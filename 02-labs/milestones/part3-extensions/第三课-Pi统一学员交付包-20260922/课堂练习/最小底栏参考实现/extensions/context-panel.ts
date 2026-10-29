/**
 * /context-panel 扩展入口（Pi 0.85.1）。
 *
 * 唯一职责：把宿主 TUI 的宽度工具接进纯逻辑核心。
 * 真实行为、接口依据与验证状态见 README；纯逻辑与阈值规则见 ./context-panel-core.ts。
 */
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { createContextPanelExtension } from "./context-panel-core.ts";

export default function (pi: ExtensionAPI): void {
  createContextPanelExtension(pi, { visibleWidth, truncateToWidth });
}
