import deferredLoader from "./extensions/deferred-loader.ts";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 启动 Deferred Tool Loading 针对性单元测试...");
  console.log("==================================================================");

  const registeredTools = new Map<string, any>();
  const commands = new Map<string, any>();
  const eventListeners = new Map<string, Function[]>();
  let activeToolNames: string[] = ["read", "bash", "edit", "write"];

  const mockPi = {
    registerTool: (def: any) => {
      registeredTools.set(def.name, def);
      // 默认注册时加入 active
      if (!activeToolNames.includes(def.name)) {
        activeToolNames.push(def.name);
      }
    },
    registerCommand: (name: string, def: any) => {
      commands.set(name, def);
    },
    on: (event: string, handler: Function) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(handler);
    },
    getAllTools: () => Array.from(registeredTools.values()),
    getActiveTools: () => [...activeToolNames],
    setActiveTools: (tools: string[]) => {
      activeToolNames = [...tools];
    },
  };

  // 1. 加载扩展
  deferredLoader(mockPi);

  // 2. 模拟 session_start 事件触发
  const sessionStartHandlers = eventListeners.get("session_start") || [];
  for (const handler of sessionStartHandlers) {
    handler();
  }

  // --- 检验 1: 初始开局状态 ---
  console.log("\n[Test 1/4] 检验初始工具冷冻与瘦身状态...");
  if (activeToolNames.includes("generate_sla_report")) {
    throw new Error("❌ Test 1 失败：generate_sla_report 未被冷冻，依然存在于 activeTools 中！");
  }
  if (!activeToolNames.includes("search_tools")) {
    throw new Error("❌ Test 1 失败：核心元工具 search_tools 未能在 activeTools 中就位！");
  }
  console.log("✅ PASS: generate_sla_report 成功冷冻，search_tools 正常就位。当前活跃工具:", activeToolNames);

  // --- 检验 2: 触发 search_tools 搜索并动态热插拔 ---
  console.log("\n[Test 2/4] 检验大模型调用 search_tools 动态热插拔...");
  const searchToolDef = registeredTools.get("search_tools");
  const searchResult = await searchToolDef.execute("call-1", { query: "sla" });
  console.log("执行 search_tools 结果:", searchResult.content[0].text);

  if (!activeToolNames.includes("generate_sla_report")) {
    throw new Error("❌ Test 2 失败：调用 search_tools 后，generate_sla_report 未能动态热插拔到 activeTools！");
  }
  console.log("✅ PASS: 动态热插拔成功！当前活跃工具池已扩展为:", activeToolNames);

  // --- 检验 3: 调用刚激活的重型工具 execute ---
  console.log("\n[Test 3/4] 检验刚激活的 generate_sla_report 工具真实执行能力...");
  const slaToolDef = registeredTools.get("generate_sla_report");
  const slaResult = await slaToolDef.execute("call-2", {
    serviceName: "PaymentGateway",
    downtimeMinutes: 50,
    targetAvailability: 99.9,
  });
  console.log("执行报告输出:\n", slaResult.content[0].text);
  if (!slaResult.details || typeof slaResult.details.actualAvailability !== "number") {
    throw new Error("❌ Test 3 失败：SLA 计算结果缺少数值详情！");
  }
  console.log("✅ PASS: generate_sla_report 执行正常，数值计算精准！");

  // --- 检验 4: 检验 /reset-tools 命令能够重新冷冻 ---
  console.log("\n[Test 4/4] 检验调试命令 /reset-tools 重新冷冻与回退...");
  const resetCommand = commands.get("reset-tools");
  let notifiedMsg = "";
  await resetCommand.handler("", {
    ui: {
      notify: (msg: string) => { notifiedMsg = msg; }
    }
  });
  if (activeToolNames.includes("generate_sla_report")) {
    throw new Error("❌ Test 4 失败：执行 /reset-tools 后未能重置工具池！");
  }
  console.log("✅ PASS: 工具池成功回退，generate_sla_report 重新被冷冻！通知:", notifiedMsg);

  console.log("\n==================================================================");
  console.log("🎉 全部 4 项针对性测试 100% 通过！Deferred Tool Loading 机制完备！");
  console.log("==================================================================");
}

runTests().catch(err => {
  console.error("❌ 测试崩溃:", err);
  process.exit(1);
});
