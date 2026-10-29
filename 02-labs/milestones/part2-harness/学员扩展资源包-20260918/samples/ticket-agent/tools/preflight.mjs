import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
for (const [cmd,args] of [['node',['--version']],['npm',['--version']],['python3',['--version']],['git',['--version']],['pi',['--version']]]) {
 const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0)throw Error(`${cmd} unavailable`);console.log(r.stdout.trim()||r.stderr.trim());
}
for(const p of ['node_modules/typescript/bin/tsc','node_modules/typescript-language-server/lib/cli.mjs','.pi/mcp.json','.pi/pi-lsp.json','.pi/agents/course-scout.md','.pi/agents/course-reviewer.md'])if(!fs.existsSync(p))throw Error(`Missing: ${p}`);
const msgs=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'course-preflight',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_policy',arguments:{}}},{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'list_tickets',arguments:{}}}];
const r=spawnSync('python3',['tools/mcp-server.py'],{input:msgs.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:15000});
if(r.status!==0)throw Error('MCP process failed');const out=r.stdout.trim().split('\n').map(x=>JSON.parse(x));
if(out.some(x=>x.error||x.result?.isError)||out.length!==4)throw Error('MCP protocol failed');
const policy=JSON.parse(out.find(x=>x.id===3).result.content[0].text);const tickets=JSON.parse(out.find(x=>x.id===4).result.content[0].text);
if(policy.policy.urgentHours!==4||policy.policy.normalHours!==24||tickets.tickets.length!==6)throw Error('Unexpected fixture');
console.log('PASS: local dependencies and MCP protocol, thresholds 4/24, six tickets.');
console.log('Next: source ./course-env.sh; pi; /course-check. Model, web search, LSP extension execution and child model still require T2.');
