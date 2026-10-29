from pathlib import Path
import json,re,hashlib,urllib.parse,sys
p=Path(sys.argv[1]).resolve();k=p/'package';errors=[];imports=0
for f in p.rglob('*'):
 if 'node_modules' in f.parts:continue
 if f.is_symlink():errors.append('symlink: '+str(f))
 if not f.is_file():continue
 if f.suffix in ['.ts','.mts','.js']:
  s=f.read_text()
  for target in re.findall(r'''(?:from\s*|import\s*\(|import\s+)["']([^"']+)["']''',s):
   if target.startswith('.'):
    imports+=1;t=(f.parent/target).resolve()
    if not t.is_relative_to(p) or not any(x.exists() for x in [t,Path(str(t)+'.ts'),t/'index.ts']):errors.append(f'{f.relative_to(p)} -> {target}')
   if target.startswith(('/Users/','/tmp/','/opt/')):errors.append('absolute import: '+target)
 if f.suffix=='.md':
  for target in re.findall(r'\]\(([^)]+)\)',f.read_text()):
   target=urllib.parse.unquote(target.split('#')[0].strip('<>'))
   if target and not re.match(r'^[a-zA-Z]+:',target):
    t=(f.parent/target).resolve()
    if not t.is_relative_to(p) or not t.exists():errors.append(f'{f.relative_to(p)} -> {target}')
m=json.loads((k/'package.json').read_text())
for field,paths in m['pi'].items():
 for path in paths:
  if not (k/path).resolve().is_relative_to(k) or not (k/path).exists():errors.append('manifest '+path)
for item in ['extensions/messenger/crew/agents/crew-worker.md','extensions/messenger/skills/pi-messenger-crew/SKILL.md','prompts/project-map.md']:
 if not (k/item).is_file():errors.append('missing '+item)
print(json.dumps({'root':str(p),'relative_imports_checked':imports,'errors':errors},ensure_ascii=False,indent=2));sys.exit(bool(errors))
