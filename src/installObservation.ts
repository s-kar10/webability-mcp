import type { BrowserContext, Page, Request } from 'playwright'
import { openSession, type OpenSessionOptions } from './browser.js'
import type { InstallObservation } from './installCheck.js'

// Runs before page scripts. DOM types are deliberately confined to browser code.
const INIT = `(() => {
  const observations = { policyViolations: [], runtimeErrors: [] };
  window.__webabilityInstallObservation = observations;
  addEventListener('securitypolicyviolation', e => observations.policyViolations.push({
    blockedUrl: e.blockedURI, directive: e.effectiveDirective,
    policy: e.originalPolicy, disposition: e.disposition
  }));
  addEventListener('error', e => {
    if (e.filename) observations.runtimeErrors.push({ scriptUrl: e.filename, message: e.message });
  });
})()`

/** A URL in a stack frame, without the trailing `:line:column` the frame appends. */
const STACK_FRAME_URL = /https?:\/\/[^\s()]+/

function scriptUrlFromStack(stack: string | undefined): string | undefined {
  const found = stack?.match(STACK_FRAME_URL)?.[0]
  // A frame always carries :line:column after the URL; a port alone is not a frame.
  if (!found || !/^https?:\/\/[^/]+\/./.test(found)) return undefined
  try { return new URL(found.replace(/(?::\d+){1,2}$/, '')).href } catch { return undefined }
}

/** Overridable so tests can prove the deadline without waiting out the default. */
const DEFAULT_OBSERVATION_DEADLINE_MS = 30000

export interface ObserveInstallOptions extends OpenSessionOptions {
  /** Overall cap on the observation. Exceeding it rejects and always closes the session. */
  deadlineMs?: number
}

/** Top-level document only. No consent interaction or policy bypass. */
export async function observeInstall(url: string, options: ObserveInstallOptions = {}): Promise<InstallObservation> {
  const { deadlineMs = DEFAULT_OBSERVATION_DEADLINE_MS, ...sessionOptions } = options
  let requests: InstallObservation['requests'] = []
  let uncaught: InstallObservation['runtimeErrors'] = []
  const session = await openSession({
    ...sessionOptions,
    setupContext: async (context: BrowserContext) => {
      await sessionOptions.setupContext?.(context)
      // Reset when the shared opener retries in a fresh context.
      requests = []
      uncaught = []
      // Listeners are context-wide, so a popup the page opens reports too.
      // Only the session's own page is evidence about this page.
      let inspected: Page | undefined
      const isInspectedScript = (request: Request): boolean => {
        try {
          const frame = request.frame()
          return request.resourceType() === 'script' && frame.page() === inspected && !frame.parentFrame()
        } catch { return false } // Service-worker requests have no frame.
      }
      await context.addInitScript(INIT)
      context.on('request', (request) => {
        if (isInspectedScript(request) && !request.redirectedFrom()) requests.push({ url: request.url() })
      })
      const record = async (request: Request, failed: boolean) => {
        try {
          if (!isInspectedScript(request)) return
          let original = request
          while (original.redirectedFrom()) original = original.redirectedFrom()!
          const response = await request.response()
          // Only terminal requests: a 200 response alone is not a completed download.
          if (request.redirectedTo()) return
          const entry = requests.find((r) => r.url === original.url() && r.status === undefined && !r.failure)
          if (entry) Object.assign(entry, { ...(response ? { status: response.status() } : {}),
            ...(failed ? { failure: request.failure()?.errorText ?? 'Script request failed' } : {}) })
        } catch { /* Context closure cannot supply usable evidence. */ }
      }
      context.on('requestfinished', (r) => { void record(r, false) })
      // window 'error' is muted for cross-origin scripts without CORS ("Script error."),
      // so the page-level exception is the only record of a broken install.
      context.on('page', (page: Page) => {
        if (inspected) return
        inspected = page
        page.on('pageerror', (error: Error) => {
          const scriptUrl = scriptUrlFromStack(error.stack)
          // Child-frame exceptions surface on the Page too. Only a script the
          // inspected document itself requested is evidence about this page.
          if (scriptUrl && requests.some((r) => r.url === scriptUrl)) uncaught.push({ scriptUrl, message: error.message })
        })
      })
      context.on('requestfailed', (r) => { void record(r, true) })
    },
  })
  let deadlineTimer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_, reject) => {
    deadlineTimer = setTimeout(() => reject(new Error(`Install observation exceeded the ${deadlineMs}ms deadline`)), deadlineMs)
  })
  // A client-side redirect replaces the document during the wait, and the init
  // script reruns in the new one, so its own guard cannot see the swap. The
  // page's main-frame DOMContentLoaded is one new-document signal per document;
  // same-document history changes do not fire it.
  let documentLoads = 0
  let countedPage: Page = session.page
  const countDocument = () => { documentLoads++ }
  countedPage.on('domcontentloaded', countDocument)
  try {
    // A page can block the event loop after load, so the DOM read would never
    // settle. The deadline bounds the whole observation, not just navigation.
    return await Promise.race([inspect(), deadline])
  } finally {
    clearTimeout(deadlineTimer)
    await session.close()
  }

  async function inspect(): Promise<InstallObservation> {
    const started = Date.now()
    const response = await session.goto(url, { waitUntil: 'load', timeout: 20000 })
    if (!response || response.status() >= 400) throw new Error(`Page navigation failed: HTTP ${response?.status() ?? 'unknown'}`)
    // The shared opener retries in a fresh browser: the first load is that page's.
    if (session.page !== countedPage) {
      countedPage.off('domcontentloaded', countDocument)
      countedPage = session.page
      documentLoads = 1
      countedPage.on('domcontentloaded', countDocument)
    }
    // Bounded window for dynamically inserted embeds; not a site-wide absence claim.
    await session.page.waitForTimeout(1000)
    if (documentLoads > 1) throw new Error('Install observation was interrupted by navigation')
    const dom = await session.page.evaluate(`(() => {
      const o = window.__webabilityInstallObservation;
      if (!o) throw new Error('Install observation was interrupted by navigation');
      return { ...o, scriptElements: Array.from(document.querySelectorAll('script[src], script[data-src]')).flatMap(s => {
        const type = s.getAttribute('type') || '';
        const attributes = Object.fromEntries(['data-cookieconsent', 'data-cookiecategory', 'data-consent'].filter(k => s.hasAttribute(k)).map(k => [k, s.getAttribute(k)]));
        // src and data-src are separate candidates (consent managers keep a
        // placeholder in src). One malformed URL skips that candidate only.
        return ['src', 'data-src'].flatMap(name => {
          const raw = s.getAttribute(name);
          if (!raw) return [];
          try { return [{ src: new URL(raw, document.baseURI).href, type, attributes }] } catch { return [] }
        });
      }) };
    })()`)
    const runtimeErrors = [...dom.runtimeErrors]
    for (const e of uncaught) {
      // The window listener already reported this exception (same script, same text).
      if (!e.message || runtimeErrors.some((r) => r.scriptUrl === e.scriptUrl &&
        (r.message.includes(e.message) || e.message.includes(r.message)))) continue
      runtimeErrors.push(e)
    }
    return { ...dom, runtimeErrors, finalUrl: session.page.url(), requests, observationDurationMs: Date.now() - started }
  }
}
