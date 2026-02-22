const WebSocket = require('ws');

const RELAY_URL = process.argv[2] || 'wss://successful-caring-production-7b3a.up.railway.app';
const NODE_NAME = 'kimi-claw';

console.log(`[${NODE_NAME}] 连接到中继服务器: ${RELAY_URL}`);
console.log(`[${NODE_NAME}] 等待 alibot 的回复... 按 Ctrl+C 退出`);

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  console.log(`[${NODE_NAME}] ✅ 已连接`);
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
  console.log(`[${NODE_NAME}] ❌ 连接已关闭`);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error(`[${NODE_NAME}] ❌ 错误:`, err.message);
  process.exit(1);
});
