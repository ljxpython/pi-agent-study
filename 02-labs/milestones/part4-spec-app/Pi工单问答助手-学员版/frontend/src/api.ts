export interface ApiError {code:string;message:string;retryable:boolean}
export class ApiFailure extends Error {
  constructor(readonly error:ApiError,readonly status:number){super(error.message);}
}
export interface Envelope {serverEpoch:string;sessionId:string|null;seq:number;requestId:string|null;type:string;payload:unknown}
const EVENTS=new Set(['snapshot','request.updated','message.delta','message.updated','query.updated','selection.updated','resources.updated','model.updated','report.updated']);
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function envelope(value:unknown):Envelope {
  if(!object(value)||typeof value.serverEpoch!=='string'||!(value.sessionId===null||typeof value.sessionId==='string')||!Number.isSafeInteger(value.seq)||(value.seq as number)<0||!(value.requestId===null||typeof value.requestId==='string')||typeof value.type!=='string'||!EVENTS.has(value.type)||!Object.hasOwn(value,'payload'))throw new Error('后端事件协议不兼容');
  const p=value.payload;
  if(value.type==='snapshot'){
    if(!object(p)||!['normal','recovery_readonly'].includes(p.mode as string)||p.serverEpoch!==value.serverEpoch||p.sessionId!==value.sessionId||p.seq!==value.seq||!Array.isArray(p.messages)||!Array.isArray(p.reports))throw new Error('后端快照协议不兼容');
  }else if(value.type==='message.delta'){
    if(!object(p)||typeof p.messageId!=='string'||p.role!=='assistant'||typeof p.delta!=='string')throw new Error('后端消息协议不兼容');
  }else if(value.type==='message.updated'){
    if(!object(p)||typeof p.id!=='string'||typeof p.text!=='string'||!['user','assistant'].includes(p.role as string)||!['partial','completed','failed','cancelled','interrupted'].includes(p.status as string))throw new Error('后端消息协议不兼容');
  }else if(value.type==='request.updated'){
    if(p!==null&&(!object(p)||typeof p.requestId!=='string'||!['accepted','running','stopping','completed','failed','cancelled','interrupted'].includes(p.status as string)||!Array.isArray(p.steps)))throw new Error('后端请求协议不兼容');
  }else if(value.type==='query.updated'){
    if(p!==null&&(!object(p)||!object(p.analysis)||!Array.isArray(p.records)||typeof p.count!=='number'))throw new Error('后端查询协议不兼容');
  }else if(value.type==='selection.updated'){
    if(!object(p)||!Number.isSafeInteger(p.revision)||!Object.hasOwn(p,'sourceRef'))throw new Error('后端资料协议不兼容');
  }else if(value.type==='resources.updated'){
    if(!object(p)||!Number.isSafeInteger(p.revision))throw new Error('后端资源协议不兼容');
  }else if(value.type==='model.updated'){
    if(!object(p)||!Number.isSafeInteger(p.revision)||!['host','independent'].includes(p.credentialMode as string)||typeof p.configured!=='boolean')throw new Error('后端模型协议不兼容');
  }else if(value.type==='report.updated'){
    if(!object(p)||!Array.isArray(p.reports)||!Object.hasOwn(p,'action'))throw new Error('后端报告协议不兼容');
  }
  return value as unknown as Envelope;
}
/** A fresh connection owns its epoch. Late callbacks cannot replace it. */
export class EventOrder {
  generation=0;private epoch:string|null=null;private sequence=-1;private first=true;
  begin():number{this.generation++;this.first=true;return this.generation;}
  accept(value:unknown,generation:number):Envelope|null {
    if(generation!==this.generation)return null;
    const event=envelope(value);
    if(this.first){if(event.type!=='snapshot')throw new Error('事件流缺少首帧快照');this.first=false;this.epoch=event.serverEpoch;this.sequence=event.seq;return event;}
    if(event.serverEpoch!==this.epoch)throw new Error('事件流进程身份变化，请重新同步');
    if(event.seq<=this.sequence)return null;
    if(event.seq!==this.sequence+1)throw new Error('事件序号不连续，请重新同步');
    this.sequence=event.seq;return event;
  }
}
/** Streaming SSE framing. Heartbeats are comments and never become business events. */
export class SseParser {
  private buffer='';
  push(chunk:string):unknown[]{
    this.buffer+=chunk;if(this.buffer.length>4*1024*1024)throw new Error('事件缓冲超过限制');
    const result:unknown[]=[];
    while(true){const match=/\r?\n\r?\n/.exec(this.buffer);if(!match)break;const frame=this.buffer.slice(0,match.index);this.buffer=this.buffer.slice(match.index+match[0].length);const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');if(data){try{result.push(JSON.parse(data));}catch{throw new Error("后端事件协议不兼容：JSON格式无效");}}}
    return result;
  }
}
export class ApiClient {
  readonly order=new EventOrder();private token='';private controller:AbortController|undefined;
  private stopped=false;private reconnectTimer:ReturnType<typeof setTimeout>|undefined;
  constructor(private readonly transport:typeof fetch=(...args)=>fetch(...args),private readonly storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>=sessionStorage){this.token=storage.getItem('pi-ticket-access')??'';}
  private async bootstrap():Promise<void>{const response=await this.transport('/api/access',{method:'POST',headers:{'content-type':'application/json','x-pi-bootstrap':'1'},body:'{}'});if(!response.ok)throw new Error('无法建立本机访问连接');const value:unknown=await response.json();if(!object(value)||typeof value.token!=='string')throw new Error('后端认证协议不兼容');this.token=value.token;this.storage.setItem('pi-ticket-access',this.token);}
  async request<T>(path:string,method='GET',input?:unknown):Promise<T>{
    if(!this.token)await this.bootstrap();
    const response=await this.transport(path,{method,headers:{authorization:`Bearer ${this.token}`,...(input===undefined?{}:{'content-type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)})});
    if(!response.ok){const body:unknown=await response.json().catch(()=>null);if(response.status===401){this.token='';this.storage.removeItem('pi-ticket-access');}const error=object(body)&&object(body.error)?body.error:null;throw new ApiFailure({code:typeof error?.code==='string'?error.code:'REQUEST_FAILED',message:typeof error?.message==='string'?error.message:'请求失败，未自动重发',retryable:false},response.status);}
    return response.json() as Promise<T>;
  }
  async download(id:string):Promise<Blob>{if(!this.token)await this.bootstrap();const response=await this.transport(`/api/reports/${encodeURIComponent(id)}/download`,{headers:{authorization:`Bearer ${this.token}`}});if(!response.ok)throw new Error('报告下载失败');return response.blob();}
  connect(receive:(event:Envelope,generation:number)=>void,status:(connected:boolean,message:string)=>void):void {
    this.stopped=false;clearTimeout(this.reconnectTimer);this.controller?.abort();
    let failures=0;
    const attempt=async()=>{
      if(this.stopped)return;const generation=this.order.begin();this.controller?.abort();const controller=new AbortController();this.controller=controller;status(false,'正在同步后端状态…');
      try {
        if(!this.token)await this.bootstrap();if(generation!==this.order.generation||this.stopped)return;
        let response=await this.transport('/api/events',{headers:{authorization:`Bearer ${this.token}`},signal:controller.signal});
        if(response.status===401){this.token='';this.storage.removeItem('pi-ticket-access');await this.bootstrap();if(generation!==this.order.generation||this.stopped)return;response=await this.transport('/api/events',{headers:{authorization:`Bearer ${this.token}`},signal:controller.signal});}
        if(!response.ok||!response.body)throw new Error('无法订阅后端事件');
        const reader=response.body.getReader();const decoder=new TextDecoder();const parser=new SseParser();
        try{while(!this.stopped&&generation===this.order.generation){const next=await reader.read();if(next.done)throw new Error('后端连接已断开');for(const raw of parser.push(decoder.decode(next.value,{stream:true}))){const event=this.order.accept(raw,generation);if(!event)continue;receive(event,generation);if(event.type==='snapshot'){failures=0;status(true,'已连接后端');}}}}finally{await reader.cancel().catch(()=>{});}
      }catch(error){
        if(this.stopped||generation!==this.order.generation)return;
        const message=error instanceof Error?error.message:'后端连接失败';status(false,message);
        if(message.includes('协议不兼容')){this.stopped=true;return;}
        if(failures>=3){status(false,'连接失败，请点击重新连接。任务不会自动重发。');return;}
        this.reconnectTimer=setTimeout(()=>{void attempt();},[1000,2000,5000][failures++]);
      }
    };
    void attempt();
  }
  close():void{this.stopped=true;this.order.begin();clearTimeout(this.reconnectTimer);this.controller?.abort();}
}
