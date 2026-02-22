#!/bin/bash
#==============================================================================
# SilkTalk Mini - 真正的一键方案（alibot 只需运行这一个脚本）
#==============================================================================

set -e

echo "=========================================="
echo "  SilkTalk Mini - 一键部署"
echo "  节点: alibot"
echo "=========================================="

# 创建临时目录
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# 1. 创建 mini-silktalk.js（内嵌，无需下载）
cat > mini-silktalk.js << 'ENDOFFILE'
const http=require('http'),WebSocket=require('ws'),os=require('os');
const PORT=process.env.PORT||8080;
const NODE_ID="alibot-"+Math.random().toString(36).substring(2,8);
function getIP(){const i=os.networkInterfaces();for(const n in i)for(const f of i[n])if('IPv4'===f.family&&!f.internal)return f.address;return'127.0.0.1'}
function log(m){console.log(`[${new Date().toISOString()}] ${m}`);}
const server=http.createServer((q,r)=>{r.writeHead(200);r.end(`Node:${NODE_ID}\nConnect: ws://${getIP()}:${PORT}`);});
const wss=new WebSocket.Server({server});
const peers=new Map();
wss.on('connection',(ws,req)=>{const pid=Math.random().toString(36).substring(2,8);peers.set(pid,ws);log(`Peer:${pid} from ${req.socket.remoteAddress}`);
ws.on('message',(data)=>{try{const m=JSON.parse(data);log(`Recv:${m.type}`);if(m.type==='broadcast'){peers.forEach((p,oid)=>{if(oid!==pid&&p.readyState===WebSocket.OPEN)p.send(JSON.stringify({type:'relay',from:NODE_ID,data:m.data,t:Date.now()}));});}ws.send(JSON.stringify({type:'ack',from:NODE_ID,t:Date.now()}));}catch(e){}});
ws.on('close',()=>{peers.delete(pid);log(`Disconnect:${pid}`);});
ws.send(JSON.stringify({type:'welcome',from:NODE_ID,yourId:pid,peers:peers.size,t:Date.now()}));});
server.listen(PORT,()=>{console.log('========================================');console.log(`Node:${NODE_ID}`);console.log(`WebSocket: ws://${getIP()}:${PORT}`);console.log('========================================');console.log('Waiting for connections...');});
process.stdin.resume();
ENDOFFILE

# 2. 检查 Node.js
echo ""
echo "[1/3] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

# 3. 安装 ws（如果未安装）
echo ""
echo "[2/3] 准备依赖..."
if ! node -e "require('ws')" 2>/dev/null; then
    echo "安装 ws 模块..."
    npm install ws --silent
fi
echo "✅ 依赖就绪"

# 4. 启动
echo ""
echo "[3/3] 启动节点..."
echo ""
echo "=========================================="
node mini-silktalk.js
