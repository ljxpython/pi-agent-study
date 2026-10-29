import { mkdir, open, readFile, readdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Check } from 'typebox/value';
import { TOOL_CONTRACT, assert, record, string, validDate, type AnalysisRef, type SourceRef } from './contracts.js';
import { hash } from './resources.js';
import type { Proposal } from './business.js';
export interface Draft extends Proposal {draftId:string;sessionId:string;requestId:string;createdAt:string}
export interface ReportAction {actionId:string;draftId:string;status:'pending_confirmation'|'saving'|'saved'|'failed'|'cancelled'|'expired'|'interrupted';createdAt:string;expiresAt:string;previousActionId:string|null;reportId:string|null;approvedAt?:string}
export interface ReportSummary {reportId:string;draftId:string;actionId:string;title:string;sourceRef:SourceRef;contentHash:string;savedAt:string}
interface Metadata extends ReportSummary {schemaVersion:1;sessionId:string;requestId:string;analysis:AnalysisRef;approvedAt:string}
export interface SavedReport {summary:ReportSummary;markdown:string;metadata:Metadata}
type Phase='markdown_synced'|'files_synced'|'published'|'directory_synced';
function id(value:unknown):asserts value is string {assert(typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value),'成果ID无效');}
async function syncDirectory(path:string):Promise<void> {const dir=await open(path,'r');try{await dir.sync();}finally{await dir.close();}}
export class Reports {
 private readonly active=new Set<string>();
 constructor(private readonly root:string,private readonly checkpoint:(phase:Phase)=>Promise<void>=async()=>{}){}
 private path(reportId:string):string {id(reportId);return join(this.root,'reports',reportId);}
 async read(reportId:string):Promise<SavedReport> {
  const path=this.path(reportId);const metadata:unknown=JSON.parse(await readFile(join(path,'metadata.json'),'utf8'));const markdown=await readFile(join(path,'report.md'),'utf8');
  assert(record(metadata)&&metadata.schemaVersion===1&&metadata.reportId===reportId&&metadata.actionId===reportId,'报告包元数据不完整','STATE_UNAVAILABLE');
  id(metadata.draftId);string(metadata.title,120);string(metadata.sessionId,100);string(markdown,24000);
  assert(typeof metadata.requestId==='string'&&metadata.requestId.trim().length>0&&metadata.requestId.length<=100,'报告生成请求缺失','STATE_UNAVAILABLE');
  assert(validDate(metadata.savedAt)&&validDate(metadata.approvedAt)&&Date.parse(metadata.approvedAt)<=Date.parse(metadata.savedAt),'报告保存或批准时间无效','STATE_UNAVAILABLE');
  assert(record(metadata.sourceRef)&&record(metadata.analysis)&&record(metadata.analysis.sourceRef),'报告来源不完整','STATE_UNAVAILABLE');
  const analysisSchema={...TOOL_CONTRACT.$defs.AnalysisRef,$defs:TOOL_CONTRACT.$defs};
  assert(Check(analysisSchema,metadata.analysis)&&Check(TOOL_CONTRACT.$defs.SourceRef,metadata.sourceRef),'报告分析引用不完整','STATE_UNAVAILABLE');
  for(const value of [metadata.analysis.analysisId,metadata.analysis.queryRequestId,metadata.sourceRef.datasetId,metadata.sourceRef.version]){
   assert(typeof value==='string'&&value.trim().length>0,'报告分析引用为空','STATE_UNAVAILABLE');
  }
  assert(metadata.sourceRef.datasetId===metadata.analysis.sourceRef.datasetId&&metadata.sourceRef.version===metadata.analysis.sourceRef.version&&metadata.contentHash===hash(markdown),'报告内容或来源校验失败','STATE_UNAVAILABLE');
  const m=metadata as unknown as Metadata;
  return {summary:{reportId:m.reportId,draftId:m.draftId,actionId:m.actionId,title:m.title,sourceRef:m.sourceRef,contentHash:m.contentHash,savedAt:m.savedAt},markdown,metadata:m};
 }
 async readApproved(draft:Draft,action:ReportAction):Promise<SavedReport> {
  const saved=await this.read(action.actionId);const m=saved.metadata;
  assert(m.draftId===draft.draftId&&action.draftId===draft.draftId&&m.sessionId===draft.sessionId&&m.requestId===draft.requestId&&m.title===draft.title&&m.contentHash===draft.contentHash&&saved.markdown===draft.markdown&&m.approvedAt===action.approvedAt&&isDeepStrictEqual(m.analysis,draft.analysis),'报告与持久化草稿或批准记录不一致','STATE_UNAVAILABLE');
  return saved;
 }
 async scan():Promise<{reports:ReportSummary[];unavailable:boolean;conflict:boolean}> {
  let entries;try{entries=await readdir(join(this.root,'reports'),{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {reports:[],unavailable:false,conflict:false};throw e;}
  const reports:ReportSummary[]=[];const drafts=new Set<string>();let unavailable=false,conflict=false;
  for(const entry of entries){
   if(entry.name==='.DS_Store'&&entry.isFile())continue;
   if(!entry.isDirectory()){unavailable=true;continue;}
   try {const report=await this.read(entry.name);if(drafts.has(report.summary.draftId))conflict=true;drafts.add(report.summary.draftId);reports.push(report.summary);}catch{unavailable=true;}
  }
  return {reports:reports.sort((a,b)=>a.savedAt.localeCompare(b.savedAt)),unavailable,conflict};
 }
 async publish(draft:Draft,action:ReportAction):Promise<SavedReport> {
  id(action.actionId);assert(action.draftId===draft.draftId&&action.status==='saving'&&validDate(action.approvedAt),'尚未获得有效用户批准','FORBIDDEN');
  assert(validDate(action.createdAt)&&validDate(action.expiresAt)&&Date.parse(action.expiresAt)-Date.parse(action.createdAt)===600000&&Date.parse(action.approvedAt!)>=Date.parse(action.createdAt)&&Date.parse(action.approvedAt!)<Date.parse(action.expiresAt),'批准不在有效期限内','ACTION_EXPIRED');
  assert(draft.contentHash===hash(draft.markdown),'草稿内容发生变化','STALE_ANALYSIS');
  assert(!this.active.has(action.actionId),'报告正在保存','BUSY');
  this.active.add(action.actionId);
  try {
   const final=this.path(action.actionId);
   let exists=true;try {await stat(final);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;exists=false;}
   if(exists)return await this.readApproved(draft,action);
   const scan=await this.scan();assert(!scan.conflict&&!scan.unavailable&&!scan.reports.some(r=>r.draftId===draft.draftId),'同一草稿已有保存成果或存在一致性故障','STATE_UNAVAILABLE');
   const pending=join(this.root,'.pending',`${action.actionId}-${randomUUID()}`);await mkdir(pending);
   const metadata:Metadata={schemaVersion:1,reportId:action.actionId,actionId:action.actionId,draftId:draft.draftId,title:draft.title,sourceRef:draft.analysis.sourceRef,contentHash:draft.contentHash,savedAt:new Date().toISOString(),approvedAt:action.approvedAt!,sessionId:draft.sessionId,requestId:draft.requestId,analysis:draft.analysis};
   for(const [name,body] of [['report.md',draft.markdown],['metadata.json',JSON.stringify(metadata)]]){
    const file=await open(join(pending,name),'wx',0o600);try{await file.writeFile(body);await file.sync();}finally{await file.close();}
    if(name==='report.md')await this.checkpoint('markdown_synced');
   }
   assert(hash(await readFile(join(pending,'report.md'),'utf8'))===draft.contentHash,'写入后校验失败','SAVE_FAILED');
   await syncDirectory(pending);await this.checkpoint('files_synced');
   await rename(pending,final);await this.checkpoint('published');
   await syncDirectory(join(this.root,'reports'));await syncDirectory(join(this.root,'.pending'));await this.checkpoint('directory_synced');
   return await this.readApproved(draft,action);
  } catch(e) {
   // Publication may have succeeded before a later fsync/notification failed. Disk is authoritative.
   try {return await this.readApproved(draft,action);}catch{}
   throw e;
  } finally {this.active.delete(action.actionId);}
 }
}
