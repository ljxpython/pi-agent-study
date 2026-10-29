/**
 * /context-panel 入口（Pi 0.85.1）。
 *
 * 本文件只做接线，不含业务规则：
 *   - 记录文件位置由宿主公开接口 `getAgentDir()` 决定（尊重 PI_CODING_AGENT_DIR，本课为默认全局环境）；
 *   - 宽度计算与截断用宿主 `@earendil-works/pi-tui` 的真实实现（中文 2 列、`█`/`░` 各 1 列）；
 *   - 其余全部在 ./context-panel-core.ts（纯逻辑）与 ./context-panel-store.ts（持久化）里。
 */
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

import { createContextPanelExtension } from "./context-panel-core.ts";
import { createPanelStateStore, resolveStatePath } from "./context-panel-store.ts";

export default function (pi: ExtensionAPI): void {
  const store = createPanelStateStore({ statePath: resolveStatePath(getAgentDir()) });
  createContextPanelExtension(pi, { measure: { visibleWidth, truncateToWidth }, store });
}
