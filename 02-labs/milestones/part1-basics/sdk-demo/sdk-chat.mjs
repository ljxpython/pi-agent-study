import {
  createAgentSession, DefaultResourceLoader,
  ModelRuntime, SessionManager, getAgentDir,
} from "@earendil-works/pi-coding-agent";

// 读取现有 Pi 模型配置，不在代码里填写 Key。
if (!process.env.PI_DEMO_PROVIDER || !process.env.PI_DEMO_MODEL) {
  throw new Error("请先设置 PI_DEMO_PROVIDER 和 PI_DEMO_MODEL");
}
const modelRuntime = await ModelRuntime.create();
const model = modelRuntime.getModel(process.env.PI_DEMO_PROVIDER, process.env.PI_DEMO_MODEL);
if (!model) throw new Error("未找到模型，请核对 PI_DEMO_PROVIDER 和 PI_DEMO_MODEL");

// 本例只展示对话，不加载扩展、技能与提示模板。
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(), agentDir: getAgentDir(),
  noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true,
});
await resourceLoader.reload();
const { session } = await createAgentSession({
  modelRuntime, model, resourceLoader, tools: [],
  sessionManager: SessionManager.inMemory(),
});

const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  console.log(`模型：${session.model.provider}/${session.model.id}`);
  console.log("你：你好\nAgent：");
  await session.prompt("你好");
  const last = session.messages.filter(m => m.role === "assistant").at(-1);
  if (!last || ["error", "aborted"].includes(last.stopReason)) {
    throw new Error("本次请求没有正常完成，请检查模型连接或中断状态");
  }
  console.log();
} finally {
  unsubscribe();
  session.dispose();
}
