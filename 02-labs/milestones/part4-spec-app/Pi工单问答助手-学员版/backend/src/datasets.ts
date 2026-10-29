import { readFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assert, string, validateDataset, type DatasetPayload, type SourceRef } from './contracts.js';
import { hash } from './resources.js';

export interface DatasetSummary {id:string;name:string;version:string;count:number;origin:'builtin'|'upload'}
export interface Dataset {dataset:DatasetSummary;payload:DatasetPayload}
export const BUILTIN:DatasetPayload={now:'2026-09-17T12:00:00Z',policy:{urgentHours:4,normalHours:24},tickets:[
 {id:'T01',title:'登录 API 报错',team:'平台',priority:'urgent',status:'open',createdAt:'2026-09-17T07:00:00Z'},
 {id:'T02',title:'登录样式错位',team:'前端',priority:'normal',status:'open',createdAt:'2026-09-16T10:00:00Z'},
 {id:'T03',title:'支付超时',team:'平台',priority:'urgent',status:'closed',createdAt:'2026-09-16T00:00:00Z'},
 {id:'T04',title:'API 导出',team:'平台',priority:'normal',status:'open',createdAt:'2026-09-17T10:00:00+08:00'},
 {id:'T05',title:'API 边界',team:'前端',priority:'urgent',status:'open',createdAt:'2026-09-17T08:00:00Z'},
 {id:'T06',title:'将来任务',team:'平台',priority:'normal',status:'open',createdAt:'2026-09-18T12:00:00Z'},
]};
/** Only explicitly registered dataset ids are readable. Uncommitted upload files are not discovered. */
export class Datasets {
 private readonly registered=new Map<string,Dataset>();
 constructor(private readonly root:string){}
 private path(id:string):string {assert(/^[A-Za-z0-9_-]{1,100}$/.test(id),'资料ID无效');return join(this.root,'datasets',`${id}.json`);}
 async restore(summaries:DatasetSummary[]):Promise<void> {
  const next=new Map<string,Dataset>();
  for(const summary of summaries){
   assert(!next.has(summary.id),'资料ID重复','STATE_UNAVAILABLE');
   const payload=validateDataset(JSON.parse(await readFile(this.path(summary.id),'utf8')));
   assert(hash(JSON.stringify(payload))===summary.version&&payload.tickets.length===summary.count,'资料内容与注册版本不一致','STATE_UNAVAILABLE');
   next.set(summary.id,{dataset:{...summary},payload});
  }
  this.registered.clear();for(const [id,value] of next)this.registered.set(id,value);
 }
 list():DatasetSummary[]{return [...this.registered.values()].map(v=>({...v.dataset}));}
 get(id:string):Dataset {const item=this.registered.get(id);assert(item,'资料不存在','RESOURCE_NOT_FOUND');return structuredClone(item);}
 bound(source:SourceRef|null):Dataset {assert(source,'请先选择资料','NO_DATASET_SELECTED');const item=this.get(source.datasetId);assert(item.dataset.version===source.version,'资料版本已变化','SOURCE_NOT_AUTHORIZED');return item;}
 async prepare(name:unknown,input:unknown,builtin=false):Promise<Dataset> {
  string(name,200,'资料名称');const payload=validateDataset(input);
  const id=builtin?'builtin-tickets':randomUUID();const version=hash(JSON.stringify(payload));
  const item:Dataset={dataset:{id,name,version,count:payload.tickets.length,origin:builtin?'builtin':'upload'},payload};
  let file;
  try {file=await open(this.path(id),'wx',0o600);}catch(e){
   if(!builtin||(e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
   // A previous interrupted initialization may have published exactly this immutable fixture.
   const existing=validateDataset(JSON.parse(await readFile(this.path(id),'utf8')));
   assert(hash(JSON.stringify(existing))===version,'内置资料文件不完整或被修改','STATE_UNAVAILABLE');return item;
  }
  try {await file.writeFile(JSON.stringify(payload));await file.sync();}finally{await file.close();}
  const dir=await open(join(this.root,'datasets'),'r');try{await dir.sync();}finally{await dir.close();}
  return item;
 }
 register(item:Dataset):void {assert(!this.registered.has(item.dataset.id),'资料已注册','RESOURCE_CONFLICT');this.registered.set(item.dataset.id,structuredClone(item));}
}
