import { useMemo, useState } from 'react'

interface Props {
  tags: string[]
  counts: Record<string, number>
  selected: string[]
  onChange: (tags: string[]) => void
}

const PREVIEW = 20

export function TagFilter({ tags, counts, selected, onChange }: Props) {
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q
      ? tags.filter((t) => t.toLowerCase().includes(q))
      : tags
    return showAll ? list : list.slice(0, PREVIEW)
  }, [tags, filter, showAll])

  const totalFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? tags.filter((t) => t.toLowerCase().includes(q)).length : tags.length
  }, [tags, filter])

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  const clear = () => onChange([])

  return (
    <aside className="filters">
      <div className="filter-section">
        <div className="filter-section-header">
          <h3>标签</h3>
          {selected.length > 0 && (
            <button type="button" className="btn ghost filter-clear" onClick={clear}>
              清除 ({selected.length})
            </button>
          )}
        </div>
        <div className="keyword-search">
          <input
            type="search"
            className="keyword-search-input"
            placeholder="搜索标签…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setShowAll(false)
            }}
            spellCheck={false}
            aria-label="搜索标签"
          />
        </div>
        <div className="keywords">
          {filtered.length === 0 ? (
            <p className="filter-empty">无匹配标签</p>
          ) : (
            filtered.map((tag) => {
              const checked = selected.includes(tag)
              return (
                <label key={tag} className="filter-label keyword-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(tag)}
                  />
                  <span className="checkmark" aria-hidden />
                  <span className="label-text">{tag}</span>
                  <span className="tag-count">{counts[tag] ?? 0}</span>
                </label>
              )
            })
          )}
        </div>
        {!showAll && totalFiltered > PREVIEW && (
          <button
            type="button"
            className="show-more-btn"
            onClick={() => setShowAll(true)}
          >
            显示更多 ({totalFiltered - PREVIEW}+)
          </button>
        )}
      </div>
    </aside>
  )
}
