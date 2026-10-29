import { AppFault, type AppError } from './contracts.js';
/** Stops stalled work, not long work. No total duration, request-count or token quota. */
export class RunGuard {
 private idle:ReturnType<typeof setTimeout>|undefined;
 private connection:ReturnType<typeof setTimeout>|undefined;
 private fingerprints:string[]=[];private stopped=false;
 constructor(private readonly stop:(error:AppError)=>void,private readonly limits={connectionMs:15000,idleMs:120000}){this.progress();}
 request():void {if(this.stopped)throw new AppFault('CANCELLED','任务已停止');clearTimeout(this.connection);this.connection=setTimeout(()=>this.fail('模型连接超时，已请求停止'),this.limits.connectionMs);}
 connected():void {clearTimeout(this.connection);this.connection=undefined;}
 progress():void {if(this.stopped)return;clearTimeout(this.idle);this.idle=setTimeout(()=>this.fail('模型或工具长时间没有进展，已请求停止'),this.limits.idleMs);}
 tool(fingerprint:string):void {
  if(this.stopped)throw new AppFault('CANCELLED','任务已停止');
  this.fingerprints.push(fingerprint);this.fingerprints=this.fingerprints.slice(-9);
  for(let n=1;n<=3;n++){
   const block=this.fingerprints.slice(-n).join(',');
   if(this.fingerprints.length>=n*3&&this.fingerprints.slice(-n*2,-n).join(',')===block&&this.fingerprints.slice(-n*3,-n*2).join(',')===block){this.fail('工具重复执行且没有进展，已请求停止');throw new AppFault('CANCELLED','重复工具循环已停止');}
  }
  this.progress();
 }
 private fail(message:string):void {if(this.stopped)return;this.dispose();this.stop(new AppFault('PROVIDER_ERROR',message).toJSON());}
 dispose():void {this.stopped=true;clearTimeout(this.idle);clearTimeout(this.connection);}
}
