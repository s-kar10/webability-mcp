import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { ROOT } from './common.mjs'
const manifest=JSON.parse(await readFile(join(ROOT,'lab/evidence/manifest.json'),'utf8'))
for(const f of manifest.files){
 assert.equal(createHash('sha256').update(await readFile(join(ROOT,'lab',f.file))).digest('hex'),f.sha256,f.file)
}
const matrix=JSON.parse(await readFile(join(ROOT,'lab/cases/matrix.json'),'utf8'))
assert.equal(matrix.length,24);assert.equal(new Set(matrix.map(r=>r.case_id)).size,24)
for(const row of matrix){
 assert.ok(['planned','reproduced','access-blocked','not applicable'].includes(row.status))
 for(const key of ['state_score','explanation_score'])assert.ok([null,'right','wrong','unknown'].includes(row[key]))
 if(row.status==='reproduced'){
  for(const key of ['control_run','broken_run','repair_run']){
   assert.ok(row[key]);const run=JSON.parse(await readFile(join(ROOT,'lab/evidence',row[key],'run.json'),'utf8'))
   assert.equal(run.builder,row.builder)
  }
  assert.ok(await readFile(join(ROOT,'lab',row.ground_truth_file)))
 }
}
console.log(`Verified ${manifest.files.length} raw evidence hashes and 24 case records`)
