export interface Bookmark {
  id: number
  title: string
  url: string
  category: string
  tags: string[]
  rating: number
  createdAt: string
  /** Short Chinese description from enrichment */
  desc?: string
  enriched?: boolean
  enrichedAt?: string
}

export type BookmarkDraft = {
  title: string
  url: string
  category: string
  tags: string[]
  rating: number
  desc: string
}

export function emptyDraft(): BookmarkDraft {
  return {
    title: '',
    url: '',
    category: '',
    tags: [],
    rating: 3,
    desc: '',
  }
}

export function draftFromBookmark(b: Bookmark): BookmarkDraft {
  return {
    title: b.title ?? '',
    url: b.url ?? '',
    category: b.category ?? '',
    tags: Array.isArray(b.tags) ? [...b.tags] : [],
    rating: typeof b.rating === 'number' ? b.rating : 3,
    desc: b.desc ?? '',
  }
}

export function newBookmarkId(): number {
  // Avoid collisions when creates fire in the same millisecond (double-submit).
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

/** Normalize URL for equality (trim + lowercase). */
export function bookmarkUrlKey(url: string): string {
  return url.trim().toLowerCase()
}

/**
 * Drop duplicate bookmarks by id, then by url (first wins).
 * Keeps list stable for React keys and local draft / remote loads.
 */
export function dedupeBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  const seenIds = new Set<number>()
  const seenUrls = new Set<string>()
  const out: Bookmark[] = []
  for (const b of bookmarks) {
    const urlKey = bookmarkUrlKey(b.url ?? '')
    if (seenIds.has(b.id)) continue
    if (urlKey && seenUrls.has(urlKey)) continue
    seenIds.add(b.id)
    if (urlKey) seenUrls.add(urlKey)
    out.push(b)
  }
  return out
}
