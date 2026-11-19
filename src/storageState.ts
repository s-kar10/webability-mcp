/**
 * Logged-in scans. `storageState` is a path to a Playwright storage-state
 * JSON file (cookies + localStorage per origin), made by logging in once in a
 * real browser (`webability flow <url> --save-storage-state auth.json`).
 *
 * Local (stdio) only. The hosted server refuses the argument on key presence,
 * before anything is read, so it never takes a path, cookies or headers.
 * Design: docs/logged-in-scanning.md.
 */
import { readFileSync } from 'node:fs'
import { collectAuthWallEvidenceInPage, judgeAuthWall } from '@webability/core'
import { resolve } from 'node:path'

/** Tools that open the browser with the state. Every other tool refuses the argument. */
export const STORAGE_STATE_TOOLS = new Set(['scan_page', 'flow_scan'])

export interface StorageState {
  cookies: unknown[]
  origins: unknown[]
}

export const STORAGE_STATE_PROPERTY = {
  storageState: {
    type: 'string',
    description:
      'Local MCP only. Path to a Playwright storage-state JSON file (cookies + localStorage) for pages behind a login. Make one by logging in once: `npx @webability/cli flow <login-url> --save-storage-state auth.json`. The hosted server refuses this argument.',
  },
} as const

/** Error text for a call that may not carry `storageState`, or null when it may. */
export function storageStateRefusal(tool: string, args: Record<string, unknown> | undefined, remote: boolean): string | null {
  if (!args || !Object.prototype.hasOwnProperty.call(args, 'storageState')) return null
  if (remote) {
    return 'storageState is refused on the hosted MCP server: it never takes cookies, sessions or files. Logged-in scans run only in the local MCP (`npx -y @webability/mcp`), where the session file stays on your machine.'
  }
  if (!STORAGE_STATE_TOOLS.has(tool)) {
    return `${tool} does not take storageState, so it would scan logged out. Use scan_page or flow_scan for pages behind a login.`
  }
  if (typeof args.storageState !== 'string' || !args.storageState.trim()) {
    return 'storageState must be a file path (string) to a Playwright storage-state JSON file, not inline cookies.'
  }
  return null
}

/** Read and check the file. Throws with the absolute path in the message. */
export function loadStorageState(rawPath: string, cwd: string = process.cwd()): { path: string; state: StorageState } {
  const path = resolve(cwd, rawPath)
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    throw new Error(`storageState file not readable: ${path}${code ? ` (${code})` : ''}. Make one with \`npx @webability/cli flow <login-url> --save-storage-state ${rawPath}\`.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`storageState file is not JSON: ${path}`)
  }
  const s = parsed as Partial<StorageState> | null
  if (!s || typeof s !== 'object' || !Array.isArray(s.cookies) || !Array.isArray(s.origins)) {
    throw new Error(`storageState file is not a Playwright storage state (needs "cookies" and "origins" arrays): ${path}`)
  }
  return { path, state: { cookies: s.cookies, origins: s.origins } }
}

/**
 * Core's sign-in-page verdict (helpers/authWall.ts): a visible password or
 * OAuth-only wall plus two corroborating signals. A plain redirect inside the
 * app is not one, so it is scanned normally.
 */
export function isAuthWall(blocked: { signal?: string } | undefined | null): boolean {
  return typeof blocked?.signal === 'string' && blocked.signal.startsWith('auth-wall:')
}

/** Appended to core's "landed on a sign-in page" reason when no session was given. */
export function authWallHint(remote: boolean): string {
  return remote
    ? ' To scan pages behind a login, run the local MCP (`npx -y @webability/mcp`) and pass `storageState`, a session file saved after logging in once.'
    : ' To scan pages behind a login, pass `storageState`: a session file saved after logging in once (`npx @webability/cli flow <login-url> --save-storage-state auth.json`).'
}

export const SESSION_EXPIRED_NOTE = (urls: string[]) =>
  `Warning: ${urls.length} page(s) landed on a sign-in page while using storageState — the session has likely expired (or this account cannot open the page). They were NOT scanned as the app: ${urls.join(', ')}. Log in again with \`npx @webability/cli flow <login-url> --save-storage-state <file>\` and retry.`

/**
 * An app with a stale session often renders its shell, then bounces to the
 * login route once its API call fails: after core's pre-scan check ran. When
 * the URL moved during the scan, ask core's verdict again on the page as it is
 * now. Null when the URL did not move or it is not a sign-in page.
 */
export async function lateAuthWall(page: any, requestedUrl: string, urlBeforeScan: string): Promise<{ reason: string; finalUrl: string } | null> {
  try {
    if (page.url() === urlBeforeScan) return null
    await page.waitForLoadState?.('domcontentloaded', { timeout: 5000 }).catch(() => {})
    const evidence = await page.evaluate(collectAuthWallEvidenceInPage)
    const wall = judgeAuthWall(evidence, requestedUrl, page.url())
    return wall ? { reason: wall.reason, finalUrl: wall.finalUrl } : null
  } catch {
    return null
  }
}
