import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usageTotals } from '../src/usage.ts';
test('usage sums assistant/tool/summary entries, ignores user; empty session is zero', () => {
    const usage = { input: 2, output: 3, cacheRead: 4, cacheWrite: 5 };
    const entries: any = [{ type: 'message', message: { role: 'assistant', usage } }, { type: 'message', message: { role: 'toolResult', usage } }, { type: 'compaction', usage }, { type: 'branch_summary', usage }, { type: 'message', message: { role: 'user', usage } }];
    assert.deepEqual(usageTotals(entries), { input: 8, output: 12, cacheRead: 16, cacheWrite: 20 });
    assert.deepEqual(usageTotals([]), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});
