import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
import { InMemoryCredentialStore, InMemoryModelsStore, type Api, type Model, type Credential } from '@earendil-works/pi-ai';
import { AppFault, assert, exactKeys, record, revision, string } from './contracts.js';

export interface ModelPreferences {
  credentialMode: 'host'|'independent'; revision: number;
  provider: string; modelId: string; api: string|null; baseUrl: string|null;
}
export interface ModelConfigView extends ModelPreferences { configured: boolean }
interface Change extends Omit<ModelPreferences,'revision'> { expectedRevision:number; keyAction:'keep'|'replace'|'clear'; apiKey?:string }
export interface ModelBinding { runtime: ModelRuntime; model: Model<Api>; thinkingLevel:'off'|'low' }
const DEFAULT: ModelPreferences = {credentialMode:'host',revision:0,provider:'tongba',modelId:'glm-5.3',api:null,baseUrl:null};
const APIS = ['openai-completions','openai-responses','anthropic-messages'];
function validate(value:unknown):Change {
  exactKeys(value,['expectedRevision','credentialMode','provider','modelId','api','baseUrl','keyAction'],['apiKey']);
  revision(value.expectedRevision); string(value.provider,100); string(value.modelId,200);
  assert(value.credentialMode==='host'||value.credentialMode==='independent','模型模式无效');
  assert(['keep','replace','clear'].includes(value.keyAction as string),'密钥操作无效');
  assert(value.api===null || typeof value.api==='string','API类型无效');
  assert(value.baseUrl===null || typeof value.baseUrl==='string','模型地址无效');
  if(value.keyAction==='replace') string(value.apiKey,16000,'API Key');
  else assert(!Object.hasOwn(value,'apiKey'),'本操作不接受API Key');
  if(value.credentialMode==='host') assert(value.keyAction==='keep','本机认证只允许复用');
  else {
    assert(APIS.includes(value.api as string),'独立模式API类型不受支持'); string(value.baseUrl,2000);
    let url:URL; try {url=new URL(value.baseUrl);} catch {throw new AppFault('INVALID_INPUT','模型地址无效');}
    assert(url.protocol==='https:' || (url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)),'模型地址需要HTTPS或本机HTTP');
    assert(!url.username&&!url.password&&!url.search&&!url.hash,'模型地址不能包含凭据、查询参数或片段');
  }
  return value as unknown as Change;
}
/** Validate persisted preferences with the same rules as an explicit configuration change. */
export function validatePreferences(value:unknown):ModelPreferences {
  exactKeys(value,['credentialMode','revision','provider','modelId','api','baseUrl']);
  const {revision:version,...fields}=value;
  validate({...fields,expectedRevision:version,keyAction:'keep'});
  return value as unknown as ModelPreferences;
}
function detectEnvModel(): { prefs: Omit<ModelPreferences, 'revision'>; key: string } | undefined {
  const env = { ...process.env };
  // 兜底尝试从上层工程根目录读取 .env
  for (const envPath of [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../../.env'),
    resolve(homedir(), 'PyCharmMiscProject/ai-research/pi-agent-study/.env'),
  ]) {
    try {
      const content = readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
          if (!env[k]) env[k] = v;
        }
      }
      break;
    } catch {}
  }

  if (env.XIAOK_PROXY_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'xiaok',
        modelId: env.XIAOK_PROXY_DEFAULT_MODEL || 'deepseek-v4.1-flash',
        api: 'openai-completions',
        baseUrl: env.XIAOK_PROXY_URL || 'https://xiaok.lol/v1',
      },
      key: env.XIAOK_PROXY_API_KEY,
    };
  }
  if (env.PI_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'pi-env',
        modelId: env.PI_MODEL_ID || 'gpt-4o-mini',
        api: 'openai-completions',
        baseUrl: env.PI_BASE_URL || 'https://api.openai.com/v1',
      },
      key: env.PI_API_KEY,
    };
  }
  if (env.DEEPSEEK_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'deepseek',
        modelId: env.DEEPSEEK_MODEL_ID || 'deepseek-chat',
        api: 'openai-completions',
        baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      },
      key: env.DEEPSEEK_API_KEY,
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'openai',
        modelId: env.OPENAI_MODEL_ID || 'gpt-4o-mini',
        api: 'openai-completions',
        baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      },
      key: env.OPENAI_API_KEY,
    };
  }
  if (env.SILICONFLOW_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'siliconflow',
        modelId: env.SILICONFLOW_MODEL_ID || 'deepseek-ai/DeepSeek-V3',
        api: 'openai-completions',
        baseUrl: 'https://api.siliconflow.cn/v1',
      },
      key: env.SILICONFLOW_API_KEY,
    };
  }
  if (env.ZHIPU_API_KEY) {
    return {
      prefs: {
        credentialMode: 'independent',
        provider: 'zhipu',
        modelId: 'glm-4-flash',
        api: 'openai-completions',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      },
      key: env.ZHIPU_API_KEY,
    };
  }
  return undefined;
}

/** Owns only process-memory authentication. Persist preferences(), never this instance. */
export class Models {
  private prefs:ModelPreferences;
  private key:string|undefined;
  private binding:ModelBinding|undefined;
  private changing=false;
  constructor(preferences:ModelPreferences=DEFAULT, private readonly hostDir=join(homedir(),'.pi/agent'), private readonly busy:()=>boolean=()=>false) {
    this.prefs={...preferences};
  }
  preferences():ModelPreferences {return {...this.prefs};}
  view():ModelConfigView {return {...this.prefs,configured:!!this.binding};}
  require():ModelBinding {assert(this.binding,'模型尚未配置。请点击右上角【设置】填入 API Key，或在终端设置环境变量 (如 DEEPSEEK_API_KEY / OPENAI_API_KEY)','MODEL_NOT_CONFIGURED'); return this.binding;}
  async initialize():Promise<void> {
    this.binding=await this.resolve(this.prefs,undefined);
    if (!this.binding) {
      const envConfig = detectEnvModel();
      if (envConfig) {
        const prefs: ModelPreferences = { ...envConfig.prefs, revision: this.prefs.revision };
        const binding = await this.resolve(prefs, envConfig.key);
        if (binding) {
          this.prefs = prefs;
          this.key = envConfig.key;
          this.binding = binding;
        }
      }
    }
  }
  async update(input:unknown, persist:(preferences:ModelPreferences)=>Promise<void>=async()=>{}):Promise<ModelConfigView> {
    assert(!this.busy()&&!this.changing,'当前任务尚未结束','BUSY');
    const next=validate(input); assert(next.expectedRevision===this.prefs.revision,'模型配置已变化','REVISION_CONFLICT');
    this.changing=true;
    try {
      // A key belongs to one endpoint/provider. Changing either cannot carry it implicitly.
      const sameTarget=this.prefs.credentialMode==='independent' && next.provider===this.prefs.provider && next.baseUrl===this.prefs.baseUrl && next.api===this.prefs.api;
      const key=next.credentialMode==='host'||next.keyAction==='clear'?undefined:next.keyAction==='replace'?next.apiKey:sameTarget?this.key:undefined;
      const prefs:ModelPreferences={credentialMode:next.credentialMode,revision:this.prefs.revision+1,provider:next.provider,modelId:next.modelId,api:next.api,baseUrl:next.baseUrl};
      const binding=await this.resolve(prefs,key);
      await persist(prefs);
      this.prefs=prefs;this.key=key;this.binding=binding;
      return this.view();
    } finally {this.changing=false;}
  }
  private async resolve(prefs:ModelPreferences,key:string|undefined):Promise<ModelBinding|undefined> {
    if(prefs.credentialMode==='independent'&&!key) return undefined;
    const credentials=new InMemoryCredentialStore();
    if(prefs.credentialMode==='host') {
      try {
        const json:unknown=JSON.parse(await readFile(join(this.hostDir,'auth.json'),'utf8'));
        if(record(json)) {
          const c=json[prefs.provider];
          assert(c===undefined||record(c),'本机认证格式无效','MODEL_NOT_CONFIGURED');
          if(c && (c.type==='api_key'||c.type==='oauth')) await credentials.modify(prefs.provider,async()=>structuredClone(c) as unknown as Credential);
        }
      } catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
    }
    const runtime=await ModelRuntime.create({credentials,modelsPath:prefs.credentialMode==='host'?join(this.hostDir,'models.json'):null,modelsStore:new InMemoryModelsStore(),allowModelNetwork:false,refreshOnCreate:false});
    assert(!runtime.getError(),'模型配置加载失败','MODEL_NOT_CONFIGURED');
    let provider=prefs.provider;
    if(prefs.credentialMode==='independent') {
      // Never reuse a built-in/global provider identity or its ambient authentication.
      provider=`pi-ticket-independent-${randomUUID()}`;
      runtime.registerProvider(provider,{api:prefs.api as Api,baseUrl:prefs.baseUrl!,models:[{id:prefs.modelId,name:prefs.modelId,reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:128000,maxTokens:65536}]});
      await runtime.setRuntimeApiKey(provider,key!);
    }
    const model=runtime.getModel(provider,prefs.modelId);
    if(!model) return undefined;
    const auth=await runtime.checkAuth(provider);
    if(!auth) return undefined;
    // Project-local compatibility for the explicitly selected teaching preset.
    // GLM-5.3 always reasons; host metadata does not disable provider thinking.
    if(prefs.credentialMode==='host'&&provider==='tongba'&&model.id==='glm-5.3'&&model.api==='openai-completions'){
      return {runtime,model:{...model,reasoning:true,compat:{...model.compat,thinkingFormat:'zai',supportsReasoningEffort:true}},thinkingLevel:'low'};
    }
    return {runtime,model,thinkingLevel:'off'};
  }
}
