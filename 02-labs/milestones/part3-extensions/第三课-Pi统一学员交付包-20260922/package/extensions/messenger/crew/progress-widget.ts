import type { LiveWorkerInfo } from "./live-progress.ts";
export function progressLines(workers: Iterable<LiveWorkerInfo>, now = Date.now()): string[] {
 return Array.from(workers).slice(0, 4).map(w => {
  const secs = Math.max(0, Math.floor((now-w.startedAt)/1000));
  const stage = w.progress.currentTool ? `执行 ${w.progress.currentTool}` : w.progress.toolCallCount ? "等待模型继续" : "等待模型首个动作";
  return `● 团队 ${w.taskId} · ${w.model ?? w.agent} · ${stage} · ${secs}s · 已完成 ${w.progress.toolCallCount} 次工具调用${now-(w.updatedAt ?? w.startedAt) >= 30000 ? " · 30秒以上无新增事件，可 Esc 取消" : ""}${w.progress.error ? " · 上次请求异常" : ""}`;
 });
}
