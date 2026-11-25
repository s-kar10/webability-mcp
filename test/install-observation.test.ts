process.env.WEBABILITY_SCAN_TELEMETRY = 'off'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkInstall } from '../src/installCheck.ts'
import { observeInstall } from '../src/installObservation.ts'
import type { Route } from 'playwright'

const SITE = 'https://site.example/'
const SCRIPT = 'https://enhancer.webability.io/widget.min.js'
// Real Chromium, deterministic routed responses: no live CDN or external site.
for (const scenario of ['present', 'blocked', 'error', 'absent', '404', 'client-block', 'consent', 'data-src-consent', 'navigation-error']) {
  test(`browser install observation: ${scenario}`, async () => {
    let requested = false
    const observe = (url: string) => observeInstall(url, { setupContext: async (context) => {
      await context.route('**/*', async (route: any) => {
        if (route.request().url() === SCRIPT) {
          requested = true
          if (scenario === 'client-block') return route.abort('blockedbyclient')
          return route.fulfill({ status: scenario === '404' ? 404 : 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' },
            body: scenario === 'error' ? 'throw new Error("widget failure")' : 'window.widgetLoaded = true' })
        }
        const consent = scenario.includes('consent')
        const html = scenario === 'absent' ? '<p>No embed</p>' : `<script ${scenario === 'data-src-consent' ? 'data-src' : 'src'}="${SCRIPT}" crossorigin="anonymous" ${consent ? 'type="text/plain" data-cookieconsent="marketing"' : ''}></script>`
        return route.fulfill({ status: scenario === 'navigation-error' ? 503 : 200, contentType: 'text/html',
          headers: scenario === 'blocked' ? { 'content-security-policy': "script-src 'self'" } : {}, body: html })
      })
    } })
    if (scenario === 'navigation-error') {
      await assert.rejects(checkInstall(SITE, { observe }), /HTTP 503/)
      return
    }
    const result = await checkInstall(SITE, { observe })
    const expected = scenario === 'absent' ? 'not_installed' : scenario.includes('consent') ? 'blocked' : ['404', 'client-block'].includes(scenario) ? 'error' : scenario
    assert.equal(result.state, expected, JSON.stringify(result))
    assert.ok(result.evidence.length)
    const kind = scenario.includes('consent') ? 'consent' : ({ present: 'script', blocked: 'security_policy', error: 'script_error', absent: 'absence', '404': 'script_load', 'client-block': 'script_load' } as Record<string, string>)[scenario]
    assert.equal(result.evidence[0].kind, kind)
    if (scenario.includes('consent')) assert.equal(requested, false)
  })
}

// Real customers paste the tag without crossorigin, and the script host sends
// no CORS header. Chromium mutes window 'error' details for such scripts, so
// the uncaught exception must still reach the observation.
test('browser install observation: error-no-cors', async () => {
  const observe = (url: string) => observeInstall(url, { setupContext: async (context) => {
    await context.route('**/*', async (route: { request(): { url(): string }; fulfill(o: object): Promise<unknown> }) => {
      if (route.request().url() === SCRIPT) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("widget failure")' })
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<script src="${SCRIPT}"></script>` })
    })
  } })

  const result = await checkInstall(SITE, { observe })

  assert.equal(result.state, 'error', JSON.stringify(result))
  const evidence = result.evidence.find((e) => e.kind === 'script_error')
  assert.equal(evidence?.kind, 'script_error', JSON.stringify(result))
  assert.equal((evidence as { scriptUrl: string }).scriptUrl, SCRIPT)
})

// Context-wide listeners also see popups: an embed loaded only by a popup the
// page opened is not evidence that the inspected page loads it.
test('browser install observation: popup embed is not the inspected page', async () => {
  const POPUP = 'https://site.example/popup'
  let popupRequested = false
  const observe = (url: string) => observeInstall(url, { setupContext: async (context) => {
    await context.route('**/*', async (route: Route) => {
      const requestUrl = route.request().url()
      if (requestUrl === SCRIPT) {
        popupRequested = true
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.widgetLoaded = true' })
      }
      if (requestUrl === POPUP) {
        return route.fulfill({ status: 200, contentType: 'text/html', body: `<script src="${SCRIPT}"></script>` })
      }
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<p>No embed</p><script>window.open('${POPUP}')</script>` })
    })
  } })

  const result = await checkInstall(SITE, { observe })

  // The popup did load the embed, so an empty result means the filter worked.
  assert.equal(popupRequested, true)
  assert.equal(result.state, 'not_installed', JSON.stringify(result))
  assert.equal(result.evidence[0].kind, 'absence')
})

// A client-side redirect loads a new document during the wait, so the observed
// document is not the one that was navigated to.
test('browser install observation: client redirect during the window interrupts', async () => {
  const OTHER = 'https://site.example/other'
  const observe = (url: string) => observeInstall(url, { setupContext: async (context) => {
    await context.route('**/*', async (route: Route) => {
      const requestUrl = route.request().url()
      if (requestUrl === OTHER) return route.fulfill({ status: 503, contentType: 'text/html', body: '<p>Unavailable</p>' })
      return route.fulfill({ status: 200, contentType: 'text/html',
        body: `<p>No embed</p><script>setTimeout(() => { location.href = '${OTHER}' }, 100)</script>` })
    })
  } })

  await assert.rejects(checkInstall(SITE, { observe }), /interrupted by navigation/)
})

// Same-document history changes are not new documents and must not interrupt.
test('browser install observation: pushState during the window is not a navigation', async () => {
  const observe = (url: string) => observeInstall(url, { setupContext: async (context) => {
    await context.route('**/*', async (route: Route) => route.fulfill({ status: 200, contentType: 'text/html',
      body: `<p>No embed</p><script>setTimeout(() => history.pushState({}, '', '/pushed'), 100)</script>` }))
  } })

  const result = await checkInstall(SITE, { observe })

  assert.equal(result.state, 'not_installed', JSON.stringify(result))
})
