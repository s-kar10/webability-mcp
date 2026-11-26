import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { evidence, ROOT } from './common.mjs'

// Exercise the built server without issuing a scan or modifying a lab site.
const e = await evidence('smoke', {
  case_id: 'MCP-STARTUP', builder: 'repository',
  command: ['node', 'lab/scripts/smoke.mjs'], started_at: new Date().toISOString(),
})
const client = new Client({ name: 'install-lab-smoke', version: '1' })
const transport = new StdioClientTransport({
  command: process.execPath, args: ['dist/index.js'], cwd: ROOT,
  env: { ...process.env, WEBABILITY_SCAN_TELEMETRY: 'off', WEBABILITY_SCAN_LOG: 'off', WEBABILITY_POSTHOG_MCP_ANALYTICS: 'off' },
  stderr: 'pipe',
})
let stderr = ''
let exit_code = 0
const start = performance.now()
transport.stderr?.on('data', chunk => { stderr += chunk })
try {
  await client.connect(transport)
  const result = await client.listTools()
  await e.save('tools.json', result)
  assert.ok(result.tools.some(tool => tool.name === 'check_install'), 'check_install must be registered')
  console.log(`Built MCP initialized; ${result.tools.length} tools; check_install registered`)
} catch (error) {
  exit_code = 1
  await e.save('error.txt', String(error))
} finally {
  await client.close().catch(() => {})
  await e.save('stderr.txt', stderr)
  await e.save('run.json', { ...e.meta, finished_at: new Date().toISOString(), duration_ms: performance.now() - start, exit_code, response_file: 'tools.json', stderr_file: 'stderr.txt' })
  console.log(e.dir)
  process.exitCode = exit_code
}
