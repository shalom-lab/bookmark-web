import {
  BOOKMARKS_PATH,
  DEFAULT_BRANCH,
  GithubApiError,
  parseRepo,
  type GithubFileContent,
  type GithubSettings,
  type ParsedRepo,
} from './types'
import { dedupeBookmarks, type Bookmark } from '../types/bookmark'

/**
 * Prefer direct browser → api.github.com (GitHub supports CORS).
 * If that fails with a network/CORS error, fall back to the Vite proxy (dev only).
 */
let useProxy = false

function baseUrl(): string {
  return useProxy ? '/api/github' : 'https://api.github.com'
}

function requireRepo(settings: GithubSettings): ParsedRepo {
  const parsed = parseRepo(settings.repo)
  if (!parsed) {
    throw new GithubApiError(422, '仓库格式无效，请使用 owner/repo')
  }
  return parsed
}

async function githubFetch(
  settings: GithubSettings,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${baseUrl()}${path}`
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('Authorization', `Bearer ${settings.token.trim()}`)
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  // Do not set Cache-Control: it is not CORS-safelisted and api.github.com
  // preflight rejects it. Cache bust via query _=timestamp + cache:'no-store'.
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch (networkErr) {
    if (!useProxy && import.meta.env.DEV) {
      useProxy = true
      try {
        return await githubFetch(settings, path, init)
      } catch {
        useProxy = false
        throw networkErr
      }
    }
    throw networkErr
  }

  return res
}

async function parseError(res: Response): Promise<never> {
  let message = res.statusText || 'Unknown error'
  try {
    const body = (await res.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // ignore
  }
  throw new GithubApiError(res.status, message)
}

function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function decodeBase64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function normalizeBookmarks(data: unknown): Bookmark[] {
  if (!Array.isArray(data)) {
    throw new GithubApiError(422, 'all_bookmarks.json 应为 JSON 数组')
  }
  const base = Date.now()
  const mapped = data.map((item, index) => {
    const b = item as Partial<Bookmark>
    return {
      // Unique fallback per row — plain Date.now() collides across the map.
      id: typeof b.id === 'number' && Number.isFinite(b.id) ? b.id : base + index,
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
  return dedupeBookmarks(mapped)
}

export type BookmarksSnapshot = {
  bookmarks: Bookmark[]
  sha: string | null
}

/** Read data/all_bookmarks.json via Contents API (with sha for RMW). */
export async function loadBookmarks(
  settings: GithubSettings,
): Promise<BookmarksSnapshot> {
  const { owner, name } = requireRepo(settings)
  const bust = `_=${Date.now()}`
  const apiPath = `/repos/${owner}/${name}/contents/${BOOKMARKS_PATH}?ref=${encodeURIComponent(DEFAULT_BRANCH)}&${bust}`
  const res = await githubFetch(settings, apiPath)

  if (res.status === 404) {
    const repoRes = await githubFetch(settings, `/repos/${owner}/${name}`)
    if (!repoRes.ok) await parseError(repoRes)
    // File missing — start empty; first save creates it.
    return { bookmarks: [], sha: null }
  }
  if (!res.ok) await parseError(res)

  const data = (await res.json()) as GithubFileContent
  if (data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new GithubApiError(422, '无法解码文件内容')
  }
  const text = decodeBase64ToUtf8(data.content)
  const parsed = JSON.parse(text) as unknown
  return { bookmarks: normalizeBookmarks(parsed), sha: data.sha }
}

/**
 * Write the full bookmarks array back to all_bookmarks.json.
 * Read-modify-write: caller must pass the latest sha (or undefined to create).
 */
export async function saveBookmarks(
  settings: GithubSettings,
  bookmarks: Bookmark[],
  sha: string | null,
  message: string,
): Promise<{ sha: string }> {
  const { owner, name } = requireRepo(settings)
  const apiPath = `/repos/${owner}/${name}/contents/${BOOKMARKS_PATH}`
  const contentText = `${JSON.stringify(bookmarks, null, 2)}\n`
  const body: Record<string, string> = {
    message,
    content: encodeUtf8ToBase64(contentText),
    branch: DEFAULT_BRANCH,
  }
  if (sha) body.sha = sha

  const res = await githubFetch(settings, apiPath, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res)
  const data = (await res.json()) as { content: { sha: string } }
  return { sha: data.content.sha }
}

export async function testConnection(settings: GithubSettings): Promise<string> {
  const { owner, name } = requireRepo(settings)
  const path = `/repos/${owner}/${name}`
  const res = await githubFetch(settings, path)
  if (!res.ok) await parseError(res)
  const data = (await res.json()) as { full_name: string; private: boolean }
  return `${data.full_name}${data.private ? ' (private)' : ' (public)'}`
}
