import { mkdir, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createAgentSession, SessionManager, type AgentSession } from '@earendil-works/pi-coding-agent';
import { AppFault, assert, TOOL_NAMES, type ToolName } from './contracts.js';
import type { ModelBinding } from './model.js';
import { Resources, RESOURCE_ROOT } from './resources.js';

/** SDK owns conversation context/history; the application owns files and actions. */
export async function openSession(resources:Resources, binding:ModelBinding, tools:ToolName[]=[], sessionFile?:string,memory=false):Promise<AgentSession> {
  assert(tools.every(t=>TOOL_NAMES.includes(t))&&new Set(tools).size===tools.length,'工具白名单无效');
  const dir=resolve(resources.dataRoot,'sessions');await mkdir(dir,{recursive:true});
  if(sessionFile) {
    let actual:string;try{actual=await realpath(sessionFile);}catch{throw new AppFault('RESOURCE_NOT_FOUND','会话文件不存在或无法读取');}
    const rel=relative(await realpath(dir),actual);
    assert(rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel),'会话路径不属于本项目','FORBIDDEN');
  }
  const manager=memory?SessionManager.inMemory(RESOURCE_ROOT):sessionFile?SessionManager.open(sessionFile,dir,RESOURCE_ROOT):SessionManager.create(RESOURCE_ROOT,dir);
  const result=await createAgentSession({cwd:RESOURCE_ROOT,agentDir:resolve(resources.dataRoot,'sdk-config'),
    modelRuntime:binding.runtime,model:binding.model,thinkingLevel:binding.thinkingLevel,noTools:'builtin',tools,
    resourceLoader:resources.loader,sessionManager:manager,settingsManager:resources.settings});
  const session=result.session;
  if(result.extensionsResult.errors.length || result.modelFallbackMessage ||
    session.getActiveToolNames().sort().join(',')!==[...tools].sort().join(',')) {
    session.dispose();throw new AppFault('RESOURCE_UNAVAILABLE','SDK会话或工具白名单初始化失败');
  }
  return session;
}

/** Explicit probe-only budget, shared by both scenarios; normal chat has no total-call quota. */
export class ProbeBudget {
  requests=0;
  tools=0;
  readonly deadline=Date.now()+120_000;
  attach(session:AgentSession):void {
    const original=session.agent.streamFunction;
    session.agent.streamFunction=(model,context,options)=>{
      assert(Date.now()<this.deadline && this.requests<3,'SDK探针请求预算耗尽','CANCELLED');
      this.requests++;
      return original(model,context,{...options,maxTokens:512});
    };
  }
  beforeTool():void {assert(Date.now()<this.deadline&&this.tools<1,'SDK探针工具预算耗尽','CANCELLED');this.tools++;}
  async run(session:AgentSession,text:string):Promise<void> {
    const remaining=Math.min(60_000,this.deadline-Date.now());
    assert(remaining>0,'SDK探针时间预算耗尽','CANCELLED');
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;void session.abort();},remaining);
    try {await session.prompt(text);assert(!timedOut,'SDK探针超时','CANCELLED');}
    finally {clearTimeout(timer);}
  }
}
