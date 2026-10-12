import type { Bookmark } from '../types/bookmark'
import { DEFAULT_SETTINGS, type GithubSettings } from './types'

/** Flat, hyphenated BYOK keys — mandatory convention. */
export const KEY_TOKEN = 'gh-bookmark-token'
export const KEY_REPO = 'gh-bookmark-repo'

/**
 * Local working copy of all_bookmarks (overlay). Not a secret.
 * Shape: { bookmarks, baseSha, dirty }
 */
export const KEY_DRAFT = 'gh-bookmark-local-draft'

/**
 * Silently read both keys from localStorage into settings shape.
 * No modal interrupt — call on App start.
 */
export function loadSettings(): GithubSettings {
  try {
    return {
      token: localStorage.getItem(KEY_TOKEN) ?? '',
      repo: localStorage.getItem(KEY_REPO) ?? '',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** save = setItem for each flat key (never a JSON blob of secrets). */
export function saveSettings(settings: GithubSettings): void {
  localStorage.setItem(KEY_TOKEN, settings.token.trim())
  localStorage.setItem(KEY_REPO, settings.repo.trim())
}

/** clear = removeItem for both keys. */
export function clearSettings(): void {
  localStorage.removeItem(KEY_TOKEN)
  localStorage.removeItem(KEY_REPO)
}

export function isConfigured(settings: GithubSettings): boolean {
  return Boolean(settings.token.trim() && settings.repo.trim().includes('/'))
}

export type LocalDraft = {
  bookmarks: Bookmark[]
  /** Remote file sha this draft was based on (null if file did not exist). */
  baseSha: string | null
  /** True when local edits have not been pushed to GitHub. */
  dirty: boolean
}

function normalizeDraftBookmarks(data: unknown): Bookmark[] {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    const b = item as Partial<Bookmark>
    return {
      id: typeof b.id === 'number' ? b.id : Date.now(),
      title: String(b.title ?? ''),
      url: String(b.url ?? ''),
      category: String(b.category ?? 'Default'),
      tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
      rating: typeof b.rating === 'number' ? b.rating : 3,
      createdAt: String(b.createdAt ?? new Date().toISOString()),
      desc: b.desc != null ? String(b.desc) : undefined,
      enriched: b.enriched === true ? true : undefined,
      enrichedAt: b.enrichedAt != null ? String(b.enrichedAt) : undefined,
    }
  })
}

/** Read local all_bookmarks overlay; null if missing/invalid. */
export function loadDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(KEY_DRAFT)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalDraft>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      bookmarks: normalizeDraftBookmarks(parsed.bookmarks),
      baseSha: typeof parsed.baseSha === 'string' ? parsed.baseSha : null,
      dirty: parsed.dirty === true,
    }
  } catch {
    return null
  }
}

/** Persist local overlay (full bookmarks array + dirty flag). */
export function saveDraft(draft: LocalDraft): void {
  localStorage.setItem(
    KEY_DRAFT,
    JSON.stringify({
      bookmarks: draft.bookmarks,
      baseSha: draft.baseSha,
      dirty: draft.dirty,
    }),
  )
}

export function clearDraft(): void {
  localStorage.removeItem(KEY_DRAFT)
}
