#!/usr/bin/env node
/**
 * SilkTalk Mini - Layer 1 极简验证版
 * 纯 WebSocket P2P，零依赖，单文件，即拷即运行
 * 
 * 使用方法:
 *   节点A (主节点): node mini-silktalk.js
 *   节点B (连接A):  node mini-silktalk.js ws://<A的IP>:8080
 */

const http = require('http');
const WebSocket = require('ws');
const os = require('os');

const PORT = process.env.PORT || 8080;
const NODE_ID = Math.random().toString(36).substring(2, 10);

function getIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// 创建 WebSocket 服务器
function createServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end(`SilkTalk Mini Node: ${NODE_ID}\nConnect: ws://${getIP()}:${PORT}`);
  });

  const wss = new WebSocket.Server({ server });
  const peers = new Map();

  wss.on('connection', (ws, req) => {
    const peerId = Math.random().toString(36).substring(2, 8);
    peers.set(peerId, ws);
    log(`Peer connected: ${peerId} from ${req.socket.remoteAddress}`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        log(`Received from ${peerId}: ${msg.type}`);
        
        // 广播给所有其他节点
        if (msg.type === 'broadcast') {
          peers.forEach((peer, pid) => {
            if (pid !== peerId && peer.readyState === WebSocket.OPEN) {
              peer.send(JSON.stringify({
                type: 'relay',
                from: NODE_ID,
                originalFrom: msg.from,
                data: msg.data,
                timestamp: Date.now()
              }));
            }
          });
        }
        
        // 回复确认
        ws.send(JSON.stringify({
          type: 'ack',
          from: NODE_ID,
          to: msg.from,
          timestamp: Date.now()
        }));
        
      } catch (e) {
        log(`Invalid message from ${peerId}: ${data}`);
      }
    });

    ws.on('close', () => {
      peers.delete(peerId);
      log(`Peer disconnected: ${peerId}`);
    });

    ws.on('error', (err) => {
      log(`Peer error ${peerId}: ${err.message}`);
    });

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'welcome',
      from: NODE_ID,
      yourId: peerId,
      peers: peers.size,
      timestamp: Date.now()
    }));
  });

  server.listen(PORT, () => {
    log('========================================');
    log(`SilkTalk Mini Node: ${NODE_ID}`);
    log(`Server: http://${getIP()}:${PORT}`);
    log(`WebSocket: ws://${getIP()}:${PORT}`);
    log('========================================');
    log('Waiting for connections...');
    log('Press Ctrl+C to stop');
  });

  return { server, wss, peers };
}

// 连接到其他节点
function connectToPeer(url) {
  log(`Connecting to ${url}...`);
  
  const ws = new WebSocket(url);
  
  ws.on('open', () => {
    log(`Connected to ${url}`);
    
    // 发送测试消息
    ws.send(JSON.stringify({
      type: 'broadcast',
      from: NODE_ID,
      data: 'Hello from SilkTalk Mini!',
      timestamp: Date.now()
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      log(`Received: ${JSON.stringify(msg, null, 2)}`);
    } catch (e) {
      log(`Received: ${data}`);
    }
  });

  ws.on('close', () => {
    log(`Disconnected from ${url}`);
    process.exit(0);
  });

  ws.on('error', (err) => {
    log(`Connection error: ${err.message}`);
    process.exit(1);
  });
}

// 主函数
function main() {
  const target = process.argv[2];
  
  if (target) {
    // 客户端模式：连接到指定节点
    connectToPeer(target);
  } else {
    // 服务器模式：启动监听
    createServer();
  }
}

// 检查 WebSocket 模块
try {
  require('ws');
} catch (e) {
  console.log('Installing ws module...');
  const { execSync } = require('child_process');
  execSync('npm install ws', { stdio: 'inherit' });
  console.log('Please run again');
  process.exit(0);
}

main();
