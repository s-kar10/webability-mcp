/**
 * Confidential OAuth clients (RFC 6749 §2.3.1). Third-party MCP clients such
 * as GoHighLevel Agent Studio register with token_endpoint_auth_method
 * client_secret_basic or client_secret_post and then send client_id only in
 * "Authorization: Basic base64(client_id:client_secret)". /token used to read
 * client_id from the form body alone, so those clients got
 * invalid_grant "redirect_uri or client_id mismatch" on a valid code.
 *
 * The secret is accepted and never checked: the clients are public in
 * practice and PKCE is the proof. Echoing the requested method and returning
 * a secret keeps strict clients from aborting before they ever call /token.
 *
 * Offline: real src/http.ts against a mock platform API.
 */
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const REDIRECT = 'https://studio.gohighlevel.com/mcp/oauth/callback'
const VERIFIER = 'confidential-client-verifier-0123456789abcdefghijkl'
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url')

const USER_TOKEN = 'wa_live_confidential_abc123'
const REFRESH_TOKEN = 'wa_refresh_confidential_r1'
const ROTATED_TOKEN = 'wa_live_confidential_rotated'
const ROTATED_REFRESH = 'wa_refresh_confidential_r2'

let api: Server
let child: ChildProcess
let BASE = ''

before(async () => {
  api = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/cli/device-code') {
        res.end(JSON.stringify({ deviceCode: 'dc', userCode: 'ABCD-1234', verificationUrl: 'https://app.webability.io/activate?code=ABCD-1234' }))
      } else if (req.url === '/cli/device-token') {
        res.end(JSON.stringify({ token: USER_TOKEN, refreshToken: REFRESH_TOKEN }))
      } else if (req.url === '/cli/refresh-token') {
        res.end(JSON.stringify({ token: ROTATED_TOKEN, refreshToken: ROTATED_REFRESH }))
      } else {
        res.statusCode = 404
        res.end('{}')
      }
    })
  })
  await new Promise<void>((r) => api.listen(0, '127.0.0.1', r))
  const apiPort = (api.address() as { port: number }).port
  // 28000-28999: no other test file in this `tsx --test` run draws from it.
  const port = 28000 + Math.floor(Math.random() * 1000)
  BASE = `http://127.0.0.1:${port}`
  child = spawn(join(here, '..', 'node_modules', '.bin', 'tsx'), [join(here, '..', 'src', 'http.ts')], {
    env: {
      ...process.env,
      PORT: String(port),
      WEBABILITY_API_URL: `http://127.0.0.1:${apiPort}`,
      MCP_PUBLIC_URL: BASE,
      OAUTH_SIGNING_SECRET: 'confidential-client-secret-0123456789ab',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${BASE}/health`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error('server did not start')
})

after(() => {
  child?.kill()
  api?.close()
})

interface Registration {
  client_id: string
  client_secret?: string
  token_endpoint_auth_method?: string
}

/** client_id is HMAC(name, redirect_uris, iat-seconds), so two registrations in
 * the same second only differ by name — give each one a counter. */
let registrations = 0

async function register(extra: Record<string, unknown> = {}): Promise<Registration> {
  registrations += 1
  const r = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: `GoHighLevel ${registrations}`, redirect_uris: [REDIRECT], ...extra }),
  })
  const body: unknown = await r.json()
  assert.equal(r.status, 201, JSON.stringify(body))
  assert.ok(body && typeof body === 'object' && 'client_id' in body && typeof body.client_id === 'string')
  return body as Registration
}

/** Walk /authorize/start → complete and return the authorization code. */
async function codeFor(clientId: string): Promise<string> {
  const start = await fetch(`${BASE}/authorize/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, redirect_uri: REDIRECT, state: 's', code_challenge: CHALLENGE, code_challenge_method: 'S256' }),
  })
  assert.equal(start.status, 200)
  const { sid } = (await start.json()) as { sid: string }
  const done = await fetch(`${BASE}/authorize/complete?sid=${sid}`, { redirect: 'manual' })
  assert.equal(done.status, 302)
  return new URL(done.headers.get('location')!).searchParams.get('code')!
}

/** Parsed JSON object from a response — unknown until this guard proves the shape. */
async function jsonObject(r: Response): Promise<Record<string, unknown>> {
  const value: unknown = await r.json()
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `expected a JSON object, got ${JSON.stringify(value)}`)
  return value as Record<string, unknown>
}

function basic(clientId: string, secret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`
}

function tokenRequest(params: Record<string, string>, headers: Record<string, string> = {}) {
  return fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(params).toString(),
  })
}

test('AS metadata advertises the confidential client auth methods', async () => {
  const meta: unknown = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json()
  assert.ok(meta && typeof meta === 'object' && 'token_endpoint_auth_methods_supported' in meta)
  const methods = meta.token_endpoint_auth_methods_supported
  assert.ok(Array.isArray(methods))
  for (const m of ['none', 'client_secret_basic', 'client_secret_post']) assert.ok(methods.includes(m), `missing ${m} in ${JSON.stringify(methods)}`)
})

test('DCR default stays public: none, no client_secret', async () => {
  const reg = await register()
  assert.equal(reg.token_endpoint_auth_method, 'none')
  assert.equal(reg.client_secret, undefined)
})

test('DCR echoes client_secret_basic and returns a client_secret', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  assert.equal(reg.token_endpoint_auth_method, 'client_secret_basic')
  assert.equal(typeof reg.client_secret, 'string')
  assert.ok(reg.client_secret!.length >= 20)
})

test('DCR echoes client_secret_post and returns a client_secret', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_post' })
  assert.equal(reg.token_endpoint_auth_method, 'client_secret_post')
  assert.equal(typeof reg.client_secret, 'string')
})

test('code exchange accepts client_id from the Basic header only', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const code = await codeFor(reg.client_id)
  const r = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: VERIFIER },
    { authorization: basic(reg.client_id, reg.client_secret!) },
  )
  const body = await jsonObject(r)
  assert.equal(r.status, 200, JSON.stringify(body))
  assert.equal(body.access_token, USER_TOKEN)
  assert.equal(body.token_type, 'Bearer')
  assert.equal(typeof body.refresh_token, 'string')
})

test('code exchange accepts client_secret_post in the body', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_post' })
  const code = await codeFor(reg.client_id)
  const r = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id: reg.client_id,
    client_secret: reg.client_secret!,
    code_verifier: VERIFIER,
  })
  const body = await jsonObject(r)
  assert.equal(r.status, 200, JSON.stringify(body))
  assert.equal(body.access_token, USER_TOKEN)
})

test('code exchange with matching body and Basic client_id succeeds', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const code = await codeFor(reg.client_id)
  const r = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: VERIFIER },
    { authorization: basic(reg.client_id, reg.client_secret!) },
  )
  assert.equal(r.status, 200)
})

test('body client_id that conflicts with the Basic header → invalid_grant', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const other = await register()
  const code = await codeFor(reg.client_id)
  const r = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: other.client_id, code_verifier: VERIFIER },
    { authorization: basic(reg.client_id, reg.client_secret!) },
  )
  const body = await jsonObject(r)
  assert.equal(r.status, 400, JSON.stringify(body))
  assert.equal(body.error, 'invalid_grant')
})

test('Basic client_id that names another client → invalid_grant', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const other = await register()
  const code = await codeFor(reg.client_id)
  const r = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: VERIFIER },
    { authorization: basic(other.client_id, 'whatever') },
  )
  const body = await jsonObject(r)
  assert.equal(r.status, 400, JSON.stringify(body))
  assert.equal(body.error, 'invalid_grant')
})

test('refresh grant accepts client_id from the Basic header only', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const code = await codeFor(reg.client_id)
  const first = await jsonObject(
    await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: VERIFIER }, { authorization: basic(reg.client_id, reg.client_secret!) }),
  )
  assert.equal(typeof first.refresh_token, 'string')

  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token }, { authorization: basic(reg.client_id, reg.client_secret!) })
  const body = await jsonObject(r)
  assert.equal(r.status, 200, JSON.stringify(body))
  assert.equal(body.access_token, ROTATED_TOKEN)
  assert.equal(typeof body.refresh_token, 'string')
})

test('refresh with a Basic client_id that did not receive the token → invalid_grant', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const other = await register()
  const code = await codeFor(reg.client_id)
  const first = await jsonObject(
    await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: VERIFIER }, { authorization: basic(reg.client_id, reg.client_secret!) }),
  )
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first.refresh_token }, { authorization: basic(other.client_id, 'whatever') })
  const body = await jsonObject(r)
  assert.equal(r.status, 400, JSON.stringify(body))
  assert.equal(body.error, 'invalid_grant')
})

test('a percent-encoded client_id in the Basic header decodes (RFC 6749 §2.3.1)', async () => {
  const reg = await register({ token_endpoint_auth_method: 'client_secret_basic' })
  const code = await codeFor(reg.client_id)
  // A minted id is base64url + '.', which encodeURIComponent leaves as is.
  // Percent-encode every byte so the header only works if the server decodes.
  const pct = (v: string) => Array.from(Buffer.from(v, 'utf8'), (b) => '%' + b.toString(16).toUpperCase().padStart(2, '0')).join('')
  const encoded = pct(reg.client_id)
  assert.notEqual(encoded, reg.client_id)
  const r = await tokenRequest(
    { grant_type: 'authorization_code', code, redirect_uri: REDIRECT, code_verifier: VERIFIER },
    { authorization: basic(encoded, pct(reg.client_secret!)) },
  )
  assert.equal(r.status, 200)
})
