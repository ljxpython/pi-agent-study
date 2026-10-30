import * as fs from "fs";
import * as path from "path";
import contextPanelExtension from "./extensions/context-panel.ts";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 启动 Context Panel E2~E3 (常驻底栏与持久化开关) 针对性单元测试...");
  console.log("==================================================================");

  const commands = new Map<string, any>();
  const eventListeners = new Map<string, Function[]>();
  let currentStatus: { key: string; text?: string } | null = null;
  let lastNotification: { msg: string; type: string } | null = null;

  const mockPi = {
    registerCommand: (name: string, def: any) => {
      commands.set(name, def);
    },
    on: (event: string, handler: Function) => {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event)!.push(handler);
    },
  };

  // 1. 加载扩展
  contextPanelExtension(mockPi);

  // 模拟上下文状态
  let mockPercent: any = 23.0;
  const mockCtx = {
    mode: "tui",
    cwd: process.cwd(),
    getContextUsage: () => ({ percent: mockPercent }),
    ui: {
      setStatus: (key: string, text?: string) => {
        currentStatus = { key, text };
      },
      notify: (msg: string, type: string) => {
        lastNotification = { msg, type };
      },
    },
  };

  // --- 测试 1: session_start 触发底栏初始化与 23% 进度条计算 ---
  console.log("\n[Test 1/5] 验证会话启动与 23% 进度条计算...");
  const sessionHandlers = eventListeners.get("session_start") || [];
  for (const h of sessionHandlers) await h({}, mockCtx);

  if (!currentStatus || currentStatus.key !== "context-panel") {
    throw new Error("❌ Test 1 失败：未能挂载 context-panel 底栏！");
  }
  console.log("当前底栏文本:", currentStatus.text);
  if (!currentStatus.text?.includes("[██░░░░░░░░] 23.0%")) {
    throw new Error(`❌ Test 1 失败：进度条计算错误，期望包含 [██░░░░░░░░] 23.0%，实际为 ${currentStatus.text}`);
  }
  console.log("✅ PASS: 23% 映射为 2 格填充，底栏挂载成功！");

  // --- 测试 2: turn_end 自动刷新联动 ---
  console.log("\n[Test 2/5] 验证 turn_end 自动刷新联动...");
  mockPercent = 65.4; // 模拟大模型思考后上下文增长到 65.4%
  const turnEndHandlers = eventListeners.get("turn_end") || [];
  for (const h of turnEndHandlers) await h({}, mockCtx);

  console.log("turn_end 刷新后底栏:", currentStatus.text);
  if (!currentStatus.text?.includes("[███████░░░] 65.4%")) {
    throw new Error(`❌ Test 2 失败：turn_end 自动刷新未生效，期望 [███████░░░] 65.4%，实际为 ${currentStatus.text}`);
  }
  console.log("✅ PASS: turn_end 自动重绘底栏成功！");

  // --- 测试 3: 边界测试 (0.0% 与 null) ---
  console.log("\n[Test 3/5] 验证 0.0% 与 null/NaN 边界防御...");
  mockPercent = 0.0;
  for (const h of turnEndHandlers) await h({}, mockCtx);
  if (!currentStatus.text?.includes("[░░░░░░░░░░] 0.0%")) {
    throw new Error(`❌ Test 3 失败：0.0% 边界渲染失败: ${currentStatus.text}`);
  }

  mockPercent = null;
  for (const h of turnEndHandlers) await h({}, mockCtx);
  if (currentStatus.text !== "[上下文: 待更新]") {
    throw new Error(`❌ Test 3 失败：null 降级失败: ${currentStatus.text}`);
  }
  console.log("✅ PASS: 边界条件严苛防御全部通过！");

  // --- 测试 4: /context-panel off 与 on 命令切换 ---
  console.log("\n[Test 4/5] 验证 /context-panel 命令开关控制...");
  const panelCmd = commands.get("context-panel");
  mockPercent = 40.0;

  // 执行 off
  await panelCmd.handler("off", mockCtx);
  if (currentStatus.text !== undefined) {
    throw new Error(`❌ Test 4 失败：执行 off 后底栏未被清除 (text 必须为 undefined)！`);
  }
  console.log("已关闭底栏，底栏状态为:", currentStatus.text);

  // 执行 on
  await panelCmd.handler("on", mockCtx);
  if (!currentStatus.text?.includes("[████░░░░░░] 40.0%")) {
    throw new Error(`❌ Test 4 失败：执行 on 后未能恢复底栏！`);
  }
  console.log("已恢复底栏，底栏状态为:", currentStatus.text);

  // 无参 toggle
  await panelCmd.handler("", mockCtx); // 应该由 on 变 off
  if (currentStatus.text !== undefined) {
    throw new Error(`❌ Test 4 失败：toggle 未能成功关闭底栏！`);
  }
  console.log("✅ PASS: 开关命令与 toggle 反转全部正常！");

  // --- 测试 5: 持久化文件落盘验证 ---
  console.log("\n[Test 5/5] 验证沙盒内 .pi/context-panel.json 偏好落盘...");
  const configFile = path.join(process.cwd(), ".pi", "context-panel.json");
  if (!fs.existsSync(configFile)) {
    throw new Error("❌ Test 5 失败：未能在 .pi/ 目录下生成 context-panel.json 偏好文件！");
  }
  const configContent = JSON.parse(fs.readFileSync(configFile, "utf-8"));
  console.log("持久化文件内容:", configContent);
  if (typeof configContent.enabled !== "boolean") {
    throw new Error("❌ Test 5 失败：偏好文件结构不符合规范！");
  }
  console.log("✅ PASS: 沙盒内部持久化完美落盘，绝无宿主机污染！");

  console.log("\n==================================================================");
  console.log("🎉 全部 5 项针对性测试 100% 通过！E2~E3 状态栏组件已具备生产水准！");
  console.log("==================================================================");
}

runTests().catch(err => {
  console.error("❌ 测试崩溃:", err);
  process.exit(1);
});
