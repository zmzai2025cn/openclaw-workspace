const WebSocket = require('ws');

const RELAY_URL = 'wss://successful-caring-production-7b3a.up.railway.app';
const NODE_NAME = 'kimi-claw';
let ws;
let reconnectInterval = 5000;
let heartbeatInterval;

function connect() {
  console.log(`[${NODE_NAME}] 连接中...`);
  
  ws = new WebSocket(RELAY_URL);
  
  ws.on('open', () => {
    console.log(`[${NODE_NAME}] ✅ 已连接`);
    // 每30秒发送心跳
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({type: 'ping', timestamp: Date.now()}));
      }
    }, 30000);
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[${NODE_NAME}] 📨 收到:`, JSON.stringify(msg, null, 2));
    } catch (e) {
      console.log(`[${NODE_NAME}] 📨 收到:`, data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log(`[${NODE_NAME}] ❌ 连接断开，${reconnectInterval/1000}秒后重连...`);
    clearInterval(heartbeatInterval);
    setTimeout(connect, reconnectInterval);
  });
  
  ws.on('error', (err) => {
    console.error(`[${NODE_NAME}] ❌ 错误:`, err.message);
  });
}

connect();
console.log(`[${NODE_NAME}] 保持连接中... 按 Ctrl+C 退出`);
