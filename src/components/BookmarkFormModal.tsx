import { useEffect, useState } from 'react'
import {
  draftFromBookmark,
  emptyDraft,
  type Bookmark,
  type BookmarkDraft,
} from '../types/bookmark'

interface Props {
  open: boolean
  initial: Bookmark | null
  onClose: () => void
  onSubmit: (draft: BookmarkDraft, editing: Bookmark | null) => void
  busy: boolean
}

export function BookmarkFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  busy,
}: Props) {
  const [draft, setDraft] = useState<BookmarkDraft>(emptyDraft())
  const [tagsText, setTagsText] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      const d = draftFromBookmark(initial)
      setDraft(d)
      setTagsText(d.tags.join(', '))
    } else {
      setDraft(emptyDraft())
      setTagsText('')
    }
    setErr(null)
  }, [open, initial])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const title = draft.title.trim()
    const url = draft.url.trim()
    if (!title) {
      setErr('请填写标题')
      return
    }
    if (!url) {
      setErr('请填写 URL')
      return
    }
    try {
      // Validate URL
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      setErr('URL 格式无效')
      return
    }
    const tags = tagsText
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    onSubmit({ ...draft, title, url, tags, category: draft.category.trim() || 'Default' }, initial)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{initial ? '编辑书签' : '新建书签'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>标题</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="书签标题"
              autoFocus
            />
          </label>

          <label className="field">
            <span>URL</span>
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://…"
              spellCheck={false}
            />
          </label>

          <label className="field">
            <span>简介</span>
            <textarea
              rows={3}
              value={draft.desc}
              onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
              placeholder="一两句中文简介（可选）"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>分类</span>
              <input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="如 Web / AI"
              />
            </label>
            <label className="field">
              <span>评分 (1–5)</span>
              <input
                type="number"
                min={1}
                max={5}
                value={draft.rating}
                onChange={(e) =>
                  setDraft({ ...draft, rating: Number(e.target.value) || 3 })
                }
              />
            </label>
          </div>

          <label className="field">
            <span>标签（逗号分隔）</span>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="工具, 录屏"
              spellCheck={false}
            />
          </label>

          {err && <div className="banner error">{err}</div>}

          <footer className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              取消
            </button>
            <div className="spacer" />
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? '保存中…' : '保存到本地'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
