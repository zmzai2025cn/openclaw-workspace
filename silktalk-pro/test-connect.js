const WebSocket = require('ws');

const target = 'ws://10.0.88.136:8080';
const myId = 'main-node-' + Math.random().toString(36).substring(2, 6);

console.log('========================================');
console.log('  SilkTalk Mini - 连接测试');
console.log('========================================');
console.log('');
console.log('我的ID:', myId);
console.log('目标:', target);
console.log('');

const ws = new WebSocket(target);

ws.on('open', () => {
  console.log('✅ 连接成功！');
  console.log('');
  
  // 发送测试消息
  ws.send(JSON.stringify({
    type: 'broadcast',
    from: myId,
    data: 'Hello from main node!',
    timestamp: Date.now()
  }));
  console.log('📤 发送测试消息');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    console.log('📥 收到消息:', JSON.stringify(msg, null, 2));
    
    if (msg.type === 'ack') {
      console.log('');
      console.log('✅ 双向通信验证成功！');
      console.log('');
      console.log('========================================');
      console.log('  P2P 连接测试通过');
      console.log('========================================');
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.log('📥 收到:', data.toString());
  }
});

ws.on('error', (err) => {
  console.log('❌ 连接错误:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('连接关闭');
});

setTimeout(() => {
  console.log('❌ 超时，未收到响应');
  process.exit(1);
}, 10000);
