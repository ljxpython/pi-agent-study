/**
 * ==============================================================================
 * 🎯 SLA 时效计算核心引擎: sla.ts
 * ==============================================================================
 * 💡 老王人话：
 * 这个文件负责回答两个最关键的问题：
 * 1. 这张工单已经等待了多久（几小时）？➔ ageHours()
 * 2. 这张工单有没有超时违规？➔ isOverdue()
 * 核心就 30 行代码，但藏着 3 个工业级生产避坑细节！
 * ==============================================================================
 */

import type { Ticket, Policy } from './types.ts';

// 💡 基础常识：1 小时 = 60 分 * 60 秒 * 1000 毫秒 = 3,600,000 毫秒
// 下划线 3_600_000 是数字分隔符语法，方便人眼阅读千分位，等价于 3600000
const MS_PER_HOUR = 3_600_000;

/**
 * 💡 防御性编程 1：解析 ISO 日期字符串为毫秒时间戳
 * 为什么要写这个辅助函数，而不是直接调用 Date.parse()？
 * - 踩坑点：如果传入非法日期字符串（如 "bad-date"），Date.parse() 会返回 NaN！
 * - 后果：在 JS 里 NaN 与任何数字比较大小都返回 false，会导致 bug 悄无声息地吞噬掉！
 * - 解法：通过 Number.isNaN() 严格检查，发现脏数据立刻抛出 RangeError 快速失败 (Fail-Fast)！
 */
function parseTime(value: string, label: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ${label} date: ${JSON.stringify(value)}`);
  }
  return ms;
}

/**
 * 💡 核心函数 1：计算工单相对于基准时间经过了多少小时 (ageHours)
 * @param ticket - 工单对象（包含 createdAt 字符串）
 * @param now - 当前基准时间（ISO 字符串，如 "2026-09-17T12:00:00Z"）
 * @returns 经过的小时数（浮点数）
 */
export function ageHours(ticket: Ticket, now: string): number {
  const nowMs = parseTime(now, 'now');
  const createdMs = parseTime(ticket.createdAt, 'createdAt');

  // 计算毫秒差值并转换为小时数
  const hours = (nowMs - createdMs) / MS_PER_HOUR;

  /**
   * 💡 防御性编程 2：未来时钟截断 (Future Clamp)
   * 踩坑点：如果上游分布式系统存在时钟漂移，或者用户误传了未来的时间（如 T06），
   * createdMs 会大于 nowMs，算出来的 hours 是负数（如 -24 小时）！
   * 解法：通过三元表达式 `hours > 0 ? hours : 0`，负数安全截断归零，杜绝负数时长污染！
   */
  return hours > 0 ? hours : 0;
}

/**
 * 💡 核心函数 2：判定工单是否超时逾期 (isOverdue)
 * @param ticket - 工单对象
 * @param now - 当前基准时间
 * @param policy - SLA 政策阈值（urgent 允许几小时，normal 允许几小时）
 * @returns true = 已超时违规; false = 未超时或已关闭
 */
export function isOverdue(ticket: Ticket, now: string, policy: Policy): boolean {
  const age = ageHours(ticket, now);

  /**
   * 💡 业务边界 1：已关闭工单绝不计算逾期 (Closed Never Overdue)
   * 无论已关闭的单子创建了多久，只要 status === 'closed'，它就不再属于积压队列，
   * 必须强制直接返回 false！
   */
  if (ticket.status === 'closed') {
    return false;
  }

  // 根据工单优先级，动态选用对应的 SLA 阈值
  const limit = ticket.priority === 'urgent' ? policy.urgentHours : policy.normalHours;

  /**
   * 💡 业务边界 2：严格大于阈值才算超时 (Strict Greater Than)
   * 注意是 `age > limit` 而不是 `>=`！
   * 如果等待时长恰好等于 4.0 小时，说明在最后一秒刚好到期，尚未发生违约（属于临界零余量）。
   */
  return age > limit;
}
