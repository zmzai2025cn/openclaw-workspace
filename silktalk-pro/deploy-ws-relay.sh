#!/bin/bash
#==============================================================================
# SilkTalk WebSocket Relay - 一键部署脚本
#==============================================================================

set -e

echo "=========================================="
echo "  SilkTalk WebSocket Relay"
echo "  一键部署"
echo "=========================================="

TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# 创建 relay-server.js
cat > relay-server.js << 'ENDOFFILE'
const WebSocket=require('ws'),http=require('http');
const PORT=process.env.PORT||8080,nodes=new Map();
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({status:'running',nodes:nodes.size,timestamp:new Date().toISOString()}));});
const wss=new WebSocket.Server({server});
console.log('========================================');
console.log('  SilkTalk Relay Server');
console.log('========================================');
wss.on('connection',(ws,req)=>{const nodeId=Math.random().toString(36).substring(2,10),ip=req.socket.remoteAddress;
console.log(\`[\${new Date().toISOString()}] Connected: \${nodeId} from \${ip}\`);
nodes.set(nodeId,{ws,ip,connectedAt:new Date(),lastPing:Date.now()});
ws.send(JSON.stringify({type:'welcome',nodeId,message:'Connected',nodes:Array.from(nodes.keys()).filter(id=>id!==nodeId),timestamp:Date.now()}));
broadcast({type:'node-joined',nodeId,totalNodes:nodes.size,timestamp:Date.now()},nodeId);
ws.on('message',(data)=>{try{const msg=JSON.parse(data);switch(msg.type){case'broadcast':broadcast({type:'message',from:nodeId,data:msg.data,timestamp:Date.now()},nodeId);break;case'direct':const target=nodes.get(msg.target);if(target&&target.ws.readyState===WebSocket.OPEN){target.ws.send(JSON.stringify({type:'direct',from:nodeId,data:msg.data,timestamp:Date.now()}));}break;case'ping':ws.send(JSON.stringify({type:'pong',timestamp:Date.now()}));nodes.get(nodeId).lastPing=Date.now();break;}}catch(e){}});
ws.on('close',()=>{console.log(\`[\${new Date().toISOString()}] Disconnected: \${nodeId}\`);nodes.delete(nodeId);broadcast({type:'node-left',nodeId,totalNodes:nodes.size,timestamp:Date.now()});});});
function broadcast(msg,exclude){const data=JSON.stringify(msg);nodes.forEach((node,id)=>{if(id!==exclude&&node.ws.readyState===WebSocket.OPEN)node.ws.send(data);});}
server.listen(PORT,()=>{console.log(\`Server running on port \${PORT}\`);console.log(\`WebSocket: ws://0.0.0.0:\${PORT}\`);});
ENDOFFILE

# 检查 Node.js
echo ""
echo "[1/3] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 安装 ws
echo ""
echo "[2/3] 安装依赖..."
if ! node -e "require('ws')" 2>/dev/null; then
    npm install ws --silent
fi
echo "✅ 依赖就绪"

# 启动
echo ""
echo "[3/3] 启动中继服务器..."
echo "=========================================="
echo ""
echo "中继服务器将启动在端口 8080"
echo "WebSocket: ws://0.0.0.0:8080"
echo ""
echo "按 Ctrl+C 停止"
echo ""
node relay-server.js
