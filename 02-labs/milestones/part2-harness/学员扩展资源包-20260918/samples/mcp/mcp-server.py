import sys,json
from pathlib import Path
root=Path(__file__).resolve().parent
for line in sys.stdin:
 try:
  req=json.loads(line); method=req.get('method'); rid=req.get('id')
  if rid is None: continue
  if method=='initialize': result={'protocolVersion':'2024-11-05','capabilities':{'tools':{}},'serverInfo':{'name':'course-support-readonly','version':'1.0.0'}}
  elif method=='ping': result={}
  elif method=='tools/list': result={'tools':[{'name':'get_policy','description':'Read synthetic SLA thresholds and current reporting time','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},{'name':'list_tickets','description':'Read six synthetic support tickets. No write operations exist.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}}]}
  elif method=='tools/call':
   data=json.loads((root/'workspace/sample.json').read_text());name=req['params']['name']
   with (root/'evidence/mcp-calls.jsonl').open('a') as f:f.write(json.dumps({'method':method,'tool':name})+'\n')
   value=({'policy':data['policy'],'now':data['now']} if name=='get_policy' else {'tickets':data['tickets']} if name=='list_tickets' else {'error':'unknown tool'})
   result={'content':[{'type':'text','text':json.dumps(value,ensure_ascii=False)}],'isError':name not in ['get_policy','list_tickets']}
  else:
   print(json.dumps({'jsonrpc':'2.0','id':rid,'error':{'code':-32601,'message':'Method not found'}}),flush=True);continue
  print(json.dumps({'jsonrpc':'2.0','id':rid,'result':result},ensure_ascii=False),flush=True)
 except Exception as e:
  print(json.dumps({'jsonrpc':'2.0','id':None,'error':{'code':-32603,'message':type(e).__name__}}),flush=True)
