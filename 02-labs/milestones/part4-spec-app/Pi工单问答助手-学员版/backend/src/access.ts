import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assert, exactKeys } from './contracts.js';

/** Local browser boundary. Does not attempt to protect against a hostile local process. */
export class Access {
  private readonly token=randomBytes(32).toString('hex');
  private readonly hosts:Set<string>;
  private readonly origins:Set<string>;
  constructor(port:number, developmentProxy=false) {
    this.hosts=new Set([`127.0.0.1:${port}`,...developmentProxy?['127.0.0.1:5178']:[]]);
    this.origins=new Set([...this.hosts].map(host=>`http://${host}`));
  }
  entry(request:IncomingMessage):void {
    assert(this.hosts.has(request.headers.host??''),'不允许的访问地址','FORBIDDEN');
    assert(request.method==='GET'||request.method==='HEAD','不允许的入口方法','FORBIDDEN');
    assert(request.headers.origin===undefined||this.origins.has(request.headers.origin),'不允许的来源','FORBIDDEN');
  }
  check(request:IncomingMessage,bootstrap=false):void {
    assert(this.hosts.has(request.headers.host??''),'不允许的访问地址','FORBIDDEN');
    assert(request.method!=='OPTIONS','不接受跨站预检','FORBIDDEN');
    const origin=request.headers.origin;
    const write=request.method!=='GET'&&request.method!=='HEAD';
    assert((!write&&!bootstrap&&origin===undefined)||typeof origin==='string'&&this.origins.has(origin),'不允许的来源','FORBIDDEN');
    if(bootstrap) {
      assert(request.method==='POST'&&request.headers['x-pi-bootstrap']==='1','初始化请求无效','FORBIDDEN');
      assert(request.headers['content-type']?.split(';')[0].trim().toLowerCase()==='application/json','需要JSON请求','INVALID_INPUT');
      return;
    }
    const value=request.headers.authorization;
    const expected=`Bearer ${this.token}`;
    assert(typeof value==='string'&&Buffer.byteLength(value)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(value),Buffer.from(expected)),'访问令牌无效','UNAUTHORIZED');
  }
  bootstrap(body:unknown):{token:string} {exactKeys(body,[]);return {token:this.token};}
}
export function responseHeaders(response:ServerResponse):void {
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Content-Security-Policy',"frame-ancestors 'none'");
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Referrer-Policy','no-referrer');
}
