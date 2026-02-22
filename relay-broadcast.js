const WebSocket = require('ws');

const RELAY_URL = 'wss://successful-caring-production-7b3a.up.railway.app';

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  // 发送广播消息（不包含 to 字段）
  const broadcastMsg = {
    text: '这是 Kimi 的广播消息！有人能听到吗？📢',
    from: 'kimi-claw',
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(broadcastMsg));
  console.log('📢 广播消息已发送');
  
  // 发送定向消息
  const directMsg = {
    to: 'zc8imv2l',
    text: '这是 Kimi 发送给 zc8imv2l 的定向消息 🎯',
    from: 'kimi-claw',
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(directMsg));
  console.log('📤 定向消息已发送给 zc8imv2l');
  
  setTimeout(() => {
    ws.close();
  }, 1000);
});

ws.on('error', (err) => {
  console.error('错误:', err.message);
});
