import fs from 'node:fs';
import path from 'node:path';
export default function(pi: any) {
 pi.registerCommand('course-check', {description:'检查第四章当前会话的工具注册和记忆目录（不调用模型）', handler:async (_args:any,ctx:any)=>{
  const names=pi.getAllTools().map((x:any)=>x.name).sort();
  const required=['read','write','edit','bash','todo','memory_read','memory_write','memory_status','web_search','fetch_content','lsp_diagnostics','subagent','support_get_policy','support_list_tickets'];
  const result={cwd:ctx.cwd,memoryDir:process.env.PI_MEMORY_DIR||null,model:ctx.model?`${ctx.model.provider}/${ctx.model.id}`:null,missing:required.filter(x=>!names.includes(x)),tools:names,activeTools:pi.getActiveTools(),note:'Registration check only. Run T2 to verify actual execution.'};
  fs.mkdirSync(path.join(ctx.cwd,'.course-evidence'),{recursive:true});fs.writeFileSync(path.join(ctx.cwd,'.course-evidence/registration.json'),JSON.stringify(result,null,2));
  ctx.ui.notify(JSON.stringify(result,null,2),result.missing.length?'warning':'info');
 }});
}
