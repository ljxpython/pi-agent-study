import { mkdir, readdir, readFile, open, unlink, rmdir, realpath } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppFault, assert, record } from './contracts.js';
import { atomicWrite } from './resources.js';

interface Owner { application:'pi-ticket-assistant'; pid:number; host:string; nonce:string }
function owner(value:unknown):value is Owner {
  return record(value)&&value.application==='pi-ticket-assistant'&&Number.isSafeInteger(value.pid)&&(value.pid as number)>0&&typeof value.host==='string'&&typeof value.nonce==='string';
}
function isDead(pid:number):boolean {
  try {process.kill(pid,0);return false;} catch(e) {return (e as NodeJS.ErrnoException).code==='ESRCH';}
}
/** Kernel-exclusive mkdir; a dead local owner may be reclaimed under a separate exclusive gate. */
class DirectoryLock {
  private readonly mine:Owner={application:'pi-ticket-assistant',pid:process.pid,host:hostname(),nonce:randomUUID()};
  private constructor(private readonly path:string) {}
  static async acquire(root:string):Promise<DirectoryLock> {
    const lock=new DirectoryLock(join(root,'.instance-lock'));
    try {await mkdir(lock.path);} catch(e) {
      if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;
      const gate=join(root,'.lock-recovery');
      try {await mkdir(gate);} catch {throw new AppFault('BUSY','数据目录正在使用或锁恢复归属不明，请核查现有进程');}
      try {
        let old:unknown;try {old=JSON.parse(await readFile(join(lock.path,'owner.json'),'utf8'));}catch{throw new AppFault('BUSY','数据目录锁归属不明，保留原锁，请人工核查');}
        assert(owner(old)&&old.host===hostname()&&isDead(old.pid),'数据目录已有活动进程或锁归属不明','BUSY');
        await unlink(join(lock.path,'owner.json'));await rmdir(lock.path);
        // Another fresh starter may win the mkdir. Never remove its new lock.
        try {await mkdir(lock.path);} catch {throw new AppFault('BUSY','另一个进程已取得数据目录');}
      } finally {await rmdir(gate);}
    }
    const file=await open(join(lock.path,'owner.json'),'wx',0o600);
    try {await file.writeFile(JSON.stringify(lock.mine));await file.sync();}finally{await file.close();}
    return lock;
  }
  async release():Promise<void> {
    const current:unknown=JSON.parse(await readFile(join(this.path,'owner.json'),'utf8'));
    assert(owner(current)&&current.nonce===this.mine.nonce,'数据目录锁归属已变化','STATE_UNAVAILABLE');
    await unlink(join(this.path,'owner.json'));await rmdir(this.path);
  }
}
export function dataDirectory(defaultPath:string,value=process.env.PI_TICKET_DATA_DIR):string {
  if(value===undefined)return resolve(defaultPath);
  assert(value.trim().length>0&&isAbsolute(value),'PI_TICKET_DATA_DIR必须是非空绝对路径');return resolve(value);
}

/** One application state file. Schema validation and mutation semantics belong to the coordinator. */
export class Storage<T extends {schemaVersion:1}> {
  private state:T|null=null;
  private writing=false;
  private failed=false;
  private constructor(readonly root:string,private readonly lock:DirectoryLock,private readonly validate:(value:unknown)=>T) {}
  static async open<T extends {schemaVersion:1}>(directory:string,initial:T,validate:(value:unknown)=>T):Promise<Storage<T>> {
    await mkdir(directory,{recursive:true});const root=await realpath(directory);
    const entries=await readdir(root);
    assert(entries.length===0||entries.includes('state.json'),'目录不是可识别的项目数据目录，拒绝覆盖','STATE_UNAVAILABLE');
    const lock=await DirectoryLock.acquire(root);const storage=new Storage(root,lock,validate);
    try {
      if(entries.length===0) {
        const state=validate(structuredClone(initial));await atomicWrite(join(root,'state.json'),JSON.stringify(state));storage.state=state;
      } else {
        try {storage.state=validate(JSON.parse(await readFile(join(root,'state.json'),'utf8')));}catch{storage.failed=true;}
      }
      if(!storage.failed)for(const dir of ['datasets','templates','sessions','reports','.pending'])await mkdir(join(root,dir),{recursive:true});
      return storage;
    } catch(e) {await lock.release();throw e;}
  }
  get readonly():boolean {return this.failed;}
  read():T|null {return structuredClone(this.state);}
  async commit(next:T):Promise<void> {
    assert(!this.failed,'状态不可写，已进入只读恢复模式','STATE_UNAVAILABLE');
    assert(!this.writing,'另一个状态提交尚未完成','BUSY');
    const checked=this.validate(structuredClone(next));this.writing=true;
    try {await atomicWrite(join(this.root,'state.json'),JSON.stringify(checked));this.state=checked;}
    catch {this.failed=true;throw new AppFault('STATE_UNAVAILABLE','状态保存失败，已进入只读模式，未保存状态不能保证重启恢复');}
    finally{this.writing=false;}
  }
  async close():Promise<void> {assert(!this.writing,'状态提交中不能释放锁','BUSY');await this.lock.release();}
}
