/**
 * The engine's Page for scan_page / diff_scan (DESIGN M-1 cutover step 2).
 *
 * A browser session from openSession (local Chromium on stdio, the hosted
 * browser on the HTTP server). Every call reads `session.page` when it runs,
 * because the HTTP/2 retry in session.goto swaps the page for one in a fresh
 * browser; navigation goes through session.goto for that retry. Routes (SSRF
 * guard, tunnel header) live on the session's context, so the engine's own
 * goto carries them.
 */
import { fromPlaywright, isOwnWidgetAsset, type Page } from '@webability/core/engine'
import type { BrowserSession } from './browser.js'

export function sessionPage(session: BrowserSession): Page {
  const p = () => session.page
  const page = fromPlaywright({
    goto: (url, o) => session.goto(url, o),
    evaluate: (fn, arg) => p().evaluate(fn, arg),
    screenshot: (o) => p().screenshot(o),
    keyboard: { press: (k) => p().keyboard.press(k) },
    waitForLoadState: (s, o) => p().waitForLoadState(s, o),
    url: () => p().url(),
    addScriptTag: (o) => p().addScriptTag(o),
    // The engine blocks our own widget through a route. Page routes run before
    // the context's SSRF / tunnel routes, and `fallback` hands every other
    // request to them, so their guards still decide.
    route: (u, h) => p().route(u, h),
    unroute: (u, h) => p().unroute(u, h),
  })
  // axe scans iframes through the live page (read per call: the retry swaps it).
  return { ...page, playwrightPage: () => p() }
}

/**
 * Keep our own widget off the page, on the CONTEXT: an HTTP/2 retry builds a
 * new browser, context and page (browser.ts), which drops any page-level
 * route the engine installed — and then the widget would load while the run
 * still reported the source view. `setupContext` runs again for the retry, so
 * the guard covers it. Abort-only, and its predicate matches only our widget's
 * URLs: every other request never enters this handler, so the caller's routes
 * (SSRF, tunnel) still decide it.
 */
export async function installOwnWidgetRoute(context: { route: (url: (u: URL) => boolean, handler: (route: { abort(reason?: string): Promise<void> }) => unknown) => Promise<unknown> }): Promise<void> {
  await context.route(
    (u) => isOwnWidgetAsset(u.href),
    (route) => Promise.resolve(route.abort('blockedbyclient')).catch(() => undefined),
  )
}
