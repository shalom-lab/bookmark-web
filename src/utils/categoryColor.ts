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

/** Saturated palette — used for active/hit state and card badges. */
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

/** Mix hex toward white (0 = original, 1 = white). */
function mixWhite(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.round((num >> 16) + (255 - (num >> 16)) * amount)
  const g = Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount)
  const b = Math.round((num & 0xff) + (255 - (num & 0xff)) * amount)
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
      const light = mixWhite(color, 0.72)
      const lightEnd = mixWhite(color, 0.58)
      const style = document.createElement('style')
      style.setAttribute('data-category', category)
      // Card badges stay saturated; top tabs idle = pastel, .active = saturated (current hit color)
      style.textContent = [
        `.${cls}{background:linear-gradient(135deg,${color},${adjustColor(color, -20)});}`,
        `.tab-btn.${cls}{background:linear-gradient(135deg,${light},${lightEnd});color:#334155;}`,
        `.tab-btn.${cls} .tab-count{background:rgba(15,23,42,0.1);color:#475569;}`,
        `.tab-btn.${cls}.active{background:linear-gradient(135deg,${color},${adjustColor(color, -20)});color:#fff;}`,
        `.tab-btn.${cls}.active .tab-count{background:rgba(255,255,255,0.28);color:#fff;}`,
      ].join('')
      document.head.appendChild(style)
    }
  }
  return cls
}

export function categoryColor(category: string): string {
  if (!category) return '#64748b'
  return COLORS[hashCode(category) % COLORS.length]
}
