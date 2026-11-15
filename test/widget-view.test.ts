/**
 * scan_page names which DOM it measured (core's EngineWidgetView).
 *
 * A page that installs our own widget exists in two states: the site's own
 * markup, and the visitor's view with our widget's patches applied. A scan that
 * does not say which one it read lets a caller diff the two and report the
 * widget's own patches as the customer's markup (or as regressions). So:
 *
 * - default ('blocked'): our widget's bundle request is refused BEFORE the
 *   navigation, so it never reaches the network. Proven with a route that
 *   counts how many of our widget requests got through: zero.
 * - 'applied' (widgetView: "applied"): the bundle loads, the widget's
 *   completion flag arrives, and the result is the visitor-verified view.
 * - the flag never arriving is a clean timeout, reported as unknown, never as
 *   the source view.
 */
process.env.WEBABILITY_SCAN_TELEMETRY = 'off'
process.env.WEBABILITY_SCAN_LOG = 'off'
delete process.env.OPENROUTER_API_KEY

import assert from 'node:assert/strict'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { after, before, test } from 'node:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { openSession } from '../src/browser.ts'
import { createServer, scanPageOnEngine } from '../src/server.ts'

const WIDGET_URL = 'https://widget.webability.io/widget.min.js'

/** The widget's side effect, visible in the DOM the scan reads. */
const MATCH_SCRIPT = `window.__widgetRan = true; document.querySelector('main')?.setAttribute('data-widget', 'on'); setTimeout(() => { window.__aswFixesApplied = true }, 50)`
/** Same bundle, but the completion flag never arrives: the handshake must time out. */
const SILENT_SCRIPT = `window.__widgetRan = true`

const page = (scriptPath: string) =>
  `<!doctype html><html lang="en"><head><title>App</title></head><body><main><h1>App</h1><button></button></main><script src="${WIDGET_URL}"></script></body></html>`

let http: HttpServer
let base = ''
let widgetScripts = 0

before(async () => {
  http = createHttpServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(page(req.url ?? '/'))
  })
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(http.address() as any).port}/`
})
after(() => http?.close())

/**
 * A session whose network layer answers for our widget bundle and counts how
 * many of those requests actually got that far. The engine's block is a route
 * of its own: an aborted request never reaches this counter.
 */
const sessionServingWidget = (body: string) => {
  const seen: string[] = []
  const open: typeof openSession = (o) =>
    openSession({
      ...o,
      setupContext: async (ctx: any) => {
        await o.setupContext?.(ctx)
        // Installed AFTER the server's guards, so theirs decide first.
        await ctx.route('**://widget.webability.io/**', (route: any) => {
          seen.push(route.request().url())
          widgetScripts++
          return route.fulfill({ status: 200, contentType: 'application/javascript', body })
        })
      },
    })
  return { open, seen }
}

test('blocked (default): our widget request never gets through, view is the source', { timeout: 120_000 }, async () => {
  widgetScripts = 0
  const { open, seen } = sessionServingWidget(MATCH_SCRIPT)
  const { result } = await scanPageOnEngine(`${base}source`, null, 'desktop', { level: 'AA' }, false, undefined, open)
  assert.equal(result.blocked, undefined)
  assert.equal(seen.length, 0, `our widget's bundle reached the network: ${JSON.stringify(seen)}`)
  assert.equal(widgetScripts, 0)
  assert.equal(result.widget.view, 'source')
  assert.equal(result.widget.mode, 'blocked')
  assert.equal(result.widget.blocked, 1, 'the refusal is counted, so the caller can see the page installs our widget')
  assert.equal(result.widget.visitorVerified, false)
  assert.deepEqual(result.stats.warnings, [])
})

test('widgetView applied: waits for the completion flag and reports the visitor view', { timeout: 120_000 }, async () => {
  widgetScripts = 0
  const { open, seen } = sessionServingWidget(MATCH_SCRIPT)
  const { result } = await scanPageOnEngine(`${base}applied`, null, 'desktop', { level: 'AA', widget: 'applied' }, false, undefined, open)
  assert.equal(result.blocked, undefined)
  assert.ok(seen.length >= 1, 'the widget bundle was never requested, so this is not the visitor view')
  assert.equal(result.widget.view, 'applied')
  assert.equal(result.widget.mode, 'applied')
  assert.equal(result.widget.handshake, 'applied')
  assert.equal(result.widget.visitorVerified, true)
})

test('widgetView applied: a widget that never finishes times out cleanly and is never called source', { timeout: 120_000 }, async () => {
  const { open } = sessionServingWidget(SILENT_SCRIPT)
  const started = Date.now()
  const { result } = await scanPageOnEngine(`${base}silent`, null, 'desktop', { level: 'AA', widget: 'applied', widgetAppliedTimeoutMs: 500 }, false, undefined, open)
  assert.ok(Date.now() - started < 60_000)
  assert.equal(result.widget.handshake, 'timeout')
  assert.equal(result.widget.view, 'unknown')
  assert.equal(result.widget.visitorVerified, false)
  assert.ok(
    result.stats.warnings.some((w) => w.includes('__aswFixesApplied')),
    `the timeout is not explained: ${JSON.stringify(result.stats.warnings)}`,
  )
})

test('scan_page output names the view it measured', { timeout: 120_000 }, async () => {
  const [c, s] = InMemoryTransport.createLinkedPair()
  const cl = new Client({ name: 'test', version: '1' }, { capabilities: {} })
  await Promise.all([createServer({}).connect(s), cl.connect(c)])
  const r: any = await cl.callTool({ name: 'scan_page', arguments: { url: `${base}tool`, format: 'json' } }, undefined, { timeout: 120_000 })
  assert.notEqual(r.isError, true)
  const text = String(r.content.map((x: any) => x.text).join('\n'))
  assert.match(text, /DOM measured: the site's own markup/)
  const json = JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)?.[1])
  assert.equal(json.widget.view, 'source')
  assert.equal(json.widget.mode, 'blocked')
  assert.equal(json.widget.blocked, 1)
})
