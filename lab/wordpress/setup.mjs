import { randomBytes } from 'node:crypto'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { ROOT } from '../scripts/common.mjs'
process.chdir(ROOT)
await mkdir('lab/private',{recursive:true})
const command=['compose','-f','lab/wordpress/compose.yaml','run','--rm','cli','wp']
const exists=spawnSync('docker',[...command,'core','is-installed'],{stdio:'ignore'})
if(exists.status===0){console.log('WordPress is already installed');process.exit(0)}
let credentials={username:'lab-owner',password:randomBytes(24).toString('hex'),url:'http://127.0.0.1:8099/wp-admin/'}
try { credentials=JSON.parse(await readFile('lab/private/wordpress-admin.json','utf8')) }
catch (err) { if(err.code!=='ENOENT')throw err; await writeFile('lab/private/wordpress-admin.json',JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'}) }
const p=spawnSync('docker',[...command,'core','install','--url=http://127.0.0.1:8099','--title=WebAbility Install Failure Lab',`--admin_user=${credentials.username}`,`--admin_password=${credentials.password}`,'--admin_email=lab-owner@example.invalid','--skip-email'],{stdio:['ignore','pipe','pipe']})
if(p.status!==0){console.error('WordPress installation failed. Inspect Docker status; private credentials preserved.');process.exit(1)}
console.log('WordPress installed. Local credentials: lab/private/wordpress-admin.json')
