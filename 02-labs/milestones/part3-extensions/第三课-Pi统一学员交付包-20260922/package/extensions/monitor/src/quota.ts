import { readdir, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
export interface WeeklyQuota {
    usedPercent?: number;
    observedAt?: number;
    resetAt?: number;
    stale?: boolean;
    reason?: string;
    source?: 'codex-records';
}
export function parseQuota(text: string, now = Date.now()): WeeklyQuota | undefined {
    let best: WeeklyQuota | undefined;
    for (const line of text.split('\n')) {
        try {
            const e = JSON.parse(line);
            if (e.type !== 'event_msg' || e.payload?.type !== 'token_count')
                continue;
            const r = e.payload.rate_limits;
            if (!r || r.limit_id !== 'codex')
                continue;
            const observedAt = Date.parse(e.timestamp);
            if (!Number.isFinite(observedAt) || observedAt > now + 60000)
                continue;
            for (const window of [r.primary, r.secondary]) {
                if (window?.window_minutes !== 10080 || typeof window.used_percent !== 'number' || !Number.isFinite(window.used_percent) || window.used_percent < 0 || window.used_percent > 100)
                    continue;
                const resetAt = typeof window.resets_at === 'number' ? window.resets_at * 1000 : NaN;
                if (!Number.isFinite(resetAt))
                    continue;
                const candidate: WeeklyQuota = resetAt <= now ? { reason: '记录窗口已过期', observedAt, resetAt, source: 'codex-records' } : { usedPercent: window.used_percent, observedAt, resetAt, stale: now - observedAt > 15 * 60 * 1000, source: 'codex-records' };
                if (!best || observedAt > best.observedAt!)
                    best = candidate;
            }
        }
        catch { /* partial lines and unrelated events are intentionally ignored */ }
    }
    return best;
}
// Bounded metadata/tail reads; never read auth, print user messages or retain raw logs.
const snapshots = new Map<string, WeeklyQuota>();
export async function readWeeklyQuota(root = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions'), now = Date.now()): Promise<WeeklyQuota> {
    try {
        const files: string[] = [];
        for (let day = 0; day < 3; day++) {
            const d = new Date(now - day * 86400000);
            const folder = join(root, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
            try {
                for (const name of await readdir(folder))
                    if (name.endsWith('.jsonl'))
                        files.push(join(folder, name));
            }
            catch { }
        }
        const ranked = await Promise.all(files.sort().reverse().slice(0, 200).map(async (path) => ({ path, mtime: (await stat(path)).mtimeMs })));
        ranked.sort((a, b) => b.mtime - a.mtime);
        let best = snapshots.get(root);
        if (best?.resetAt && best.resetAt <= now)
            best = { ...best, usedPercent: undefined, reason: '记录窗口已过期' };
        for (const { path } of ranked.slice(0, 8)) {
            const f = await open(path, 'r');
            try {
                const size = (await f.stat()).size, bytes = Math.min(size, 2097152), buf = Buffer.alloc(bytes);
                const { bytesRead } = await f.read(buf, 0, bytes, size - bytes);
                let text = buf.subarray(0, bytesRead).toString('utf8');
                if (size > bytes)
                    text = text.slice(text.indexOf('\n') + 1);
                const q = parseQuota(text, now);
                if (q && (!best || q.observedAt! > best.observedAt!))
                    best = q;
            }
            finally {
                await f.close();
            }
        }
        if (best) {
            best = { ...best, stale: now - best.observedAt! > 15 * 60 * 1000 };
            snapshots.set(root, best);
        }
        return best ?? { reason: '未获取' };
    }
    catch {
        return { reason: '读取不可用' };
    }
}
