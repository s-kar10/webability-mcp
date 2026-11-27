import assert from 'node:assert/strict'
import { test } from 'node:test'

import { redactSensitiveMcpPayloads, stabilizeScanTimeoutFingerprint } from '../src/posthog.ts'

const SCAN_PAGE_TIMEOUT =
  'https://slow-site.example/ took longer than 55s to scan, so it stopped at the hosted limit for one tool call. Try again, or use start_audit for slow or large sites.'
const DIFF_SCAN_TIMEOUT =
  'diff_scan of https://baseline.example/ and https://slow-site.example/ took longer than 55s to scan, so it stopped at the hosted limit for one tool call. Try again, or use start_audit for slow or large sites.'

function exceptionEvent(value: string) {
  return {
    event: '$exception',
    properties: {
      $exception_list: [{ type: 'Error', value }],
      $mcp_tool_name: 'scan_page',
    },
  }
}

test('scan_page deadline timeout gets a stable fingerprint', () => {
  const event = stabilizeScanTimeoutFingerprint(exceptionEvent(SCAN_PAGE_TIMEOUT))
  assert.equal(event.properties.$exception_fingerprint, 'webability-mcp:hosted-scan-deadline-timeout')
})

test('diff_scan deadline timeout gets the same stable fingerprint', () => {
  const event = stabilizeScanTimeoutFingerprint(exceptionEvent(DIFF_SCAN_TIMEOUT))
  assert.equal(event.properties.$exception_fingerprint, 'webability-mcp:hosted-scan-deadline-timeout')
})

test('every slow site groups into one issue instead of one per URL', () => {
  const a = stabilizeScanTimeoutFingerprint(
    exceptionEvent('https://a.example/ took longer than 55s to scan, so it stopped at the hosted limit for one tool call.'),
  )
  const b = stabilizeScanTimeoutFingerprint(
    exceptionEvent('https://b.example/ took longer than 55s to scan, so it stopped at the hosted limit for one tool call.'),
  )
  assert.equal(a.properties.$exception_fingerprint, b.properties.$exception_fingerprint)
})

test('the timeout event is still captured, not dropped as misuse noise', () => {
  const event = redactSensitiveMcpPayloads(exceptionEvent(SCAN_PAGE_TIMEOUT))
  assert.ok(event, 'timeout event must survive beforeSend so the timeout rate stays visible')
  assert.equal(event.properties.$exception_fingerprint, 'webability-mcp:hosted-scan-deadline-timeout')
})

test('other exceptions keep their default fingerprint', () => {
  const event = stabilizeScanTimeoutFingerprint(
    exceptionEvent('Error: Scan failed: page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://accesio.ro/'),
  )
  assert.equal(event.properties.$exception_fingerprint, undefined)
})

test('non-exception events are untouched', () => {
  const event = stabilizeScanTimeoutFingerprint({
    event: '$mcp_tool_call',
    properties: { $mcp_tool_name: 'scan_page' },
  })
  assert.equal(event.properties.$exception_fingerprint, undefined)
})
