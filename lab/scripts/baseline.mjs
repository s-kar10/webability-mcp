import { spawn } from 'node:child_process'
import { evidence, ROOT } from './common.mjs'
const e=await evidence('baseline',{case_id:'BASELINE',builder:'repository',command:['node','lab/scripts/baseline.mjs']})
const commands=[['typecheck',['run','typecheck']],['build',['run','build']],['test',['test']]]
const results=[]
for(const [name,args] of commands){
  const started_at=new Date().toISOString(); const start=performance.now(); let stdout='',stderr=''
  const code=await new Promise((resolve,reject)=>{
    const p=spawn('npm',args,{cwd:ROOT,env:{...process.env,WEBABILITY_SCAN_TELEMETRY:'off'}})
    p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b)
    p.once('error',reject);p.once('close',code=>resolve(code ?? 1))
  })
  await e.save(`${name}.stdout.txt`,stdout);await e.save(`${name}.stderr.txt`,stderr)
  results.push({command:['npm',...args],started_at,finished_at:new Date().toISOString(),duration_ms:performance.now()-start,exit_code:code,stdout_file:`${name}.stdout.txt`,stderr_file:`${name}.stderr.txt`})
  console.log(name,code)
}
await e.save('run.json',{...e.meta,results})
console.log(e.dir);process.exitCode=results.some(r=>r.exit_code!==0)?1:0
