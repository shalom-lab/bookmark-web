import { categoryClass } from '../utils/categoryColor'

interface Props {
  categories: string[]
  counts: Record<string, number>
  selected: string
  onSelect: (category: string) => void
}

export function CategoryTabs({ categories, counts, selected, onSelect }: Props) {
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
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={selected === c}
          className={`tab-btn ${categoryClass(c)}${selected === c ? ' active' : ''}`}
          onClick={() => onSelect(selected === c ? '' : c)}
        >
          {c}
          <span className="tab-count">{counts[c] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
