import { ApiClient, ApiFailure, type Envelope } from './api.js';
import { setResources, type Resource } from './resources.js';
import type { Dataset, DatasetPayload, QueryResult } from './domain.js';
interface Source {datasetId:string;version:string}
interface Message {id:string;requestId:string;role:'user'|'assistant';text:string;status:string}
interface Request {requestId:string;clientRequestId:string;kind:string;status:string;error:{message:string}|null;steps:Step[]}
export interface Step {id:string;tool:string;label:string;status:string;durationMs:number|null;sourceRef:Source|null;error:{message:string}|null}
export interface ModelView {credentialMode:'host'|'independent';revision:number;provider:string;modelId:string;api:string|null;baseUrl:string|null;configured:boolean}
function validRequest(value:unknown,id:string):value is Request {
 if(!value||typeof value!=='object')return false;
 const request=value as Record<string,unknown>;
 return request.clientRequestId===id&&typeof request.requestId==='string'&&request.requestId.length>0&&
  ['accepted','running','stopping','completed','failed','cancelled','interrupted'].includes(String(request.status))&&Array.isArray(request.steps);
}
interface Action {actionId:string;draftId:string;status:string;expiresAt:string;reportId:string|null}
interface Query extends Omit<QueryResult,'sourceRef'|'requestId'> {analysis:{analysisId:string;queryRequestId:string;sourceRef:Source;contextRevision:number};summaryStatus:string;evaluation:{evaluation:string;missingRules:string[];counts:Record<string,number>;basis:{now:string|null;policy:{urgentHours:number|null;normalHours:number|null}}}|null}
interface Report {reportId:string;draftId:string;actionId:string;title:string;sourceRef:Source;contentHash:string;savedAt:string}
interface Snapshot {mode:'normal'|'recovery_readonly';serverEpoch:string;sessionId:string|null;seq:number;request:Request|null;messages:Message[];reports:Report[];selection?:{revision:number;sourceRef:Source|null};resourceRevision?:number;model?:ModelView;query?:Query|null;reportAction?:Action|null;error?:{message:string}}
interface Summary {id:string;name:string;version:string;count:number;origin:'builtin'|'upload'}
export interface Preview {actionId:string;requestId:string;sourceRef:QueryResult['sourceRef'];body:string;contentHash:string;expiresAt:string}
export interface Saved extends Report {body:string;sourceRef:QueryResult['sourceRef']}
export const isBusy=(status:string)=>status!=='idle';
export class ApiRuntime {
 notice='正在连接后端…';connected=false;datasets:Dataset[]=[];reports:Saved[]=[];preview:Preview|null=null;
 private state:Snapshot|undefined;private pending=false;private updateScheduled=false;private resourceLoad=0;private datasetLoad=0;private reportLoad=0;
 private retrySubmission:{text:string;body:unknown;id:string;sessionId:string}|undefined;
 constructor(private readonly changed:()=>void,readonly api=new ApiClient()){}
 get request():Request|null{return this.state?.request??null;}
 get model():ModelView|undefined{return this.state?.model;}
 get messages():Message[]{return this.state?.messages??[];}
 get steps():Step[]{return this.state?.request?.steps??[];}
 get selectedDatasetId():string|null{return this.state?.selection?.sourceRef?.datasetId??null;}
 get readonly():boolean{return this.state?.mode==='recovery_readonly';}
 get canStop():boolean{return !!this.state?.request&&['accepted','running','stopping'].includes(this.state.request.status);}
 get status():'idle'|'running'|'awaiting-confirmation'{
  if(!this.connected||this.readonly||this.pending||this.canStop||this.state?.reportAction?.status==='saving')return 'running';
  return this.state?.reportAction?.status==='pending_confirmation'?'awaiting-confirmation':'idle';
 }
 get previewState():string {const status=this.state?.reportAction?.status;return status==='pending_confirmation'?'pending':status??'none';}
 get query():(QueryResult&{evaluation:Query['evaluation'];summaryStatus:string})|null {
  const q=this.state?.query;if(!q)return null;
  return {records:q.records,count:q.count,filters:q.filters,statistics:q.statistics,sourceRef:this.source(q.analysis.sourceRef),requestId:q.analysis.queryRequestId,evaluation:q.evaluation,summaryStatus:q.summaryStatus};
 }
 private source(source:Source):QueryResult['sourceRef'] {return {...source,name:this.datasets.find(d=>d.id===source.datasetId)?.name??source.datasetId};}
 private notify():void {if(this.updateScheduled)return;this.updateScheduled=true;requestAnimationFrame(()=>{this.updateScheduled=false;this.changed();});}
 connect():void {this.api.connect((event,generation)=>this.receive(event,generation),(connected,message)=>{this.connected=connected;this.notice=this.state?.error?.message??message;this.notify();});}
 private receive(event:Envelope,generation:number):void {
  if(event.type==='snapshot'){this.state=event.payload as Snapshot;this.notice=this.state.error?.message??'已同步后端状态';if(!this.readonly){void this.refreshDatasets(generation);void this.refreshResources(generation);}void this.refreshReports(generation);}
  else if(this.state){
   this.state.seq=event.seq;
   switch(event.type){
    case 'request.updated':this.state.request=event.payload as Request|null;if(this.state.request?.error)this.notice=this.state.request.error.message;else if(this.state.request?.status==='cancelled')this.notice='任务已停止，未继续生成成果。';break;
    case 'message.delta':{const p=event.payload as {messageId:string;delta:string};const m=this.state.messages.find(m=>m.id===p.messageId);if(!m)throw new Error('后端消息协议不兼容：缺少消息起点');m.text+=p.delta;break;}
    case 'message.updated':{const message=event.payload as Message;const i=this.state.messages.findIndex(m=>m.id===message.id);if(i<0)this.state.messages.push(message);else this.state.messages[i]=message;this.state.messages=this.state.messages.slice(-100);break;}
    case 'query.updated':this.state.query=event.payload as Query|null;break;
    case 'selection.updated':this.state.selection=event.payload as Snapshot['selection'];void this.refreshDatasets(generation);break;
    case 'resources.updated':this.state.resourceRevision=(event.payload as {revision:number}).revision;void this.refreshResources(generation);break;
    case 'model.updated':this.state.model=event.payload as ModelView;break;
    case 'report.updated':{const value=event.payload as {action:Action|null;reports:Report[]};this.state.reportAction=value.action;this.state.reports=value.reports;void this.refreshReports(generation);break;}
   }
  }
  this.notify();
 }
 private current(generation:number):boolean{return generation===this.api.order.generation;}
 private problem(error:unknown):void{this.notice=error instanceof Error?error.message:'请求失败';this.notify();}
 private async refreshDatasets(generation:number):Promise<void>{
  const load=++this.datasetLoad;
  try{const {items}=await this.api.request<{items:Summary[]}>('/api/datasets');if(!this.current(generation)||load!==this.datasetLoad)return;
   this.datasets=items.map(d=>{const old=this.datasets.find(old=>old.id===d.id&&old.version===d.version);return {...old,...d,origin:d.origin==='builtin'?'fixture':'upload',tickets:old?.tickets??[]};});this.notify();
  }catch(e){if(this.current(generation))this.problem(e);}
 }
 private async refreshResources(generation:number):Promise<void>{
  const load=++this.resourceLoad;
  try{
   const catalog=await this.api.request<{revision:number;items:Array<{id:string;kind:Resource['kind'];loadStatus:string}>}>('/api/resources');
   const resources=await Promise.all(catalog.items.map(async item=>{
    const detail=await this.api.request<Resource&{command:string|null;loadStatus:string}>(`/api/resources/${encodeURIComponent(item.id)}`);
    const template=item.kind==='template'?await this.api.request<{revision:number;body:string;defaultBody:string}>(`/api/templates/${encodeURIComponent(item.id)}`):null;
    return {...detail,command:detail.command??undefined,status:detail.loadStatus==='loaded'?'available':'unavailable',body:template?.defaultBody??detail.body,...(template?{currentBody:template.body,templateRevision:template.revision}:{})} as Resource;
   }));
   if(!this.current(generation)||load!==this.resourceLoad||catalog.revision!==this.state?.resourceRevision)return;setResources(resources);this.notify();
  }catch(e){if(this.current(generation))this.problem(e);}
 }
 private async refreshReports(generation:number):Promise<void>{
  const load=++this.reportLoad;const state=this.state;if(!state)return;
  try{
   const reports=await Promise.all(state.reports.map(async r=>{const prior=this.reports.find(old=>old.reportId===r.reportId&&old.contentHash===r.contentHash);const body=prior?.body??(await this.api.request<{markdown:string}>(`/api/reports/${encodeURIComponent(r.reportId)}`)).markdown;return {...r,body,sourceRef:this.source(r.sourceRef)};}));
   let preview:Preview|null=null;const action=state.reportAction;
   if(action&&!this.readonly){const d=await this.api.request<{draft:{requestId:string;contentHash:string;analysisRef:{sourceRef:Source}};markdown:string}>(`/api/report-drafts/${encodeURIComponent(action.draftId)}`);preview={actionId:action.actionId,requestId:d.draft.requestId,sourceRef:this.source(d.draft.analysisRef.sourceRef),body:d.markdown,contentHash:d.draft.contentHash,expiresAt:action.expiresAt};}
   if(!this.current(generation)||load!==this.reportLoad)return;this.reports=reports;this.preview=preview;this.notify();
  }catch(e){if(this.current(generation))this.problem(e);}
 }
 async dataset(id:string):Promise<Dataset>{const data=await this.api.request<{dataset:Summary;payload:DatasetPayload}>(`/api/datasets/${encodeURIComponent(id)}`);const dataset:Dataset={...data.dataset,...data.payload,origin:data.dataset.origin==='builtin'?'fixture':'upload'};this.datasets=this.datasets.map(d=>d.id===id?dataset:d);return dataset;}
 async select(id:string|null):Promise<void>{
  const dataset=this.datasets.find(d=>d.id===id);
  const epoch=this.state?.serverEpoch;
  const selection=await this.command<NonNullable<Snapshot['selection']>>('/api/selection','PUT',{expectedRevision:this.state?.selection?.revision,sourceRef:dataset?{datasetId:dataset.id,version:dataset.version}:null});
  const state=this.state;
  if(state&&state.serverEpoch===epoch&&(!state.selection||state.selection.revision<=selection.revision)){
   state.selection=selection;this.notify();
  }
 }
 async upload(name:string,payload:DatasetPayload):Promise<void>{await this.command('/api/datasets','POST',{name,payload});await this.refreshDatasets(this.api.order.generation);}
 private async command<T>(path:string,method:string,input:unknown):Promise<T>{this.pending=true;this.notify();try{return await this.api.request<T>(path,method,input);}catch(e){this.problem(e);throw e;}finally{this.pending=false;this.notify();}}
 private async lookupSubmission(pending:{id:string;sessionId:string}):Promise<boolean>{
  try{
   const query=new URLSearchParams({clientRequestId:pending.id,sessionId:pending.sessionId});
   const request=await this.api.request<Request>(`/api/requests?${query}`);
   if(!validRequest(request,pending.id))throw new Error('请求查询协议不兼容');
   this.notice='已核对原请求状态，没有重复发送。';
   this.retrySubmission=undefined;
   this.connect();
   return true;
  }catch(error){
   if(error instanceof ApiFailure&&error.status===404&&error.error.code==='REQUEST_NOT_FOUND')return false;
   throw error;
  }
 }
 async submit(text:string):Promise<boolean>{
  if(this.status!=='idle'||!this.state?.selection||!this.state.model||!this.state.sessionId)return false;
  this.pending=true;this.notify();
  try{
   const prior=this.retrySubmission;
   if(prior){
    try{
     if(await this.lookupSubmission(prior))return prior.text===text;
    }catch(error){this.problem(error);return false;}
    if(prior.text!==text)this.retrySubmission=undefined;
   }
   const s=this.state;
   const id=this.retrySubmission?.id??crypto.randomUUID();
   const submission=this.retrySubmission??{
    text,id,sessionId:s.sessionId!,
    body:{clientRequestId:id,text,expected:{serverEpoch:s.serverEpoch,sessionId:s.sessionId,selectionRevision:s.selection!.revision,resourceRevision:s.resourceRevision,modelRevision:s.model!.revision}},
   };
   try{
    const result=await this.api.request<{request:unknown}>('/api/requests','POST',submission.body);
    if(!validRequest(result?.request,submission.id))throw new Error('请求受理协议不兼容');
    this.retrySubmission=undefined;return true;
   }catch(error){
    if(this.state?.request?.clientRequestId===submission.id){this.retrySubmission=undefined;return true;}
    if(error instanceof ApiFailure&&error.status<500){this.retrySubmission=undefined;this.problem(error);return false;}
    this.retrySubmission=submission;
    try{if(await this.lookupSubmission(submission))return true;}catch{}
    this.notice='发送结果尚未确认，输入已保留。再次发送会先核对原请求，不自动重发。';
    return false;
   }
  }finally{this.pending=false;this.notify();}
 }
 async stop():Promise<void>{const r=this.state?.request;if(r&&this.canStop)await this.command(`/api/requests/${r.requestId}/stop`,'POST',{expectedServerEpoch:this.state!.serverEpoch}).catch(()=>{});}
 async cancelPreview():Promise<void>{if(this.previewState==='pending'&&this.preview)await this.command(`/api/report-actions/${this.preview.actionId}/cancel`,'POST',{expectedServerEpoch:this.state!.serverEpoch}).catch(()=>{});}
 async confirm(id:string):Promise<void>{if(this.preview?.actionId===id)await this.command(`/api/report-actions/${id}/confirm`,'POST',{expectedHash:this.preview.contentHash,expectedServerEpoch:this.state!.serverEpoch}).catch(()=>{});}
 async reapply():Promise<void>{if(this.preview)await this.command(`/api/report-actions/${this.preview.actionId}/reapply`,'POST',{clientRequestId:crypto.randomUUID(),expectedHash:this.preview.contentHash,expectedServerEpoch:this.state!.serverEpoch}).catch(()=>{});}
 async configure(input:unknown):Promise<ModelView>{return this.command('/api/model-config','PUT',input);}
 async testModel(kind:'chat'|'tool'):Promise<void>{await this.command('/api/model-tests','POST',{kind,expectedModelRevision:this.model?.revision,clientRequestId:crypto.randomUUID()});}
 async saveTemplate(id:string,expectedRevision:number,body:string,reset=false):Promise<{body:string;revision:number}>{return this.command(`/api/templates/${encodeURIComponent(id)}${reset?'/reset':''}`,reset?'POST':'PUT',reset?{expectedRevision}:{expectedRevision,body});}
 async download(id:string):Promise<void>{try{const blob=await this.api.download(id);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`report-${id}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.problem(e);}}
}
