import type { ServerResponse } from 'node:http';
import { responseHeaders } from './access.js';

export type EventType='snapshot'|'request.updated'|'message.delta'|'message.updated'|'query.updated'|'selection.updated'|'resources.updated'|'model.updated'|'report.updated';
export interface Envelope {serverEpoch:string;sessionId:string|null;seq:number;requestId:string|null;type:EventType;payload:unknown}
interface Client {response:ServerResponse;queue:string[];bytes:number;blocked:boolean;closed:boolean;heartbeat:ReturnType<typeof setInterval>}
const MAX_BUFFER=4*1024*1024;
/** Process-local projection stream, deliberately without event history or replay. */
export class Events {
  private sequence=0;
  private clients=new Set<Client>();
  constructor(readonly serverEpoch:string,private readonly sessionId:()=>string|null,private readonly projection:()=>Record<string,unknown>) {}
  get seq():number {return this.sequence;}
  snapshot():Record<string,unknown> {return {...this.projection(),serverEpoch:this.serverEpoch,sessionId:this.sessionId(),seq:this.sequence};}
  private envelope(type:EventType,payload:unknown,requestId:string|null):Envelope {
    return {serverEpoch:this.serverEpoch,sessionId:this.sessionId(),seq:this.sequence,requestId,type,payload};
  }
  publish(type:Exclude<EventType,'snapshot'>,payload:unknown,requestId:string|null=null):void {
    this.sequence++;
    // Serialize immediately; subsequent in-memory mutations cannot change queued events.
    const frame=`data: ${JSON.stringify(this.envelope(type,payload,requestId))}\n\n`;
    for(const client of this.clients)this.enqueue(client,frame);
  }
  subscribe(response:ServerResponse):()=>void {
    responseHeaders(response);response.setHeader('Content-Type','text/event-stream; charset=utf-8');response.setHeader('Connection','keep-alive');
    const client:Client={response,queue:[],bytes:0,blocked:true,closed:false,heartbeat:setInterval(()=>this.enqueue(client,': heartbeat\n\n'),15000)};
    client.heartbeat.unref();
    response.on('close',()=>this.remove(client));
    response.on('error',()=>this.remove(client));
    response.on('drain',()=>{client.blocked=false;this.flush(client);});
    // No await or disk reads between registration and snapshot capture.
    this.clients.add(client);
    this.enqueue(client,`data: ${JSON.stringify(this.envelope('snapshot',this.snapshot(),null))}\n\n`);
    client.blocked=false;this.flush(client);
    return ()=>this.remove(client);
  }
  private enqueue(client:Client,frame:string):void {
    if(client.closed)return;
    const size=Buffer.byteLength(frame);
    if(client.bytes+client.response.writableLength+size>MAX_BUFFER){this.remove(client);return;}
    client.queue.push(frame);client.bytes+=size;this.flush(client);
  }
  private flush(client:Client):void {
    if(client.closed||client.blocked)return;
    // A write callback can trigger another publish; keep its frame queued behind this one.
    client.blocked=true;
    while(client.queue.length&&!client.closed){
      const frame=client.queue.shift()!;client.bytes-=Buffer.byteLength(frame);
      try {if(!client.response.write(frame))return;} catch {this.remove(client);return;}
    }
    client.blocked=false;
  }
  private remove(client:Client):void {
    if(client.closed)return;client.closed=true;clearInterval(client.heartbeat);this.clients.delete(client);client.queue=[];client.bytes=0;client.response.destroy();
  }
  close():void {for(const client of this.clients)this.remove(client);}
}
