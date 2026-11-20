import { chromium } from 'playwright'
import { evidence, checkUrl } from './common.mjs'
const [case_id,builder,raw,container_id,published_version,trigger,consent_state] = process.argv.slice(2)
if(!consent_state || !/^GTM-[A-Z0-9]+$/.test(container_id ?? '')) throw new Error('Usage: node lab/scripts/gtm-timing.mjs CASE BUILDER URL GTM-ID VERSION TRIGGER CONSENT_STATE')
const url=checkUrl(raw)
const e=await evidence('gtm',{case_id,builder,tested_url:url,container_id,published_version,trigger,consent_state,
  command:['node','lab/scripts/gtm-timing.mjs',...process.argv.slice(2)],observation_window_ms:30000})
const widget=(raw)=>{try{const u=new URL(raw);return u.protocol==='https:' && ['enhancer.webability.io','widget-v2.webability.io','widget.webability.io','widget.access-widget.com'].includes(u.hostname)&&u.pathname==='/widget.min.js'}catch{return false}}
const gtm=(raw)=>{try{const u=new URL(raw);return u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtm.js'&&u.searchParams.get('id')===container_id}catch{return false}}
let browser
const runs=[]
const INIT=`(() => {
 const out=[];window.__labInsertions=out;
 const record=s=>{if(s.src)out.push({url:s.src,ms:performance.now()})};
 new MutationObserver(records=>records.forEach(r=>{
  if(r.type==='attributes') {record(r.target);return}
  r.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.tagName==='SCRIPT')record(n);n.querySelectorAll?.('script[src]').forEach(record)}})
 })).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
})()`
async function sample(page, cache, index){
 const events=[];const started_at=new Date().toISOString();const start=performance.now();let error=null
 const onRequest=r=>{if(r.resourceType()==='script'&&!r.frame().parentFrame())events.push({event:'request',url:r.url(),ms:performance.now()-start})}
 const onFinish=r=>{if(r.resourceType()==='script'&&!r.frame().parentFrame()&&!r.redirectedTo()){let original=r;while(original.redirectedFrom())original=original.redirectedFrom();events.push({event:'finished',url:r.url(),original_url:original.url(),ms:performance.now()-start})}}
 const onFail=r=>events.push({event:'failed',url:r.url(),ms:performance.now()-start,failure:r.failure()?.errorText})
 page.on('request',onRequest);page.on('requestfinished',onFinish);page.on('requestfailed',onFail)
 let dom=[]
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000})
  if(!response||response.status()>=400)throw new Error('Navigation HTTP '+response?.status())
  await page.waitForTimeout(Math.max(0,30000-(performance.now()-start)))
  dom=await page.evaluate(()=>window.__labInsertions ?? [])
 }catch(err){error=String(err)}
 finally{page.off('request',onRequest);page.off('requestfinished',onFinish);page.off('requestfailed',onFail)}
 const first=(event,predicate)=>events.find(x=>x.event===event&&predicate(x.original_url ?? x.url))?.ms ?? null
 const row={index,cache,started_at,finished_at:new Date().toISOString(),duration_ms:performance.now()-start,error,
  gtm_request_ms:first('request',gtm),widget_request_ms:first('request',widget),widget_completed_ms:first('finished',widget),
  widget_insertion_ms:dom.find(x=>widget(x.url))?.ms ?? null,events,insertions:dom}
 runs.push(row);await e.save(`sample-${index}.json`,row)
 console.log(cache,index,row.widget_request_ms ?? 'not observed')
}
try{
 browser=await chromium.launch({headless:true})
 for(let i=1;i<=5;i++){const c=await browser.newContext();await c.addInitScript(INIT);try{await sample(await c.newPage(),'fresh',i)}finally{await c.close()}}
 const c=await browser.newContext();await c.addInitScript(INIT)
 try{
  const page=await c.newPage();await page.goto(url,{waitUntil:'load',timeout:30000})
  await e.save('warm-prime.json',{url,finished_at:new Date().toISOString(),note:'Unscored priming navigation; no consent interactions performed'})
  for(let i=6;i<=10;i++)await sample(page,'warm',i)
 }finally{await c.close()}
}catch(error){
 await e.save('error.txt',String(error));process.exitCode=1
}finally{
 await browser?.close()
 const summary={}
 for(const cache of ['fresh','warm']){
  const rows=runs.filter(r=>r.cache===cache);const times=rows.filter(r=>!r.error&&r.widget_request_ms!==null).map(r=>r.widget_request_ms).sort((a,b)=>a-b)
  summary[cache]={attempts:rows.length,observed:times.length,unknown:rows.length-times.length,
    median_ms:times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:null,
    maximum_ms:times.length?times.at(-1):null,observed_over_10s:times.filter(t=>t>10000).length}
 }
 await e.save('run.json',{...e.meta,exit_code:process.exitCode ?? 0,summary,note:'Request/finish times are runner monotonic milliseconds since navigation command; insertion times use page performance time origin. No consent clicks performed. Pair with check.mjs runs for tool duration.'})
 console.log(e.dir)
}
