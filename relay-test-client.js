const WebSocket = require('ws');

const RELAY_URL = process.argv[2] || 'wss://successful-caring-production-7b3a.up.railway.app';
const NODE_NAME = 'kimi-claw';
const TARGET_NODE = 'dcsfdwh0'; // alibot 的节点ID

console.log(`[${NODE_NAME}] 连接到中继服务器: ${RELAY_URL}`);

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  console.log(`[${NODE_NAME}] ✅ 已连接到中继服务器`);
  
  // 发送第一条测试消息
  setTimeout(() => {
    sendToNode(TARGET_NODE, '你好！这是 Kimi Claw 通过节点ID发送的测试消息 🚀');
  }, 2000);
  
  // 发送第二条测试消息
  setTimeout(() => {
    sendToNode(TARGET_NODE, '中继服务器工作正常！双向通信测试中...');
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    console.log(`[${NODE_NAME}] 📨 收到消息:`, JSON.stringify(msg, null, 2));
  } catch (e) {
    console.log(`[${NODE_NAME}] 📨 收到原始数据:`, data.toString());
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

function sendToNode(targetNodeId, text) {
  if (ws.readyState === WebSocket.OPEN) {
    const msg = {
      to: targetNodeId,
      text: text,
      from: NODE_NAME,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(msg));
    console.log(`[${NODE_NAME}] 📤 发送给 ${targetNodeId}: ${text}`);
  }
}

// 10秒后自动退出
setTimeout(() => {
  console.log(`[${NODE_NAME}] 测试完成，断开连接`);
  ws.close();
}, 10000);
