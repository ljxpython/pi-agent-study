import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { Type } from 'typebox';
import type { AgentSession, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { isContextOverflow } from '@earendil-works/pi-ai';
import { AppFault, assert, exactKeys, fault, record, revision, string, modelToolSchema, TOOL_NAMES, type AppError, type SourceRef, type ToolName } from './contracts.js';
import { Models, type ModelPreferences } from './model.js';
import { Resources, hash } from './resources.js';
import { Storage } from './storage.js';
import { BUILTIN, Datasets, type DatasetSummary } from './datasets.js';
import { Events } from './events.js';
import { openSession } from './session.js';
import { queryTickets, evaluateTickets, prepareReport, type Analysis, type Proposal } from './business.js';
import { RunGuard } from './progress.js';
import { Reports, type Draft, type ReportAction, type ReportSummary } from './reports.js';

import { validateState, type State, type RequestStatus, type RequestRecord, type ToolStep } from './state.js';
export type { RequestView, MessageView, ToolStep } from './state.js';
import type { RequestView } from './state.js';
function canonical(value:unknown):string {return JSON.stringify(value,(_key,v)=>record(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);}
const terminal=(status:RequestStatus)=>['completed','failed','cancelled','interrupted'].includes(status);
const labels:Record<ToolName,string>={query_tickets:'查询工单',evaluate_ticket_age:'检查时效',prepare_report:'准备报告草稿'};
export class App {
 readonly serverEpoch=randomUUID();readonly events:Events;readonly datasets:Datasets;readonly reports:Reports;readonly resources:Resources;readonly models:Models;
 private session:AgentSession|undefined;private taskSession:AgentSession|undefined;private error:AppError|null=null;private mutating=false;private running:Promise<void>|undefined;private saving:Promise<void>|undefined;
 private active:RequestRecord|undefined;private working:Analysis|null=null;private proposal:Proposal|undefined;private guard:RunGuard|undefined;
 private expiry:ReturnType<typeof setTimeout>|undefined;
 private constructor(private readonly store:Storage<State>,private state:State,private readonly onSession?: (session:AgentSession)=>void,private readonly now:()=>number=Date.now) {
  this.datasets=new Datasets(store.root);this.reports=new Reports(store.root);
  this.resources=new Resources(store.root,()=>this.busy());this.models=new Models(state.model,undefined,()=>this.busy());
  this.events=new Events(this.serverEpoch,()=>this.error?null:this.state.sessionId,()=>this.projection());
 }
 private queryView(){if(!this.state.analysis)return null;const {analysis,records,count,filters,statistics,evaluation,summaryStatus}=this.state.analysis;return {analysis,records,count,filters,statistics,evaluation,summaryStatus};}
 private savedReports:ReportSummary[]=[];
 static async open(root:string,onSession?:(session:AgentSession)=>void,initialModel?:ModelPreferences,now:()=>number=Date.now):Promise<App> {
  const initial:State={schemaVersion:1,sessionId:randomUUID(),sdkFile:null,model:initialModel??new Models().preferences(),datasets:[],selection:{revision:0,sourceRef:null},requests:[],messages:[],analysis:null,drafts:[],actions:[],activeActionId:null,reapplications:[]};
  const store=await Storage.open(root,initial,validateState);const app=new App(store,store.read()??initial,onSession,now);
  try {
   const scan=await app.reports.scan();app.savedReports=scan.reports;
   if(store.readonly||scan.conflict||scan.unavailable){app.error=new AppFault('STATE_UNAVAILABLE',scan.unavailable?'存在不可用成果，当前仅可查看完整已保存报告；原文件已保留':'状态无法安全恢复，当前仅可查看完整已保存报告').toJSON();return app;}
   for(const report of scan.reports){
    const action=app.state.actions.find(a=>a.actionId===report.actionId);const draft=app.state.drafts.find(d=>d.draftId===action?.draftId);
    assert(action&&draft,'报告缺少对应草稿或批准记录','STATE_UNAVAILABLE');await app.reports.readApproved(draft,action);
   }
   assert(!app.state.actions.some(a=>a.status==='saved'&&!scan.reports.some(r=>r.actionId===a.actionId)),'已保存动作缺少完整报告包','STATE_UNAVAILABLE');
   await app.datasets.restore(app.state.datasets);
   if(!app.state.datasets.length){const builtin=await app.datasets.prepare('示例工单.json',BUILTIN,true);app.state.datasets.push(builtin.dataset);await app.persist();app.datasets.register(builtin);}
   if(app.state.selection.sourceRef)app.datasets.bound(app.state.selection.sourceRef);
   if(app.state.analysis){
    const stored=app.state.analysis;const payload=app.datasets.bound(stored.analysis.sourceRef).payload;
    const expected=queryTickets(payload,stored.analysis.sourceRef,stored.filters,stored.analysis.queryRequestId);
    assert(isDeepStrictEqual(stored.records,expected.records),'分析工单与原始资料不一致','STATE_UNAVAILABLE');
    for(const field of ['now','urgentHours','normalHours'] as const){
     if(stored.basis.origins[field]?.kind!=='dataset')continue;
     const actual=field==='now'?stored.basis.now:stored.basis.policy[field];
     const original=field==='now'?expected.basis.now:expected.basis.policy[field];
     assert(actual===original,'分析规则与来源资料不一致','STATE_UNAVAILABLE');
    }
   }
   for(const request of app.state.requests)if(!terminal(request.status)){request.status='interrupted';request.error=new AppFault('CANCELLED','后端重启，未完成任务已中断，未自动重发').toJSON();}
   for(const message of app.state.messages)if(message.status==='partial')message.status='interrupted';
   for(const action of app.state.actions){const saved=scan.reports.find(r=>r.actionId===action.actionId);if(saved){action.status='saved';action.reportId=saved.reportId;}else if(action.status==='pending_confirmation')action.status='expired';else if(action.status==='saving')action.status='interrupted';}
   await app.persist();await app.resources.initialize(app.tools());
   try{await app.models.initialize();}catch{/* Invalid host auth remains visibly unconfigured; there is no fallback. */}
   if(app.models.view().configured)await app.ensureSession();
   return app;
  }catch(e){app.error=fault(e,'STATE_UNAVAILABLE');return app;}
 }
 private projection():Record<string,unknown> {
  if(this.error)return {mode:'recovery_readonly',messages:this.state.messages.slice(-100),request:this.view(this.state.requests.at(-1)),reports:this.savedReports,error:this.error};
  return {mode:'normal',messages:this.state.messages.slice(-100),request:this.view(this.state.requests.at(-1)),reports:this.savedReports,selection:this.state.selection,resourceRevision:this.resources.revision,model:this.models.view(),query:this.queryView(),reportAction:this.action()};
 }
 snapshot():Record<string,unknown>{this.normalizeExpiry();return this.events.snapshot();}
 private view(r:RequestRecord|undefined):RequestView|null {if(!r)return null;const {requestId,clientRequestId,kind,status,receivedAt,sourceRef,error,steps}=r;return structuredClone({requestId,clientRequestId,kind,status,receivedAt,sourceRef,error,steps});}
 request(id:string):RequestView {const r=this.state.requests.find(r=>r.requestId===id);assert(r,'请求不存在','REQUEST_NOT_FOUND');return this.view(r)!;}
 requestByClient(clientRequestId:string,sessionId:string):RequestView {
  string(clientRequestId,100);string(sessionId,100);
  const request=sessionId===this.state.sessionId?this.state.requests.find(r=>r.clientRequestId===clientRequestId):undefined;
  assert(request,'请求不存在','REQUEST_NOT_FOUND');return this.view(request)!;
 }
 private action():ReportAction|null {return this.state.actions.find(a=>a.actionId===this.state.activeActionId)??null;}
 private normalizeExpiry():void {
  const action=this.action();if(action?.status==='pending_confirmation'&&this.now()>=Date.parse(action.expiresAt)){action.status='expired';this.events.publish('report.updated',{action,reports:this.savedReports});}
 }
 busy():boolean {this.normalizeExpiry();return !!this.active||!!this.saving||['pending_confirmation','saving'].includes(this.action()?.status??'');}
 private writable():void {assert(!this.error&&!this.store.readonly,'状态不可写，当前处于恢复只读模式','STATE_UNAVAILABLE');}
 private async mutate<T>(fn:()=>Promise<T>):Promise<T> {this.writable();assert(!this.mutating,'另一项变更尚未完成','BUSY');this.mutating=true;try{return await fn();}finally{this.mutating=false;}}
 private async persist():Promise<void> {
  try{await this.store.commit(this.state);}catch(e){this.error=fault(e,'STATE_UNAVAILABLE');if(this.active){this.active.error=this.error;void this.taskSession?.abort();}this.events.publish('request.updated',this.view(this.active));this.events.close();throw e;}
 }
 private async ensureSession():Promise<AgentSession> {
  if(this.session)return this.session;let file:string|undefined;
  if(this.state.sdkFile){file=resolve(this.store.root,this.state.sdkFile);try{await access(file);}catch{assert(!this.state.messages.some(m=>m.role==='assistant'&&m.status==='completed'),'已完成会话文件缺失','STATE_UNAVAILABLE');file=undefined;}}
  this.session=await openSession(this.resources,this.models.require(),TOOL_NAMES,file);this.onSession?.(this.session);
  this.state.sdkFile=relative(this.store.root,this.session.sessionFile!);await this.persist();return this.session;
 }
 async upload(name:unknown,payload:unknown):Promise<DatasetSummary> {return this.mutate(async()=>{assert(!this.busy(),'任务进行中','BUSY');const item=await this.datasets.prepare(name,payload);this.state.datasets.push(item.dataset);await this.persist();this.datasets.register(item);this.events.publish('selection.updated',this.state.selection);return item.dataset;});}
 async select(input:unknown):Promise<State['selection']> {return this.mutate(async()=>{
  exactKeys(input,['expectedRevision','sourceRef']);revision(input.expectedRevision);assert(!this.busy(),'任务进行中','BUSY');assert(input.expectedRevision===this.state.selection.revision,'资料选择已变化','REVISION_CONFLICT');
  let source:SourceRef|null=null;if(input.sourceRef!==null){exactKeys(input.sourceRef,['datasetId','version']);string(input.sourceRef.datasetId,100);string(input.sourceRef.version,128);source=input.sourceRef as unknown as SourceRef;this.datasets.bound(source);}
  this.state.selection={revision:this.state.selection.revision+1,sourceRef:source};this.state.analysis=null;this.state.activeActionId=null;clearTimeout(this.expiry);
  await this.persist();this.events.publish('selection.updated',this.state.selection);this.events.publish('query.updated',null);this.reportEvent();return structuredClone(this.state.selection);
 });}
 async configure(input:unknown){return this.mutate(async()=>{const result=await this.models.update(input,async prefs=>{this.state.model=prefs;await this.persist();});this.session?.dispose();this.session=undefined;this.events.publish('model.updated',result);return result;});}
 async template(id:string,input:unknown,reset=false){return this.mutate(async()=>{
  exactKeys(input,reset?['expectedRevision']:['expectedRevision','body']);revision(input.expectedRevision);
  const session=this.session;
  const modelBefore=JSON.stringify(session?.model);
  const historyBefore=hash(JSON.stringify(session?.messages??[]));
  const reload=async()=>{
   if(!session){await this.resources.reload();return;}
   await session.reload();
   assert(session.getActiveToolNames().sort().join(',')===[...TOOL_NAMES].sort().join(','),'重载后工具白名单不一致','RESOURCE_UNAVAILABLE');
   assert(JSON.stringify(session.model)===modelBefore&&hash(JSON.stringify(session.messages))===historyBefore,'重载改变了模型绑定或会话历史','RESOURCE_UNAVAILABLE');
  };
  try{return reset?await this.resources.reset(id,input.expectedRevision,reload):await this.resources.save(id,input.expectedRevision,input.body as string,reload);}
  catch(error){if(error instanceof AppFault&&error.code==='RESOURCE_UNAVAILABLE'){session?.dispose();this.session=undefined;}throw error;}
  finally{this.events.publish('resources.updated',{revision:this.resources.revision});}
 });}

 async submit(input:unknown,test?:{kind:'chat'|'tool';fingerprint:string}):Promise<{request:RequestView;duplicate:boolean}> {return this.mutate(async()=>{
  exactKeys(input,['clientRequestId','text','expected']);string(input.clientRequestId,100);string(input.text,4000);exactKeys(input.expected,['serverEpoch','sessionId','selectionRevision','resourceRevision','modelRevision']);
  const fingerprint=test?.fingerprint??hash(canonical(input));const previous=this.state.requests.find(r=>r.clientRequestId===input.clientRequestId);
  if(previous){assert(previous.fingerprint===fingerprint,'同一请求ID的内容不同','IDEMPOTENCY_CONFLICT');return {request:this.view(previous)!,duplicate:true};}
  const expected=input.expected;assert(expected.serverEpoch===this.serverEpoch,'后端已重启，请同步状态','STALE_SERVER');assert(expected.sessionId===this.state.sessionId&&expected.selectionRevision===this.state.selection.revision&&expected.resourceRevision===this.resources.revision&&expected.modelRevision===this.models.view().revision,'页面版本已变化，请同步后重试','REVISION_CONFLICT');
  assert(!this.busy(),'当前任务或报告确认尚未结束','BUSY');this.resources.validateCommand(input.text);this.models.require();const session=test?await openSession(this.resources,this.models.require(),test.kind==='tool'?['query_tickets']:[],undefined,true):await this.ensureSession();if(test)this.onSession?.(session);
  const r:RequestRecord={requestId:randomUUID(),clientRequestId:input.clientRequestId,kind:test?'model_test':'chat',...(test?{testKind:test.kind}:{}),status:'accepted',receivedAt:new Date(this.now()).toISOString(),sourceRef:test?(test.kind==='tool'?{datasetId:this.state.datasets[0].id,version:this.state.datasets[0].version}:null):structuredClone(this.state.selection.sourceRef),error:null,steps:[],text:input.text,fingerprint,userMessageId:randomUUID(),assistantMessageId:randomUUID()};
  this.state.requests.push(r);this.state.messages.push({id:r.userMessageId,requestId:r.requestId,role:'user',text:r.text,status:'completed'},{id:r.assistantMessageId,requestId:r.requestId,role:'assistant',text:'',status:'partial'});this.state.messages=this.state.messages.slice(-100);
  try{await this.persist();}catch(error){r.status='failed';r.error=fault(error);this.state.messages.find(m=>m.id===r.assistantMessageId)!.status='failed';throw error;}
  this.active=r;this.events.publish('request.updated',this.view(r));for(const message of this.state.messages.slice(-2))this.events.publish('message.updated',message,r.requestId);
  this.running=this.run(session,r).finally(()=>{if(test)session.dispose();});return {request:this.view(r)!,duplicate:false};
 });}
 async testModel(input:unknown):Promise<{request:RequestView;duplicate:boolean}> {
  exactKeys(input,['kind','expectedModelRevision','clientRequestId']);assert(input.kind==='chat'||input.kind==='tool','连接测试类型无效');revision(input.expectedModelRevision);string(input.clientRequestId,100);
  const fingerprint=hash(canonical(input));const prior=this.state.requests.find(r=>r.clientRequestId===input.clientRequestId);
  if(!prior)assert(input.expectedModelRevision===this.models.view().revision,'模型配置已变化','REVISION_CONFLICT');
  const text=input.kind==='chat'?'这是模型连接测试，请用一句简短中文说明你可以正常回复。不要查询工单。':'这是只读工具连接测试。已明确绑定本次测试专用的内置教学工单资料，请调用一次 query_tickets，查询平台团队 open 工单，再用一句话说明结果及来源。';
  return this.submit({clientRequestId:input.clientRequestId,text,expected:{serverEpoch:this.serverEpoch,sessionId:this.state.sessionId,selectionRevision:this.state.selection.revision,resourceRevision:this.resources.revision,modelRevision:this.models.view().revision}},{kind:input.kind,fingerprint});
 }
 private tools():ToolDefinition[] {return TOOL_NAMES.map(name=>({name,label:labels[name],description:`${labels[name]}。只处理本次绑定资料；分析ID/规则版本来自已有工具结果，规则证据只能来自当前用户消息。${name==='evaluate_ticket_age'?'先调用本工具核对资料及当前分析的时效依据，不能因查询输出未列now/policy就断定缺规则。updates必须为JSON对象，不是字符串或数组；仅明确补规则时提供。':''}`,parameters:Type.Unsafe(modelToolSchema(name)),execute:async(_id,input)=>this.tool(name,input)}));}
 private async tool(name:ToolName,input:unknown){
  const r=this.active;assert(r&&r.status==='running'&&!this.error,'任务已停止','CANCELLED');
  const step:ToolStep={id:randomUUID(),tool:name,label:r.kind==='model_test'?`连接测试 · ${labels[name]}`:labels[name],status:'running',startedAt:new Date().toISOString(),finishedAt:null,durationMs:null,sourceRef:r.sourceRef,error:null};const start=performance.now();r.steps.push(step);this.events.publish('request.updated',this.view(r),r.requestId);
  try {
   this.guard?.tool(hash(canonical({name,input,source:r.sourceRef})));
   this.datasets.bound(r.sourceRef);let output:unknown;
   if(name==='query_tickets'){this.working=queryTickets(this.datasets.bound(r.sourceRef).payload,r.sourceRef!,input,r.requestId);const {analysis,records,count,statistics}=this.working;output={ok:true,analysis,records,count,statistics};}
   else {assert(this.working&&canonical(this.working.analysis.sourceRef)===canonical(r.sourceRef),'当前没有可用分析结果','STALE_ANALYSIS');
    if(name==='evaluate_ticket_age'){this.working=evaluateTickets(this.working,input,{messageId:r.userMessageId,text:r.text,receivedAt:r.receivedAt,requestId:r.requestId});output={ok:true,analysis:this.working.analysis,...this.working.evaluation};}
    else{this.proposal=prepareReport(this.working,input);const {title:_title,...proposal}=this.proposal;output={ok:true,...proposal};}
   }
   const text=JSON.stringify(output);assert(Buffer.byteLength(text)<=2*1024*1024,'工具结果过大，请缩小查询范围','RESULT_TOO_LARGE');step.status='completed';return {content:[{type:'text' as const,text}],details:{ok:true}};
  }catch(e){step.status=(r.status as RequestStatus)==='stopping'?'cancelled':'failed';step.error=fault(e);return {content:[{type:'text' as const,text:JSON.stringify({ok:false,error:step.error})}],details:{ok:false}};}
  finally{step.finishedAt=new Date().toISOString();step.durationMs=performance.now()-start;this.events.publish('request.updated',this.view(r),r.requestId);}
 }
 private async run(session:AgentSession,r:RequestRecord):Promise<void> {
  this.taskSession=session;this.working=r.kind==='model_test'?null:structuredClone(this.state.analysis);this.proposal=undefined;r.status='running';this.events.publish('request.updated',this.view(r),r.requestId);
  const message=this.state.messages.find(m=>m.id===r.assistantMessageId)!;
  const guard=new RunGuard(error=>{r.error=error;void session.abort();});this.guard=guard;
  const original=session.agent.streamFunction;
  let skillBody:string|null=null;
  session.agent.streamFunction=(model,context,options)=>{
   if(skillBody!==null){
    const user=context.messages.findLast(m=>m.role==='user');
    const text=user?.role==='user'?(typeof user.content==='string'?user.content:user.content.filter(c=>c.type==='text').map(c=>c.text).join('')):'';
    if(!text.startsWith('<skill name="ticket-triage" ')||!text.includes(`\n\n${skillBody}\n</skill>`)){
     r.error=new AppFault('RESOURCE_UNAVAILABLE','SDK未成功展开受控Skill，已阻止模型请求').toJSON();
     throw new AppFault('RESOURCE_UNAVAILABLE',r.error.message);
    }
   }
   guard.request();return original(model,context,{...options,maxRetries:0,onResponse:async(response,model)=>{guard.connected();await options?.onResponse?.(response,model);}});
  };
  const unsubscribe=session.subscribe(event=>{
   if(this.error||r.status!=='running')return;
   if(event.type==='message_update'){const update=event.assistantMessageEvent;if((update.type==='text_delta'||update.type==='thinking_delta'||update.type==='toolcall_delta')&&update.delta.length)guard.progress();if(update.type==='text_delta'){message.text+=update.delta;this.events.publish('message.delta',{messageId:message.id,role:'assistant',delta:update.delta},r.requestId);}}
   if(event.type==='tool_execution_start'||event.type==='tool_execution_end')guard.progress();
  });
  try {
   skillBody=await this.resources.skillBody(r.text);
   const selectedModel=this.models.preferences();
   assert(session.model?.id===selectedModel.modelId,'会话模型与当前配置不一致','MODEL_NOT_CONFIGURED');
   const sourceName=r.sourceRef?this.datasets.list().find(dataset=>dataset.id===r.sourceRef?.datasetId&&dataset.version===r.sourceRef?.version)?.name:null;
   assert(!r.sourceRef||sourceName,'绑定资料名称不存在','RESOURCE_NOT_FOUND');
   const context=`\n\n[应用任务依据：用户消息ID=${r.userMessageId}；接收时间=${r.receivedAt}；绑定资料=${JSON.stringify(r.sourceRef)}；绑定资料名称=${JSON.stringify(sourceName)}；当前分析=${JSON.stringify(this.working?.analysis??null)}；当前请求模型ID=${JSON.stringify(session.model.id)}；应用配置Provider=${JSON.stringify(selectedModel.provider)}。模型标识仅代表本轮请求目标，不能证明提供方实际部署身份；回答当前模型问题时不要沿用旧会话中的模型自述。这是应用元数据，不是新增用户规则。]`;
   // SDK still performs command expansion. Business metadata is injected as a context-only custom message.
   await session.sendCustomMessage({customType:'ticket-request-context',content:context,display:false},{triggerTurn:false});
   await session.prompt(r.text.trim());
   const last=session.messages.at(-1);
   if(last?.role==='assistant'&&isContextOverflow(last,session.model?.contextWindow))r.error??=new AppFault('CONTEXT_TOO_LARGE','模型上下文无法容纳本次请求，未自动压缩或重试').toJSON();
   if((r.status as RequestStatus)==='stopping'){r.status='cancelled';message.status='cancelled';}
   else if(r.error||last?.role!=='assistant'||last.stopReason!=='stop'){r.status='failed';r.error??=new AppFault('PROVIDER_ERROR','模型未正常完成回复').toJSON();message.status='failed';}
   else{r.status='completed';message.status='completed';message.text=last.content.filter(c=>c.type==='text').map(c=>c.text).join('');}
   if(r.kind==='model_test'&&r.testKind==='tool'&&!r.steps.some(s=>s.tool==='query_tickets'&&s.status==='completed')){r.status='failed';r.error=new AppFault('PROVIDER_ERROR','模型回复了文字，但未完成工具调用测试').toJSON();message.status='failed';}
   if(r.kind==='chat'&&this.working&&(r.status==='completed'||!isDeepStrictEqual(this.state.analysis,this.working))){
    if(canonical(this.state.analysis?.analysis)!==canonical(this.working.analysis)){this.state.activeActionId=null;clearTimeout(this.expiry);}
    this.working.summaryStatus=r.status==='completed'?'completed':'failed';this.state.analysis=this.working;
   }
   const proposal=this.proposal as Proposal|undefined;
   if(r.kind==='chat'&&r.status==='completed'&&proposal){const now=this.now();const draft:Draft={...proposal,draftId:randomUUID(),sessionId:this.state.sessionId,requestId:r.requestId,createdAt:new Date(now).toISOString()};const action:ReportAction={actionId:randomUUID(),draftId:draft.draftId,status:'pending_confirmation',createdAt:draft.createdAt,expiresAt:new Date(now+600000).toISOString(),previousActionId:null,reportId:null};this.state.drafts.push(draft);this.state.actions.push(action);this.state.activeActionId=action.actionId;clearTimeout(this.expiry);this.expiry=setTimeout(()=>this.normalizeExpiry(),600000);this.expiry.unref();}
   if(!this.error)await this.persist();
  }catch(e){r.status=(r.status as RequestStatus)==='stopping'?'cancelled':'failed';r.error=fault(e);message.status=r.status;try{if(!this.error)await this.persist();}catch{}}
  finally{if(r.error?.code==='RESOURCE_UNAVAILABLE'){this.resources.invalidate();this.events.publish('resources.updated',{revision:this.resources.revision});}guard.dispose();this.guard=undefined;session.agent.streamFunction=original;unsubscribe();this.active=undefined;this.taskSession=undefined;this.events.publish('message.updated',message,r.requestId);this.events.publish('request.updated',this.view(r),r.requestId);if(r.kind==='chat'&&this.working)this.events.publish('query.updated',this.queryView(),r.requestId);this.events.publish('report.updated',{action:this.action(),reports:this.savedReports});}
 }
 draft(id:string):Draft {const draft=this.state.drafts.find(d=>d.draftId===id&&d.sessionId===this.state.sessionId);assert(draft,'草稿不存在','RESOURCE_NOT_FOUND');return structuredClone(draft);}
 private currentDraft(action:ReportAction,expectedHash:unknown):Draft {
  const draft=this.draft(action.draftId);assert(draft.contentHash===expectedHash&&hash(draft.markdown)===draft.contentHash,'草稿内容已变化','STALE_ANALYSIS');
  assert(this.state.analysis&&canonical(draft.analysis)===canonical(this.state.analysis.analysis)&&canonical(draft.analysis.sourceRef)===canonical(this.state.selection.sourceRef),'资料或分析依据已变化，请重新生成','STALE_ANALYSIS');return draft;
 }
 private reportEvent():void {this.events.publish('report.updated',{action:this.action(),reports:this.savedReports});}
 async confirm(id:string,input:unknown):Promise<{action:ReportAction;saved:boolean}> {return this.mutate(async()=>{
  exactKeys(input,['expectedHash','expectedServerEpoch']);assert(input.expectedServerEpoch===this.serverEpoch,'后端已重启','STALE_SERVER');
  const action=this.state.actions.find(a=>a.actionId===id);assert(action,'确认动作不存在','RESOURCE_NOT_FOUND');
  const known=this.savedReports.find(r=>r.actionId===id);if(known){const saved=await this.reports.readApproved(this.draft(action.draftId),action);assert(saved.summary.contentHash===input.expectedHash,'报告内容与确认不一致','STALE_ANALYSIS');return {action:structuredClone(action),saved:true};}
  this.normalizeExpiry();assert(action.status!=='expired','确认已过期，请重新申请保存','ACTION_EXPIRED');
  if(action.status==='saving'){this.currentDraft(action,input.expectedHash);return {action:structuredClone(action),saved:false};}
  assert(action.status==='pending_confirmation'&&this.state.activeActionId===id,'该确认动作已结束','STALE_ANALYSIS');const draft=this.currentDraft(action,input.expectedHash);
  action.status='saving';action.approvedAt=new Date(this.now()).toISOString();await this.persist();this.reportEvent();
  this.saving=this.saveReport(draft,action);return {action:structuredClone(action),saved:false};
 });}
 private async saveReport(draft:Draft,action:ReportAction):Promise<void> {
  try{const saved=await this.reports.publish(draft,action);action.status='saved';action.reportId=saved.summary.reportId;this.savedReports.push(saved.summary);await this.persist();}
  catch{if(!this.error){action.status='failed';try{await this.persist();}catch{}}}
  finally{this.saving=undefined;this.reportEvent();}
 }
 async cancel(id:string,input:unknown):Promise<ReportAction> {return this.mutate(async()=>{
  exactKeys(input,['expectedServerEpoch']);assert(input.expectedServerEpoch===this.serverEpoch,'后端已重启','STALE_SERVER');this.normalizeExpiry();
  const action=this.state.actions.find(a=>a.actionId===id);assert(action,'确认动作不存在','RESOURCE_NOT_FOUND');assert(action.status!=='saving','文件正在保存，无法撤销','BUSY');
  if(action.status==='pending_confirmation'){action.status='cancelled';await this.persist();this.reportEvent();}return structuredClone(action);
 });}
 async reapply(id:string,input:unknown):Promise<{action:ReportAction;created:boolean}> {return this.mutate(async()=>{
  exactKeys(input,['clientRequestId','expectedHash','expectedServerEpoch']);string(input.clientRequestId,100);const fingerprint=hash(canonical({id,...input}));
  const accepted=this.state.reapplications.find(r=>r.clientRequestId===input.clientRequestId);if(accepted){assert(accepted.fingerprint===fingerprint,'同一请求ID内容不同','IDEMPOTENCY_CONFLICT');return {action:structuredClone(this.state.actions.find(a=>a.actionId===accepted.actionId)!),created:false};}
  assert(input.expectedServerEpoch===this.serverEpoch,'后端已重启','STALE_SERVER');this.normalizeExpiry();const old=this.state.actions.find(a=>a.actionId===id);assert(old,'确认动作不存在','RESOURCE_NOT_FOUND');
  const saved=this.savedReports.find(r=>r.draftId===old.draftId);if(saved){const action=this.state.actions.find(a=>a.actionId===saved.actionId)!;const report=await this.reports.readApproved(this.draft(action.draftId),action);assert(report.summary.contentHash===input.expectedHash,'报告内容与申请不一致','STALE_ANALYSIS');return {action:structuredClone(action),created:false};}
  const pending=this.state.actions.find(a=>a.draftId===old.draftId&&['pending_confirmation','saving'].includes(a.status));if(pending){this.currentDraft(pending,input.expectedHash);return {action:structuredClone(pending),created:false};}
  assert(!this.busy(),'另一个任务或确认尚未结束','BUSY');assert(old.status==='expired','仅过期草稿可重新申请保存','STALE_ANALYSIS');this.currentDraft(old,input.expectedHash);
  const now=this.now();const action:ReportAction={actionId:randomUUID(),draftId:old.draftId,status:'pending_confirmation',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+600000).toISOString(),previousActionId:id,reportId:null};
  this.state.actions.push(action);this.state.activeActionId=action.actionId;this.state.reapplications.push({clientRequestId:input.clientRequestId,fingerprint,actionId:action.actionId});await this.persist();this.reportEvent();clearTimeout(this.expiry);this.expiry=setTimeout(()=>this.normalizeExpiry(),600000);this.expiry.unref();return {action:structuredClone(action),created:true};
 });}
 async stop(id:string,epoch:string):Promise<RequestView> {this.writable();assert(epoch===this.serverEpoch,'后端已重启','STALE_SERVER');const r=this.state.requests.find(r=>r.requestId===id);assert(r,'请求不存在','REQUEST_NOT_FOUND');if(!terminal(r.status)&&r.status!=='stopping'){r.status='stopping';this.events.publish('request.updated',this.view(r),id);void this.taskSession?.abort();}return this.view(r)!;}
 async settled():Promise<void>{await this.running;await this.saving;}
 async close():Promise<void>{clearTimeout(this.expiry);await this.taskSession?.abort();await this.session?.abort();await this.running;await this.saving;this.session?.dispose();this.events.close();await this.store.close();}
}
