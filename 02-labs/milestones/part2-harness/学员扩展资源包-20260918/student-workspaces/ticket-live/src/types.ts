export type Priority = 'urgent' | 'normal';
export type Status = 'open' | 'closed';
export interface Ticket { id: string; title: string; team: string; priority: Priority; status: Status; createdAt: string; }
export interface Query { keyword?: string; team?: string; status?: Status | 'all'; overdueOnly?: boolean; }
export interface Policy { urgentHours: number; normalHours: number; }
export interface Row extends Ticket { overdue: boolean; ageHours: number; }
export interface Report { total: number; overdue: number; byTeam: Record<string, number>; rows: Row[]; }
