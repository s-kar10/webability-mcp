/**
 * scan_html runs the detectors in jsdom, which has no Range.getClientRects.
 * The colorOnly same-line gate needs layout; without it the detector must
 * fall back to its pre-layout behaviour, not throw (an engine-failed bug).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fastScanHtml } from '../src/fastScan.js'

test('scan_html: colorOnly does not throw in jsdom on a link inside a sentence', async () => {
  const html = '<!doctype html><html lang="en"><head><title>t</title></head><body><main><p style="color:#222">Read the full story about our new service in <a href="/x" style="color:#06c;text-decoration:none">this article</a> before you sign up today.</p></main></body></html>'
  const res: any = await fastScanHtml(html)
  const bugs = (res.internal_bugs ?? []).filter((b: any) => b.tool === 'colorOnly')
  assert.deepEqual(bugs, [], JSON.stringify(bugs))
})
