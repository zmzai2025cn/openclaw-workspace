const WebSocket = require('ws');

const RELAY_URL = 'wss://successful-caring-production-7b3a.up.railway.app';
const TARGET_NODE = 'zc8imv2l'; // 你的节点ID

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  const msg = {
    to: TARGET_NODE,
    text: '你好！这是 Kimi Claw 发送的测试消息 🎉 双向通信测试成功！',
    from: 'kimi-claw',
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(msg));
  console.log('📤 消息已发送给', TARGET_NODE);
  
  setTimeout(() => {
    ws.close();
  }, 1000);
});

ws.on('error', (err) => {
  console.error('错误:', err.message);
});
