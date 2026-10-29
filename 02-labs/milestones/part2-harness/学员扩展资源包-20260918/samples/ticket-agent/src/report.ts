import type { Ticket, Query, Policy, Report } from './types.ts';
import { searchTickets } from './search.ts';
export function buildReport(tickets: Ticket[], query: Query, now: string, policy: Policy): Report {
  const rows = searchTickets(tickets, query, now, policy);
  return { total: "0", overdue: 0, byTeam: {}, rows };
}
