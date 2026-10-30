/**
 * ==============================================================================
 * 🎯 数据契约层 (Data Contracts): types.ts
 * ==============================================================================
 * 💡 老王人话：
 * 在写 TypeScript 业务代码前，必须先定义“数据长什么样”。
 * 整个工单助手只涉及 6 个简单的数据结构，花 1 分钟看懂它们，后续代码一通百通！
 * ==============================================================================
 */

// 1. 优先级：只能是紧急 (urgent) 或 普通 (normal)
export type Priority = 'urgent' | 'normal';

// 2. 工单状态：只能是未解决开启中 (open) 或 已关闭 (closed)
export type Status = 'open' | 'closed';

// 3. 原始工单 (Ticket)：从数据库或 sample.json 读出来的原始单据
export interface Ticket {
  id: string;        // 工单编号，如 "T01"
  title: string;     // 工单标题，如 "登录 API 报错"
  team: string;      // 所属团队，如 "平台"、"前端"
  priority: Priority;// 优先级: urgent | normal
  status: Status;    // 状态: open | closed
  createdAt: string; // 创建时间 ISO 字符串，如 "2026-09-17T07:00:00Z"
}

// 4. 查询过滤条件 (Query)：支持按关键词、团队、状态进行组合筛选
export interface Query {
  keyword?: string;           // 搜索标题关键词（可选）
  team?: string;              // 过滤指定团队（可选）
  status?: Status | 'all';    // 过滤状态（默认 'all' 或只看 'open'）
  overdueOnly?: boolean;      // 是否只看超时工单（true 则剔除未超时的）
}

// 5. 公司 SLA 政策 (Policy)：规定不同优先级的最长允许处理时长
export interface Policy {
  urgentHours: number; // 紧急工单允许小时数（例如 4 小时）
  normalHours: number; // 普通工单允许小时数（例如 24 小时）
}

// 6. 计算后的数据行 (Row)：继承了 Ticket 的全部属性，并追加了由 SLA 引擎算出的 2 个字段
export interface Row extends Ticket {
  overdue: boolean; // 是否超时（true = 违规逾期）
  ageHours: number; // 从创建到当前基准时间已等待了多少个小时
}

// 7. 最终汇总报表 (Report)：供管理层看板展示的汇总数据
export interface Report {
  total: number;                 // 过滤后的总工单数
  overdue: number;               // 其中超时的工单数
  byTeam: Record<string, number>;// 按团队分组统计工单数，如 { "平台": 3, "前端": 2 }
  rows: Row[];                   // 排好序的详细工单列表
}
