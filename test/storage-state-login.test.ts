/**
 * Logged-in scans: scan_page and flow_scan take `storageState`, a path to a
 * Playwright storage-state JSON file (cookies + localStorage). Local (stdio)
 * only: the hosted server refuses the argument before it reads anything.
 *
 * Fixture: /app is behind a cookie. Without `sid=ok` it 302s to /login.
 * Local server (127.0.0.1) + real browser, like flow-scan-single-page.test.ts.
 */
process.env.WEBABILITY_SCAN_TELEMETRY = 'off'
process.env.WEBABILITY_SCAN_LOG = 'off'
process.env.WEBABILITY_JUDGE = 'off'

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { createServer } from '../src/server.ts'

async function call(name: string, args: Record<string, unknown>, serverOpts: Record<string, unknown> = {}) {
  const [c, s] = InMemoryTransport.createLinkedPair()
  const cl = new Client({ name: 'test', version: '1' }, { capabilities: {} })
  await Promise.all([createServer(serverOpts as any).connect(s), cl.connect(c)])
  const r: any = await cl.callTool({ name, arguments: args }, undefined, { timeout: 120_000 })
  const text = (r.content as any[]).map((x) => String(x.text ?? '')).join('\n')
  const m = text.match(/```json\n([\s\S]*?)\n```/)
  return { isError: r.isError === true, text, json: m ? JSON.parse(m[1]!) : null }
}

const LOGIN = `<!doctype html><html lang="en"><head><title>Sign in</title></head><body><main><h1>Sign in</h1><form><label>Email <input name="e"></label><label>Password <input type="password" name="p"></label><button>Sign in</button></form></main></body></html>`
const APP = `<!doctype html><html lang="en"><head><title>App</title></head><body><main><h1>Dashboard</h1><img src="/secret-dashboard.png"></main></body></html>`
const SETTINGS = `<!doctype html><html lang="en"><head><title>Settings</title></head><body><main><h1>Settings</h1><section><img src="/secret-settings.png"></section></main></body></html>`

let http: HttpServer
let base = ''
let dir = ''
let goodState = ''
let staleState = ''

before(async () => {
  http = createHttpServer((req, res) => {
    const authed = /(?:^|;\s*)sid=ok(?:;|$)/.test(req.headers.cookie ?? '')
    if (req.url === '/login') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(LOGIN)
    }
    if (req.url === '/home') {
      // A normal redirect inside the app (not a login bounce).
      res.writeHead(302, { location: authed ? '/app' : '/login' })
      return res.end()
    }
    if (req.url === '/slow-spa') {
      // Renders the app shell first, then bounces once its API call fails (stale token).
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(authed ? APP : `<!doctype html><html lang="en"><head><title>App</title></head><body><main><h1>Dashboard</h1><p>Loading your data</p></main><script>setTimeout(() => location.replace('/login'), 1500)</script></body></html>`)
    }
    if (req.url === '/spa') {
      // Client-side bounce, like a React dashboard with no valid token.
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(authed ? APP : `<!doctype html><html lang="en"><head><title>Loading</title></head><body><main><h1>Loading</h1></main><script>setTimeout(() => location.replace('/login'), 300)</script></body></html>`)
    }
    if (!authed) {
      res.writeHead(302, { location: '/login' })
      return res.end()
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(req.url === '/settings' ? SETTINGS : APP)
  })
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(http.address() as any).port}`
  dir = mkdtempSync(join(tmpdir(), 'wa-state-'))
  const state = (value: string) => JSON.stringify({
    cookies: [{ name: 'sid', value, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }],
    origins: [],
  })
  goodState = join(dir, 'auth.json')
  staleState = join(dir, 'stale.json')
  writeFileSync(goodState, state('ok'))
  writeFileSync(staleState, state('expired'))
})
after(() => http?.close())

test('flow_scan with storageState scans the pages behind the login', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/app`, autoNavigate: [`${base}/settings`], storageState: goodState })
  assert.equal(r.isError, false, r.text)
  assert.ok(r.json, r.text)
  const finals = (r.json.pages as any[]).map((p) => p.finalUrl)
  assert.deepEqual(finals, [`${base}/app`, `${base}/settings`])
  assert.match(r.text, /secret-dashboard\.png/)
  assert.match(r.text, /secret-settings\.png/)
})

test('flow_scan without autoNavigate forwards storageState to the single-page scan', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/app`, storageState: goodState })
  assert.equal(r.isError, false, r.text)
  assert.match(r.text, /secret-dashboard\.png/)
})

test('scan_page with storageState scans the logged-in page', async () => {
  const r = await call('scan_page', { url: `${base}/app`, storageState: goodState })
  assert.equal(r.isError, false, r.text)
  assert.match(r.text, /secret-dashboard\.png/)
})

test('an expired session is reported loudly, not scanned as the app', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/app`, autoNavigate: [`${base}/settings`], storageState: staleState })
  assert.equal(r.isError, false, r.text)
  assert.match(r.text, /redirected.*session.*expired|session.*expired/i)
  const pages = r.json.pages as any[]
  assert.ok(pages.some((p) => p.status === 'auth_redirect'), JSON.stringify(pages))
  assert.doesNotMatch(r.text, /secret-dashboard\.png/)
})

test('scan_page with an expired session says so', async () => {
  const r = await call('scan_page', { url: `${base}/app`, storageState: staleState })
  assert.match(r.text, /session.*expired/i)
})

test('a missing storageState file is a tool error that names the absolute path', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/app`, autoNavigate: [], storageState: 'no-such-dir/auth.json' })
  assert.equal(r.isError, true)
  assert.match(r.text, new RegExp(join(process.cwd(), 'no-such-dir', 'auth.json').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')))
})

test('a file that is not a storage state is refused', async () => {
  const bad = join(dir, 'bad.json')
  writeFileSync(bad, JSON.stringify({ hello: 'world' }))
  const r = await call('scan_page', { url: `${base}/app`, storageState: bad })
  assert.equal(r.isError, true)
  assert.match(r.text, /storage.?state/i)
})

test('an inline object is refused: storageState is a file path only', async () => {
  const r = await call('scan_page', { url: `${base}/app`, storageState: { cookies: [], origins: [] } })
  assert.equal(r.isError, true)
  assert.match(r.text, /path/i)
})

test('tools that do not support storageState refuse it instead of scanning logged out', async () => {
  const r = await call('verify_fix', { url: `${base}/app`, selector: 'img', wcag: '1.1.1', storageState: goodState })
  assert.equal(r.isError, true)
  assert.match(r.text, /storageState/)
  assert.match(r.text, /scan_page|flow_scan/)
})

for (const tool of ['scan_page', 'flow_scan', 'verify_fix', 'detect_framework']) {
  test(`hosted ${tool} refuses storageState before reading anything`, async () => {
    const args = tool === 'flow_scan'
      ? { startUrl: 'https://example.com', storageState: '/definitely/not/here.json' }
      : { url: 'https://example.com', selector: 'img', wcag: '1.1.1', storageState: '/definitely/not/here.json' }
    const r = await call(tool, args, { remote: true })
    assert.equal(r.isError, true, r.text)
    assert.match(r.text, /local MCP/i)
    assert.doesNotMatch(r.text, /ENOENT|not found|no such file/i)
  })
}

test('hosted refuses storageState of any type, even an empty value', async () => {
  const r = await call('scan_page', { url: 'https://example.com', storageState: { cookies: [] } }, { remote: true })
  assert.equal(r.isError, true)
  assert.match(r.text, /local MCP/i)
})

test('a client-side bounce to the login page (SPA) is caught too', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/spa`, autoNavigate: [`${base}/settings`], storageState: staleState })
  assert.equal(r.isError, false, r.text)
  const spa = (r.json.pages as any[]).find((p) => p.requested === `${base}/spa`)
  assert.equal(spa?.status, 'auth_redirect', JSON.stringify(r.json.pages))
})

test('a normal redirect with a valid session is scanned, not called an expired session', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/home`, autoNavigate: [`${base}/settings`], storageState: goodState })
  assert.equal(r.isError, false, r.text)
  const home = (r.json.pages as any[]).find((p) => p.requested === `${base}/home`)
  assert.equal(home?.status, 'scanned', JSON.stringify(r.json.pages))
  assert.doesNotMatch(r.text, /session.*expired/i)
  const sp = await call('scan_page', { url: `${base}/home`, storageState: goodState })
  assert.equal(sp.isError, false, sp.text)
  assert.match(sp.text, /secret-dashboard\.png/)
})

test('without storageState, a login wall points at storageState (local MCP)', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/app`, autoNavigate: [`${base}/settings`] })
  const app = (r.json.pages as any[]).find((p) => p.requested === `${base}/app`)
  assert.equal(app?.status, 'blocked', JSON.stringify(r.json.pages))
  assert.match(app.reason, /storageState/)
})

test('a late client-side bounce (during the scan) is caught too', async () => {
  const r = await call('flow_scan', { startUrl: `${base}/slow-spa`, autoNavigate: [`${base}/settings`], storageState: staleState })
  const p = (r.json.pages as any[]).find((x) => x.requested === `${base}/slow-spa`)
  assert.equal(p?.status, 'auth_redirect', JSON.stringify(r.json.pages))
  const sp = await call('scan_page', { url: `${base}/slow-spa`, storageState: staleState })
  assert.match(sp.text, /session.*expired/i)
})
