import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildReport} from '../src/report.ts';
import type {Ticket} from '../src/types.ts';
const now='2026-09-17T12:00:00Z';const policy={urgentHours:4,normalHours:24};
for(const team of ['__proto__','constructor','toString'])test('team aggregation supports '+team,()=>{
 const tickets:Ticket[]=[{id:'A',title:'normal',team,priority:'normal',status:'open',createdAt:now}];
 const result=buildReport(tickets,{},now,policy);
 assert.equal(Object.hasOwn(result.byTeam,team),true);
 assert.equal(result.byTeam[team],1);
 assert.equal(JSON.parse(JSON.stringify(result.byTeam))[team],1);
});
