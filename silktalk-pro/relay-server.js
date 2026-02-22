#!/usr/bin/env node
/**
 * SilkTalk Relay Server - 简单WebSocket中继
 * 部署到任何支持Node.js的服务器即可
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const nodes = new Map(); // 存储连接的节点

// 创建HTTP服务器（用于健康检查）
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'running',
    nodes: nodes.size,
    timestamp: new Date().toISOString()
  }));
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

console.log('========================================');
console.log('  SilkTalk Relay Server');
console.log('========================================');
console.log('');

wss.on('connection', (ws, req) => {
  const nodeId = Math.random().toString(36).substring(2, 10);
  const ip = req.socket.remoteAddress;
  
  console.log(`[${new Date().toISOString()}] Node connected: ${nodeId} from ${ip}`);
  
  // 存储节点信息
  nodes.set(nodeId, {
    ws,
    ip,
    connectedAt: new Date(),
    lastPing: Date.now()
  });
  
  // 发送欢迎消息和节点列表
  ws.send(JSON.stringify({
    type: 'welcome',
    nodeId,
    message: 'Connected to SilkTalk Relay',
    nodes: Array.from(nodes.keys()).filter(id => id !== nodeId),
    timestamp: Date.now()
  }));
  
  // 广播新节点加入
  broadcast({
    type: 'node-joined',
    nodeId,
    totalNodes: nodes.size,
    timestamp: Date.now()
  }, nodeId);
  
  // 处理消息
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[${nodeId}] ${msg.type}:`, msg.data || msg.target || '');
      
      switch (msg.type) {
        case 'broadcast':
          // 广播给所有其他节点
          broadcast({
            type: 'message',
            from: nodeId,
            data: msg.data,
            timestamp: Date.now()
          }, nodeId);
          break;
          
        case 'direct':
          // 发送给指定节点
          const target = nodes.get(msg.target);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({
              type: 'direct',
              from: nodeId,
              data: msg.data,
              timestamp: Date.now()
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Target ${msg.target} not found or offline`,
              timestamp: Date.now()
            }));
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          nodes.get(nodeId).lastPing = Date.now();
          break;
          
        case 'list-nodes':
          ws.send(JSON.stringify({
            type: 'nodes',
            nodes: Array.from(nodes.entries()).map(([id, info]) => ({
              id,
              connectedAt: info.connectedAt,
              lastPing: info.lastPing
            })),
            timestamp: Date.now()
          }));
          break;
          
        default:
          console.log(`Unknown message type: ${msg.type}`);
      }
    } catch (e) {
      console.error(`Invalid message from ${nodeId}:`, e.message);
    }
  });
  
  // 处理断开
  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Node disconnected: ${nodeId}`);
    nodes.delete(nodeId);
    
    broadcast({
      type: 'node-left',
      nodeId,
      totalNodes: nodes.size,
      timestamp: Date.now()
    });
  });
  
  // 处理错误
  ws.on('error', (err) => {
    console.error(`[${nodeId}] Error:`, err.message);
  });
});

// 广播函数
function broadcast(msg, excludeNodeId) {
  const data = JSON.stringify(msg);
  nodes.forEach((node, id) => {
    if (id !== excludeNodeId && node.ws.readyState === WebSocket.OPEN) {
      node.ws.send(data);
    }
  });
}

// 清理离线节点（每30秒）
setInterval(() => {
  const now = Date.now();
  const offline = [];
  
  nodes.forEach((node, id) => {
    if (now - node.lastPing > 120000) { // 2分钟无响应
      offline.push(id);
    }
  });
  
  offline.forEach(id => {
    console.log(`[${new Date().toISOString()}] Removing offline node: ${id}`);
    nodes.delete(id);
  });
}, 30000);

// 启动服务器
server.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
  console.log(`WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}`);
  console.log('');
  console.log('Waiting for nodes...');
  console.log('Press Ctrl+C to stop');
  console.log('========================================');
});
