import { evidence, checkUrl } from './common.mjs'
const [case_id, builder, raw] = process.argv.slice(2)
if (!case_id || !builder || !raw) throw new Error('Usage: node lab/scripts/capture-page.mjs CASE_ID BUILDER URL')
const url = checkUrl(raw)
const e = await evidence('page', {case_id, builder, tested_url:url, command:process.argv.slice(1)})
const start = performance.now()
try {
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)})
  await e.save('page.html', await response.text())
  Object.assign(e.meta, {final_url:response.url, http_status:response.status,
    content_security_policy:response.headers.get('content-security-policy'),
    lab_cache:response.headers.get('x-install-lab-cache'), exit_code:response.ok ? 0 : 1})
} catch (error) {
  await e.save('error.txt', String(error))
  e.meta.exit_code = 1
} finally {
  Object.assign(e.meta, {duration_ms:performance.now()-start, finished_at:new Date().toISOString()})
  await e.save('run.json', e.meta)
  console.log(e.dir)
  process.exitCode = e.meta.exit_code
}
