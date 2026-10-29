import { Check } from "typebox/value";

// Canonical tool shapes from backend-spec §7.2; tests check exact parity.
export const TOOL_CONTRACT = {
  "$defs": {
    "Id": {"type":"string","minLength":1,"maxLength":100},
    "Revision": {"type":"integer","minimum":0,"maximum":9007199254740991},
    "SourceRef": {"type":"object","properties":{"datasetId":{"type":"string","minLength":1,"maxLength":100},"version":{"type":"string","minLength":1,"maxLength":128}},"required":["datasetId","version"],"additionalProperties":false},
    "Ticket": {"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":100},"title":{"type":"string","minLength":1,"maxLength":500},"team":{"enum":["平台","前端"]},"priority":{"enum":["urgent","normal"]},"status":{"enum":["open","closed"]},"createdAt":{"type":"string","minLength":1,"maxLength":40}},"required":["id","title","team","priority","status","createdAt"],"additionalProperties":false},
    "AnalysisRef": {"type":"object","properties":{"analysisId":{"type":"string","minLength":1,"maxLength":100},"queryRequestId":{"type":"string","minLength":1,"maxLength":100},"sourceRef":{"$ref":"#/$defs/SourceRef"},"contextRevision":{"type":"integer","minimum":0,"maximum":9007199254740991}},"required":["analysisId","queryRequestId","sourceRef","contextRevision"],"additionalProperties":false},
    "RuleEvidence": {"type":"object","properties":{"messageId":{"type":"string","minLength":1,"maxLength":100},"quote":{"type":"string","minLength":1,"maxLength":4000}},"required":["messageId","quote"],"additionalProperties":false},
    "HourUpdate": {"type":"object","properties":{"value":{"type":"number","exclusiveMinimum":0,"maximum":2501999792.9836087},"evidence":{"$ref":"#/$defs/RuleEvidence"}},"required":["value","evidence"],"additionalProperties":false},
    "NowUpdate": {"anyOf":[{"type":"object","properties":{"mode":{"const":"received_at"},"evidence":{"$ref":"#/$defs/RuleEvidence"}},"required":["mode","evidence"],"additionalProperties":false},{"type":"object","properties":{"mode":{"const":"explicit_value"},"value":{"type":"string","minLength":1,"maxLength":40},"evidence":{"$ref":"#/$defs/RuleEvidence"}},"required":["mode","value","evidence"],"additionalProperties":false}]},
    "RuleUpdates": {"type":"object","properties":{"now":{"$ref":"#/$defs/NowUpdate"},"urgentHours":{"$ref":"#/$defs/HourUpdate"},"normalHours":{"$ref":"#/$defs/HourUpdate"}},"required":[],"additionalProperties":false,"minProperties":1},
    "EvaluationRow": {"type":"object","properties":{"ticketId":{"type":"string","minLength":1,"maxLength":100},"status":{"enum":["overdue","within_limit","future","not_applicable","not_evaluated"]},"ageMs":{"anyOf":[{"type":"number"},{"type":"null"}]},"thresholdHours":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]}},"required":["ticketId","status","ageMs","thresholdHours"],"additionalProperties":false},
    "Error": {"type":"object","properties":{"ok":{"const":false},"error":{"type":"object","properties":{"code":{"enum":["INVALID_INPUT","NO_DATASET_SELECTED","SOURCE_NOT_AUTHORIZED","STALE_ANALYSIS","RULE_CLARIFICATION_REQUIRED","RESULT_TOO_LARGE","CANCELLED","RESOURCE_UNAVAILABLE"]},"message":{"type":"string","minLength":1,"maxLength":500},"retryable":{"const":false}},"required":["code","message","retryable"],"additionalProperties":false}},"required":["ok","error"],"additionalProperties":false},
    "RuleOrigin": {"anyOf":[{"type":"object","properties":{"kind":{"const":"dataset"},"sourceRef":{"$ref":"#/$defs/SourceRef"}},"required":["kind","sourceRef"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"user_message"},"messageId":{"$ref":"#/$defs/Id"},"quote":{"type":"string","minLength":1,"maxLength":4000},"mode":{"enum":["explicit_value","received_at"]}},"required":["kind","messageId","quote","mode"],"additionalProperties":false},{"type":"null"}]},
    "Basis": {"type":"object","properties":{"now":{"anyOf":[{"type":"string","maxLength":40},{"type":"null"}]},"policy":{"type":"object","properties":{"urgentHours":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"normalHours":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]}},"required":["urgentHours","normalHours"],"additionalProperties":false},"origins":{"type":"object","properties":{"now":{"$ref":"#/$defs/RuleOrigin"},"urgentHours":{"$ref":"#/$defs/RuleOrigin"},"normalHours":{"$ref":"#/$defs/RuleOrigin"}},"required":["now","urgentHours","normalHours"],"additionalProperties":false}},"required":["now","policy","origins"],"additionalProperties":false}
  },
  "tools": {
    "query_tickets": {"input":{"type":"object","properties":{"team":{"enum":["平台","前端"]},"status":{"enum":["open","closed"]},"priority":{"enum":["urgent","normal"]}},"required":["team","status"],"additionalProperties":false},"success":{"type":"object","properties":{"ok":{"const":true},"analysis":{"$ref":"#/$defs/AnalysisRef"},"records":{"type":"array","items":{"$ref":"#/$defs/Ticket"},"maxItems":1000},"count":{"type":"integer","minimum":0,"maximum":1000},"statistics":{"type":"object","properties":{"urgent":{"type":"integer","minimum":0,"maximum":1000},"normal":{"type":"integer","minimum":0,"maximum":1000}},"required":["urgent","normal"],"additionalProperties":false}},"required":["ok","analysis","records","count","statistics"],"additionalProperties":false}},
    "evaluate_ticket_age": {"input":{"type":"object","properties":{"analysisId":{"type":"string","minLength":1,"maxLength":100},"expectedRevision":{"type":"integer","minimum":0,"maximum":9007199254740991},"updates":{"$ref":"#/$defs/RuleUpdates"}},"required":["analysisId","expectedRevision"],"additionalProperties":false},"success":{"type":"object","properties":{"ok":{"const":true},"analysis":{"$ref":"#/$defs/AnalysisRef"},"evaluation":{"enum":["evaluated","not_evaluated"]},"missingRules":{"type":"array","items":{"enum":["now","urgentHours","normalHours"]},"maxItems":3},"rows":{"type":"array","items":{"$ref":"#/$defs/EvaluationRow"},"maxItems":1000},"counts":{"type":"object","properties":{"overdue":{"type":"integer","minimum":0,"maximum":1000},"within_limit":{"type":"integer","minimum":0,"maximum":1000},"future":{"type":"integer","minimum":0,"maximum":1000},"not_applicable":{"type":"integer","minimum":0,"maximum":1000},"not_evaluated":{"type":"integer","minimum":0,"maximum":1000}},"required":["overdue","within_limit","future","not_applicable","not_evaluated"],"additionalProperties":false},"basis":{"$ref":"#/$defs/Basis"}},"required":["ok","analysis","evaluation","missingRules","rows","counts","basis"],"additionalProperties":false}},
    "prepare_report": {"input":{"type":"object","properties":{"analysisId":{"type":"string","minLength":1,"maxLength":100},"expectedRevision":{"type":"integer","minimum":0,"maximum":9007199254740991},"title":{"type":"string","minLength":1,"maxLength":120},"recommendations":{"type":"array","items":{"type":"string","minLength":1,"maxLength":500},"maxItems":12}},"required":["analysisId","expectedRevision","title","recommendations"],"additionalProperties":false},"success":{"type":"object","properties":{"ok":{"const":true},"proposalId":{"type":"string","minLength":1,"maxLength":100},"analysis":{"$ref":"#/$defs/AnalysisRef"},"markdown":{"type":"string","minLength":1,"maxLength":24000},"contentHash":{"type":"string","pattern":"^[a-f0-9]{64}$"},"status":{"const":"draft_proposal"}},"required":["ok","proposalId","analysis","markdown","contentHash","status"],"additionalProperties":false}}
  }
} as const;

export type Team = "平台" | "前端";
export type Priority = "urgent" | "normal";
export type TicketStatus = "open" | "closed";
export interface Ticket { id: string; title: string; team: Team; priority: Priority; status: TicketStatus; createdAt: string }
export interface Policy { urgentHours: number; normalHours: number }
export interface DatasetPayload { tickets: Ticket[]; now?: string; policy?: Policy }
export interface SourceRef { datasetId: string; version: string }
export interface AnalysisRef { analysisId: string; queryRequestId: string; sourceRef: SourceRef; contextRevision: number }
export interface Filters { team: Team; status: TicketStatus; priority?: Priority }
export interface RuleEvidence { messageId: string; quote: string }
export interface HourUpdate { value: number; evidence: RuleEvidence }
export type NowUpdate = { mode: "received_at"; evidence: RuleEvidence } | { mode: "explicit_value"; value: string; evidence: RuleEvidence };
export interface RuleUpdates { now?: NowUpdate; urgentHours?: HourUpdate; normalHours?: HourUpdate }
export interface ToolInputs {
  query_tickets: Filters;
  evaluate_ticket_age: { analysisId: string; expectedRevision: number; updates?: RuleUpdates };
  prepare_report: { analysisId: string; expectedRevision: number; title: string; recommendations: string[] };
}
export type ToolName = keyof ToolInputs;
export const TOOL_NAMES: ToolName[] = ["query_tickets", "evaluate_ticket_age", "prepare_report"];
export const ERROR_STATUS = {
  INVALID_INPUT: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, SOURCE_NOT_AUTHORIZED: 403, RESOURCE_READ_ONLY: 403,
  REQUEST_NOT_FOUND: 404, RESOURCE_NOT_FOUND: 404, BUSY: 409, REVISION_CONFLICT: 409, STALE_SERVER: 409,
  IDEMPOTENCY_CONFLICT: 409, STALE_ANALYSIS: 409, MODEL_NOT_CONFIGURED: 409, RESOURCE_CONFLICT: 409,
  ACTION_EXPIRED: 410, RULE_CLARIFICATION_REQUIRED: 422, NO_DATASET_SELECTED: 409, CANCELLED: 409,
  RESULT_TOO_LARGE: 413, CONTEXT_TOO_LARGE: 413, PAYLOAD_TOO_LARGE: 413,
  SAVE_FAILED: 500, STATE_UNAVAILABLE: 500, PROVIDER_ERROR: 502, RESOURCE_UNAVAILABLE: 503,
} as const;
export type AppErrorCode = keyof typeof ERROR_STATUS;
export interface AppError { code: AppErrorCode; message: string; retryable: boolean }
export class AppFault extends Error {
  constructor(public readonly code: AppErrorCode, message: string) { super(message); this.name = "AppFault"; }
  get status(): number { return ERROR_STATUS[this.code]; }
  toJSON(): AppError { return { code: this.code, message: this.message, retryable: false }; }
}
export function fault(error: unknown, fallback: AppErrorCode = "PROVIDER_ERROR"): AppError {
  return error instanceof AppFault ? error.toJSON() : { code: fallback, message: "操作失败，请检查配置或稍后手动重试。", retryable: false };
}
export function assert(condition: unknown, message: string, code: AppErrorCode = "INVALID_INPUT"): asserts condition {
  if (!condition) throw new AppFault(code, message);
}
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
  assert(record(value), "必须提供JSON对象");
  assert(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)), "字段缺失或包含未支持的字段");
}
export function string(value: unknown, max: number, label = "字段"): asserts value is string {
  assert(typeof value === "string" && value.trim().length > 0 && value.length <= max, `${label}为空或超过长度限制`);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return false;
  const [, y, mo, d, h, mi, sec, zone] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && Number(h) < 24 && Number(mi) < 60 && Number(sec) < 60 &&
    (zone === "Z" || (Number(zone.slice(1,3)) < 24 && Number(zone.slice(4,6)) < 60)) && Number.isFinite(Date.parse(value));
}
export function hours(value: unknown): asserts value is number {
  assert(typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER / 3_600_000, "时效阈值必须为可换算毫秒的有限正数");
}
export function revision(value: unknown): asserts value is number {
  assert(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "版本号无效");
}
export function validateDataset(value: unknown): DatasetPayload {
  exactKeys(value, ["tickets"], ["now", "policy"]);
  assert(Array.isArray(value.tickets) && value.tickets.length <= 1000, "工单必须为最多1000条的数组");
  assert(Buffer.byteLength(JSON.stringify(value), "utf8") <= 2 * 1024 * 1024, "资料超过2MiB", "PAYLOAD_TOO_LARGE");
  const ids = new Set<string>();
  const tickets = value.tickets.map((row: unknown): Ticket => {
    exactKeys(row, ["id", "title", "team", "priority", "status", "createdAt"]);
    string(row.id, 100, "工单ID"); string(row.title, 500, "标题");
    assert(!ids.has(row.id), "工单ID重复"); ids.add(row.id);
    assert(row.team === "平台" || row.team === "前端", "团队无效");
    assert(row.priority === "urgent" || row.priority === "normal", "优先级无效");
    assert(row.status === "open" || row.status === "closed", "工单状态无效");
    assert(validDate(row.createdAt), "创建时间必须为有效带时区ISO时间");
    return { id: row.id, title: row.title, team: row.team, priority: row.priority, status: row.status, createdAt: row.createdAt };
  });
  const result: DatasetPayload = { tickets };
  if (Object.hasOwn(value, "now")) { assert(validDate(value.now), "分析时间必须为有效带时区ISO时间"); result.now = value.now; }
  if (Object.hasOwn(value, "policy")) {
    exactKeys(value.policy, ["urgentHours", "normalHours"]); hours(value.policy.urgentHours); hours(value.policy.normalHours);
    result.policy = { urgentHours: value.policy.urgentHours, normalHours: value.policy.normalHours };
  }
  return result;
}
// JSON Schema counts Unicode code points; product string limits use JS UTF-16 length.
function checkStrings(value: unknown, schema: Record<string, unknown>): void {
  if (typeof schema.$ref === "string") { checkStrings(value, TOOL_CONTRACT.$defs[schema.$ref.split("/").at(-1)! as keyof typeof TOOL_CONTRACT.$defs]); return; }
  if (typeof value === "string") {
    assert(value.trim().length > 0 && (typeof schema.maxLength !== "number" || value.length <= schema.maxLength), "字符串为空或超过长度限制");
  }
  if (record(value) && record(schema.properties)) for (const [key, child] of Object.entries(schema.properties)) if (Object.hasOwn(value, key) && record(child)) checkStrings(value[key], child);
  if (Array.isArray(value) && record(schema.items)) for (const item of value) checkStrings(item, schema.items);
  if (Array.isArray(schema.anyOf)) {
    for (const branch of schema.anyOf) if (record(branch) && Check({ ...branch, $defs: TOOL_CONTRACT.$defs }, value)) { checkStrings(value, branch); break; }
  }
}
export function toolSchema(name: ToolName) { return { ...TOOL_CONTRACT.tools[name].input, $defs: TOOL_CONTRACT.$defs }; }
/** Model-facing input only: expand our finite local refs, retaining strict types. */
export function modelToolSchema(name:ToolName):Record<string,unknown> {
  const expand=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(expand);
    if(!record(value))return value;
    if(typeof value.$ref==='string'){
      const {$ref,...rest}=value;const key=$ref.replace(/^#\/\$defs\//,'');
      const definition=(TOOL_CONTRACT.$defs as Record<string,unknown>)[key];
      assert(record(definition),'工具Schema引用无效','RESOURCE_UNAVAILABLE');
      return expand({...definition,...rest});
    }
    return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,expand(child)]));
  };
  const schema=expand(TOOL_CONTRACT.tools[name].input);assert(record(schema),'工具Schema无效','RESOURCE_UNAVAILABLE');return schema;
}
export function validateTool<K extends ToolName>(name: K, input: unknown): ToolInputs[K] {
  const schema = toolSchema(name);
  assert(Check(schema, input), "工具参数不符合合同"); checkStrings(input, schema);
  if (name === "evaluate_ticket_age") {
    const updates = (input as ToolInputs["evaluate_ticket_age"]).updates;
    if (updates?.now?.mode === "explicit_value") assert(validDate(updates.now.value), "分析时间必须为有效带时区ISO时间");
  }
  return input as ToolInputs[K];
}
