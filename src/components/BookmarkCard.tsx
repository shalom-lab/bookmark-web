import type { Bookmark } from '../types/bookmark'
import { TagCapsule } from './TagCapsule'

interface Props {
  bookmark: Bookmark
  onEdit: (b: Bookmark) => void
  onDelete: (b: Bookmark) => void
  onTagClick: (tag: string) => void
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function stars(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

export function BookmarkCard({ bookmark, onEdit, onDelete, onTagClick }: Props) {
  return (
    <article className="bookmark-card">
      <div className="card-top">
        {bookmark.category && (
          <span className="category-pill">{bookmark.category}</span>
        )}
        <span className="rating" title={`评分 ${bookmark.rating}`}>
          {stars(bookmark.rating)}
        </span>
      </div>

      <h3 className="card-title">
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          {bookmark.title || '(无标题)'}
        </a>
      </h3>

      <p className="card-host">{hostOf(bookmark.url)}</p>

      {bookmark.desc && <p className="card-desc">{bookmark.desc}</p>}

      {bookmark.tags.length > 0 && (
        <div className="card-tags">
          {bookmark.tags.map((t) => (
            <TagCapsule key={t} label={t} onClick={() => onTagClick(t)} />
          ))}
        </div>
      )}

      <footer className="card-actions">
        <button type="button" className="btn ghost" onClick={() => onEdit(bookmark)}>
          编辑
        </button>
        <button
          type="button"
          className="btn ghost danger-text"
          onClick={() => onDelete(bookmark)}
        >
          删除
        </button>
      </footer>
    </article>
  )
}
