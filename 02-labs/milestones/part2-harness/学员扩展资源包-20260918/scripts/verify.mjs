import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lines=fs.readFileSync(path.join(root,'SHA256SUMS'),'utf8').trim().split('\n');
let count=0;for(const line of lines){const hash=line.slice(0,64),name=line.slice(66);const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('Invalid path');if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash)throw Error('Hash mismatch: '+name);count++;}
console.log('PASS: '+count+' distributed files match SHA256SUMS. No model calls.');
