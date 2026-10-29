import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2], extra=process.argv.slice(3);
const modes={hooks:['official-examples/protected-paths.ts','official-examples/input-transform.ts'],mvp:[],memory:['node_modules/pi-memory/index.ts'],web:['node_modules/@kkkiio/pi-web-ui/extensions/mirror-server.ts'],mcp:['config-examples/mcp-extension.ts'],lsp:['node_modules/@narumitw/pi-lsp/dist/index.ts'],subagents:['node_modules/pi-subagents/index.ts']};
if(!(mode in modes))throw Error('Choose hooks, mvp, memory, web, mcp, lsp or subagents');
const cwd=path.join(root,mode==='mvp'?'samples/mvp':mode==='hooks'?'samples/hooks':'samples/playground');
fs.mkdirSync(cwd,{recursive:true});
const env={...process.env,PI_TELEMETRY:'0',PI_MEMORY_DIR:path.join(root,'student-state/memory'),PI_MEMORY_QMD_UPDATE:'off',PI_MEMORY_EXIT_SUMMARY:'0',PI_WEB_UI_HOST:'127.0.0.1'};
env.PATH=path.join(root,'node_modules/.bin')+path.delimiter+(env.PATH||'');
const flags=mode==='mvp'?['--no-extensions','-e',path.join(root,'official-examples/todo.ts')]:['--no-extensions','--no-skills','--no-prompt-templates','--no-context-files'];
// MVP keeps prompt/skill discovery enabled; other presets intentionally isolate one capability.
const cli=path.join(root,'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
if(!fs.existsSync(cli))throw Error('Run npm install --ignore-scripts first');
const child=spawn(process.execPath,[cli,...flags,...modes[mode].flatMap(p=>['-e',path.join(root,p)]),...extra],{cwd,env,stdio:'inherit'});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?1:0);});
