/**
 * ==============================================================================
 * 🎯 命令行执行入口 (CLI): cli.ts
 * ==============================================================================
 * 💡 老王人话：
 * 这个文件是整个 ticket-live 项目的“可执行开关”！
 * 当你在终端输入 `npm run demo` 时，底层跑的就是这个文件。
 * 它的逻辑简单到令人发指，总共就 4 句话：
 * 1. 读出 sample.json 假数据（包含工单列表、基准时间 now、SLA政策）；
 * 2. 把数据喂给 report.ts 的 buildReport 函数；
 * 3. 把算出来的 JSON 结果格式化打印到控制台屏幕上！
 * ==============================================================================
 */

import { readFileSync } from 'node:fs';
import { buildReport } from './report.ts';

// 1. 读取上级目录的 sample.json 数据文件
const samplePath = new URL('../sample.json', import.meta.url);
const rawJson = readFileSync(samplePath, 'utf8');
const { tickets, policy, now } = JSON.parse(rawJson);

// 2. 调用报表引擎：只查看 open（开启中）的未关闭工单
const report = buildReport(tickets, { status: 'open' }, now, policy);

// 3. 将结果美化打印到终端
console.log(JSON.stringify(report, null, 2));
