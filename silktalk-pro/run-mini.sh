#!/bin/bash
#==============================================================================
# SilkTalk Mini - 一键安装运行脚本
#==============================================================================

set -e

echo "========================================"
echo "SilkTalk Mini - Layer 1 极简验证版"
echo "========================================"

# 检查 Node.js
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Node.js 未安装"
    echo "请安装 Node.js 18+"
    exit 1
fi

echo "✅ Node.js: $(node --version)"

# 创建临时目录
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# 下载 mini-silktalk.js
echo ""
echo "[1/3] 下载 SilkTalk Mini..."
cat > mini-silktalk.js << 'ENDOFFILE'
#!/usr/bin/env node
const http=require('http'),WebSocket=require('ws'),os=require('os');
const PORT=process.env.PORT||8080,NODE_ID=Math.random().toString(36).substring(2,10);
function getIP(){const i=os.networkInterfaces();for(const n in i)for(const f of i[n])if('IPv4'===f.family&&!f.internal)return f.address;return'127.0.0.1'}
function log(m){console.log(`[${new Date().toISOString()}] ${m}`)}
function createServer(){const s=http.createServer((q,r)=>{r.writeHead(200);r.end(`Node:${NODE_ID}\nws://${getIP()}:${PORT}`)}),w=new WebSocket.Server({server:s}),p=new Map;w.on('connection',(c,r)=>{const i=Math.random().toString(36).substring(2,8);p.set(i,c);log(`Peer:${i} from ${r.socket.remoteAddress}`);c.on('message',d=>{try{const m=JSON.parse(d);log(`Recv:${m.type}`);'broadcast'===m.type&&p.forEach((e,o)=>{o!==i&&e.readyState===WebSocket.OPEN&&e.send(JSON.stringify({type:'relay',from:NODE_ID,originalFrom:m.from,data:m.data,t:Date.now()}))});c.send(JSON.stringify({type:'ack',from:NODE_ID,to:m.from,t:Date.now()}))}catch(e){}});c.on('close',()=>{p.delete(i);log(`Disconnect:${i}`)});c.send(JSON.stringify({type:'welcome',from:NODE_ID,yourId:i,peers:p.size,t:Date.now()}))});s.listen(PORT,()=>{log('========================================');log(`Node:${NODE_ID}`);log(`Server:http://${getIP()}:${PORT}`);log(`WebSocket:ws://${getIP()}:${PORT}`);log('========================================');log('Waiting...')});return{s,w,p}}
function connect(u){log(`Connect:${u}`);const c=new WebSocket(u);c.on('open',()=>{log('Connected!');c.send(JSON.stringify({type:'broadcast',from:NODE_ID,data:'Hello!',t:Date.now()}))});c.on('message',d=>{try{log(`Recv:${JSON.stringify(JSON.parse(d),null,2)}`)}catch(e){log(`Recv:${d}`)}});c.on('close',()=>{log('Disconnected');process.exit(0)});c.on('error',e=>{log(`Error:${e.message}`);process.exit(1)})}
try{require('ws')}catch(e){console.log('Installing ws...');require('child_process').execSync('npm install ws',{stdio:'inherit'});console.log('Please run again');process.exit(0)}
const t=process.argv[2];t?connect(t):createServer()
ENDOFFILE

echo "✅ 下载完成"

# 安装 ws 模块
echo ""
echo "[2/3] 安装依赖 (ws)..."
if [ ! -d "node_modules" ]; then
    npm install ws --silent
fi
echo "✅ 依赖安装完成"

# 启动
echo ""
echo "[3/3] 启动节点..."
echo "========================================"
echo ""

if [ -z "$1" ]; then
    echo "🟢 主节点模式"
    echo "   其他节点可以连接到你的地址"
    echo ""
    node mini-silktalk.js
else
    echo "🔵 客户端模式"
    echo "   连接到: $1"
    echo ""
    node mini-silktalk.js "$1"
fi
