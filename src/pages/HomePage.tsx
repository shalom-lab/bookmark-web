import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkCard } from '../components/BookmarkCard'
import { BookmarkFormModal } from '../components/BookmarkFormModal'
import { SearchBar } from '../components/SearchBar'
import { loadBookmarks, saveBookmarks } from '../github/client'
import { isConfigured } from '../github/storage'
import { friendlyGithubError, type GithubSettings } from '../github/types'
import {
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

export function HomePage({ settings }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [sha, setSha] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Bookmark | null>(null)

  const configured = isConfigured(settings)

  const refresh = useCallback(async () => {
    if (!isConfigured(settings)) {
      setBookmarks([])
      setSha(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const snap = await loadBookmarks(settings)
      setBookmarks(snap.bookmarks)
      setSha(snap.sha)
    } catch (e) {
      setError(friendlyGithubError(e))
    } finally {
      setLoading(false)
    }
  }, [settings])

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

  const filtered = useMemo(() => {
    return bookmarks.filter((b) => {
      if (category && b.category !== category) return false
      return matchesQuery(b, query)
    })
  }, [bookmarks, query, category])

  const persist = async (
    next: Bookmark[],
    message: string,
  ): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      const result = await saveBookmarks(settings, next, sha, message)
      setBookmarks(next)
      setSha(result.sha)
      return true
    } catch (e) {
      setError(friendlyGithubError(e))
      // Re-fetch sha on conflict so next save can succeed
      if (
        e &&
        typeof e === 'object' &&
        'status' in e &&
        (e as { status: number }).status === 409
      ) {
        try {
          const snap = await loadBookmarks(settings)
          setSha(snap.sha)
        } catch {
          // ignore
        }
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (draft: BookmarkDraft, current: Bookmark | null) => {
    let next: Bookmark[]
    let message: string
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
      message = `bookmark-web: update ${draft.title}`
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
      message = `bookmark-web: add ${draft.title}`
    }
    const ok = await persist(next, message)
    if (ok) {
      setFormOpen(false)
      setEditing(null)
    }
  }

  const handleDelete = async (b: Bookmark) => {
    if (!confirm(`确定删除「${b.title}」？将写入 GitHub 仓库。`)) return
    const next = bookmarks.filter((x) => x.id !== b.id)
    await persist(next, `bookmark-web: delete ${b.title}`)
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

  return (
    <div className="page home-page">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <h1>Bookmarks</h1>
            <p className="subtitle">
              {configured ? settings.repo : '未配置仓库'} · data/all_bookmarks.json
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void refresh()}
            disabled={!configured || loading}
          >
            {loading ? '加载中…' : '刷新'}
          </button>
          <button type="button" className="btn primary" onClick={openCreate}>
            + 新建
          </button>
          <Link to="/settings" className="btn">
            设置
          </Link>
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

      {error && <div className="banner error">{error}</div>}

      <SearchBar
        value={query}
        onChange={setQuery}
        category={category}
        categories={categories}
        onCategoryChange={setCategory}
        count={filtered.length}
        total={bookmarks.length}
      />

      {loading && bookmarks.length === 0 ? (
        <div className="empty-state">正在从 GitHub 加载…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {bookmarks.length === 0
            ? configured
              ? '暂无书签，点击「新建」添加第一条。'
              : '配置仓库后即可加载书签。'
            : '没有匹配的书签，试试调整搜索或分类。'}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              onEdit={openEdit}
              onDelete={(x) => void handleDelete(x)}
              onTagClick={(tag) => setQuery(tag)}
            />
          ))}
        </div>
      )}

      <BookmarkFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          if (!saving) {
            setFormOpen(false)
            setEditing(null)
          }
        }}
        onSubmit={(d, cur) => void handleSubmit(d, cur)}
        busy={saving}
      />
    </div>
  )
}
