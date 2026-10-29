import type { ExtensionFactory, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { TOOL_NAMES, AppFault } from '../../src/contracts.js';
/** Explicit project extension only. Business tool implementations are supplied by the host. */
export function ticketTools(tools: ToolDefinition[]): ExtensionFactory {
  const names = tools.map(tool => tool.name);
  if (new Set(names).size !== names.length || names.some(name => !TOOL_NAMES.includes(name as typeof TOOL_NAMES[number]))) {
    throw new AppFault('RESOURCE_CONFLICT', '业务工具白名单不匹配');
  }
  return pi => { for (const tool of tools) pi.registerTool(tool); };
}
