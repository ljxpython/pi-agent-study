import { truncateToWidth } from '@earendil-works/pi-tui';
export const colors = { muted: '\x1b[38;2;139;150;164m', active: '\x1b[38;2;83;202;219m', error: '\x1b[38;2;238;196;103m', reset: '\x1b[0m' };
// Strip terminal controls from untrusted tool metadata. Original content remains in Pi.
export function plain(value: unknown, limit = 100): string {
    return String(value ?? '').replace(/\x1b\][^\x07]*(?:\x07|$)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function action(name: string, args: any): string {
    const labels: Record<string, string> = { read: '读取文件', write: '写入文件', edit: '修改文件', grep: '搜索内容', find: '查找文件', ls: '查看目录' };
    if (name === 'bash') {
        const command = plain(args?.command, 200);
        if (/^(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check)\b|^pytest\b|^python\S*\s+-m\s+pytest\b/.test(command))
            return '运行测试';
        if (/^pwd(?:\s|$)/.test(command))
            return '定位项目 · pwd';
        const executable = command.match(/^[\w./-]+/)?.[0]?.split('/').pop();
        return executable ? `执行命令 · ${executable}` : '执行命令';
    }
    return labels[name] ?? `调用工具 · ${plain(name, 40)}`;
}
export interface Row {
    id: string;
    name: string;
    args: unknown;
    result?: {
        content?: any[];
        isError?: boolean;
    };
    partial: boolean;
    started: boolean;
}
export function failure(row: Row): string {
    const content = row.result?.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') ?? '';
    const first = content.split('\n').find(line => line.trim()) ?? '执行失败';
    return plain(first, 110);
}
export function cancelled(row: Row): boolean {
    return !!row.result?.isError && /(?:request was aborted|operation was aborted|已取消|用户取消)/i.test(failure(row));
}
export function line(text: string, width: number, color = colors.muted): string {
    return color + truncateToWidth(' ' + text, Math.max(1, width), '…') + colors.reset;
}
/** Returns per-tool rows; one anchor owns the summary, all others can be zero-height. */
export function groupLines(rows: Row[], running: boolean, width: number): Map<string, string[]> {
    const result = new Map(rows.map(row => [row.id, [] as string[]]));
    if (!rows.length)
        return result;
    const cancelledRows = rows.filter(cancelled);
    const failed = rows.filter(row => row.result?.isError && !cancelled(row));
    const complete = rows.filter(row => row.result && !row.partial && !row.result.isError);
    const unfinished = rows.filter(row => !row.result || row.partial);
    if (!running) {
        const parts = [`已完成 ${complete.length} 步`];
        if (failed.length)
            parts.push(`${failed.length} 项失败`);
        if (cancelledRows.length)
            parts.push(`${cancelledRows.length} 项已取消`);
        if (unfinished.length)
            parts.push(`${unfinished.length} 项未完成`);
        result.set(rows[0].id, ['', line(`▸ ${parts.join(' · ')} · Ctrl+O 查看详情`, width)]);
        for (const row of failed)
            result.get(row.id)!.push(line(`● ${action(row.name, row.args)}失败 · ${failure(row)}`, width, colors.error));
        return result;
    }
    // Keep failures visible even if newer calls have arrived; successful older rows collapse.
    const executing = rows.filter(row => row.started && (!row.result || row.partial));
    const settled = rows.filter(row => row.result && !row.partial);
    const selected = executing.slice(-3);
    const remaining = 3 - selected.length;
    if (remaining > 0)
        selected.push(...settled.slice(-remaining));
    if (!selected.length)
        selected.push(...rows.slice(0, 3));
    const visible = new Set([...selected, ...failed]);
    const hidden = rows.filter(row => !visible.has(row)).length;
    for (const row of rows) {
        const lines = result.get(row.id)!;
        if (row === rows[0]) {
            lines.push('');
            if (hidden)
                lines.push(line(`▸ 已收起 ${hidden} 步 · Ctrl+O 查看详情`, width));
        }
        if (!visible.has(row))
            continue;
        const label = action(row.name, row.args);
        if (row.result?.isError)
            lines.push(line(`● ${label}失败 · ${failure(row)}`, width, colors.error));
        else if (row.result && !row.partial)
            lines.push(line(`● 已完成 · ${label}`, width));
        else
            lines.push(line(`● ${row.started ? '正在' : '准备'}${label}…`, width, colors.active));
    }
    return result;
}
