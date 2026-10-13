import { categoryClass } from '../utils/categoryColor'

interface Props {
  categories: string[]
  counts: Record<string, number>
  selected: string
  /** Categories present in the current filtered result set (tag/search hit). */
  hitCategories?: Set<string> | string[]
  onSelect: (category: string) => void
}

export function CategoryTabs({
  categories,
  counts,
  selected,
  hitCategories,
  onSelect,
}: Props) {
  const hit =
    hitCategories instanceof Set
      ? hitCategories
      : new Set(hitCategories ?? [])

  return (
    <div className="category-tabs" role="tablist" aria-label="按分类筛选">
      <button
        type="button"
        role="tab"
        aria-selected={selected === ''}
        className={`tab-btn tab-btn-all${selected === '' ? ' active' : ''}`}
        onClick={() => onSelect('')}
      >
        全部
      </button>
      {categories.map((c) => {
        const isActive = selected === c
        const isHit = !isActive && hit.has(c)
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-btn ${categoryClass(c)}${isActive ? ' active' : ''}${isHit ? ' hit' : ''}`}
            onClick={() => onSelect(selected === c ? '' : c)}
          >
            {c}
            <span className="tab-count">{counts[c] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
