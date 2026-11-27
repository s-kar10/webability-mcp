/**
 * scan_html is a process-wide, single-document engine: one module-level jsdom
 * window, one scan at a time, no AbortSignal, no deadline and no per-call cap
 * (the only limit was the 5 MiB HTTP body). Phase-3 measured the consequences
 * on origin/main: a 12 KB snippet blocked the event loop for 5.9 s, 24 KB for
 * 33 s, a depth-800 nest for 10 s — /health and every other tool share that
 * loop, so the container HEALTHCHECK failed during any such scan, and any
 * caller holding a valid account token was unmetered.
 *
 * These tests pin the three guards:
 *   1. cheap pre-scan caps (bytes / elements / nesting depth) with a tool-level
 *      error that points at engine:"browser" / scan_page;
 *   2. a hard deadline (withDeadline) so one call cannot outlive 24 s;
 *   3. a bounded queue — past the cap the caller is told the server is busy
 *      instead of chaining onto the shared promise forever.
 *
 * Payload shapes are the measured ones: span soup (element count), deep nests
 * (depth), and a normal component snippet that must keep working.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import {
  DEFAULT_SCAN_HTML_QUEUE,
  ScanHtmlBusyError,
  ScanHtmlLimitError,
  SCAN_HTML_DEADLINE_MS,
  SCAN_HTML_MAX_BYTES,
  SCAN_HTML_MAX_DEPTH,
  SCAN_HTML_MAX_ELEMENTS,
  assertScanHtmlWithinCaps,
  engineDocument,
  estimateMarkupSize,
  fastScanHtml,
} from '../src/fastScan.ts'
import { HOSTED_CALL_DEADLINE_MS, createServer } from '../src/server.ts'

const require = createRequire(import.meta.url)

const SMALL = '<main><h1>T</h1><img src="a.png"><button></button></main>'
/** Flat element soup: the 12 KB → 5.9 s shape (cost is superlinear in element count).
 *  The image without alt is a known positive, so "the scan completed" is checked
 *  by a finding, not by an empty list. */
const spans = (n: number) => '<main><h1>T</h1><img src="a.png">' + '<span>text</span>'.repeat(n) + '</main>'
/** The depth-800 → 10 s shape. */
const nest = (n: number) => '<main><h1>T</h1>' + '<div>'.repeat(n) + 'x' + '</div>'.repeat(n) + '</main>'

const isLimit = (kind: string) => (err: unknown) => {
  assert.ok(err instanceof ScanHtmlLimitError, `expected ScanHtmlLimitError, got ${(err as Error)?.name}: ${(err as Error)?.message}`)
  assert.equal(err.kind, kind)
  // Every cap error must name the way out, not just refuse.
  assert.match(err.message, /scan_page/)
  assert.match(err.message, /engine:"browser"/)
  return true
}

async function connect(srv = createServer({ remote: true })) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1' }, { capabilities: {} })
  await Promise.all([srv.connect(serverTransport), client.connect(clientTransport)])
  return client
}

const text = (res: any) => res.content.map((c: any) => String(c.text ?? '')).join('\n')

test('caps: 256 KB of html is refused before jsdom is even loaded', async () => {
  const html = '<div>' + 'x'.repeat(SCAN_HTML_MAX_BYTES) + '</div>'
  const t0 = Date.now()
  assert.throws(() => assertScanHtmlWithinCaps(html), isLimit('bytes'))
  const ms = Date.now() - t0
  // A length check, not a scan: a 300 KB scan takes minutes, so anything in
  // the low hundreds of ms (under the parallel suite's load) is proof enough.
  assert.ok(ms < 500, `byte cap should be a length check, took ${ms}ms`)

  // Through the tool: a tool-level error naming the alternatives, still no jsdom.
  const jsdom = require.resolve('jsdom')
  assert.equal(require.cache[jsdom], undefined, 'premise: jsdom is not loaded yet in this process')
  const client = await connect()
  const res = await client.callTool({ name: 'scan_html', arguments: { html } })
  assert.equal((res as any).isError, true)
  assert.match(text(res), /scan_page/)
  assert.match(text(res), /engine:"browser"/)
  assert.equal(require.cache[jsdom], undefined, 'an over-cap snippet must not reach the jsdom engine')
  await client.close()
})

test('caps: the element-count cap refuses span soup before any scan runs', () => {
  const html = spans(SCAN_HTML_MAX_ELEMENTS + 1)
  assert.throws(() => assertScanHtmlWithinCaps(html), isLimit('elements'))
  // A snippet at the cap is accepted (the cap is a ceiling, not a target).
  // main + h1 + img + spans: exactly the cap.
  assert.doesNotThrow(() => assertScanHtmlWithinCaps(spans(SCAN_HTML_MAX_ELEMENTS - 3)))
  assert.throws(() => assertScanHtmlWithinCaps(spans(SCAN_HTML_MAX_ELEMENTS - 2)), isLimit('elements'))
})

test('caps: the nesting-depth cap refuses the depth-800 shape', () => {
  const html = nest(SCAN_HTML_MAX_DEPTH + 1)
  assert.throws(() => assertScanHtmlWithinCaps(html), isLimit('depth'))
  assert.throws(() => assertScanHtmlWithinCaps(nest(800)), isLimit('depth'))
  assert.doesNotThrow(() => assertScanHtmlWithinCaps(nest(SCAN_HTML_MAX_DEPTH - 1)))
})

test('the pre-scan estimate is cheap and does not over-count void/self-closing tags', () => {
  // 256 KB of prose: no tags, so only the byte/length walk happens.
  const prose = '<main><h1>T</h1><p>' + 'text '.repeat(Math.floor((SCAN_HTML_MAX_BYTES - 100) / 5)) + '</p></main>'
  const t0 = Date.now()
  const est = estimateMarkupSize(prose)
  assert.ok(Date.now() - t0 < 500, 'pre-scan is one pass, not a parse')
  assert.equal(est.elements, 3)

  const voids = estimateMarkupSize('<img src="a"><br><input type="text"><div><span>x</span></div>')
  assert.equal(voids.elements, 5)
  assert.equal(voids.depth, 2, 'void elements close themselves; only div > span nests')

  // A `>` inside a quoted attribute value does not split the tag in two.
  assert.equal(estimateMarkupSize('<a title="a > b">x</a>').elements, 1)
})

test('the pre-scan is linear on hostile markup (the guard must not become the wedge)', () => {
  // Measured on the first version of this guard: a backtracking tag regex took
  // 1.0 s at 32 KB, 4.4 s at 64 KB and 16 s at 128 KB on these shapes — a
  // scanner that a single small request can freeze is worse than no cap.
  const shapes: Array<[string, string]> = [
    ['unterminated tags', '<a '.repeat(85_000)],
    ['unterminated names', '<a'.repeat(128_000)],
    ['one 250 KB name', '<' + 'a'.repeat(250_000)],
    ['unclosed quote', '<div title="' + 'x'.repeat(250_000)],
    ['stray angle brackets', '< '.repeat(125_000)],
    // parse5's tree builder is superlinear in depth: a full parse of this took
    // 9 s. The count must stop the parse at the cap.
    ['52k nested divs', '<div>'.repeat(52_000)],
    ['85k nested formatting tags', '<b>'.repeat(85_000)],
    ['misnested formatting', '<b><i></b></i>'.repeat(18_000)],
    ['nested tables', '<table><tr><td>'.repeat(17_000)],
  ]
  for (const [label, html] of shapes) {
    const t0 = Date.now()
    const est = estimateMarkupSize(html)
    const ms = Date.now() - t0
    assert.ok(ms < 500, `${label}: pre-scan took ${ms}ms on ${Buffer.byteLength(html)} bytes`)
    if (label.startsWith('unterminated') || label === 'one 250 KB name' || label === 'unclosed quote' || label === 'stray angle brackets') {
      // Nothing after an unterminated tag is markup the parser would build.
      assert.ok(est.elements <= SCAN_HTML_MAX_ELEMENTS, `${label}: counted ${est.elements} elements`)
    } else {
      // A real nest or soup past a cap is refused, quickly.
      assert.ok(est.over, `${label}: not refused (${est.elements} elements, depth ${est.depth})`)
    }
  }
})

test('a stray `<` is text, not a tag that swallows the markup after it', () => {
  // Per the tokenizer `<` followed by a space starts no tag; the next character
  // is read again. Jumping to the next `>` here would skip a real <span>.
  assert.equal(estimateMarkupSize('x < y <span>z</span>').elements, 1)
  assert.equal(estimateMarkupSize('< 3 and <b>bold</b>').elements, 1)
})

test('caps cannot be bypassed by closing tags the parser treats differently', () => {
  // `</br>` is a br START tag in the HTML parser: it inserts an element.
  assert.throws(() => assertScanHtmlWithinCaps('</br>'.repeat(SCAN_HTML_MAX_ELEMENTS + 5)), isLimit('elements'))
  // A stray `</p>` inserts a p element too.
  assert.throws(() => assertScanHtmlWithinCaps('</p>'.repeat(SCAN_HTML_MAX_ELEMENTS + 5)), isLimit('elements'))
  // An unmatched `</span>` is ignored by the parser, so it cannot cancel the
  // depth of the divs around it: 50 open divs + 100 stray closers + 60 more is
  // a real depth of 110, past the cap.
  assert.throws(() => assertScanHtmlWithinCaps('<div>'.repeat(50) + '</span>'.repeat(100) + '<div>'.repeat(60)), isLimit('depth'))
})

test('the estimate never counts fewer elements or less depth than jsdom actually builds', async () => {
  // The bypass direction is the dangerous one: a pre-scan that under-counts
  // waves through exactly the payload it exists to stop. Pin it against the
  // parser the engine itself uses.
  const { JSDOM } = await import('jsdom')
  const cases: Array<[string, string]> = [
    ['component', SMALL],
    ['voids', '<img src="a"><br><input type="text"><div><span>x</span></div>'],
    ['self-closing divs', '<div/>'.repeat(50)],
    ['bare quote in a tag', '<x ">' + '<span>x</span>'.repeat(60) + '<x ">'],
    ['quoted angle bracket', '<a title="a > b"><span>x</span></a>'],
    ['40 deep', nest(40)],
    ['table without tbody', '<table><tr><td><span>x</span></td></tr></table>'],
    ['stray br closers', '</br>'.repeat(20)],
    ['stray p closers', '</p>'.repeat(20)],
    ['unmatched closer inside a nest', '<div>'.repeat(10) + '</span>'.repeat(5) + '<div>'.repeat(10)],
    ['stray angle bracket', 'x < y <span>z</span>'],
    // Review shapes (PR 230): each was accepted while jsdom built more.
    ['double angle bracket', '<<span>x</span>'.repeat(20)],
    ['angle bracket then space', '< <span>x</span>'.repeat(20)],
    ['equals at attribute-name start', '<x =">' + '<span>x</span>'.repeat(20)],
    ['double equals', '<x a=="' + '>' + '<span>x</span>'.repeat(20)],
    ['closer that does not match', '<div></span>'.repeat(40)],
    ['empty closer', '<div></>'.repeat(40)],
    ['tag name with a dot', '<br.>'.repeat(40)],
    ['end tag name with a dot', '<div>'.repeat(40) + '</div.x>'.repeat(40) + '<div>'.repeat(20)],
  ]
  for (const [label, html] of cases) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    const doc = dom.window.document as any
    doc.open()
    // The document the engine writes: a snippet inside the fixed page, whose
    // own <main> and <h1> do not count.
    doc.write(engineDocument(html).doc)
    doc.close()
    const main = doc.querySelector('main')
    const actualElements = main.querySelectorAll('*').length - 1
    let actualDepth = 0
    const walk = (el: any, d: number) => {
      actualDepth = Math.max(actualDepth, d)
      for (const child of el.children) walk(child, d + 1)
    }
    walk(main, 0)
    const est = estimateMarkupSize(html)
    // A +2 slack on both counts: the parser inserts a couple of nodes the markup
    // never names (`<tbody>` for a bare `<tr>`, `<head>`/`<body>`). Those are
    // constant, and both caps leave room, so they cannot defeat one.
    assert.ok(est.elements + 2 >= actualElements, `${label}: estimate ${est.elements} < jsdom ${actualElements}`)
    assert.ok(est.depth + 2 >= actualDepth, `${label}: estimate depth ${est.depth} < jsdom ${actualDepth}`)
  }
})

test('caps cannot be bypassed by a quote the tokenizer does not treat as a quote', () => {
  // A bare `"` is an ordinary character in a tag: `<x ">` closes at that `>`.
  // A regex that treats it as a quote reads the whole payload as one element.
  const wrapper = '<x ">'
  const spanSoup = wrapper + '<span>x</span>'.repeat(5000) + wrapper
  assert.throws(() => assertScanHtmlWithinCaps(spanSoup), isLimit('elements'))
  const deep = wrapper + nest(800) + wrapper
  assert.throws(() => assertScanHtmlWithinCaps(deep), isLimit('depth'))
})

test('caps cannot be bypassed by a trailing slash on a non-void element', () => {
  // parse5 ignores `<div/>` outside foreign content: it nests like `<div>`.
  assert.throws(() => assertScanHtmlWithinCaps('<div/>'.repeat(SCAN_HTML_MAX_DEPTH + 5)), isLimit('depth'))
})

test('a normal component snippet still scans', async () => {
  const r = await fastScanHtml(SMALL)
  assert.equal(r.engine, 'in-process')
  assert.ok(r.issues.length >= 2, `expected findings, got ${r.issues.map((i) => i.type).join(',')}`)
})

test('deadline: a call waiting behind a slow scan is answered at its deadline, not at the end of the queue', async () => {
  // The 120-span scan blocks for seconds; the second call's 250 ms budget
  // expires meanwhile. The timer itself can only fire when the block yields, so
  // the assertion is the return type plus the 24 s ceiling — never "at 250 ms".
  const slow = fastScanHtml(spans(120))
  const t0 = Date.now()
  await assert.rejects(fastScanHtml(SMALL, { deadlineMs: 250 }), /did not finish within/)
  const ms = Date.now() - t0
  assert.ok(ms < SCAN_HTML_DEADLINE_MS, `a queued call must not outlive the default budget (took ${ms}ms)`)
  const first = await slow
  assert.ok(first.issues.length >= 1, 'the first scan must still complete normally')
})

test('deadline: a queued call whose caller gave up never scans the shared document', async () => {
  // The skip path is `abort.abort()` + `signal.throwIfAborted()` before
  // `document.write`. Without it every expired waiter still rewrites the one
  // shared document after its caller was answered.
  await fastScanHtml(SMALL) // warms the shared window
  const doc = (globalThis as any).document
  assert.ok(doc && typeof doc.write === 'function', 'premise: the shared jsdom window is installed')
  const original = doc.write.bind(doc)
  let writes = 0
  doc.write = (...args: unknown[]) => {
    writes += 1
    return (original as any)(...args)
  }
  try {
    const slow = fastScanHtml(spans(120))
    await assert.rejects(fastScanHtml(SMALL, { deadlineMs: 100 }), /did not finish within/)
    await slow
    assert.equal(writes, 1, `only the running scan may write the shared document, saw ${writes} writes`)
  } finally {
    doc.write = original
  }
})

test('deadline: a scan that blows its budget returns a DeadlineError, never a result', async () => {
  // A pathological payload under the caps, on a budget it cannot meet. The
  // detector kernel is one synchronous block, so the timer fires at the first
  // yield: the reply is bounded by that block (which the caps bound), not by
  // the deadline alone. Only the 24 s ceiling is asserted here, load-tolerant.
  const t0 = Date.now()
  let finished = false
  let err: unknown
  try {
    await fastScanHtml(spans(200), { deadlineMs: 250 })
    finished = true
  } catch (e) {
    err = e
  }
  const ms = Date.now() - t0
  assert.equal(finished, false, 'a scan past its 250 ms budget must not report findings as if it finished')
  assert.equal((err as Error)?.name, 'DeadlineError')
  assert.match(String((err as Error)?.message), /did not finish within/)
  assert.ok(ms < SCAN_HTML_DEADLINE_MS, `one call must not outlive the default budget (took ${ms}ms)`)
})

test('deadline: an aborted scan leaves the scanning chain healthy', async () => {
  await assert.rejects(fastScanHtml(spans(200), { deadlineMs: 250 }), /did not finish within/)
  // The abandoned scan may still own the shared window until it settles; the
  // next scan must still produce a real result for ITS document (never an empty
  // or clobbered one written mid-abort).
  const r = await fastScanHtml(SMALL, { deadlineMs: 24_000 })
  const ids = r.issues.map((i) => i.type)
  assert.ok(ids.includes('image-alt') || ids.includes('missing_alt'), `post-abort scan missed the img: ${ids}`)
  assert.ok(ids.includes('button-name') || ids.includes('unlabeled_button'), `post-abort scan missed the button: ${ids}`)
  assert.equal(r.fragment, true)
})

test('deadline: 24 s default, one second under scan_page hosted budget', () => {
  assert.equal(SCAN_HTML_DEADLINE_MS, 24_000)
  assert.ok(SCAN_HTML_DEADLINE_MS < HOSTED_CALL_DEADLINE_MS)
})

test('queue: past the cap the caller is told the server is busy, and the slot frees up', async () => {
  const previous = process.env.MCP_SCAN_HTML_MAX_QUEUE
  process.env.MCP_SCAN_HTML_MAX_QUEUE = '1'
  try {
    const slow = fastScanHtml(spans(120))
    await assert.rejects(fastScanHtml(SMALL), (err: unknown) => {
      assert.ok(err instanceof ScanHtmlBusyError, `expected ScanHtmlBusyError, got ${(err as Error)?.name}`)
      assert.match(err.message, /busy/i)
      assert.match(err.message, /retry in \d+s/)
      assert.ok(err.retryAfterSeconds >= 1)
      return true
    })
    const slowResult = await slow
    assert.ok(slowResult.issues.length >= 1, 'the first scan must not be disturbed by the refusal')
    // Slot released: the next call runs.
    const after = await fastScanHtml(SMALL)
    assert.ok(after.issues.length >= 2)
  } finally {
    if (previous === undefined) delete process.env.MCP_SCAN_HTML_MAX_QUEUE
    else process.env.MCP_SCAN_HTML_MAX_QUEUE = previous
  }
})

test('queue: the busy state reaches the caller as a tool result, not a hang', async () => {
  const previous = process.env.MCP_SCAN_HTML_MAX_QUEUE
  process.env.MCP_SCAN_HTML_MAX_QUEUE = '1'
  try {
    const client = await connect()
    const [a, b] = await Promise.allSettled([
      client.callTool({ name: 'scan_html', arguments: { html: spans(120) } }),
      client.callTool({ name: 'scan_html', arguments: { html: SMALL } }),
    ])
    const results = [a, b].filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map((r) => r.value)
    assert.equal(results.length, 2, 'both calls must be answered — the queued call must not hang')
    const busy = results.filter((r) => r.isError && /busy|retry in/i.test(text(r)))
    assert.equal(busy.length, 1, `expected exactly one busy result, got: ${results.map((r) => text(r).slice(0, 80)).join(' | ')}`)
    assert.ok(results.some((r) => !r.isError), 'the other call must still scan')
    await client.close()
  } finally {
    if (previous === undefined) delete process.env.MCP_SCAN_HTML_MAX_QUEUE
    else process.env.MCP_SCAN_HTML_MAX_QUEUE = previous
  }
})

test('the default queue is bounded', () => {
  assert.ok(Number.isInteger(DEFAULT_SCAN_HTML_QUEUE) && DEFAULT_SCAN_HTML_QUEUE >= 2 && DEFAULT_SCAN_HTML_QUEUE <= 32)
})

test('a seeded fuzz never finds an estimate below the tree jsdom builds', async () => {
  // Hand-picked shapes miss whole classes (the review's parse5 fuzz found
  // thousands). Random strings from tag and punctuation tokens, judged against
  // the parser the engine uses, with no slack.
  const { JSDOM } = await import('jsdom')
  const tokens = ['<', '>', '/', '=', '"', "'", ' ', '!', '?', '-', '.', 'div', 'span', 'p', 'br', 'b', 'x', 'tr', 'td', 'table', 'a', '</', '<!--', '-->', '<div>', '</div>', '<p>', '</p>', '<br>', '</br>', '<span>', '</span>', '<x ', 'a=', '="', '<<', '<svg>', '</svg>', '<math>', '<html>', '<head>', '<body>', '</body>']
  let seed = 230
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const doc = dom.window.document as any
  const misses: string[] = []
  for (let n = 0; n < 2000 && misses.length < 5; n++) {
    let html = ''
    const len = 5 + Math.floor(rand() * 40)
    for (let t = 0; t < len; t++) html += tokens[Math.floor(rand() * tokens.length)]
    const { elements: actualElements, depth: actualDepth } = jsdomSize(doc, html)
    const est = estimateMarkupSize(html)
    if (est.elements < actualElements || est.depth < actualDepth) misses.push(`${JSON.stringify(html)}: estimate ${est.elements}/${est.depth}, jsdom ${actualElements}/${actualDepth}`)
  }
  assert.deepEqual(misses, [])
})

test('foreign-content html/head/body are counted: they are real SVG/MathML elements', () => {
  // Inside <svg>/<math> an <html> tag is not the implied root; parse5 builds it.
  for (const root of ['svg', 'math']) {
    const nest = `<${root}>` + '<html>'.repeat(500)
    const est = estimateMarkupSize(nest)
    assert.ok(est.over, `<${root}><html>x500 must be refused, got ${JSON.stringify(est)}`)
    assert.throws(() => assertScanHtmlWithinCaps(nest), ScanHtmlLimitError)
  }
})

test('foreign-content html/head/body: the estimate matches the tree jsdom builds', async () => {
  const { JSDOM } = await import('jsdom')
  const doc = new JSDOM('<!doctype html><html><body></body></html>').window.document as any
  // <html> stays foreign inside <svg>/<math>; <head>/<body> break out of it.
  const shapes = ['<svg><html><html></html></html></svg>', '<math><html><html>', '<svg><body></body><head></head>', '<svg><g><html><body>', '<p>x</p><body><head><html>', '<svg><foreignObject><html><body><p>x']
  for (const html of shapes) {
    const est = estimateMarkupSize(html)
    const actual = jsdomSize(doc, html)
    assert.ok(est.elements >= actual.elements && est.depth >= actual.depth, `${html}: estimate ${est.elements}/${est.depth}, jsdom ${actual.elements}/${actual.depth}`)
  }
})

/**
 * Elements and depth of the tree jsdom builds for what the engine writes, by the
 * caps' rule: the document's own (HTML-namespace) html/head/body are free, and a
 * snippet's fixed page (title, main, h1; main one level) is not counted.
 */
function jsdomSize(doc: any, html: string): { elements: number; depth: number } {
  const { doc: written, fragment } = engineDocument(html)
  doc.open()
  doc.write(written)
  doc.close()
  const XHTML = 'http://www.w3.org/1999/xhtml'
  let elements = fragment ? -3 : 0
  let depth = 0
  const walk = (el: any, d: number) => {
    const implied = el.namespaceURI === XHTML && ['html', 'head', 'body'].includes(el.localName)
    const here = implied ? d : d + 1
    if (!implied) elements += 1
    depth = Math.max(depth, here - (fragment ? 1 : 0))
    for (const child of el.children) walk(child, here)
    if (el.localName === 'template' && el.content) for (const child of el.content.children) walk(child, here)
  }
  walk(doc.documentElement, 0)
  return { elements, depth }
}
