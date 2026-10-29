import {createMcpAdapter} from '../node_modules/pi-mcp-adapter/index.ts';
import {fileURLToPath} from 'node:url';
export default createMcpAdapter({config:{mcpServers:{support:{command:'python3',args:[fileURLToPath(new URL('../samples/mcp/mcp-server.py',import.meta.url))],directTools:true}},settings:{hostConfigDiscovery:'off'}}});
