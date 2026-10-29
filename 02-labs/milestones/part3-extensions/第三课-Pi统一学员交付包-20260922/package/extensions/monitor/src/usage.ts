import type { SessionEntry } from '@earendil-works/pi-coding-agent';
export function usageTotals(entries: readonly SessionEntry[]) {
    const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    for (const e of entries) {
        const usage = e.type === 'message' && (e.message.role === 'assistant' || e.message.role === 'toolResult') ? e.message.usage : (e.type === 'compaction' || e.type === 'branch_summary') ? e.usage : undefined;
        if (usage)
            for (const key of Object.keys(total) as (keyof typeof total)[])
                total[key] += usage[key] ?? 0;
    }
    return total;
}
