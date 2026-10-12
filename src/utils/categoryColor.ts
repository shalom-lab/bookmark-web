/** Hash a category string to a stable index (same approach as awesome-prompt). */
export function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const COLORS = [
  '#FF4D4D',
  '#7C3AED',
  '#2DD4BF',
  '#F59E0B',
  '#EC4899',
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#6366F1',
  '#84CC16',
]

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent))
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent))
  return '#' + ((b | (g << 8) | (r << 16)) >>> 0).toString(16).padStart(6, '0')
}

/** Return CSS class name + inject gradient style once per category. */
export function categoryClass(category: string): string {
  if (!category) return 'category-default'
  const h = hashCode(category)
  const cls = `category-${h}`
  if (typeof document !== 'undefined') {
    const attr = `data-category="${category}"`
    if (!document.querySelector(`style[${attr}]`)) {
      const color = COLORS[h % COLORS.length]
      const style = document.createElement('style')
      style.setAttribute('data-category', category)
      style.textContent = `.${cls}{background:linear-gradient(135deg,${color},${adjustColor(color, -20)});}`
      document.head.appendChild(style)
    }
  }
  return cls
}

export function categoryColor(category: string): string {
  if (!category) return '#64748b'
  return COLORS[hashCode(category) % COLORS.length]
}
