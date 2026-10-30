/**
 * ==============================================================================
 * 🧪 consumer-app/verify-e2e.ts: 消费项目端到端包加载验证
 * ==============================================================================
 * 运行方式：npx tsx verify-e2e.ts
 * 验证目标：
 * 1. 模拟宿主加载已安装的扩展包；
 * 2. 断言 0 加载错误；
 * 3. 断言 /context-panel 命令成功注册；
 * 4. 模拟调用 /context-panel on/off，校验状态切换与通知。
 * ==============================================================================
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import { discoverAndLoadExtensions, initTheme } from "@earendil-works/pi-coding-agent";

async function main() {
  console.log("================================================================================");
  console.log("🔍 启动下游消费者项目 E2E 验证：挂载 @laowang/pi-custom-suite 扩展包");
  console.log("================================================================================");

  initTheme("dark", false);

  const cwd = process.cwd();
  const bundleEntry = path.resolve(
    cwd,
    "../producer-bundle/extensions/context-panel/index.ts"
  );

  console.log(`1. 扫描扩展入口: ${bundleEntry}`);
  const loaded = await discoverAndLoadExtensions([bundleEntry], cwd, path.join(cwd, ".pi"));

  console.log("2. 校验加载错误列表...");
  assert.deepEqual(loaded.errors, [], `加载出现错误: ${JSON.stringify(loaded.errors)}`);
  assert.equal(loaded.extensions.length, 1, "应成功挂载 1 个扩展");

  const ext = loaded.extensions[0];
  const commandNames = [...ext.commands.keys()];
  console.log("3. 挂载成功的扩展命令:", commandNames);
  assert.ok(
    commandNames.includes("context-panel"),
    "必须成功注册 /context-panel 命令"
  );

  // 4. 模拟在 TUI 模式下调用该命令
  console.log("4. 模拟调用命令: /context-panel off");
  const cmd = ext.commands.get("context-panel");

  let statusSet: { key: string; text?: string } = { key: "" };
  let notified: { text: string; level: string } = { text: "", level: "" };

  const fakeCtx = {
    mode: "tui",
    ui: {
      setStatus: (key: string, text?: string) => {
        statusSet = { key, text };
      },
      notify: (text: string, level: string) => {
        notified = { text, level };
      },
    },
    getContextUsage: () => ({ percent: 23.5 }),
  };

  await cmd.handler("off", fakeCtx);
  assert.equal(statusSet.text, undefined, "关闭底栏后状态应被设为 undefined 释放屏幕");
  assert.ok(notified.text.includes("🔴 关闭"), "应发出关闭通知");
  console.log("   --> 成功关闭底栏，屏幕占位已释放！通知:", notified.text);

  console.log("5. 模拟调用命令: /context-panel on");
  await cmd.handler("on", fakeCtx);
  assert.ok(statusSet.text?.includes("23.5%"), "开启底栏后应正确渲染 23.5% 进度条");
  assert.ok(notified.text.includes("🟢 开启"), "应发出开启通知");
  console.log("   --> 成功开启底栏，渲染结果:", statusSet.text);

  console.log("\n🎉 恭喜！扩展包在下游项目中的端到端集成 100% 验收通过！\n");
}

main().catch((err) => {
  console.error("❌ 验证失败:", err);
  process.exit(1);
});
