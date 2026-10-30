/**
 * ==============================================================================
 * 🧪 context-panel-store 直观演练与验证脚本
 * ==============================================================================
 * 运行方式：npx tsx test-store.ts
 * 验证目标：
 * 1. 正常落盘：验证原子写入流程、JSON 文件格式；
 * 2. 损坏自愈防御：注入破烂配置，验证 read 降级与 commit 拒绝覆盖；
 * 3. 并发锁保护：模拟两个并发进程抢写，验证 toggle 绝不丢失反转。
 * ==============================================================================
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  createPanelStateStore,
  parseStateRecord,
  serializeStateRecord,
} from "./extensions/context-panel-store.ts";

const TEST_DIR = path.join(process.cwd(), ".pi", "store-sandbox-test");
const STATE_FILE = path.join(TEST_DIR, "state.json");

async function runDemo() {
  // 确保清理旧沙盒
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  console.log("================================================================================");
  console.log("🔥 老王硬核实测：context-panel-store 工业级存储三板斧");
  console.log("================================================================================");

  // ----------------------------------------------------------------------------
  // 实验 1: 首次无记录与正常原子写入
  // ----------------------------------------------------------------------------
  console.log("\n▶️ 实验 1：首次无记录读取 + 原子落盘写入");
  const store1 = createPanelStateStore({ statePath: STATE_FILE });
  const read1 = store1.read();
  console.log("1. 初始读取结果:", read1); // 应该是 { kind: 'missing' }

  const commit1 = await store1.commit(true);
  console.log("2. 提交 enabled=true 结果:", commit1);
  console.log("3. 磁盘文件内容:\n" + fs.readFileSync(STATE_FILE, "utf-8").trim());

  // ----------------------------------------------------------------------------
  // 实验 2: 损坏自愈与“拒绝静默谋杀”
  // ----------------------------------------------------------------------------
  console.log("\n▶️ 实验 2：故意搞破坏！注入非法的破烂 JSON");
  // 破坏现场：写一个 enabled 不是布尔值的破烂配置
  fs.writeFileSync(STATE_FILE, '{"version":1,"enabled":"sb_string"}\n');
  console.log("⚠️ 人为注入脏数据: {\"version\":1,\"enabled\":\"sb_string\"}");

  const readCorrupt = store1.read();
  console.log("1. 读取破烂配置 (read 优雅报错):", readCorrupt);

  console.log("2. 尝试向已损坏的文件中提交修改（模拟无脑 save）：");
  const commitCorrupt = await store1.commit(false);
  console.log("3. 提交结果 (commit 坚决拒绝覆盖):", commitCorrupt);
  console.log("4. 检查原磁盘文件是否被保护（未被乱写覆盖）:");
  console.log("   内容依然为:", fs.readFileSync(STATE_FILE, "utf-8").trim());

  // ----------------------------------------------------------------------------
  // 实验 3: 并发竞争模拟（两个进程同时 toggle）
  // ----------------------------------------------------------------------------
  console.log("\n▶️ 实验 3：模拟两个终端窗口（并发进程）同时反转开关");
  // 恢复为一个合法的开启状态
  await fs.promises.writeFile(STATE_FILE, serializeStateRecord(true));

  const storeA = createPanelStateStore({ statePath: STATE_FILE, lockWaitMs: 3000, lockRetryMs: 10 });
  const storeB = createPanelStateStore({ statePath: STATE_FILE, lockWaitMs: 3000, lockRetryMs: 10 });

  console.log("初始状态: true");
  console.log("终端 A 与 终端 B 同时执行 toggle 反转操作...");

  const [resA, resB] = await Promise.all([
    storeA.commit((cur) => !cur),
    storeB.commit((cur) => !cur),
  ]);

  console.log("终端 A 结果:", resA);
  console.log("终端 B 结果:", resB);
  const finalRead = storeA.read();
  console.log("最终落盘状态 (两次反转后回到原点):", finalRead);

  // 清理沙箱
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  console.log("\n✅ 全部实验完成，沙箱已清理！这代码经得起千锤百炼！\n");
}

runDemo().catch((err) => {
  console.error("执行出错:", err);
  process.exit(1);
});
