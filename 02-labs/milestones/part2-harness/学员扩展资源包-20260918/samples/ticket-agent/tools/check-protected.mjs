import fs from 'node:fs';
import crypto from 'node:crypto';
const checks = JSON.parse(fs.readFileSync('.course-baseline.json', 'utf8'));
const changed = Object.entries(checks).filter(([p, hash]) => !fs.existsSync(p) || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') !== hash).map(([p]) => p);
if (changed.length) { console.error('FAIL protected files changed:', changed); process.exit(1); }
console.log(`PASS: ${Object.keys(checks).length} protected files unchanged (post-run audit, not an OS sandbox).`);
