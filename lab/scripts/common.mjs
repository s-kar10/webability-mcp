import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
export const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)))
export async function evidence(kind, fields = {}) {
  const run_id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}-${randomUUID().slice(0,8)}`
  const dir = join(ROOT, 'lab/private', run_id)
  await mkdir(dir, { recursive: true })
  const meta = { run_id, timestamp: new Date().toISOString(), git_commit: execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    tracked_dirty: Boolean(execFileSync('git',['diff','HEAD','--name-only'],{cwd:ROOT,encoding:'utf8'}).trim()),
    runner_sha256: createHash('sha256').update(await readFile(process.argv[1])).digest('hex'),
    environment: { node: process.version, platform: process.platform, arch: process.arch }, ...fields }
  return { dir, meta, save: (name, value) => writeFile(join(dir,name), typeof value === 'string' ? value : JSON.stringify(value,null,2)+'\n', {flag:'wx'}) }
}
export function checkUrl(raw) {
  const url = new URL(raw)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without embedded credentials')
  return url.href
}
