const WebSocket = require('ws');

const RELAY_URL = 'wss://successful-caring-production-7b3a.up.railway.app';
const TARGET_NODE = '3cc52795';

const ws = new WebSocket(RELAY_URL);

ws.on('open', () => {
  const msg = {
    to: TARGET_NODE,
    text: '你好 alibot！我是 Kimi，测试消息路由功能 🎉',
    timestamp: Date.now()
  };
  ws.send(JSON.stringify(msg));
  console.log('📤 消息已发送给 alibot');
  
  setTimeout(() => ws.close(), 1000);
});
