export type ResourceKind = "template" | "skill" | "tool" | "extension" | "package";
export type ResourceStatus = "available" | "unavailable" | "design-example";
export type ResourceRelationType = "contains" | "source" | "provides" | "provided_by" | "declares_use";

export interface ResourceRelation {
  readonly type: ResourceRelationType;
  readonly targetId: string;
  readonly label: string;
}

export interface Resource {
  readonly id: string;
  readonly command?: string;
  readonly code?: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ResourceKind;
  readonly body: string;
  readonly version: string;
  readonly status: ResourceStatus;
  readonly source: string;
  readonly files?: readonly string[];
  readonly relations: readonly ResourceRelation[];
  readonly demoPrompt?: string;
  readonly currentBody?: string;
  readonly templateRevision?: number;
}

export const RESOURCE_KIND_LABELS: Readonly<Record<ResourceKind, string>> = {
  template: "提示词模板",
  skill: "Skills",
  tool: "Tools 工具",
  extension: "Extensions 扩展",
  package: "Packages 包",
};

const relation = (type: ResourceRelationType, targetId: string, label: string): ResourceRelation => ({ type, targetId, label });

// This is the complete bounded demo directory. It is intentionally static: no filesystem discovery,
// package installation, extension activation, or backend request is implied by an entry here.
export const DEMO_RESOURCES: readonly Resource[] = [
  {
    id: "template.query-tickets",
    command: "/query",
    name: "查询工单",
    kind: "template",
    description: "根据资料查找、筛选和统计工单",
    body: "请查询当前资料中平台团队的 open 工单。\n列出匹配记录、数量和资料来源；缺少资料时请先说明。\n不要忽略用户提出的额外筛选条件。",
    demoPrompt: "查询平台团队open工单",
    version: "demo-1.0.0",
    status: "available",
    source: "项目演示目录",
    relations: [relation("source", "package.ticket-assistant", "所属包")],
  },
  {
    id: "template.handoff-report",
    command: "/report",
    name: "整理交接报告",
    kind: "template",
    description: "将当前分析整理为有依据的交接报告",
    body: "请根据当前工单分析生成交接报告。\n包含：分析范围、优先事项、异常记录、处理建议。\n引用工单编号与资料来源，不编造缺失信息。",
    demoPrompt: "请整理处理建议",
    version: "demo-1.0.0",
    status: "available",
    source: "项目演示目录",
    relations: [relation("source", "package.report-handoff", "所属包")],
  },
  {
    id: "skill.ticket-triage",
    command: "/skill:ticket-triage",
    name: "工单分诊",
    kind: "skill",
    description: "识别优先处理工单，检查时间异常，整理交接建议",
    body: "1. 读取当前选择的工单资料。\n2. 按明确的 now 与 policy 检查时效与异常；缺少规则时先询问。\n3. 输出有来源的结论与建议，不编造工单事实。",
    files: ["SKILL.md · 使用说明", "references/triage-rules.md · 示例规则"],
    version: "demo-1.0.0",
    status: "available",
    source: "项目演示目录",
    relations: [
      relation("source", "package.ticket-assistant", "所属包"),
      relation("declares_use", "tool.query-tickets", "声明使用"),
      relation("declares_use", "tool.evaluate-ticket-age", "声明使用"),
    ],
  },
  {
    id: "tool.query-tickets",
    code: "query_tickets",
    name: "查询工单",
    kind: "tool",
    description: "按团队、状态和优先级查询工单记录",
    body: "只读业务工具。接入后由后端校验资料来源与查询条件。",
    version: "demo-1.0.0",
    status: "design-example",
    source: "设计示例扩展：工单处理扩展",
    relations: [relation("provided_by", "extension.ticket-workflow", "由扩展提供")],
  },
  {
    id: "tool.evaluate-ticket-age",
    code: "evaluate_ticket_age",
    name: "检查时效",
    kind: "tool",
    description: "按资料中的 now 与 policy 检查工单时效",
    body: "只读业务工具。对话可补充 now 与 policy；接入后由后端校验时间规则与资料版本。",
    version: "demo-1.0.0",
    status: "design-example",
    source: "设计示例扩展：工单处理扩展",
    relations: [relation("provided_by", "extension.ticket-workflow", "由扩展提供")],
  },
  {
    id: "extension.ticket-workflow",
    name: "工单处理扩展",
    kind: "extension",
    description: "设计示例：注册工单查询与时效检查入口",
    body: "用于说明扩展与业务工具的边界。当前只展示登记关系，未加载、未启用。",
    version: "0.1.0-example",
    status: "design-example",
    source: "设计示例包",
    relations: [
      relation("source", "package.ticket-assistant", "来源包"),
      relation("provides", "tool.query-tickets", "提供工具"),
      relation("provides", "tool.evaluate-ticket-age", "提供工具"),
    ],
  },
  {
    id: "extension.report-handoff",
    name: "报告交接扩展",
    kind: "extension",
    description: "设计示例：连接报告整理与人工确认流程",
    body: "用于说明报告交接扩展的登记位置。当前未加载、未启用，也没有可执行按钮。",
    version: "0.1.0-example",
    status: "design-example",
    source: "设计示例包",
    relations: [relation("source", "package.report-handoff", "来源包")],
  },
  {
    id: "extension.ui-events",
    name: "界面事件扩展",
    kind: "extension",
    description: "设计示例：记录确认与状态变化事件",
    body: "用于展示空工具关系和失效关联的处理方式。当前未加载、未启用。",
    version: "0.1.0-example",
    status: "design-example",
    source: "设计示例包",
    relations: [
      relation("source", "package.ui-examples", "来源包"),
      relation("provides", "tool.future-notification", "提供工具（未登记）"),
    ],
  },
  {
    id: "package.ticket-assistant",
    name: "工单教学资源包",
    kind: "package",
    description: "设计示例：工单查询、分诊与处理流程的目录组合",
    body: "设计示例，未接入。包成员是受控目录关系，不表示本机已安装或正在加载。",
    version: "0.1.0-example",
    status: "design-example",
    source: "项目能力库",
    relations: [
      relation("contains", "template.query-tickets", "提示词模板"),
      relation("contains", "skill.ticket-triage", "Skill"),
      relation("contains", "extension.ticket-workflow", "Extension"),
    ],
  },
  {
    id: "package.report-handoff",
    name: "报告交接示例包",
    kind: "package",
    description: "设计示例：交接报告模板与确认扩展",
    body: "设计示例，未接入。这里只展示资源组成，不提供安装、更新或启停操作。",
    version: "0.1.0-example",
    status: "design-example",
    source: "项目能力库",
    relations: [
      relation("contains", "template.handoff-report", "提示词模板"),
      relation("contains", "extension.report-handoff", "Extension"),
    ],
  },
  {
    id: "package.ui-examples",
    name: "界面事件设计包",
    kind: "package",
    description: "设计示例：用于说明界面事件扩展的包来源",
    body: "设计示例，未接入。成员数量按当前静态目录关系计算。",
    version: "0.1.0-example",
    status: "design-example",
    source: "项目能力库",
    relations: [relation("contains", "extension.ui-events", "Extension")],
  },
  {
    id: "package.empty-example",
    name: "空资源示例包",
    kind: "package",
    description: "设计示例：当前没有登记成员",
    body: "设计示例，未接入。空包用于展示真实的零成员状态。",
    version: "0.1.0-example",
    status: "design-example",
    source: "项目能力库",
    relations: [],
  },
];

export function resourcesOfKind(kind: ResourceKind, catalog: readonly Resource[] = RESOURCES): Resource[] {
  return catalog.filter((resource) => resource.kind === kind);
}

export function findResource(id: string, catalog: readonly Resource[] = RESOURCES): Resource | undefined {
  return catalog.find((resource) => resource.id === id);
}

export function resolveResourceRelation(
  resourceRelation: ResourceRelation,
  catalog: readonly Resource[] = RESOURCES,
): Resource | undefined {
  return findResource(resourceRelation.targetId, catalog);
}

/** The command picker is derived from the catalog; non-command resources never enter it. */
export function conversationResources(catalog: readonly Resource[] = RESOURCES): Resource[] {
  return catalog.filter((resource) =>
    (resource.kind === "template" || resource.kind === "skill") && Boolean(resource.command),
  );
}

/** Local substring search, not semantic/fuzzy search. Stable catalog order breaks ties. */
export function matchResources(input: string, catalog: readonly Resource[] = RESOURCES): Resource[] {
  if (!input.startsWith("/")) return [];
  const query = input.slice(1).trim().toLowerCase();
  return conversationResources(catalog).map((resource, index) => {
    const command = resource.command!.slice(1).toLowerCase();
    const rank = !query || command === query ? 0
      : command.startsWith(query) ? 1 : command.includes(query) ? 2
      : resource.name.toLowerCase().includes(query) ? 3
      : resource.description.toLowerCase().includes(query) ? 4 : 5;
    return { resource, rank, index };
  }).filter((x) => x.rank < 5).sort((a, b) => a.rank - b.rank || a.index - b.index).map((x) => x.resource);
}

export function validateTemplate(body: string): string | null {
  if (!body.trim()) return "模板正文不能为空。";
  if (body.length > 24000) return "模板正文不能超过24000字符。";
  return null;
}

// Runtime catalog is supplied exclusively by the backend; demo fixtures are test-only.
export let RESOURCES: readonly Resource[] = [];
export function setResources(resources: readonly Resource[]): void { RESOURCES = resources; }
