/**
 * ==============================================================================
 * 🎯 工单过滤与确定性排序引擎: search.ts
 * ==============================================================================
 * 💡 老王人话：
 * 这个文件负责根据用户的搜索条件（关键词、团队、状态、是否仅看超时），
 * 把符合条件的工单找出来，并严格按照【三重排序法则】排好序交出来！
 * 代码 50 行，核心就是 1 个比较器函数 + 1 个过滤循环！
 * ==============================================================================
 */

import type { Ticket, Query, Policy, Row } from './types.ts';
import { ageHours, isOverdue } from './sla.ts';

/**
 * 💡 核心机制：确定性三重排序比较器 (compareRows)
 *
 * 语法扫盲：JS 的 Array.prototype.sort(comparator) 工作机制：
 * - 返回负数 (< 0)：a 排在 b 前面（a 优先）；
 * - 返回正数 (> 0)：b 排在 a 前面（b 优先）；
 * - 返回 0：两者位置不变。
 *
 * 🏆 项目长期沉淀的三重排序法则 (Tie-Breaker)：
 * 1. 优先级规则：紧急工单 (urgent) 必须绝对排在普通工单 (normal) 前面！
 * 2. 时间升序规则 (FIFO)：同一优先级下，早创建的工单排在前面（先到先服务）；
 * 3. 终极决胜规则 (ID Tie-Breaker)：如果同一秒创建，按工单 ID 字母升序排列！
 *    （防止前端多次刷新渲染时列表上下乱跳！）
 */
function compareRows(a: Row, b: Row): number {
  // 第 1 重判断：优先级不同时，urgent 优先排前面
  if (a.priority !== b.priority) {
    return a.priority === 'urgent' ? -1 : 1;
  }

  // 第 2 重判断：优先级相同，比对创建时间戳（升序，先创建的在前）
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (at !== bt) {
    return at - bt; // at 较小则为负数，a 排前面
  }

  // 第 3 重判断：连时间都完全一样，用 ID 字典序作为终极决胜法则 (Tie-Breaker)
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

/**
 * 💡 核心函数：根据查询条件组合筛选工单并排序
 *
 * @param tickets - 原始工单列表（纯函数原则：绝不修改输入原数组！）
 * @param query - 查询条件（keyword 关键词、team 团队、status 状态、overdueOnly 仅看超时）
 * @param now - 当前基准时间
 * @param policy - SLA 政策
 * @returns 排好序的计算后行数组 Row[]
 */
export function searchTickets(tickets: Ticket[], query: Query, now: string, policy: Policy): Row[] {
  // 1. 预处理关键词：去空格、转小写（实现大小写不敏感搜索）
  const keyword = query.keyword === undefined ? '' : query.keyword.trim().toLowerCase();
  const status = query.status === undefined ? 'all' : query.status;

  const rows: Row[] = [];

  // 2. 遍历工单，执行多条件的交集过滤 (AND 逻辑)
  for (const ticket of tickets) {
    // 过滤条件 ①：关键词匹配（标题包含关键词才放行）
    if (keyword !== '' && !ticket.title.toLowerCase().includes(keyword)) {
      continue;
    }

    // 过滤条件 ②：团队精确匹配
    if (query.team !== undefined && ticket.team !== query.team) {
      continue;
    }

    // 过滤条件 ③：状态匹配（若不是 'all'，则必须状态一致）
    if (status !== 'all' && ticket.status !== status) {
      continue;
    }

    // 调用 sla.ts 计算是否超时
    const overdue = isOverdue(ticket, now, policy);

    // 过滤条件 ④：如果勾选了“只看超时”，未超时的直接跳过
    if (query.overdueOnly && !overdue) {
      continue;
    }

    // 组装成新对象 Row，通过扩展运算符 {...ticket} 保证不篡改原始数据
    rows.push({
      ...ticket,
      overdue,
      ageHours: ageHours(ticket, now), // 附加计算出的已等待小时数
    });
  }

  // 3. 执行确定性三重排序并返回
  return rows.sort(compareRows);
}
