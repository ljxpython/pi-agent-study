import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { discoverAndLoadExtensions, initTheme } from '@earendil-works/pi-coding-agent';
initTheme('dark', false);
const temporary = await mkdtemp(join(tmpdir(), 'pi-bundle-load-'));
try {
 const loaded = await discoverAndLoadExtensions(['extensions/monitor/extensions/index.ts','extensions/activity/index.ts','extensions/messenger/index.ts'].map(n=>resolve(n)), temporary, temporary);
 assert.deepEqual(loaded.errors, []);
 assert.equal(loaded.extensions.length, 3);
 const commands = loaded.extensions.flatMap(e=>[...e.commands.keys()]);
 const tools = loaded.extensions.flatMap(e=>[...e.tools.keys()]);
 for(const name of ['monitor','activity','messenger']) assert.ok(commands.includes(name),name);
 assert.ok(tools.includes('pi_messenger'));
 assert.equal(new Set(commands).size,commands.length);
 assert.equal(new Set(tools).size,tools.length);
 console.log(JSON.stringify({scope:'registration-only',commands,tools,providerRequests:0}));
} finally { await rm(temporary,{recursive:true,force:true}); }
