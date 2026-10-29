import type { Ticket, Policy } from './types.ts';

const MS_PER_HOUR = 3_600_000;

/** Parse an ISO date string, throwing RangeError instead of producing NaN. */
function parseTime(value: string, label: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ${label} date: ${JSON.stringify(value)}`);
  }
  return ms;
}

/** Age in hours of a ticket relative to `now`; future timestamps clamp to 0. */
export function ageHours(ticket: Ticket, now: string): number {
  const nowMs = parseTime(now, 'now');
  const createdMs = parseTime(ticket.createdAt, 'createdAt');
  const hours = (nowMs - createdMs) / MS_PER_HOUR;
  return hours > 0 ? hours : 0;
}

/** A ticket is overdue only when strictly older than its policy threshold. */
export function isOverdue(ticket: Ticket, now: string, policy: Policy): boolean {
  const age = ageHours(ticket, now);
  if (ticket.status === 'closed') {
    return false;
  }
  const limit = ticket.priority === 'urgent' ? policy.urgentHours : policy.normalHours;
  return age > limit;
}
