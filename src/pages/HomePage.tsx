import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkCard } from '../components/BookmarkCard'
import { BookmarkFormModal } from '../components/BookmarkFormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { CategoryTabs } from '../components/CategoryTabs'
import { SearchBar } from '../components/SearchBar'
import { TagFilter } from '../components/TagFilter'
import { loadBookmarks, saveBookmarks } from '../github/client'
import {
  isConfigured,
  loadDraft,
  saveDraft,
  type LocalDraft,
} from '../github/storage'
import { friendlyGithubError, type GithubSettings } from '../github/types'
import {
  bookmarkUrlKey,
  dedupeBookmarks,
  newBookmarkId,
  type Bookmark,
  type BookmarkDraft,
} from '../types/bookmark'

interface Props {
  settings: GithubSettings
}

function matchesQuery(b: Bookmark, q: string): boolean {
  if (!q) return true
  const hay = [
    b.title,
    b.url,
    b.desc ?? '',
    b.category,
    ...(b.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term))
}

function persistLocal(
  bookmarks: Bookmark[],
  baseSha: string | null,
  dirty: boolean,
): void {
  const draft: LocalDraft = { bookmarks, baseSha, dirty }
  saveDraft(draft)
}

export function HomePage({ settings }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [sha, setSha] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Bookmark | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  const configured = isConfigured(settings)

  const applyLocal = useCallback(
    (next: Bookmark[], nextSha: string | null, nextDirty: boolean) => {
      const clean = dedupeBookmarks(next)
      setBookmarks(clean)
      setSha(nextSha)
      setDirty(nextDirty)
      persistLocal(clean, nextSha, nextDirty)
    },
    [],
  )

  const refresh = useCallback(
    async (opts?: { forceRemote?: boolean }) => {
      if (!isConfigured(settings)) {
        setBookmarks([])
        setSha(null)
        setDirty(false)
        setError(null)
        setInfo(null)
        return
      }

      const existing = loadDraft()
      if (existing?.dirty && !opts?.forceRemote) {
        // Keep local overlay; still refresh remote sha in background for RMW.
        setLoading(true)
        setError(null)
        setInfo('有未推送的本地修改，已保留本地草稿。推送或丢弃后再刷新远程。')
        const local = dedupeBookmarks(existing.bookmarks)
        setBookmarks(local)
        setDirty(true)
        try {
          const snap = await loadBookmarks(settings)
          // Keep local bookmarks/dirty; adopt latest remote sha for next push.
          setSha(snap.sha)
          persistLocal(local, snap.sha, true)
        } catch (e) {
          setSha(existing.baseSha)
          setError(friendlyGithubError(e))
        } finally {
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setError(null)
      setInfo(null)
      try {
        const snap = await loadBookmarks(settings)
        applyLocal(snap.bookmarks, snap.sha, false)
      } catch (e) {
        setError(friendlyGithubError(e))
      } finally {
        setLoading(false)
      }
    },
    [settings, applyLocal],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const b of bookmarks) {
      if (b.category) set.add(b.category)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'))
  }, [bookmarks])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of bookmarks) {
      if (b.category) map[b.category] = (map[b.category] ?? 0) + 1
    }
    return map
  }, [bookmarks])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const b of bookmarks) {
      for (const t of b.tags ?? []) {
        if (t) set.add(t)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'))
  }, [bookmarks])

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of bookmarks) {
      for (const t of b.tags ?? []) {
        if (t) map[t] = (map[t] ?? 0) + 1
      }
    }
    return map
  }, [bookmarks])

  const filtered = useMemo(() => {
    return bookmarks.filter((b) => {
      if (category && b.category !== category) return false
      if (
        selectedTags.length > 0 &&
        !selectedTags.some((t) => (b.tags ?? []).includes(t))
      ) {
        return false
      }
      return matchesQuery(b, query)
    })
  }, [bookmarks, query, category, selectedTags])

  /** RMW push current local bookmark list to GitHub. */
  const pushRemote = async (
    next: Bookmark[],
    message: string,
    opts?: { clearDirtyOnSuccess?: boolean },
  ): Promise<boolean> => {
    setPushing(true)
    setError(null)
    try {
      let currentSha = sha
      // Re-read sha if missing to avoid create-vs-update races.
      if (currentSha == null) {
        try {
          const snap = await loadBookmarks(settings)
          currentSha = snap.sha
          setSha(snap.sha)
        } catch {
          // keep null — first create
        }
      }
      const result = await saveBookmarks(settings, next, currentSha, message)
      const clearDirty = opts?.clearDirtyOnSuccess !== false
      applyLocal(next, result.sha, clearDirty ? false : dirty)
      setInfo(clearDirty ? '已推送到远程' : null)
      return true
    } catch (e) {
      setError(friendlyGithubError(e))
      if (
        e &&
        typeof e === 'object' &&
        'status' in e &&
        (e as { status: number }).status === 409
      ) {
        try {
          const snap = await loadBookmarks(settings)
          setSha(snap.sha)
          persistLocal(next, snap.sha, true)
        } catch {
          // ignore
        }
      }
      return false
    } finally {
      setPushing(false)
    }
  }

  /** Create / update: localStorage only — never push on each edit. */
  const handleSubmit = (draft: BookmarkDraft, current: Bookmark | null) => {
    const urlKey = bookmarkUrlKey(draft.url)
    let next: Bookmark[]
    if (current) {
      next = bookmarks.map((b) =>
        b.id === current.id
          ? {
              ...b,
              title: draft.title,
              url: draft.url,
              category: draft.category,
              tags: draft.tags,
              rating: draft.rating,
              desc: draft.desc || undefined,
            }
          : b,
      )
    } else {
      // Upsert by URL — blind prepend was duplicating cards on repeat add / double-submit.
      const existing = bookmarks.find((b) => bookmarkUrlKey(b.url) === urlKey)
      if (existing) {
        next = bookmarks.map((b) =>
          b.id === existing.id
            ? {
                ...b,
                title: draft.title,
                url: draft.url,
                category: draft.category,
                tags: draft.tags,
                rating: draft.rating,
                desc: draft.desc || undefined,
              }
            : b,
        )
      } else {
        const created: Bookmark = {
          id: newBookmarkId(),
          title: draft.title,
          url: draft.url,
          category: draft.category,
          tags: draft.tags,
          rating: draft.rating,
          createdAt: new Date().toISOString(),
          desc: draft.desc || undefined,
        }
        next = [created, ...bookmarks]
      }
    }
    applyLocal(next, sha, true)
    setInfo('已保存到本地，点击「推送到远程」同步到 GitHub')
    setError(null)
    setFormOpen(false)
    setEditing(null)
  }

  const requestDelete = (b: Bookmark) => {
    setPendingDelete(b)
  }

  /** Delete: confirm → localStorage only — never push on each delete. */
  const confirmDelete = () => {
    if (!pendingDelete) return
    const b = pendingDelete
    const next = bookmarks.filter((x) => x.id !== b.id)
    applyLocal(next, sha, true)
    setPendingDelete(null)
    setInfo(`已删除「${b.title}」（本地）。点击「推送到远程」同步到 GitHub`)
    setError(null)
  }

  const handlePush = async () => {
    if (!dirty) {
      setInfo('没有未推送的本地修改')
      return
    }
    const ok = await pushRemote(bookmarks, 'bookmark-web: sync local draft')
    if (ok) setInfo('本地修改已全部推送到远程')
  }

  const confirmDiscard = async () => {
    setDiscardOpen(false)
    await refresh({ forceRemote: true })
    setInfo('已丢弃本地草稿并重新加载远程')
  }

  const openCreate = () => {
    if (!configured) {
      setError('请先在设置中配置 GitHub PAT 与仓库')
      return
    }
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (b: Bookmark) => {
    setEditing(b)
    setFormOpen(true)
  }

  /** Tag capsule / sidebar: filter only — must not mutate bookmarks / draft. */
  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleRefreshClick = () => {
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    void refresh({ forceRemote: true })
  }

  return (
    <div className="page home-page">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={32}
            height={32}
          />
          <div>
            <h1>
              Bookmarks
              {dirty && (
                <span className="dirty-pill" title="有未推送的本地修改">
                  未推送
                </span>
              )}
            </h1>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={handleRefreshClick}
            disabled={!configured || loading || pushing}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
          {dirty && (
            <button
              type="button"
              className="btn push"
              onClick={() => void handlePush()}
              disabled={!configured || pushing || loading}
            >
              {pushing ? '推送中…' : '推送到远程'}
            </button>
          )}
          <button type="button" className="btn primary" onClick={openCreate}>
            + 新建
          </button>
          <Link to="/settings" className="btn">
            设置
          </Link>
          {configured && (
            <a
              className="btn github-link"
              href={`https://github.com/${settings.repo.trim()}`}
              target="_blank"
              rel="noreferrer"
              title={`在 GitHub 打开 ${settings.repo.trim()}`}
            >
              GitHub
            </a>
          )}
        </div>
      </header>

      {!configured && (
        <div className="banner warn">
          尚未设置 GitHub 密钥。请前往{' '}
          <Link to="/settings">设置</Link> 填写 PAT 与 owner/repo，或事先写入
          localStorage 键 <code>gh-bookmark-token</code> /{' '}
          <code>gh-bookmark-repo</code>（启动会自动读）。
        </div>
      )}

      {dirty && (
        <div className="banner warn">
          本地有未推送的修改（保存在 <code>gh-bookmark-local-draft</code>
          ）。新建、编辑、删除仅写本地；点击「推送到远程」批量 RMW 同步到 GitHub。
        </div>
      )}

      {info && !error && <div className="banner success">{info}</div>}
      {error && <div className="banner error">{error}</div>}

      <SearchBar
        value={query}
        onChange={setQuery}
        count={filtered.length}
        total={bookmarks.length}
      />

      <CategoryTabs
        categories={categories}
        counts={categoryCounts}
        selected={category}
        onSelect={setCategory}
      />

      <div className="main-content">
        {allTags.length > 0 && (
          <TagFilter
            tags={allTags}
            counts={tagCounts}
            selected={selectedTags}
            onChange={setSelectedTags}
          />
        )}

        <div className="prompt-list">
          {loading && bookmarks.length === 0 ? (
            <div className="empty-state">正在从 GitHub 加载…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              {bookmarks.length === 0
                ? configured
                  ? '暂无书签，点击「新建」添加第一条。'
                  : '配置仓库后即可加载书签。'
                : '没有匹配的书签，试试调整搜索、分类或标签。'}
            </div>
          ) : (
            <div className="card-grid">
              {filtered.map((b) => (
                <BookmarkCard
                  key={`${b.id}-${b.url}`}
                  bookmark={b}
                  onEdit={openEdit}
                  onDelete={requestDelete}
                  onTagClick={handleTagClick}
                  activeTags={selectedTags}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BookmarkFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        busy={false}
      />

      <ConfirmModal
        open={pendingDelete !== null}
        title="删除书签"
        message={
          pendingDelete
            ? `确定删除「${pendingDelete.title}」？将先保存到本地，点击「推送到远程」后再同步到 GitHub。`
            : ''
        }
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        busy={false}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmModal
        open={discardOpen}
        title="丢弃本地修改？"
        message="有未推送的本地草稿。刷新将丢弃本地修改并重新加载远程数据。"
        confirmLabel="丢弃并刷新"
        cancelLabel="取消"
        danger
        busy={loading}
        onConfirm={() => void confirmDiscard()}
        onCancel={() => {
          if (!loading) setDiscardOpen(false)
        }}
      />
    </div>
  )
}
