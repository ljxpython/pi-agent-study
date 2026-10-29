import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { SettingsManager, type ExtensionAPI, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { usageTotals } from './usage.ts';
import { readWeeklyQuota, type WeeklyQuota } from './quota.ts';
export const GREEN = [88, 201, 151] as const;
const CYAN = [89, 201, 218] as const;
export function quotaColor(percent: number): readonly number[] {
    const stops = [[80, ...GREEN], [90, 238, 196, 103], [100, 237, 116, 122]];
    const p = Math.max(80, Math.min(100, Number.isFinite(percent) ? percent : 80));
    const a = p <= 90 ? stops[0] : stops[1], b = p <= 90 ? stops[1] : stops[2], t = (p - a[0]) / (b[0] - a[0]);
    return a.slice(1).map((v, i) => Math.round(v + (b[i + 1] - v) * t));
}
const FG = '\x1b[38;2;225;232;240m';
const BG = '\x1b[48;2;16;20;25m';
const color = (s: string, rgb: readonly number[]) => `\x1b[38;2;${rgb.join(';')}m${s}${FG}`;
const muted = (s: string) => color(s, [143, 155, 169]);
const rule = (s: string) => color(s, [54, 66, 79]);
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
export function isCodexModel(model: {
    provider?: string;
    api?: string;
} | undefined): boolean { return model?.provider === 'openai-codex' || model?.api === 'openai-codex-responses'; }
const count = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? '未知' : Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${Number(n.toFixed(1))}%`;
function bar(n: number, size: number, rgb: readonly number[]) {
    const steps = Math.round(Math.max(0, Math.min(100, n)) / 100 * size * 8), whole = Math.floor(steps / 8), fraction = steps % 8;
    return color('█'.repeat(whole) + (fraction ? '\x1b[48;2;49;60;73m' + '▏▎▍▌▋▊▉'[fraction - 1] + BG : ''), rgb) + color('█'.repeat(Math.max(0, size - whole - (fraction ? 1 : 0))), [49, 60, 73]);
}
export interface MonitorData {
    model: string;
    provider?: string;
    api?: string;
    thinking: string;
    window: number | undefined;
    context: {
        tokens: number | null;
        percent: number | null;
    } | undefined;
    quota: WeeklyQuota;
    total: ReturnType<typeof usageTotals>;
    latest?: ReturnType<typeof usageTotals>;
    expanded: boolean;
    output?: number;
    compaction: {
        enabled: boolean;
        reserveTokens: number;
        keepRecentTokens: number;
    };
    compactionStatus: string;
    others?: string[];
}
export function monitorLines(width: number, d: MonitorData, maxRows = Infinity): string[] {
    const w = Math.max(1, width), pad = w >= 40 ? 2 : 0, inner = Math.max(1, w - pad * 2), lines: string[] = [];
    const add = (s: string) => { const line = truncateToWidth(s, inner).replace(/\x1b\[0m/g, '\x1b[0m' + BG + FG).replace(/\x1b\[49m/g, BG); lines.push(BG + FG + ' '.repeat(pad) + line + ' '.repeat(Math.max(0, w - pad - visibleWidth(line))) + '\x1b[0m'); };
    const divider = () => add(rule('─'.repeat(inner)));
    const columns = (cells: string[][], sizes: number[]) => { for (let row = 0; row < Math.max(...cells.map(c => c.length)); row++)
        add(cells.map((cell, i) => { const value = truncateToWidth(cell[row] ?? '', sizes[i]); return value + ' '.repeat(Math.max(0, sizes[i] - visibleWidth(value))); }).join(rule(' │ '))); };
    const group = (cells: string[][]) => { const n = cells.length, size = Math.floor((inner - 3 * (n - 1)) / n); columns(cells, cells.map((_, i) => size + (i === n - 1 ? (inner - 3 * (n - 1)) % n : 0))); };
    const quotaVisible = isCodexModel(d);
    const valid = d.context?.tokens != null && d.context?.percent != null && Number.isFinite(d.context.percent) && Number.isFinite(d.context.tokens);
    const contextLabel = valid ? '上下文 ' + bold(color(pct(d.context!.percent!), GREEN)) : '上下文 ' + muted(d.context ? '待更新' : '未知');
    const contextNumbers = valid ? `${count(d.context!.tokens!)} / ${count(d.window)}` : `窗口 ${count(d.window)}`;
    const quotaLabel = d.quota.usedPercent != null ? '周额度 已用 ' + bold(color(pct(d.quota.usedPercent), quotaColor(d.quota.usedPercent))) : '周额度 ' + muted(d.quota.reason ?? '未获取');
    const contextCell = (size: number) => { const heading = contextLabel + '  ' + muted(contextNumbers), meter = valid ? bar(d.context!.percent!, Math.min(28, size), GREEN) : color('█'.repeat(Math.min(28, size)), [49, 60, 73]); return visibleWidth(heading) <= size ? [heading, meter] : [contextLabel, muted(contextNumbers), meter]; };
    const quotaCell = (size: number) => [quotaLabel, d.quota.usedPercent != null ? bar(d.quota.usedPercent, Math.max(1, size - (d.quota.stale ? 9 : 0)), quotaColor(d.quota.usedPercent)) + (d.quota.stale ? muted(' · 旧数据') : '') : muted('等待有效记录')];
    const input = muted('输入 ') + bold(count(d.latest?.input)), output = muted('输出 ') + bold(count(d.latest?.output));
    const latestCell = (size: number) => visibleWidth(input + ' · ' + output) <= size ? [muted('最近回复'), input + ' · ' + output] : [muted('最近回复'), input, output];
    let latestInline = false;
    add('');
    if (inner >= 100) {
        const modelSize = Math.min(25, Math.max(14, visibleWidth(d.model))), thinkSize = 9, toggleSize = 8, quotaSize = quotaVisible ? 25 : 0;
        latestInline = !quotaVisible || inner >= 140;
        const latestSize = latestInline ? 24 : 0;
        const ctxSize = inner - modelSize - thinkSize - toggleSize - quotaSize - latestSize - (quotaVisible ? 12 : 9) - (latestInline ? 3 : 0);
        const cells = [[muted('模型'), bold(d.model)], [muted('思考'), bold(d.thinking)], contextCell(ctxSize)], sizes = [modelSize, thinkSize, ctxSize];
        if (latestInline) {
            cells.push(latestCell(latestSize));
            sizes.push(latestSize);
        }
        if (quotaVisible) {
            cells.push(quotaCell(quotaSize));
            sizes.push(quotaSize);
        }
        cells.push([d.expanded ? '▾ 收起' : '▸ 详情', muted('/monitor')]);
        sizes.push(toggleSize);
        columns(cells, sizes);
    }
    else {
        const identity = bold(d.model) + muted(' · 思考 ') + bold(d.thinking), toggle = d.expanded ? '▾ 收起' : '▸ 详情';
        const left = truncateToWidth(identity, Math.max(1, inner - visibleWidth(toggle) - 2));
        add(left + ' '.repeat(Math.max(1, inner - visibleWidth(left) - visibleWidth(toggle))) + toggle);
        add('');
        if (quotaVisible && inner >= 72) {
            const left = Math.floor((inner - 3) * .6);
            columns([contextCell(left), quotaCell(inner - left - 3)], [left, inner - left - 3]);
        }
        else {
            for (const row of contextCell(inner))
                add(row);
            if (quotaVisible) {
                add('');
                for (const row of quotaCell(inner))
                    add(row);
            }
        }
    }
    if (!latestInline) {
        const row = muted('最近回复') + '  ' + input + ' · ' + output;
        if (visibleWidth(row) <= inner)
            add(row);
        else {
            add(muted('最近回复'));
            add(input + ' · ' + output);
        }
    }
    if (d.expanded) {
        add('');
        divider();
        add('');
        const metric = (label: string, value: number | undefined, tint = false) => tint ? color(label + '  ' + count(value), CYAN) : muted(label) + '  ' + bold(count(value));
        const groups = [
            [bold(color('本次缓存', CYAN)), metric('读取', d.latest?.cacheRead, true), metric('写入', d.latest?.cacheWrite, true)],
            [bold('会话累计'), metric('输入', d.total.input), metric('输出', d.total.output)]
        ];
        if (inner >= 65)
            group(groups);
        else {
            for (const cell of groups)
                add(cell.join('  '));
        }
        add('');
        divider();
        const threshold = d.window ? 100 * (d.window - d.compaction.reserveTokens) / d.window : undefined;
        add('');
        add(muted(`自动压缩 ${d.compaction.enabled ? '开启' : '关闭'}${threshold === undefined ? '' : ` · ${pct(Math.max(0, threshold))}触发`} · ${d.compactionStatus}`));
    }
    add('');
    return lines.length > maxRows ? lines.filter(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim().length > 0) : lines;
}
export function registerMonitor(pi: ExtensionAPI) {
    let expanded = false, enabled = true, current: ExtensionContext | undefined, refresh: (() => void) | undefined, quota: WeeklyQuota = { reason: '未获取' }, compact = '待命';
    let pending = false, generation = 0, lastPoll = 0;
    let settings: MonitorData['compaction'] = { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 };
    const updateQuota = async () => { if (!isCodexModel(current?.model) || pending || Date.now() - lastPoll < 30000)
        return; pending = true; lastPoll = Date.now(); const gen = generation; try {
        const value = await readWeeklyQuota();
        if (gen === generation) {
            quota = value;
            refresh?.();
        }
    }
    finally {
        pending = false;
    } };
    function install(ctx: ExtensionContext) {
        current = ctx;
        if (ctx.mode !== 'tui')
            return;
        generation++;
        if (!enabled) {
            ctx.ui.setFooter(undefined);
            return;
        }
        settings = SettingsManager.create(ctx.cwd ?? process.cwd(), undefined, { projectTrusted: ctx.isProjectTrusted?.() ?? false }).getCompactionSettings();
        ctx.ui.setFooter((tui, _theme, footerData) => {
            const repaint = () => tui.requestRender();
            refresh = repaint;
            const unsubscribe = footerData.onBranchChange(repaint);
            const timer = setInterval(() => { void updateQuota(); repaint(); }, 5000);
            timer.unref();
            void updateQuota();
            return { invalidate() { }, dispose() { clearInterval(timer); unsubscribe(); if (refresh === repaint)
                    refresh = undefined; }, render(width: number) {
                    const c = current ?? ctx, entries = c.sessionManager.getEntries();
                    const last = [...entries].reverse().find(e => e.type === 'message' && e.message.role === 'assistant');
                    const latest = last?.type === 'message' && last.message.role === 'assistant' ? last.message.usage : undefined;
                    return monitorLines(width, { model: c.model?.id ?? '无模型', provider: c.model?.provider, api: c.model?.api, thinking: pi.getThinkingLevel(), window: c.model?.contextWindow, context: c.getContextUsage(), quota, total: usageTotals(entries), latest, expanded, output: c.model?.maxTokens, compaction: settings, compactionStatus: compact, others: [...footerData.getExtensionStatuses().values()] }, Math.max(4, tui.terminal.rows - 6));
                } };
        });
    }
    pi.on('session_start', async (_e, c) => { compact = '待命'; install(c); });
    const update = async (_e: unknown, c: ExtensionContext) => { current = c; refresh?.(); };
    pi.on('model_select', async (e, c) => { await update(e, c); lastPoll = 0; void updateQuota(); });
    pi.on('agent_start', update);
    pi.on('agent_end', update);
    pi.on('tool_execution_end', update);
    pi.on('session_info_changed', update);
    pi.on('session_tree', update);
    pi.on('session_before_compact', async (_e, c) => { current = c; compact = '进行中'; refresh?.(); });
    pi.on('session_compact', async (_e, c) => { current = c; compact = '已完成'; refresh?.(); });
    pi.on('session_compact_failed', async (e, c) => { current = c; compact = e.aborted ? '已取消' : '失败，可 /compact 重试'; refresh?.(); });
    pi.on('session_shutdown', async (_e, c) => { generation++; if (c.mode === 'tui')
        c.ui.setFooter(undefined); current = undefined; refresh = undefined; });
    pi.registerCommand('monitor', { description: '展开/收起监控栏；on/off 开关；refresh 刷新配置与额度', handler: async (args, c) => {
            const arg = args.trim();
            if (!['', 'on', 'off', 'refresh'].includes(arg)) {
                c.ui.notify('用法：/monitor [on|off|refresh]', 'warning');
                return;
            }
            if (arg === 'off' || arg === 'on') {
                enabled = arg === 'on';
                install(c);
            }
            else if (arg === 'refresh') {
                lastPoll = 0;
                install(c);
                await updateQuota();
            }
            else {
                expanded = !expanded;
                current = c;
                if (!enabled) {
                    enabled = true;
                    install(c);
                }
                refresh?.();
            }
        } });
    pi.registerShortcut('ctrl+shift+m', { description: '展开/收起监控栏', handler: async (c) => { expanded = !expanded; current = c; refresh?.(); } });
    return { setEnabled(value: boolean, c: ExtensionContext) { enabled = value; install(c); } };
}
