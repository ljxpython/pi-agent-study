import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerMonitor } from '../src/monitor.ts';
export default function (pi: ExtensionAPI) { registerMonitor(pi); }
