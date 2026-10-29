import { readFileSync } from 'node:fs';
import { buildReport } from './report.ts';
const {tickets,policy,now} = JSON.parse(readFileSync(new URL('../sample.json', import.meta.url), 'utf8'));
console.log(JSON.stringify(buildReport(tickets, {status:'open'}, now, policy), null, 2));
