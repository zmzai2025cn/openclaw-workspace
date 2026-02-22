const WebSocket = require('ws');
const http = require('http');
const { randomBytes } = require('crypto');

// 创建 HTTP 服务器（Railway 需要）
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'WebSocket Relay Server is running',
    connections: nodes.size,
    timestamp: new Date().toISOString()
  }));
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 存储节点ID到WebSocket连接的映射
const nodes = new Map();

// 生成唯一节点ID
function generateNodeId() {
  return randomBytes(4).toString('hex');
}

// 广播节点列表更新
function broadcastNodeList() {
  const nodeList = Array.from(nodes.keys());
  const message = JSON.stringify({
    type: 'nodes',
    nodes: nodeList,
    timestamp: Date.now()
  });
  
  for (const [nodeId, ws] of nodes) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

wss.on('connection', (ws) => {
  const nodeId = generateNodeId();
  nodes.set(nodeId, ws);
  
  console.log(`[+] 节点连接: ${nodeId}, 总连接数: ${nodes.size}`);
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    nodeId: nodeId,
    nodes: Array.from(nodes.keys()),
    timestamp: Date.now()
  }));
  
  // 广播新节点加入
  broadcastNodeList();
  
  // 处理消息
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[${nodeId}] 收到消息:`, msg);
      
      // 添加发送者信息
      msg.from = nodeId;
      msg.serverTimestamp = Date.now();
      
      // 如果有 to 字段，定向发送
      if (msg.to) {
        const targetWs = nodes.get(msg.to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify(msg));
          console.log(`[→] 转发消息: ${nodeId} -> ${msg.to}`);
        } else {
          // 目标节点不存在或已断开
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Target node not found or disconnected',
            target: msg.to,
            timestamp: Date.now()
          }));
        }
      }
      // 否则广播给所有其他节点
      else {
        let broadcastCount = 0;
        for (const [id, clientWs] of nodes) {
          if (id !== nodeId && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(msg));
            broadcastCount++;
          }
        }
        console.log(`[→] 广播消息: ${nodeId} -> ${broadcastCount} 个节点`);
      }
    } catch (e) {
      console.error(`[!] 消息处理错误:`, e.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    console.log(`[-] 节点断开: ${nodeId}, 剩余连接数: ${nodes.size - 1}`);
    nodes.delete(nodeId);
    broadcastNodeList();
  });
  
  // 处理错误
  ws.on('error', (err) => {
    console.error(`[!] 节点 ${nodeId} 错误:`, err.message);
  });
});

// 从环境变量获取端口（Railway 会提供）
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`[=] WebSocket 中继服务器运行在端口 ${PORT}`);
});
