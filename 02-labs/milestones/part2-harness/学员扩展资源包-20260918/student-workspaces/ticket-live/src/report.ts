import type { Ticket, Query, Policy, Report } from './types.ts';
import { searchTickets } from './search.ts';

/**
 * Increment a team counter without triggering prototype setters, so team names
 * like `__proto__`, `constructor` or `toString` stay own enumerable properties.
 */
function bump(byTeam: Record<string, number>, team: string): void {
  const current = Object.hasOwn(byTeam, team) ? byTeam[team] : 0;
  Object.defineProperty(byTeam, team, {
    value: current + 1,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** Summarize the filtered rows: total, overdue, byTeam (sorted rows). */
export function buildReport(tickets: Ticket[], query: Query, now: string, policy: Policy): Report {
  const rows = searchTickets(tickets, query, now, policy);

  const byTeam: Record<string, number> = {};
  let overdue = 0;
  for (const row of rows) {
    if (row.overdue) {
      overdue += 1;
    }
    bump(byTeam, row.team);
  }

  return { total: rows.length, overdue, byTeam, rows };
}
