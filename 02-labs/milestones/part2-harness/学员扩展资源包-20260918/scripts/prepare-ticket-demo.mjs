import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dest=path.resolve(process.argv[2]||path.join(root,'student-workspaces','ticket-'+new Date().toISOString().replace(/[:.]/g,'-')));
if(fs.existsSync(dest))throw Error('Refusing to overwrite existing path: '+dest);
fs.cpSync(path.join(root,'samples/ticket-agent'),dest,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:dest,stdio:'inherit'});if(r.status!==0)throw Error(`${cmd} failed; keep this copy for diagnosis. Prepare a new destination to retry.`);}
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);
const hashes={};const editable=new Set(['src/sla.ts','src/search.ts','src/report.ts']);
function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=path.posix.join(rel,e.name);if(['node_modules','.git','.course-evidence','.course-memory'].includes(e.name))continue;if(e.isDirectory())walk(path.join(dir,e.name),n);else if(!editable.has(n))hashes[n]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,e.name))).digest('hex');}}
walk(dest);fs.writeFileSync(path.join(dest,'.course-baseline.json'),JSON.stringify(hashes,null,2)+'\n');
run('git',['init','--quiet']);run('git',['add','.']);
const quote=x=>"'"+x.replaceAll("'","'\"'\"'")+"'";
console.log('\nNew project ready; no extension or global configuration changed.\n');
console.log('cd '+quote(dest)+'\nnpm run preflight\nsource ./course-env.sh\npi');
