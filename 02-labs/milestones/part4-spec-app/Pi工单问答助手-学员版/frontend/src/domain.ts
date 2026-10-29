export type Team = "平台" | "前端";
export type Priority = "urgent" | "normal";
export type TicketStatus = "open" | "closed";

export interface Ticket {
  id: string;
  title: string;
  team: Team;
  priority: Priority;
  status: TicketStatus;
  createdAt: string;
}

export interface Policy {
  urgentHours: number;
  normalHours: number;
}

export interface DatasetPayload {
  tickets: Ticket[];
  now?: string;
  policy?: Policy;
}

export type DatasetOrigin = "fixture" | "upload";

export interface Dataset extends DatasetPayload {
  id: string;
  name: string;
  version: string;
  count: number;
  origin: DatasetOrigin;
}

export type ValidationResult =
  | { ok: true; value: DatasetPayload; canonicalJson: string }
  | { ok: false; error: string };

export interface QueryFilters {
  team: Team;
  status: TicketStatus;
  priority?: Priority;
}

export interface QueryResult {
  records: Ticket[];
  count: number;
  filters: QueryFilters;
  statistics: { urgent: number; normal: number };
  sourceRef: { datasetId: string; name: string; version: string };
  requestId: string;
}

export type QueryParseResult =
  | { ok: true; filters: QueryFilters }
  | { ok: false; error: string };

export const MAX_TICKETS = 1000;
export const MAX_ID_LENGTH = 100;
export const MAX_TITLE_LENGTH = 500;
export const MAX_DATASET_NAME_LENGTH = 120;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const DATASET_KEYS = new Set(["tickets", "now", "policy"]);
const TICKET_KEYS = new Set(["id", "title", "team", "priority", "status", "createdAt"]);
const POLICY_KEYS = new Set(["urgentHours", "normalHours"]);
const TEAM_VALUES = new Set<Team>(["平台", "前端"]);
const PRIORITY_VALUES = new Set<Priority>(["urgent", "normal"]);
const STATUS_VALUES = new Set<TicketStatus>(["open", "closed"]);
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offset === "Z" ? 0 : Number(offset.slice(1, 3));
  const offsetMinute = offset === "Z" ? 0 : Number(offset.slice(4, 6));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    !Number.isNaN(Date.parse(value))
  );
}

function failure(error: string): ValidationResult {
  return { ok: false, error };
}

export function validateDatasetPayload(input: unknown): ValidationResult {
  if (!isRecord(input)) return failure("资料根节点必须是JSON对象");
  if (!hasOnlyKeys(input, DATASET_KEYS)) return failure("资料包含未支持的字段");
  if (!("tickets" in input)) return failure("资料必须包含tickets数组");
  if (!Array.isArray(input.tickets)) return failure("tickets必须是数组");
  if (input.tickets.length > MAX_TICKETS) return failure(`记录数不能超过${MAX_TICKETS}条`);

  const ids = new Set<string>();
  const normalizedTickets: Ticket[] = [];
  for (const [index, rawTicket] of input.tickets.entries()) {
    if (!isRecord(rawTicket)) return failure(`第${index + 1}条记录必须是对象`);
    if (!hasOnlyKeys(rawTicket, TICKET_KEYS)) return failure(`第${index + 1}条记录包含未支持的字段`);
    if (!isNonEmptyString(rawTicket.id, MAX_ID_LENGTH)) return failure(`第${index + 1}条记录的id无效`);
    if (!isNonEmptyString(rawTicket.title, MAX_TITLE_LENGTH)) return failure(`第${index + 1}条记录的title无效`);
    if (!TEAM_VALUES.has(rawTicket.team as Team)) return failure(`第${index + 1}条记录的team无效`);
    if (!PRIORITY_VALUES.has(rawTicket.priority as Priority)) return failure(`第${index + 1}条记录的priority无效`);
    if (!STATUS_VALUES.has(rawTicket.status as TicketStatus)) return failure(`第${index + 1}条记录的status无效`);
    if (!isValidIsoDate(rawTicket.createdAt)) return failure(`第${index + 1}条记录的createdAt无效`);
    if (ids.has(rawTicket.id)) return failure(`存在重复id：${rawTicket.id}`);
    ids.add(rawTicket.id);
    normalizedTickets.push({
      id: rawTicket.id,
      title: rawTicket.title,
      team: rawTicket.team as Team,
      priority: rawTicket.priority as Priority,
      status: rawTicket.status as TicketStatus,
      createdAt: rawTicket.createdAt,
    });
  }

  const normalized: DatasetPayload = { tickets: normalizedTickets };
  if ("now" in input) {
    if (!isValidIsoDate(input.now)) return failure("now必须是合法ISO日期");
    normalized.now = input.now;
  }
  if ("policy" in input) {
    if (!isRecord(input.policy) || !hasOnlyKeys(input.policy, POLICY_KEYS)) {
      return failure("policy字段无效");
    }
    if (
      typeof input.policy.urgentHours !== "number" ||
      !Number.isFinite(input.policy.urgentHours) ||
      input.policy.urgentHours <= 0 ||
      typeof input.policy.normalHours !== "number" ||
      !Number.isFinite(input.policy.normalHours) ||
      input.policy.normalHours <= 0
    ) {
      return failure("policy中的小时数必须是正数");
    }
    normalized.policy = {
      urgentHours: input.policy.urgentHours,
      normalHours: input.policy.normalHours,
    };
  }

  return { ok: true, value: normalized, canonicalJson: JSON.stringify(normalized) };
}

export async function datasetVersion(payload: DatasetPayload): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseQuery(question: string): QueryParseResult {
  const value = question.trim().toLowerCase();
  // Deliberately bounded demo grammar: never discard extra conditions.
  const match = /^(?:请)?(?:查询|查看)?\s*(平台|前端)(?:团队)?\s*(open|closed|未处理|待处理|开放|已关闭|已处理)\s*工单(?:\s*[，,]?\s*(?:只看)?\s*(urgent|normal|紧急|普通))?\s*[。！!？?]?$/i.exec(value);
  if (!match) {
    return { ok: false, error: "演示仅支持团队、状态和可选优先级，例如：查询平台团队open工单，只看urgent；暂不支持排除、日期或排序条件。" };
  }
  const [, team, status, priority] = match;
  return {
    ok: true,
    filters: {
      team: team as Team,
      status: /^(open|未处理|待处理|开放)$/.test(status) ? "open" : "closed",
      ...(priority ? { priority: /^(urgent|紧急)$/.test(priority) ? "urgent" as const : "normal" as const } : {}),
    },
  };
}

export function queryTickets(tickets: Ticket[], filters: QueryFilters): Ticket[] {
  return tickets
    .filter(
      (ticket) =>
        ticket.team === filters.team &&
        ticket.status === filters.status &&
        (!filters.priority || ticket.priority === filters.priority),
    )
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
    .map((ticket) => ({ ...ticket }));
}

export function makeQueryResult(
  dataset: Dataset,
  filters: QueryFilters,
  requestId: string,
): QueryResult {
  const records = queryTickets(dataset.tickets, filters);
  return {
    records,
    count: records.length,
    filters: { ...filters },
    statistics: {
      urgent: records.filter((ticket) => ticket.priority === "urgent").length,
      normal: records.filter((ticket) => ticket.priority === "normal").length,
    },
    sourceRef: { datasetId: dataset.id, name: dataset.name, version: dataset.version },
    requestId,
  };
}

export async function validateDatasetFile(file: File): Promise<ValidationResult> {
  if (file.size > MAX_UPLOAD_BYTES) return failure("文件大小不能超过2MiB");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return failure("文件必须是有效的UTF-8 JSON");
  }
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    return failure("文件不是有效JSON");
  }
  return validateDatasetPayload(input);
}
