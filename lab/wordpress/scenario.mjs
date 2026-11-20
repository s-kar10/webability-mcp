import { spawnSync } from 'node:child_process'
import { evidence, ROOT } from '../scripts/common.mjs'
const scenario=process.argv[2]
if(!['healthy','wrong-slot','csp','cached'].includes(scenario))throw new Error('Use healthy, wrong-slot, csp, or cached')
const e=await evidence('wp-config',{case_id:`WP-${scenario}`,builder:'WordPress',scenario,command:['node','lab/wordpress/scenario.mjs',scenario]})
const steps=[]
function wp(...args){
 const command=['docker','compose','-f','lab/wordpress/compose.yaml','run','--rm','cli','wp',...args]
 const r=spawnSync(command[0],command.slice(1),{cwd:ROOT,encoding:'utf8'})
 steps.push({command,exit_code:r.status,stdout:r.stdout,stderr:r.stderr})
 if(r.status!==0)throw new Error('WordPress CLI failed')
}
try{
 wp('option','update','wa_lab_cache','no')
 wp('eval',"$f=WP_CONTENT_DIR.'/install-lab-page.html'; if(file_exists($f)) unlink($f);")
 wp('option','update','wa_lab_case',scenario==='cached'?'healthy':scenario)
 wp('option','update','wa_lab_installed',scenario==='cached'?'no':'yes')
 if(scenario==='cached'){
  wp('option','update','wa_lab_cache','yes')
  const r=await fetch('http://127.0.0.1:8099/');await e.save('primed-page.html',await r.text())
  await e.save('prime-headers.json',Object.fromEntries(r.headers))
  wp('option','update','wa_lab_installed','yes')
 }
 const response=await fetch('http://127.0.0.1:8099/')
 await e.save('page.html',await response.text());await e.save('headers.json',Object.fromEntries(response.headers))
}finally{await e.save('run.json',{...e.meta,finished_at:new Date().toISOString(),steps});console.log(e.dir)}
