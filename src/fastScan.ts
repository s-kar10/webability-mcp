/**
 * In-process scan_html (DEV-1089 item 6): jsdom + the WebAbility detectors +
 * axe-core, no browser, no network. A component-sized snippet audits in
 * milliseconds instead of the ~1.5 s a headless Chromium launch costs.
 *
 * jsdom has no layout engine, so two shims stand in for it:
 *   - client rects: every element that is not display:none reports one rect.
 *     Without this, visibility gates (`getClientRects().length === 0`) hide
 *     the whole page and `missing_h1` fires on a page WITH an h1.
 *   - media readyState: axe's preload waits for `loadedmetadata` on every
 *     <video>/<audio>, which never fires in jsdom — 10 s stall per page.
 *
 * What layout cannot fake, we do not report: every finding whose rule is in
 * the `visual` fixability tier (contrast, target size, focus ring, reflow…)
 * is dropped and counted in `skippedVisual`. Use engine:"browser" for those.
 *
 * The engine is process-wide (one jsdom document, one scan at a time, on the
 * main thread), so a scan is an event-loop block for everything else this
 * server answers. Three guards keep it from becoming a freeze: a pre-scan cap
 * on bytes / element count / nesting depth, a hard deadline per call
 * (withDeadline), and a bounded queue that answers "busy, retry in Ns" rather
 * than chaining callers behind an unbounded backlog.
 */
import { defaultTreeAdapter, parse as parse5Parse } from 'parse5'
import { createRequire } from 'module'
import type { InternalBug, JudgeOptions, JudgedEntry } from '@webability/core'
import { withDeadline } from './deadline.js'
import { enrichIssue, type Fixability } from './fixOps.js'

const require = createRequire(import.meta.url)

/**
 * Caps, deadline and queue for the in-process engine.
 *
 * This engine is process-wide: ONE jsdom document, one scan at a time, and the
 * detector kernel runs on the main thread — a scan IS an event-loop block, so
 * /health and every other tool stall behind it. Measured on origin/main:
 * 12 KB of markup blocked the loop 5.9 s, 24 KB 33 s, a depth-800 nest 10 s.
 * The cost is superlinear in element count and nesting depth, not in bytes, so
 * the snippet gets a ceiling in all three dimensions. Anything bigger belongs
 * on scan_page or on engine:"browser", where each scan is its own page.
 */
export const SCAN_HTML_MAX_BYTES = 256 * 1024
/** Measured: 300 flat elements ≈ 9 s worst case, 500 ≈ 38 s. A component snippet, not a page. */
export const SCAN_HTML_MAX_ELEMENTS = 300
/** Real markup nests well under 30. The 800-deep shape takes 10 s. */
export const SCAN_HTML_MAX_DEPTH = 100
/**
 * In-flight + queued scan_html calls allowed on one process. Past this the
 * caller is told the server is busy instead of joining a chain of unknown
 * length — unbounded queueing is what turned one slow scan into a total stall.
 */
export const DEFAULT_SCAN_HTML_QUEUE = 8
/**
 * One scan_html call may not outlive this. scan_page's hosted budget is 25 s;
 * the snippet engine gets the same idea one second under it.
 */
export const SCAN_HTML_DEADLINE_MS = 24_000

export type ScanHtmlLimitKind = 'bytes' | 'elements' | 'depth'

/** The snippet is past an engine cap. The message always names the way out. */
export class ScanHtmlLimitError extends Error {
  constructor(
    readonly kind: ScanHtmlLimitKind,
    message: string,
  ) {
    super(message)
    this.name = 'ScanHtmlLimitError'
  }
}

/** Every scan slot is taken: answer with retry guidance, never queue forever. */
export class ScanHtmlBusyError extends Error {
  readonly retryAfterSeconds: number
  constructor(
    readonly queueDepth: number,
    retryAfterSeconds: number,
  ) {
    super(
      `scan_html is at capacity: ${queueDepth} in-process scan(s) already running or queued on this server (the jsdom engine scans one document at a time). ` +
        `Server busy — retry in ${retryAfterSeconds}s. A snippet this slow belongs on scan_page, or on scan_html with engine:"browser".`,
    )
    this.name = 'ScanHtmlBusyError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Elements and nesting depth of the tree the HTML parser builds from this
 * markup, counted on parse5 (the parser jsdom uses) before the engine sees it.
 * A hand-written tokenizer here kept under-counting: a stray `<`, an `=` outside
 * a value, an end tag whose name differs by one character, `</p>` and `</br>`
 * that build elements (a seeded fuzz against parse5 found thousands). Counting
 * the parser's own tree cannot be bypassed that way. parse5 is a linear state
 * machine, so a 256 KB unterminated tag costs one pass; building a bare tree is
 * cheap next to the detectors, which are what the caps protect.
 *
 * The walk stops as soon as a cap is passed. The implied html, head and body
 * do not count; `<template>` content does (over-counting only refuses a rare
 * safe snippet).
 */
/** The document the engine writes for this input: a snippet goes inside a fixed page, a whole document as is. */
export function engineDocument(html: string): { doc: string; fragment: boolean } {
  const fragment = !looksLikeDocument(html)
  return { doc: fragment ? `<!doctype html><html lang="en"><head><title>snippet</title></head><body><main><h1>Snippet</h1>${html}</main></body></html>` : html, fragment }
}
/** Elements and depth the fixed snippet page adds by itself: title, main, h1; main is one level. */
const WRAPPER_ELEMENTS = 3
const WRAPPER_DEPTH = 1
const HTML_NS = 'http://www.w3.org/1999/xhtml'
/**
 * The document's own html/head/body, which every page has and the caps ignore.
 * Inside <svg>/<math> the same tag names are foreign elements the parser really
 * builds, so the skip is keyed on the HTML namespace, not the name alone.
 */
const isImpliedRoot = (tagName: string, namespaceURI: unknown) =>
  namespaceURI === HTML_NS && (tagName === 'html' || tagName === 'head' || tagName === 'body')
/** Thrown out of the parse5 tree adapter to stop a parse past the element cap. */
const OVER_ELEMENTS = new Error('scan_html element cap')
const OVER_DEPTH = new Error('scan_html depth cap')

export function estimateMarkupSize(html: string): { elements: number; depth: number; over?: ScanHtmlLimitKind } {
  // Parse what the engine will write: a `</p>` inside the snippet page builds
  // a <p>, while the same `</p>` at the top of a bare document is dropped.
  const { doc, fragment } = engineDocument(html)
  // parse5's tree builder slows down sharply with depth (52k nested divs: 9 s),
  // so the parse itself must stop at the cap: count every element as the
  // builder creates it and abort past the cap. Created >= built (the adoption
  // agency clones), so stopping early only ever refuses, never under-counts.
  let created = fragment ? -WRAPPER_ELEMENTS : 0
  const depthOf = new WeakMap<object, number>()
  const track = (parent: any, node: any) => {
    if (typeof node.tagName !== 'string') return
    const implied = isImpliedRoot(node.tagName, node.namespaceURI)
    const d = (depthOf.get(parent) ?? 0) + (implied ? 0 : 1)
    depthOf.set(node, d)
    if (d - (fragment ? WRAPPER_DEPTH : 0) > SCAN_HTML_MAX_DEPTH) throw OVER_DEPTH
  }
  const capped = {
    ...defaultTreeAdapter,
    createElement(tagName: string, namespaceURI: any, attrs: any) {
      if (!isImpliedRoot(tagName, namespaceURI)) {
        created += 1
        if (created > SCAN_HTML_MAX_ELEMENTS) throw OVER_ELEMENTS
      }
      return defaultTreeAdapter.createElement(tagName, namespaceURI, attrs)
    },
    // Depth as nodes are attached, so a deep nest is refused as too deep, not
    // as too many elements. A node the adoption agency moves keeps a stale depth
    // on its children; that can only miss here, and the exact walk below
    // still measures the (now small) tree.
    appendChild(parent: any, node: any) {
      track(parent, node)
      defaultTreeAdapter.appendChild(parent, node)
    },
    insertBefore(parent: any, node: any, ref: any) {
      track(parent, node)
      defaultTreeAdapter.insertBefore(parent, node, ref)
    },
  }
  let root: any
  try {
    root = parse5Parse(doc, { treeAdapter: capped as typeof defaultTreeAdapter })
  } catch (err) {
    if (err === OVER_ELEMENTS) return { elements: created, depth: 0, over: 'elements' }
    if (err === OVER_DEPTH) return { elements: created, depth: SCAN_HTML_MAX_DEPTH + 1, over: 'depth' }
    throw err
  }
  let elements = fragment ? -WRAPPER_ELEMENTS : 0
  let maxDepth = 0
  const depthOffset = fragment ? WRAPPER_DEPTH : 0
  const stack: Array<[any, number]> = [[root, 0]]
  while (stack.length) {
    const [node, depth] = stack.pop()!
    let childDepth = depth
    if (typeof node.tagName === 'string') {
      if (!isImpliedRoot(node.tagName, node.namespaceURI)) {
        elements += 1
        if (elements > SCAN_HTML_MAX_ELEMENTS) return { elements, depth: maxDepth, over: 'elements' }
        childDepth = depth + 1
        if (childDepth - depthOffset > maxDepth) {
          maxDepth = childDepth - depthOffset
          if (maxDepth > SCAN_HTML_MAX_DEPTH) return { elements, depth: maxDepth, over: 'depth' }
        }
      }
    }
    const kids = node.childNodes as any[] | undefined
    if (kids) for (let k = kids.length - 1; k >= 0; k--) stack.push([kids[k], childDepth])
    if (node.content?.childNodes) stack.push([node.content, childDepth])
  }
  return { elements, depth: maxDepth }
}

/**
 * Refuse a snippet the shared in-process engine cannot scan inside its budget,
 * BEFORE a byte of it reaches jsdom. Every message names the alternative —
 * a refusal with no way forward is just retried by the agent.
 */
export function assertScanHtmlWithinCaps(html: string): void {
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > SCAN_HTML_MAX_BYTES) {
    throw new ScanHtmlLimitError(
      'bytes',
      `scan_html html is ${kb(bytes)} KB; the in-process engine caps a snippet at ${kb(SCAN_HTML_MAX_BYTES)} KB. ` +
        'Split it into smaller snippets, or use scan_page on the URL (or scan_html with engine:"browser") to scan a whole page.',
    )
  }
  const { elements, depth, over } = estimateMarkupSize(html)
  if (over === 'elements') {
    throw new ScanHtmlLimitError(
      'elements',
      `scan_html html has ~${elements} elements; the in-process engine caps a snippet at ${SCAN_HTML_MAX_ELEMENTS} (its cost grows superlinearly with element count). ` +
        'Split it into smaller snippets, or use scan_page on the URL (or scan_html with engine:"browser") to scan a whole page.',
    )
  }
  if (over === 'depth') {
    throw new ScanHtmlLimitError(
      'depth',
      `scan_html html nests ${depth} levels deep; the in-process engine caps nesting at ${SCAN_HTML_MAX_DEPTH} levels. ` +
        'Flatten the markup, or use scan_page on the URL (or scan_html with engine:"browser") to scan the page as built.',
    )
  }
}

const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString('en-US')}`

function scanQueueLimit(): number {
  const raw = Number(process.env.MCP_SCAN_HTML_MAX_QUEUE)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_SCAN_HTML_QUEUE
}

/** How long a caller at the back of the queue should wait: the scans ahead of it, at the recent measured pace. */
function retryAfterSeconds(depth: number): number {
  return Math.min(30, Math.max(1, Math.ceil((depth * recentScanMs) / 1000)))
}

/** Scans in flight + waiting. */
let queueDepth = 0
/** EWMA of completed in-process scans, the basis of the "retry in Ns" hint. */
let recentScanMs = 750

export interface FastScanIssue {
  id: string
  type: string
  wcag: string
  level?: string
  impact: string
  message: string
  selector: string
  html?: string
  fixability: Fixability
  fix: { op: string; attribute?: string; value?: string; currentValue?: string; suggestedValue?: string; needsManualReview?: boolean }
}

export interface FastScanResult {
  engine: 'in-process'
  fragment: boolean
  issues: FastScanIssue[]
  summary: { total: number; critical: number; serious: number; moderate: number; minor: number }
  /** AI-judge verdicts on findings the engines could not decide (text-only here). */
  judged?: JudgedEntry[]
  skippedVisual: number
  engineWarnings?: string[]
  internal_bugs?: InternalBug[]
  durationMs: number
}

const looksLikeDocument = (html: string) => /<html[\s>]|<!doctype/i.test(html)

function installLayoutShims(win: any) {
  const Element = win.Element
  // jsdom's getComputedStyle reads the element's inline style and throws on
  // elements that have none (a MathML root: <math lang="en">). Such an element
  // gets an empty declaration, as an unstyled element would.
  const computed = win.getComputedStyle.bind(win)
  win.getComputedStyle = (el: any, pseudo?: string) => (el && el.style === undefined ? win.document.createElement('div').style : computed(el, pseudo))
  const rect = (el: any) => {
    const style = win.getComputedStyle(el)
    if (style && style.display === 'none') return null
    let p = el.parentElement
    while (p) {
      if (win.getComputedStyle(p).display === 'none') return null
      p = p.parentElement
    }
    return { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON() { return this } }
  }
  Element.prototype.getBoundingClientRect = function () {
    return rect(this) ?? { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() { return this } }
  }
  Element.prototype.getClientRects = function () {
    const r = rect(this)
    const list: any = r ? [r] : []
    list.item = (i: number) => list[i] ?? null
    return list
  }
  if (win.HTMLMediaElement) {
    Object.defineProperty(win.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 })
  }
  // Canvas is used only by the colour kernel (contrast) — visual tier, dropped anyway.
  if (win.HTMLCanvasElement) {
    win.HTMLCanvasElement.prototype.getContext = () => null
  }
  // No layout means no hit testing: nothing is at any point.
  win.Document.prototype.elementFromPoint = () => null
  win.Document.prototype.elementsFromPoint = () => []
  // jsdom has no CSS namespace; the kernel builds selectors with CSS.escape.
  if (!win.CSS) win.CSS = { escape: cssEscape }
}

/** CSS.escape per CSSOM §2.1.1 (serialize an identifier). */
function cssEscape(value: unknown): string {
  const s = String(value)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 0) out += '\uFFFD'
    else if ((c >= 0x1 && c <= 0x1f) || c === 0x7f || (i === 0 && c >= 0x30 && c <= 0x39) || (i === 1 && c >= 0x30 && c <= 0x39 && s.charCodeAt(0) === 0x2d)) out += '\\' + c.toString(16) + ' '
    else if (i === 0 && c === 0x2d && s.length === 1) out += '\\' + s[i]
    else if (c >= 0x80 || c === 0x2d || c === 0x5f || (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) out += s[i]
    else out += '\\' + s[i]
  }
  return out
}

let scanning: Promise<void> = Promise.resolve()

/**
 * ONE jsdom window for the life of the process. axe-core (and the detector
 * kernel) bind to the ambient `window`/`document` when first loaded, so a
 * fresh JSDOM per call scans the FIRST document forever — the second call
 * returned nothing. Instead the document is rewritten in place per scan
 * (`document.open/write/close`), which keeps every engine pointed at the
 * live content.
 */
let shared: { dom: import('jsdom').JSDOM; win: any } | null = null

function sharedWindow() {
  if (shared) return shared
  const { JSDOM, VirtualConsole } = require('jsdom') as typeof import('jsdom')
  // jsdom logs "Not implemented" (canvas etc.) to the console by default — keep stderr clean.
  const virtualConsole = new VirtualConsole()
  const dom = new JSDOM('<!doctype html><html><head><title></title></head><body></body></html>', { pretendToBeVisual: true, virtualConsole })
  const win = dom.window as any
  installLayoutShims(win)
  const g = globalThis as any
  // Detectors run in Node's realm and read DOM globals (NodeFilter, CSS,
  // HTMLInputElement...) as free identifiers: expose every jsdom global Node
  // lacks. Lazy getters, so a throwing accessor (localStorage on an opaque
  // origin) throws only if a detector reads it.
  for (const k of Object.getOwnPropertyNames(win)) {
    if (k in g) continue
    Object.defineProperty(g, k, { configurable: true, get: () => win[k] })
  }
  shared = { dom, win }
  return shared
}

export interface FastScanOptions {
  wcagTags?: string[]
  level?: 'A' | 'AA' | 'AAA'
  judge?: JudgeOptions
  /** Hard budget for one scan. Defaults to SCAN_HTML_DEADLINE_MS. */
  deadlineMs?: number
}

export async function fastScanHtml(html: string, opts: FastScanOptions = {}): Promise<FastScanResult> {
  // The caps run here as well as in the handler: this is a public entry point
  // (tests, the CLI), and a cap the caller can forget is not a cap.
  assertScanHtmlWithinCaps(html)

  const limit = scanQueueLimit()
  if (queueDepth >= limit) throw new ScanHtmlBusyError(queueDepth, retryAfterSeconds(queueDepth))
  queueDepth += 1

  // Serialise on a module-level chain: the detector kernel and axe read the
  // ambient `window`/`document`, so scans must not interleave. The chain is
  // released by the WORK, never by the caller's deadline — see
  // fastScanHtmlSerial.
  const previous = scanning
  let releaseChain!: () => void
  scanning = new Promise<void>((resolve) => (releaseChain = resolve))

  let settled = false
  // `scanMs` is the scan's OWN duration, absent when the scan never ran (its
  // caller gave up while it was queued) — the average is the pace of one scan,
  // so neither queue wait nor a skipped waiter moves it.
  const onSettled = (scanMs?: number) => {
    if (settled) return
    settled = true
    queueDepth -= 1
    if (scanMs !== undefined) recentScanMs = Math.round(recentScanMs * 0.7 + scanMs * 0.3)
    releaseChain()
  }

  return fastScanHtmlSerial(html, opts, previous, onSettled)
}

/**
 * One call, inside the serial chain, under a hard deadline.
 *
 * The deadline covers the QUEUE WAIT as well as the scan (it starts at call
 * entry, in fastScanHtml), so a call cannot outlive its budget however long the
 * queue is. It releases the CALLER; `onSettled` fires when the scan itself
 * ends. They are deliberately not the same moment: a scan that blew its
 * deadline may still own the one shared jsdom document, and the next scan
 * writing into that document would corrupt both results.
 *
 * What the deadline cannot do is preempt the detector kernel: those seconds are
 * one synchronous block, and a timer only fires when the loop yields. That part
 * is bounded by the caps — which is why both guards exist.
 */
function fastScanHtmlSerial(html: string, opts: FastScanOptions, previous: Promise<void>, onSettled: (scanMs?: number) => void): Promise<FastScanResult> {
  const abort = new AbortController()
  // The scan starts only when its turn comes; until then it is a waiter the
  // deadline can still cut, and one that never touches the shared document.
  const work = previous.then(() => scanHtmlInSharedWindow(html, opts, abort.signal))
  // `scanHtmlInSharedWindow` is async, so it cannot throw before returning a
  // promise: the slot and the chain are always released exactly once.
  work.then(
    (r) => onSettled(r.durationMs),
    () => onSettled(undefined),
  )
  return withDeadline(() => work, opts.deadlineMs ?? SCAN_HTML_DEADLINE_MS, 'scan_html').catch((err) => {
    // The caller gave up. A scan that already started stops at its next
    // checkpoint; one still queued aborts before it rewrites the document.
    abort.abort()
    throw err
  })
}

async function scanHtmlInSharedWindow(html: string, opts: FastScanOptions, signal: AbortSignal): Promise<FastScanResult> {
  const started = Date.now()
  const { doc, fragment } = engineDocument(html)
  const { win } = sharedWindow()
  // A scan whose deadline already fired must not rewrite the document: the
  // next scan may be writing its own content by now.
  signal.throwIfAborted()
  win.document.open()
  win.document.write(doc)
  win.document.close()

  const { scanDocument, installDomKernel } = await import('@webability/core/dom')
  // Detector functions run in Node's realm and read the kernel helpers
  // (isVisible, uniqueSel, isHiddenFromAT...) as free identifiers: install them
  // on Node's globalThis (scanDocument installs them on the jsdom window only),
  // or every detector throws and scan_html runs axe alone. Idempotent.
  installDomKernel(globalThis)
  signal.throwIfAborted()
  const result = await scanDocument({ window: win, includeAxe: true, wcagTags: opts.wcagTags, level: opts.level, judge: opts.judge })
  let skippedVisual = 0
  const project = (list: any[]) => {
    const out: FastScanIssue[] = []
    for (const i of list) {
      const e = enrichIssue({ id: i.id, type: i.type, wcag: i.wcag, level: i.level, impact: i.impact, message: i.message, selector: i.selector, html: i.html?.slice(0, 400), fix: i.fix }) as any
      if (e.fixability === 'visual') { skippedVisual++; continue }
      out.push(e)
    }
    return out
  }
  const issues = project(result.issues)
  const count = (lvl: string) => issues.filter((i) => i.impact === lvl).length
  const warnings = (result.engineWarnings ?? []).filter((w) => !w.startsWith('focus:'))
  return {
    engine: 'in-process',
    fragment,
    issues,
    summary: { total: issues.length, critical: count('critical'), serious: count('serious'), moderate: count('moderate'), minor: count('minor') },
    skippedVisual,
    ...(result.judged?.length ? { judged: result.judged } : {}),
    ...(warnings.length ? { engineWarnings: warnings } : {}),
    internal_bugs: result.internal_bugs ?? [],
    durationMs: Date.now() - started,
  }
}
