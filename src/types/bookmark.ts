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
  return Date.now()
}
