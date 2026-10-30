/**
 * ==============================================================================
 * 🎯 报表汇总与原型链攻防引擎: report.ts
 * ==============================================================================
 * 💡 老王人话：
 * 这个文件负责产出最终的 Report 看板数据（总数、超时数、各团队单数、排好序的明细）。
 * 全代码仅 30 行，但藏着整个项目最炸裂的高级安全考点 —— 【JavaScript 原型链污染攻防】！
 * ==============================================================================
 */

import type { Ticket, Query, Policy, Report } from './types.ts';
import { searchTickets } from './search.ts';

/**
 * 💡 深度攻防考点：防御性计数器 (bump)
 *
 * ❓ 为什么不直接写 `byTeam[team] = (byTeam[team] || 0) + 1`？
 * - 痛点：JavaScript 的普通对象继承自 Object.prototype。
 *   如果黑客或恶意测试用例提交了一个团队名字叫做 `__proto__`、`constructor` 或 `toString`，
 *   传统的写法会直接篡改 JavaScript 运行时的内置原型属性，导致原型链污染（Prototype Pollution）！
 *
 * 🛡️ 工业级解法：
 * 1. 使用 `Object.hasOwn(byTeam, team)` 检查：只认对象“自己”身上的属性，坚决忽略原型链上的祖传属性；
 * 2. 使用 `Object.defineProperty` 显式定义属性：
 *    - 无论传入什么奇葩名字，都强制定义为该对象独有的、可枚举的自有属性（Own Property）；
 *    - 严禁触发任何原型上的 setter 拦截器，彻底封死对抗性注入漏洞！
 */
function bump(byTeam: Record<string, number>, team: string): void {
  // 只检查当前对象自身是否拥有该属性，避免从原型链上继承来污染
  const current = Object.hasOwn(byTeam, team) ? byTeam[team] : 0;

  Object.defineProperty(byTeam, team, {
    value: current + 1,
    writable: true,    // 允许修改
    enumerable: true,  // 允许被 Object.keys / JSON.stringify 正常遍历展示
    configurable: true,// 允许后续重定义
  });
}

/**
 * 💡 核心函数：构建工单汇总报表 (buildReport)
 *
 * @param tickets - 原始工单列表
 * @param query - 筛选过滤条件
 * @param now - 当前基准时间
 * @param policy - SLA 政策阈值
 * @returns 包含汇总数据和明细的完整报表对象 Report
 */
export function buildReport(tickets: Ticket[], query: Query, now: string, policy: Policy): Report {
  // 1. 调用 search.ts 完成过滤与确定性三重排序
  const rows = searchTickets(tickets, query, now, policy);

  // 2. 统计各团队分布与超时总数
  const byTeam: Record<string, number> = {};
  let overdue = 0;

  for (const row of rows) {
    // 累加超时违约工单数
    if (row.overdue) {
      overdue += 1;
    }
    // 安全地递增团队工单计数
    bump(byTeam, row.team);
  }

  // 3. 返回符合接口规范的 Report 报表
  return {
    total: rows.length, // 过滤后的工单总数
    overdue,            // 发生超时的工单数
    byTeam,             // 各团队工单数量字典，如 { "平台": 3, "前端": 2 }
    rows,               // 排好序的明细列表
  };
}
