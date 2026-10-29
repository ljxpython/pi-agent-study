import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { App } from './app.js';
import { Access, responseHeaders } from './access.js';
import { AppFault, assert, exactKeys, fault, string } from './contracts.js';
import { RESOURCE_ROOT } from './resources.js';
import { dataDirectory } from './storage.js';

function json(response:ServerResponse,status:number,body:unknown):void {response.statusCode=status;response.setHeader('Content-Type','application/json; charset=utf-8');response.end(JSON.stringify(body));}
function body(request:IncomingMessage):Promise<unknown> {
 assert(request.headers['content-type']?.split(';')[0].trim().toLowerCase()==='application/json','需要JSON请求','INVALID_INPUT');
 const limit=2*1024*1024+4096;
 return new Promise((resolve,reject)=>{
  let bytes=0,done=false;const chunks:Buffer[]=[];
  request.on('data',(chunk:Buffer)=>{if(done)return;bytes+=chunk.length;if(bytes>limit){done=true;chunks.length=0;reject(new AppFault('PAYLOAD_TOO_LARGE','请求体超过限制'));return;}chunks.push(chunk);});
  request.on('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new AppFault('INVALID_INPUT','JSON格式无效'));}});
  request.on('error',()=>{if(!done){done=true;reject(new AppFault('INVALID_INPUT','请求传输中断'));}});
 });
}
export async function startServer(root=dataDirectory(resolve(RESOURCE_ROOT,'../data')),port=5179,options:{developmentProxy?:boolean;app?:App}={}) {
 const app=options.app??await App.open(root);let access:Access;
 const server=createServer((req,res)=>{void handle(req,res).catch(error=>{if(res.headersSent){res.destroy();return;}const failure=error instanceof AppFault?error:new AppFault('STATE_UNAVAILABLE','请求处理失败');json(res,failure.status,{error:fault(failure)});});});
 async function handle(req:IncomingMessage,res:ServerResponse):Promise<void> {
  responseHeaders(res);const url=new URL(req.url??'/','http://127.0.0.1');const path=decodeURIComponent(url.pathname);const method=req.method??'GET';
  if(!path.startsWith('/api/')) {
   access.entry(req);assert(path==='/'||/^\/assets\/[A-Za-z0-9_.-]+$/.test(path),'页面资源不存在','RESOURCE_NOT_FOUND');
   const file=resolve(RESOURCE_ROOT,'../../frontend/dist',path==='/'?'index.html':path.slice(1));
   let data:Buffer;try{data=await readFile(file);}catch{throw new AppFault('RESOURCE_NOT_FOUND','请先构建前端资源');}
   const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(method==='HEAD'?undefined:data);return;
  }
  if(path==='/api/access'){access.check(req,true);json(res,200,access.bootstrap(await body(req)));return;}
  access.check(req);
  const readonly=app.snapshot().mode==='recovery_readonly';
  assert(!readonly||method==='GET'&&(path==='/api/state'||path==='/api/events'||path==='/api/requests'||/^\/api\/reports\/[^/]+(?:\/download)?$/.test(path)||/^\/api\/requests\/[^/]+$/.test(path)),'当前处于恢复只读模式','STATE_UNAVAILABLE');
  if(method==='GET'&&path==='/api/state'){json(res,200,app.snapshot());return;}
  if(method==='GET'&&path==='/api/events'){app.events.subscribe(res);return;}
  if(method==='GET'&&path==='/api/datasets'){json(res,200,{items:app.datasets.list()});return;}
  if(method==='POST'&&path==='/api/datasets'){const input=await body(req);exactKeys(input,['name','payload']);json(res,201,{dataset:await app.upload(input.name,input.payload)});return;}
  if(method==='GET'&&path.startsWith('/api/datasets/')){json(res,200,app.datasets.get(path.slice('/api/datasets/'.length)));return;}
  if(method==='PUT'&&path==='/api/selection'){json(res,200,await app.select(await body(req)));return;}
  if(method==='GET'&&path==='/api/resources'){json(res,200,app.resources.catalog());return;}
  if(method==='GET'&&path.startsWith('/api/resources/')){json(res,200,await app.resources.detail(path.slice('/api/resources/'.length)));return;}
  const template=/^\/api\/templates\/([^/]+)(\/reset)?$/.exec(path);
  if(template){if(method==='GET'&&!template[2]){json(res,200,app.resources.getTemplate(template[1]));return;}if(method==='PUT'&&!template[2]||method==='POST'&&template[2]){json(res,200,await app.template(template[1],await body(req),!!template[2]));return;}}
  if(path==='/api/model-config'){if(method==='GET'){json(res,200,app.models.view());return;}if(method==='PUT'){json(res,200,await app.configure(await body(req)));return;}}
  if(path==='/api/model-tests'&&method==='POST'){const result=await app.testModel(await body(req));json(res,result.duplicate?200:202,{request:result.request});return;}
  if(path==='/api/requests'&&method==='GET'){
   const query=Object.fromEntries(url.searchParams);
   exactKeys(query,['clientRequestId','sessionId']);assert([...url.searchParams].length===2,'查询参数不能重复');
   json(res,200,app.requestByClient(query.clientRequestId,query.sessionId));return;
  }
  if(path==='/api/requests'&&method==='POST'){const result=await app.submit(await body(req));json(res,result.duplicate?200:202,{request:result.request});return;}
  const request=/^\/api\/requests\/([^/]+)(\/stop)?$/.exec(path);
  if(request){if(method==='GET'&&!request[2]){json(res,200,app.request(request[1]));return;}if(method==='POST'&&request[2]){const input=await body(req);exactKeys(input,['expectedServerEpoch']);string(input.expectedServerEpoch,100);const result=await app.stop(request[1],input.expectedServerEpoch);json(res,result.status==='stopping'?202:200,result);return;}}
  const action=/^\/api\/report-actions\/([^/]+)\/(confirm|cancel|reapply)$/.exec(path);
  if(action&&method==='POST'){const input=await body(req);if(action[2]==='confirm'){const result=await app.confirm(action[1],input);json(res,result.saved?200:202,{action:result.action});}else if(action[2]==='cancel')json(res,200,{action:await app.cancel(action[1],input)});else{const result=await app.reapply(action[1],input);json(res,result.created?201:200,{action:result.action});}return;}
  const draft=/^\/api\/report-drafts\/([^/]+)$/.exec(path);
  if(draft&&method==='GET'){const d=app.draft(draft[1]);json(res,200,{draft:{draftId:d.draftId,contentHash:d.contentHash,analysisRef:d.analysis,requestId:d.requestId},markdown:d.markdown,status:d.status});return;}
  const report=/^\/api\/reports\/([^/]+)(\/download)?$/.exec(path);
  if(report&&method==='GET'){const saved=await app.reports.read(report[1]);if(report[2]){res.setHeader('Content-Type','text/markdown; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="report-${saved.summary.reportId}.md"`);res.end(saved.markdown);}else json(res,200,{...saved.summary,markdown:saved.markdown});return;}
  throw new AppFault('RESOURCE_NOT_FOUND','接口不存在');
 }
 try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});});}catch(e){await app.close();throw e;}
 const actualPort=(server.address() as AddressInfo).port;access=new Access(actualPort,options.developmentProxy);
 return {app,server,port:actualPort,close:async()=>{await app.close();server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const instance=await startServer();console.log(`Pi 工单问答助手：http://127.0.0.1:${instance.port}`);
 let closing=false;const close=()=>{if(closing)return;closing=true;void instance.close().then(()=>{process.exitCode=0;},()=>{process.exitCode=1;});};process.once('SIGINT',close);process.once('SIGTERM',close);
}
