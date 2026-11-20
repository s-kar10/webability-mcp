/**
 * The validated-token cache is keyed by the raw bearer token. `http.ts` calls
 * `set()` only for tokens the platform validated, but entries for expired
 * valid tokens were never removed, so the map grew with every distinct valid
 * token for the life of the process.
 *
 * The second bug is subtler: `has()` answered true for an entry that had
 * already expired. http.ts uses `has()` to decide whether a token is "known
 * good", so an expired token skipped the bad-token limiter and could be
 * retried without limit.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createTokenCache } from '../src/tokenCache.ts'

const TTL = 1_000

test('an expired entry is gone for both get() and has()', () => {
  let now = 0
  const cache = createTokenCache({ max: 10, now: () => now })
  cache.set('t', now + TTL)
  assert.equal(cache.has('t'), true)
  assert.equal(cache.get('t'), TTL)

  now = TTL + 1
  assert.equal(cache.has('t'), false, 'has() must not report an expired token as known good')
  assert.equal(cache.get('t'), undefined)
  assert.equal(cache.size, 0, 'the expired entry is dropped, not left to occupy the cap')
})

test('the cache is bounded: the oldest entry is evicted at the cap', () => {
  const cache = createTokenCache({ max: 3, now: () => 0 })
  for (const t of ['a', 'b', 'c']) cache.set(t, TTL)
  assert.equal(cache.size, 3)

  cache.set('d', TTL)
  assert.equal(cache.size, 3, 'the cache never grows past its cap')
  assert.equal(cache.has('a'), false, 'the oldest entry is the one evicted')
  assert.equal(cache.has('d'), true, 'the newest entry is kept')
})

test('re-setting a live token does not evict anything', () => {
  const cache = createTokenCache({ max: 2, now: () => 0 })
  cache.set('a', TTL)
  cache.set('b', TTL)
  cache.set('a', TTL * 2)
  assert.equal(cache.size, 2)
  assert.equal(cache.has('b'), true, 'a refresh of an existing key must not evict a different token')
  assert.equal(cache.get('a'), TTL * 2, 'the refreshed expiry wins')
})

test('delete() removes an entry, so a rejected token stops validating', () => {
  const cache = createTokenCache({ max: 2, now: () => 0 })
  cache.set('a', TTL)
  cache.delete('a')
  assert.equal(cache.has('a'), false)
  assert.equal(cache.size, 0)
})
