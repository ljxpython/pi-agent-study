import type { Ticket, Query, Policy, Row } from './types.ts';
import { ageHours, isOverdue } from './sla.ts';

/**
 * Long-term project convention:
 * 1. urgent before normal
 * 2. same priority: createdAt ascending
 * 3. same createdAt: id ascending
 */
function compareRows(a: Row, b: Row): number {
  if (a.priority !== b.priority) {
    return a.priority === 'urgent' ? -1 : 1;
  }
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (at !== bt) {
    return at - bt;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
}

/**
 * Filter tickets by keyword/team/status/overdueOnly (intersection) and return
 * new Row objects sorted per the project convention. Inputs are never mutated.
 */
export function searchTickets(tickets: Ticket[], query: Query, now: string, policy: Policy): Row[] {
  const keyword = query.keyword === undefined ? '' : query.keyword.trim().toLowerCase();
  const status = query.status === undefined ? 'all' : query.status;

  const rows: Row[] = [];
  for (const ticket of tickets) {
    if (keyword !== '' && !ticket.title.toLowerCase().includes(keyword)) {
      continue;
    }
    if (query.team !== undefined && ticket.team !== query.team) {
      continue;
    }
    if (status !== 'all' && ticket.status !== status) {
      continue;
    }
    const overdue = isOverdue(ticket, now, policy);
    if (query.overdueOnly && !overdue) {
      continue;
    }
    rows.push({ ...ticket, overdue, ageHours: ageHours(ticket, now) });
  }

  return rows.sort(compareRows);
}
