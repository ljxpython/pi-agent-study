import { randomUUID } from 'node:crypto';
import { assert, validateTool, type AnalysisRef, type DatasetPayload, type Filters, type RuleUpdates, type SourceRef, type Ticket, type ToolInputs } from './contracts.js';
import { hash } from './resources.js';

type RuleOrigin={kind:'dataset';sourceRef:SourceRef}|{kind:'user_message';messageId:string;quote:string;mode:'explicit_value'|'received_at'}|null;
export interface Basis {now:string|null;policy:{urgentHours:number|null;normalHours:number|null};origins:{now:RuleOrigin;urgentHours:RuleOrigin;normalHours:RuleOrigin}}
export type AgeStatus='overdue'|'within_limit'|'future'|'not_applicable'|'not_evaluated';
export interface Evaluation {
 evaluation:'evaluated'|'not_evaluated';missingRules:('now'|'urgentHours'|'normalHours')[];
 rows:{ticketId:string;status:AgeStatus;ageMs:number|null;thresholdHours:number|null}[];
 counts:Record<AgeStatus,number>;basis:Basis;
}
export interface Analysis {
 analysis:AnalysisRef;records:Ticket[];count:number;filters:Filters;statistics:{urgent:number;normal:number};
 basis:Basis;evaluation:Evaluation|null;summaryStatus:'pending'|'completed'|'failed';
 lastRuleUpdate?:{fingerprint:string;fromRevision:number};
}
export interface UserEvidence {messageId:string;text:string;receivedAt:string;requestId:string}
export interface Proposal {proposalId:string;analysis:AnalysisRef;title:string;markdown:string;contentHash:string;status:'draft_proposal'}
export function queryTickets(dataset:DatasetPayload,sourceRef:SourceRef,input:unknown,requestId:string):Analysis {
 validateTool('query_tickets',input);const filters=input as Filters;
 const records=dataset.tickets.filter(t=>t.team===filters.team&&t.status===filters.status&&(!filters.priority||t.priority===filters.priority)).map(t=>({...t}));
 const origin:RuleOrigin={kind:'dataset',sourceRef:{...sourceRef}};
 return {analysis:{analysisId:randomUUID(),queryRequestId:requestId,sourceRef:{...sourceRef},contextRevision:0},records,count:records.length,filters:{...filters},statistics:{urgent:records.filter(t=>t.priority==='urgent').length,normal:records.filter(t=>t.priority==='normal').length},basis:{now:dataset.now?new Date(dataset.now).toISOString():null,policy:{urgentHours:dataset.policy?.urgentHours??null,normalHours:dataset.policy?.normalHours??null},origins:{now:dataset.now?origin:null,urgentHours:dataset.policy?origin:null,normalHours:dataset.policy?origin:null}},evaluation:null,summaryStatus:'pending'};
}
function applyUpdates(next:Analysis,updates:RuleUpdates,user:UserEvidence):void {
 for(const field of ['now','urgentHours','normalHours'] as const){
  const update=updates[field];if(!update)continue;
  assert(update.evidence.messageId===user.messageId&&user.text.includes(update.evidence.quote),'规则依据必须来自当前用户消息原文','RULE_CLARIFICATION_REQUIRED');
  // This checks provenance, not intent. Negation/quotation ambiguity remains a model-evaluation gate.
  if(field==='now') {
   const now=updates.now!;next.basis.now=new Date(now.mode==='received_at'?user.receivedAt:now.value).toISOString();
   next.basis.origins.now={kind:'user_message',messageId:user.messageId,quote:now.evidence.quote,mode:now.mode};
  } else {
   next.basis.policy[field]=updates[field]!.value;
   next.basis.origins[field]={kind:'user_message',messageId:user.messageId,quote:update.evidence.quote,mode:'explicit_value'};
  }
 }
}
export function evaluateTickets(current:Analysis,input:unknown,user:UserEvidence):Analysis {
 validateTool('evaluate_ticket_age',input);const args=input as ToolInputs['evaluate_ticket_age'];
 assert(args.analysisId===current.analysis.analysisId,'分析已失效','STALE_ANALYSIS');
 const fingerprint=hash(JSON.stringify({requestId:user.requestId,messageId:user.messageId,updates:args.updates,expectedRevision:args.expectedRevision}));
 const replay=!!args.updates&&current.lastRuleUpdate?.fingerprint===fingerprint;
 assert(args.expectedRevision===current.analysis.contextRevision||replay,'分析版本已变化','STALE_ANALYSIS');
 const next=structuredClone(current);
 if(args.updates&&!replay){applyUpdates(next,args.updates,user);next.analysis.contextRevision++;next.lastRuleUpdate={fingerprint,fromRevision:args.expectedRevision};}
 const {now,policy}=next.basis;
 const missingRules:Evaluation['missingRules']=[];
 if(now===null)missingRules.push('now');if(policy.urgentHours===null)missingRules.push('urgentHours');if(policy.normalHours===null)missingRules.push('normalHours');
 const counts:Evaluation['counts']={overdue:0,within_limit:0,future:0,not_applicable:0,not_evaluated:0};
 const rows=next.records.map(ticket=>{
  let status:AgeStatus='not_evaluated';let ageMs:number|null=null;let thresholdHours:number|null=null;
  if(ticket.status==='closed')status='not_applicable';
  else if(!missingRules.length){
   ageMs=Date.parse(now!)-Date.parse(ticket.createdAt);thresholdHours=policy[ticket.priority==='urgent'?'urgentHours':'normalHours'];
   status=ageMs<0?'future':ageMs>thresholdHours!*3_600_000?'overdue':'within_limit';
  }
  counts[status]++;return {ticketId:ticket.id,status,ageMs,thresholdHours};
 });
 next.evaluation={evaluation:missingRules.length?'not_evaluated':'evaluated',missingRules,rows,counts,basis:structuredClone(next.basis)};
 return next;
}
export function escapeMarkdown(text:string):string {
 return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g,'\\$1').replace(/[\r\n]+/g,' ');
}
export function prepareReport(current:Analysis,input:unknown):Proposal {
 validateTool('prepare_report',input);const args=input as ToolInputs['prepare_report'];
 assert(args.analysisId===current.analysis.analysisId&&args.expectedRevision===current.analysis.contextRevision,'分析或规则版本已变化','STALE_ANALYSIS');
 const {sourceRef}=current.analysis;
 const evaluation=current.evaluation;
 const lines=[`# ${escapeMarkdown(args.title)}`,'','## 查询事实',`- 工单数量：${current.count}`,`- 紧急：${current.statistics.urgent}；普通：${current.statistics.normal}`,`- 筛选：团队 ${escapeMarkdown(current.filters.team)}；状态 ${current.filters.status}${current.filters.priority?`；优先级 ${current.filters.priority}`:''}`,'','## 时效判断'];
 if(evaluation?.evaluation==='evaluated')lines.push(`- 超时：${evaluation.counts.overdue}；未超时：${evaluation.counts.within_limit}；未来时间异常：${evaluation.counts.future}；不适用：${evaluation.counts.not_applicable}`);
 else lines.push('- 未评估时效：分析时间或规则未完整提供，或尚未执行时效检查。');
 lines.push('','## 工单明细','| ID | 标题 | 优先级 | 状态 | 创建时间 |','| --- | --- | --- | --- | --- |');
 for(const t of current.records)lines.push(`| ${escapeMarkdown(t.id)} | ${escapeMarkdown(t.title)} | ${t.priority} | ${t.status} | ${escapeMarkdown(t.createdAt)} |`);
 lines.push('','## 分析依据',`- 资料：${escapeMarkdown(sourceRef.datasetId)}；版本：${escapeMarkdown(sourceRef.version)}`,`- 分析ID：${current.analysis.analysisId}；规则版本：${current.analysis.contextRevision}`,`- 分析时间：${current.basis.now??'未提供'}（已提供时间统一为UTC）`,`- 紧急阈值：${current.basis.policy.urgentHours??'未提供'}小时；普通阈值：${current.basis.policy.normalHours??'未提供'}小时`);
 for(const field of ['now','urgentHours','normalHours'] as const){const origin=current.basis.origins[field];lines.push(`- ${field}来源：${origin?.kind==='user_message'?`用户消息 ${escapeMarkdown(origin.messageId)}，原文“${escapeMarkdown(origin.quote)}”，模式 ${origin.mode}`:origin?.kind==='dataset'?'绑定资料':'未提供'}`);}
 lines.push('','## 模型建议');if(!args.recommendations.length)lines.push('无。');for(const recommendation of args.recommendations)lines.push(`- ${escapeMarkdown(recommendation)}`);
 const markdown=lines.join('\n')+'\n';assert(markdown.length<=24000,'报告超过24000字符，请缩小查询范围','RESULT_TOO_LARGE');
 return {proposalId:randomUUID(),analysis:structuredClone(current.analysis),title:args.title,markdown,contentHash:hash(markdown),status:'draft_proposal'};
}
