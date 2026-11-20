import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { evidence, checkUrl, ROOT } from './common.mjs'
const [case_id,builder,raw] = process.argv.slice(2)
if (!case_id || !builder || !raw) throw new Error('Usage: node lab/scripts/check.mjs CASE_ID BUILDER URL')
const url = checkUrl(raw)
const e = await evidence('check', { case_id,builder,tested_url:url,command:['node','lab/scripts/check.mjs',case_id,builder,url] })
const client = new Client({name:'install-failure-lab',version:'1'})
const transport = new StdioClientTransport({command:process.execPath,args:['--import','tsx','src/index.ts'],cwd:ROOT,
  env:{...process.env,WEBABILITY_SCAN_TELEMETRY:'off',WEBABILITY_SCAN_LOG:'off',WEBABILITY_POSTHOG_MCP_ANALYTICS:'off'},stderr:'pipe'})
let stderr=''; let exit_code=0; let result
transport.stderr?.on('data',b=>{stderr+=b.toString()})
e.meta.started_at = new Date().toISOString()
const start=performance.now()
try {
  await client.connect(transport)
  e.meta.call_started_at = new Date().toISOString()
  const callStart=performance.now()
  result=await client.callTool({name:'check_install',arguments:{url}},undefined,{timeout:60000})
  e.meta.call_duration_ms=performance.now()-callStart
  if (result.isError) exit_code=1
} catch (error) { exit_code=1; result={runner_error:String(error)} }
finally {
  e.meta.duration_ms=performance.now()-start
  e.meta.finished_at=new Date().toISOString()
  await client.close().catch(()=>{})
  Object.assign(e.meta,{exit_code,response_file:'response.json',stderr_file:'stderr.txt'})
  await e.save('response.json',result)
  await e.save('stderr.txt',stderr)
  await e.save('run.json',e.meta)
  console.log(JSON.stringify({run_dir:e.dir,state:result?.structuredContent?.state ?? null,isError:result?.isError ?? Boolean(result?.runner_error),duration_ms:e.meta.duration_ms}))
  process.exitCode=exit_code
}
