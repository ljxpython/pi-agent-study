import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleWidth } from '@earendil-works/pi-tui';
import { monitorLines, quotaColor, GREEN, isCodexModel, type MonitorData } from '../src/monitor.ts';
import { parseQuota } from '../src/quota.ts';
const data: MonitorData = { model: 'gpt-5.3-codex', provider: 'openai-codex', thinking: 'off', window: 1000000, context: { tokens: 420000, percent: 42 }, quota: { usedPercent: 85 }, total: { input: 1240000, output: 86000, cacheRead: 120000, cacheWrite: 8000 }, expanded: false, output: 65536, compaction: { enabled: true, reserveTokens: 350000, keepRecentTokens: 40000 }, compactionStatus: '待命' };
const plain = (lines: string[]) => lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
test('collapsed contains core data, excludes detail; expanded preserves totals and compression status', () => { const a = plain(monitorLines(120, data)); for (const s of ['42%', '1,000,000', 'gpt-5.3-codex', '思考', '85%'])
    assert.ok(a.includes(s)); assert.doesNotMatch(a, /累计|压缩|缓存|65,536|剩余/); const b = plain(monitorLines(120, { ...data, expanded: true })); for (const s of ['本次缓存', '65%触发', '1,240,000'])
    assert.ok(b.includes(s)); assert.match(b, /最近回复/); assert.match(b, /输入\s+未知/); });
test('context remains green at every occupancy; quota continuously changes only after 80%', () => { for (const p of [0, 42, 65, 85, 95, 100, 125]) {
    const line = monitorLines(120, { ...data, context: { tokens: p * 10000, percent: p } }).join('');
    assert.ok(line.includes('\x1b[38;2;88;201;151m'));
} assert.deepEqual(quotaColor(0), GREEN); assert.deepEqual(quotaColor(80), GREEN); assert.notDeepEqual(quotaColor(85), quotaColor(95)); for (let p = 80; p < 100; p += .1) {
    const a = quotaColor(p), b = quotaColor(p + .1);
    assert.ok(a.every((n, i) => Math.abs(n - b[i]) <= 2));
} });
test('unknown/pending never zero, long Unicode and narrow terminals stay within width', () => { for (const width of [1, 20, 40, 60, 80, 120])
    for (const expanded of [false, true]) {
        const lines = monitorLines(width, { ...data, model: '长模型'.repeat(30), expanded, others: ['状态'.repeat(70)] });
        assert.ok(lines.every(l => visibleWidth(l) <= width));
    } for (const context of [undefined, { tokens: null, percent: null }, { tokens: NaN, percent: NaN }]) {
    const line = plain(monitorLines(80, { ...data, context }));
    assert.match(line, /未知|待更新/);
    assert.doesNotMatch(line, /上下文 0%/);
} assert.match(plain(monitorLines(80, { ...data, quota: { reason: '未获取' } })), /周额度 未获取/); });
const now = Date.now();
const event = (p: any, age = 0) => JSON.stringify({ type: 'event_msg', timestamp: new Date(now - age).toISOString(), payload: { type: 'token_count', rate_limits: { limit_id: 'codex', ...p } } });
test('weekly identifies window length not field position; rejects bad, expired, unrelated records', () => { const weekly = { window_minutes: 10080, used_percent: 86, resets_at: now / 1000 + 3600 }; for (const key of ['primary', 'secondary'])
    assert.equal(parseQuota(event({ [key]: weekly }), now)?.usedPercent, 86); assert.equal(parseQuota(event({ primary: { ...weekly, window_minutes: 300 } }), now), undefined); for (const used_percent of [-1, 101, '55', null])
    assert.equal(parseQuota(event({ secondary: { ...weekly, used_percent } }), now), undefined); assert.equal(parseQuota(event({ limit_id: 'other', secondary: weekly }), now), undefined); assert.equal(parseQuota(event({ secondary: { ...weekly, resets_at: now / 1000 - 1 } }), now)?.reason, '记录窗口已过期'); assert.equal(parseQuota(event({ secondary: weekly }, 1000000), now)?.stale, true); assert.equal(parseQuota('broken\n' + event({ secondary: weekly }) + '\n{"partial":', now)?.usedPercent, 86); });
test('reader keeps latest observed quota through log gaps, expires on reset and never invents zero', async () => {
    const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { readWeeklyQuota } = await import('../src/quota.ts');
    const root = await mkdtemp(join(tmpdir(), 'pi-monitor-quota-'));
    try {
        const d = new Date(now), folder = join(root, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
        await mkdir(folder, { recursive: true });
        const file = join(folder, 'fixture.jsonl');
        await writeFile(file, event({ limit_id: 'codex', secondary: { window_minutes: 10080, used_percent: 95, resets_at: now / 1000 + 3600 } }));
        assert.equal((await readWeeklyQuota(root, now)).usedPercent, 95);
        await writeFile(file, '{"unrelated":true}\n');
        assert.equal((await readWeeklyQuota(root, now + 1000)).usedPercent, 95);
        assert.equal((await readWeeklyQuota(root, now + 3601000)).usedPercent, undefined);
        assert.equal(parseQuota(event({ secondary: { window_minutes: 10080, used_percent: 50 } }), now), undefined);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test('stale versus expired wording, unknown model max and missing quota identity', () => { const s = plain(monitorLines(120, { ...data, expanded: true, output: 0, quota: { usedPercent: 90, stale: true, observedAt: now } })); assert.doesNotMatch(s, /单次输出上限|摘要上限|近期原文/); assert.match(s, /旧数据/); assert.doesNotMatch(s, /已过期/); assert.equal(parseQuota(event({ limit_id: null, secondary: { window_minutes: 10080, used_percent: 50, resets_at: now / 1000 + 1000 } }), now), undefined); });
test('quota only for Codex subscription route; changing provider removes all quota detail and no placeholder', () => { for (const expanded of [false, true]) {
    const yes = plain(monitorLines(120, { ...data, expanded }));
    assert.match(yes, /周额度/);
    for (const model of [{ provider: 'example-api', api: 'openai-completions', model: 'deepseek-v4.1-flash' }, { provider: 'openai', api: 'openai-responses', model: 'gpt-5.3-codex' }, { provider: undefined, model: 'unknown' }]) {
        const no = plain(monitorLines(120, { ...data, ...model, expanded, quota: { usedPercent: 95, observedAt: now, resetAt: now + 3600000 } }));
        assert.doesNotMatch(no, /周额度|Codex 本地记录|旧数据/);
        assert.ok(no.includes(model.model));
    }
} assert.equal(isCodexModel({ api: 'openai-codex-responses' }), true); });
test('reference dark surface fills every column even on light terminal; block bars retain small fractions', () => { for (const expanded of [false, true])
    for (const width of [40, 60, 80, 120, 160]) {
        const lines = monitorLines(width, { ...data, expanded, context: { tokens: 25455, percent: 2.5 } });
        assert.ok(lines.every(x => visibleWidth(x) === width));
        assert.ok(lines.every(x => x.startsWith('\x1b[48;2;16;20;25m') && x.endsWith('\x1b[0m')));
        assert.match(lines.join(''), /[█▏▎▍▌▋▊▉]/);
    } });
test('A layout removes parameter grid, repeated cache, addresses and explanation', () => { const text = plain(monitorLines(120, { ...data, expanded: true, others: ['pi-web-ui: 127.0.0.1:3002'] })); for (const heading of ['最近回复', '本次缓存', '会话累计', '自动压缩 开启 · 65%触发 · 待命'])
    assert.ok(text.includes(heading)); assert.doesNotMatch(text, /单次输出上限|摘要上限|近期原文|累计读缓存|累计写缓存|127\.0|当前上下文占用/); assert.ok(monitorLines(120, { ...data, expanded: true }).length <= 16); });
test('latest input/output visible collapsed and appears once expanded; context meter capped at 28 columns', () => { for (const provider of ['example-api', 'openai-codex'])
    for (const width of [60, 80, 120, 160])
        for (const expanded of [false, true]) {
            const d = { ...data, provider, expanded, latest: { input: 736, output: 143, cacheRead: 24576, cacheWrite: 0 }, context: { tokens: 1000000, percent: 100 } };
            const lines = monitorLines(width, d);
            const text = plain(lines);
            assert.ok(text.includes('736') && text.includes('143'));
            assert.equal((text.match(/最近回复/g) ?? []).length, 1);
            for (const m of lines.join('').matchAll(/\x1b\[38;2;88;201;151m(█+)/g))
                assert.ok(m[1].length <= 28);
        } });
