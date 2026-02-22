#!/bin/bash
# Railway CLI 部署脚本 - 在本地执行

echo "=========================================="
echo "  SilkTalk Relay - Railway 部署"
echo "=========================================="
echo ""

# 1. 登录
echo "[1/5] 登录 Railway..."
echo "这会打开浏览器，请授权登录"
railway login

# 2. 创建目录
echo ""
echo "[2/5] 创建项目目录..."
mkdir -p silktalk-relay
cd silktalk-relay

# 3. 创建 package.json
echo ""
echo "[3/5] 创建配置文件..."
cat > package.json << 'EOF'
{
  "name": "silktalk-relay",
  "version": "1.0.0",
  "main": "relay-server.js",
  "scripts": {
    "start": "node relay-server.js"
  },
  "dependencies": {
    "ws": "^8.14.0"
  }
}
EOF

# 4. 创建 relay-server.js
echo ""
echo "[4/5] 创建服务器代码..."
cat > relay-server.js << 'EOF'
const WebSocket=require('ws'),http=require('http');
const PORT=process.env.PORT||8080,nodes=new Map();
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({status:'running',nodes:nodes.size,timestamp:new Date().toISOString()}));});
const wss=new WebSocket.Server({server});
console.log('SilkTalk Relay Server');
wss.on('connection',(ws,req)=>{const nodeId=Math.random().toString(36).substring(2,10),ip=req.socket.remoteAddress;
console.log(\`[\${new Date().toISOString()}] Connected: \${nodeId}\`);
nodes.set(nodeId,{ws,ip,connectedAt:new Date(),lastPing:Date.now()});
ws.send(JSON.stringify({type:'welcome',nodeId,nodes:Array.from(nodes.keys()).filter(id=>id!==nodeId),timestamp:Date.now()}));
ws.on('message',(data)=>{try{const msg=JSON.parse(data);if(msg.type==='broadcast'){nodes.forEach((node,id)=>{if(id!==nodeId&&node.ws.readyState===WebSocket.OPEN)node.ws.send(JSON.stringify({type:'message',from:nodeId,data:msg.data,timestamp:Date.now()}));});}}catch(e){}});
ws.on('close',()=>{nodes.delete(nodeId);});});
server.listen(PORT,()=>{console.log(\`Server running on port \${PORT}\`);console.log(\`WebSocket: ws://0.0.0.0:\${PORT}\`);});
EOF

# 5. 初始化并部署
echo ""
echo "[5/5] 部署到 Railway..."
railway init
railway up

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "获取公网地址:"
echo "  railway domain"
echo ""
