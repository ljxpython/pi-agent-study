import { isDeepStrictEqual } from 'node:util';
import { Check } from 'typebox/value';
import { assert, exactKeys, record, revision, string, validDate, validateDataset, validateTool, TOOL_CONTRACT, TOOL_NAMES, ERROR_STATUS, type AppError, type SourceRef, type ToolName } from './contracts.js';
import { validatePreferences, type ModelPreferences } from './model.js';
import type { DatasetSummary } from './datasets.js';
import { evaluateTickets, type Analysis } from './business.js';
import type { Draft, ReportAction } from './reports.js';
import { hash } from './resources.js';

export type RequestStatus='accepted'|'running'|'stopping'|'completed'|'failed'|'cancelled'|'interrupted';
export interface ToolStep {id:string;tool:ToolName;label:string;status:'running'|'completed'|'failed'|'cancelled';startedAt:string;finishedAt:string|null;durationMs:number|null;sourceRef:SourceRef|null;error:AppError|null}
export interface RequestView {requestId:string;clientRequestId:string;kind:'chat'|'model_test';status:RequestStatus;receivedAt:string;sourceRef:SourceRef|null;error:AppError|null;steps:ToolStep[]}
export interface RequestRecord extends RequestView {text:string;fingerprint:string;userMessageId:string;assistantMessageId:string;testKind?:'chat'|'tool'}
export interface MessageView {id:string;requestId:string;role:'user'|'assistant';text:string;status:'partial'|'completed'|'failed'|'cancelled'|'interrupted'}
export interface State {schemaVersion:1;sessionId:string;sdkFile:string|null;model:ModelPreferences;datasets:DatasetSummary[];selection:{revision:number;sourceRef:SourceRef|null};requests:RequestRecord[];messages:MessageView[];analysis:Analysis|null;drafts:Draft[];actions:ReportAction[];activeActionId:string|null;reapplications:{clientRequestId:string;fingerprint:string;actionId:string}[]}

function check(condition:unknown):asserts condition {
  assert(condition,'持久状态字段或关联损坏','STATE_UNAVAILABLE');
}
function digest(value:unknown):void {check(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value));}
function date(value:unknown):void {check(validDate(value));}
function definition(name:keyof typeof TOOL_CONTRACT.$defs,value:unknown):void {
  check(Check({...TOOL_CONTRACT.$defs[name],$defs:TOOL_CONTRACT.$defs},value));
}
function sameSource(a:SourceRef|null,b:SourceRef|null):boolean {
  return a===null?b===null:b!==null&&a.datasetId===b.datasetId&&a.version===b.version;
}
function error(value:unknown):void {
  if(value===null)return;
  exactKeys(value,['code','message','retryable']);
  check(typeof value.code==='string'&&Object.hasOwn(ERROR_STATUS,value.code)&&value.retryable===false);
  string(value.message,500);
}
function unique<T>(items:T[],id:(item:T)=>string):Map<string,T> {
  const result=new Map<string,T>();
  for(const item of items){const key=id(item);string(key,100);check(!result.has(key));result.set(key,item);}
  return result;
}
/** Validates both disk input and proposed commits; never repairs or truncates damaged state. */
export function validateState(value:unknown):State {
  exactKeys(value,['schemaVersion','sessionId','sdkFile','model','datasets','selection','requests','messages','analysis','drafts','actions','activeActionId','reapplications']);
  check(value.schemaVersion===1);string(value.sessionId,100);validatePreferences(value.model);
  check(value.sdkFile===null||typeof value.sdkFile==='string'&&value.sdkFile.startsWith('sessions/')&&!value.sdkFile.split(/[\\/]/).some(part=>part==='..'||part===''));
  for(const key of ['datasets','requests','messages','drafts','actions','reapplications'])check(Array.isArray(value[key])&&(value[key] as unknown[]).every(record));
  const state=value as unknown as State;
  const datasets=unique(state.datasets,d=>d.id);
  for(const d of datasets.values()){
    exactKeys(d,['id','name','version','count','origin']);check(/^[A-Za-z0-9_-]{1,100}$/.test(d.id));string(d.name,200);digest(d.version);
    check(Number.isInteger(d.count)&&d.count>=0&&d.count<=1000&&(d.origin==='builtin'||d.origin==='upload'));
  }
  const source=(ref:unknown,nullable=false):void=>{
    if(nullable&&ref===null)return;
    definition('SourceRef',ref);const r=ref as SourceRef;
    check(datasets.get(r.datasetId)?.version===r.version);
  };
  exactKeys(state.selection,['revision','sourceRef']);revision(state.selection.revision);source(state.selection.sourceRef,true);
  const requests=unique(state.requests,r=>r.requestId);unique(state.requests,r=>r.clientRequestId);
  for(const r of requests.values()){
    exactKeys(r,['requestId','clientRequestId','kind','status','receivedAt','sourceRef','error','steps','text','fingerprint','userMessageId','assistantMessageId'],['testKind']);
    check(r.kind==='chat'||r.kind==='model_test');check(r.kind==='model_test'?r.testKind==='chat'||r.testKind==='tool':r.testKind===undefined);
    check(['accepted','running','stopping','completed','failed','cancelled','interrupted'].includes(r.status));date(r.receivedAt);source(r.sourceRef,true);error(r.error);
    string(r.text,4000);digest(r.fingerprint);string(r.userMessageId,100);string(r.assistantMessageId,100);check(r.userMessageId!==r.assistantMessageId);
    check(Array.isArray(r.steps)&&r.steps.every(record));unique(r.steps,s=>s.id);
    for(const step of r.steps){
      exactKeys(step,['id','tool','label','status','startedAt','finishedAt','durationMs','sourceRef','error']);
      check(TOOL_NAMES.includes(step.tool));string(step.label,100);check(['running','completed','failed','cancelled'].includes(step.status));date(step.startedAt);
      if(step.finishedAt!==null)date(step.finishedAt);
      check(step.durationMs===null||Number.isFinite(step.durationMs)&&step.durationMs>=0);
      check((step.status==='running')===(step.finishedAt===null&&step.durationMs===null));
      source(step.sourceRef,true);check(sameSource(step.sourceRef,r.sourceRef));error(step.error);
    }
  }
  unique(state.messages,m=>m.id);
  for(const m of state.messages){
    exactKeys(m,['id','requestId','role','text','status']);const r=requests.get(m.requestId);check(r);
    check(m.role==='user'||m.role==='assistant');check(m.id===(m.role==='user'?r.userMessageId:r.assistantMessageId));
    check(typeof m.text==='string'&&['partial','completed','failed','cancelled','interrupted'].includes(m.status));
    if(m.role==='user')check(m.text===r.text&&m.status==='completed');
  }
  // The UI retains only its last 100 messages. Older provenance is backed by durable request records.
  check(new Set(state.requests.flatMap(r=>[r.userMessageId,r.assistantMessageId])).size===state.requests.length*2);
  const evidence=new Map(state.requests.map(r=>[r.userMessageId,r]));
  check(evidence.size===state.requests.length);
  const analysisRef=(ref:unknown):void=>{
    definition('AnalysisRef',ref);const a=ref as Analysis['analysis'];string(a.analysisId,100);string(a.queryRequestId,100);source(a.sourceRef);
    const request=requests.get(a.queryRequestId);check(request&&request.kind==='chat'&&sameSource(request.sourceRef,a.sourceRef));
  };
  if(state.analysis!==null){
    const a=state.analysis;
    exactKeys(a,['analysis','records','count','filters','statistics','basis','evaluation','summaryStatus'],['lastRuleUpdate']);
    analysisRef(a.analysis);check(sameSource(a.analysis.sourceRef,state.selection.sourceRef));validateTool('query_tickets',a.filters);validateDataset({tickets:a.records});
    check(a.count===a.records.length&&a.records.every(t=>t.team===a.filters.team&&t.status===a.filters.status&&(!a.filters.priority||t.priority===a.filters.priority)));
    exactKeys(a.statistics,['urgent','normal']);check(a.statistics.urgent===a.records.filter(t=>t.priority==='urgent').length&&a.statistics.normal===a.records.filter(t=>t.priority==='normal').length);
    definition('Basis',a.basis);if(a.basis.now!==null)date(a.basis.now);
    for(const field of ['now','urgentHours','normalHours'] as const){
      const v=field==='now'?a.basis.now:a.basis.policy[field];const origin=a.basis.origins[field];check((v===null)===(origin===null));
      if(origin?.kind==='dataset')check(sameSource(origin.sourceRef,a.analysis.sourceRef));
      if(origin?.kind==='user_message'){
        const r=evidence.get(origin.messageId);check(r&&r.kind==='chat'&&sameSource(r.sourceRef,a.analysis.sourceRef)&&origin.quote.trim().length>0&&r.text.includes(origin.quote));
        check(field==='now'||origin.mode==='explicit_value');
        if(field==='now'&&origin.mode==='received_at')check(a.basis.now===new Date(r.receivedAt).toISOString());
      }
    }
    check(['pending','completed','failed'].includes(a.summaryStatus));
    if(a.lastRuleUpdate!==undefined){exactKeys(a.lastRuleUpdate,['fingerprint','fromRevision']);digest(a.lastRuleUpdate.fingerprint);revision(a.lastRuleUpdate.fromRevision);check(a.lastRuleUpdate.fromRevision+1===a.analysis.contextRevision);}
    if(a.evaluation!==null){
      check(Check({...TOOL_CONTRACT.tools.evaluate_ticket_age.success,$defs:TOOL_CONTRACT.$defs},{ok:true,analysis:a.analysis,...a.evaluation}));
      check(isDeepStrictEqual(a.evaluation.basis,a.basis));
      const evaluated=evaluateTickets(a,{analysisId:a.analysis.analysisId,expectedRevision:a.analysis.contextRevision},{messageId:'validation',text:'',receivedAt:'2000-01-01T00:00:00Z',requestId:'validation'});
      check(isDeepStrictEqual(a.evaluation,evaluated.evaluation));
      check(a.evaluation.rows.length===a.records.length&&a.evaluation.rows.every((row,i)=>row.ticketId===a.records[i].id));
      for(const status of ['overdue','within_limit','future','not_applicable','not_evaluated'] as const)check(a.evaluation.counts[status]===a.evaluation.rows.filter(row=>row.status===status).length);
    }
  }
  const drafts=unique(state.drafts,d=>d.draftId);
  for(const d of drafts.values()){
    exactKeys(d,['proposalId','analysis','title','markdown','contentHash','status','draftId','sessionId','requestId','createdAt']);
    string(d.proposalId,100);string(d.title,120);string(d.markdown,24000);digest(d.contentHash);check(d.contentHash===hash(d.markdown));
    check(d.status==='draft_proposal'&&d.sessionId===state.sessionId);date(d.createdAt);analysisRef(d.analysis);
    const request=requests.get(d.requestId);check(request&&request.kind==='chat'&&request.status==='completed'&&sameSource(request.sourceRef,d.analysis.sourceRef));
  }
  const actions=unique(state.actions,a=>a.actionId);
  for(const a of actions.values()){
    exactKeys(a,['actionId','draftId','status','createdAt','expiresAt','previousActionId','reportId'],['approvedAt']);
    check(/^[A-Za-z0-9_-]{1,100}$/.test(a.actionId)&&drafts.has(a.draftId));date(a.createdAt);date(a.expiresAt);check(Date.parse(a.expiresAt)-Date.parse(a.createdAt)===600000);
    check(['pending_confirmation','saving','saved','failed','cancelled','expired','interrupted'].includes(a.status));
    check(a.status==='saved'?a.reportId===a.actionId:a.reportId===null);
    if(a.approvedAt!==undefined){date(a.approvedAt);check(Date.parse(a.approvedAt)>=Date.parse(a.createdAt)&&Date.parse(a.approvedAt)<Date.parse(a.expiresAt));}
    if(['saving','saved','failed','interrupted'].includes(a.status))check(a.approvedAt!==undefined);
    else check(a.approvedAt===undefined);
    if(a.previousActionId!==null){const prior=actions.get(a.previousActionId);check(prior&&prior!==a&&prior.draftId===a.draftId&&prior.status==='expired');}
  }
  check(state.activeActionId===null||actions.has(state.activeActionId));
  const pending=state.actions.filter(a=>a.status==='pending_confirmation'||a.status==='saving');check(pending.length<=1&&pending.every(a=>a.actionId===state.activeActionId));
  unique(state.reapplications,r=>r.clientRequestId);
  for(const r of state.reapplications){exactKeys(r,['clientRequestId','fingerprint','actionId']);digest(r.fingerprint);check(actions.has(r.actionId)&&actions.get(r.actionId)!.previousActionId!==null);}
  return state;
}
