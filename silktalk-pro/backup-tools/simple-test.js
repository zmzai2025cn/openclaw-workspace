#!/usr/bin/env node
/**
 * simple-test.js - 原生WebSocket测试
 * 不依赖libp2p的基础连接测试
 */

const http = require('http');
const WebSocket = require('ws');

// 配置
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SilkTalk WebSocket Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        #log { background: #f8f9fa; padding: 15px; border-radius: 5px; height: 300px; overflow-y: auto; font-family: monospace; }
      </style>
    </head>
    <body>
      <h1>🎙️ SilkTalk WebSocket 测试</h1>
      <div id="status" class="status info">等待连接...</div>
      <div>
        <button onclick="connect()">连接</button>
        <button onclick="disconnect()">断开</button>
        <button onclick="sendMessage()">发送测试消息</button>
        <button onclick="clearLog()">清空日志</button>
      </div>
      <h3>日志:</h3>
      <div id="log"></div>
      
      <script>
        let ws = null;
        const log = document.getElementById('log');
        const status = document.getElementById('status');
        
        function addLog(message, type = 'info') {
          const div = document.createElement('div');
          div.textContent = '[${new Date().toLocaleTimeString()}] ' + message;
          div.style.color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'black';
          log.appendChild(div);
          log.scrollTop = log.scrollHeight;
        }
        
        function connect() {
          if (ws) {
            addLog('已经连接', 'error');
            return;
          }
          
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const url = protocol + '//' + window.location.host;
          
          addLog('正在连接到: ' + url);
          
          ws = new WebSocket(url);
          
          ws.onopen = () => {
            status.textContent = '已连接 ✓';
            status.className = 'status success';
            addLog('连接成功!', 'success');
          };
          
          ws.onmessage = (event) => {
            addLog('收到: ' + event.data, 'success');
          };
          
          ws.onerror = (error) => {
            status.textContent = '连接错误 ✗';
            status.className = 'status error';
            addLog('错误: ' + error, 'error');
          };
          
          ws.onclose = () => {
            status.textContent = '已断开';
            status.className = 'status info';
            addLog('连接已关闭');
            ws = null;
          };
        }
        
        function disconnect() {
          if (ws) {
            ws.close();
            addLog('主动断开连接');
          } else {
            addLog('未连接', 'error');
          }
        }
        
        function sendMessage() {
          if (ws && ws.readyState === WebSocket.OPEN) {
            const msg = 'Hello from client at ' + new Date().toISOString();
            ws.send(msg);
            addLog('发送: ' + msg);
          } else {
            addLog('未连接，无法发送', 'error');
          }
        }
        
        function clearLog() {
          log.innerHTML = '';
        }
        
        // 自动连接
        setTimeout(connect, 500);
      </script>
    </body>
    </html>
  `);
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储连接的客户端
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  log(`新客户端连接: ${clientIp}`, 'green');
  clients.add(ws);
  
  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'welcome',
    message: '欢迎来到 SilkTalk WebSocket 测试服务器',
    timestamp: Date.now(),
    clients: clients.size
  }));
  
  // 广播新用户加入
  broadcast({
    type: 'join',
    message: `新用户加入 (当前在线: ${clients.size})`,
    timestamp: Date.now()
  }, ws);
  
  ws.on('message', (data) => {
    const message = data.toString();
    log(`收到消息: ${message.substring(0, 100)}`, 'cyan');
    
    // 回复确认
    ws.send(JSON.stringify({
      type: 'ack',
      received: message,
      timestamp: Date.now()
    }));
  });
  
  ws.on('close', () => {
    log(`客户端断开: ${clientIp}`, 'yellow');
    clients.delete(ws);
    
    broadcast({
      type: 'leave',
      message: `用户离开 (当前在线: ${clients.size})`,
      timestamp: Date.now()
    });
  });
  
  ws.on('error', (error) => {
    log(`客户端错误: ${error.message}`, 'red');
  });
});

// 广播消息给所有客户端
function broadcast(data, exclude = null) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 启动服务器
server.listen(PORT, HOST, () => {
  log('========================================', 'blue');
  log('  SilkTalk WebSocket 测试服务器', 'blue');
  log('========================================', 'blue');
  log(`服务器运行在: http://${HOST}:${PORT}`, 'green');
  log(`WebSocket端点: ws://${HOST}:${PORT}`, 'green');
  log('', 'reset');
  log('可用命令:', 'yellow');
  log('  客户端模式: node simple-test.js client <服务器地址>', 'reset');
  log('  压力测试: node simple-test.js stress <服务器地址> <连接数>', 'reset');
  log('========================================', 'blue');
});

// 客户端模式
if (process.argv[2] === 'client') {
  const serverUrl = process.argv[3] || 'ws://localhost:8080';
  
  log(`连接到服务器: ${serverUrl}`, 'blue');
  
  const client = new WebSocket(serverUrl);
  
  client.on('open', () => {
    log('已连接到服务器!', 'green');
    
    // 发送测试消息
    setInterval(() => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now(),
          data: 'Test message from client'
        }));
      }
    }, 5000);
  });
  
  client.on('message', (data) => {
    log(`收到: ${data}`, 'cyan');
  });
  
  client.on('error', (error) => {
    log(`错误: ${error.message}`, 'red');
  });
  
  client.on('close', () => {
    log('连接已关闭', 'yellow');
    process.exit(0);
  });
  
  // 按Ctrl+C退出
  process.on('SIGINT', () => {
    log('\n正在断开连接...', 'yellow');
    client.close();
  });
}

// 压力测试模式
if (process.argv[2] === 'stress') {
  const serverUrl = process.argv[3] || 'ws://localhost:8080';
  const connectionCount = parseInt(process.argv[4]) || 10;
  
  log(`压力测试: ${connectionCount} 个连接到 ${serverUrl}`, 'blue');
  
  const connections = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < connectionCount; i++) {
    setTimeout(() => {
      const client = new WebSocket(serverUrl);
      
      client.on('open', () => {
        successCount++;
        log(`连接 ${i + 1}/${connectionCount} 成功 (${successCount} 成功, ${failCount} 失败)`, 'green');
        connections.push(client);
      });
      
      client.on('error', () => {
        failCount++;
        log(`连接 ${i + 1}/${connectionCount} 失败 (${successCount} 成功, ${failCount} 失败)`, 'red');
      });
      
      client.on('close', () => {
        const index = connections.indexOf(client);
        if (index > -1) {
          connections.splice(index, 1);
        }
      });
    }, i * 100);
  }
  
  // 10秒后统计结果
  setTimeout(() => {
    log('\n========================================', 'blue');
    log('压力测试结果:', 'blue');
    log(`  成功: ${successCount}`, 'green');
    log(`  失败: ${failCount}`, 'red');
    log(`  当前活跃: ${connections.length}`, 'cyan');
    log('========================================', 'blue');
    
    // 关闭所有连接
    connections.forEach(c => c.close());
    process.exit(0);
  }, 15000);
}
