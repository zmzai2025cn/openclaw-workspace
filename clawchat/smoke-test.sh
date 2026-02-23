#!/bin/bash
# smoke-test.sh - 冒烟测试脚本

set -e

echo "=== ClawChat Smoke Test ==="

# 1. 环境检查
echo "[1/8] Checking environment..."
docker-compose --version || (echo "docker-compose not found" && exit 1)
node --version || (echo "node not found" && exit 1)

# 2. 启动服务
echo "[2/8] Starting services..."
docker-compose up -d clawchat-server
sleep 5

# 3. 健康检查
echo "[3/8] Health check..."
for i in {1..10}; do
  if curl -sf http://localhost:8080 2>/dev/null; then
    echo "✓ Server is healthy"
    break
  fi
  if [ $i -eq 10 ]; then
    echo "✗ Server not responding"
    docker-compose logs clawchat-server
    exit 1
  fi
  sleep 1
done

# 4. WebSocket连接测试
echo "[4/8] Testing WebSocket connection..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  console.log('✓ WebSocket connected');
  ws.close();
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('✗ WebSocket error:', err.message);
  process.exit(1);
});
setTimeout(() => { console.log('✗ Timeout'); process.exit(1); }, 5000);
" || exit 1

# 5. 注册流程测试
echo "[5/8] Testing registration flow..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({type: 'register', id: 'test-client'}));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'registered') {
    console.log('✓ Registration successful');
    ws.close();
    process.exit(0);
  }
  if (msg.type === 'error') {
    console.log('✗ Registration failed:', msg.error);
    ws.close();
    process.exit(1);
  }
});
setTimeout(() => { console.log('✗ Timeout'); process.exit(1); }, 5000);
" || exit 1

# 6. 订阅/发布测试
echo "[6/8] Testing subscribe/publish..."
node -e "
const WebSocket = require('ws');

const client1 = new WebSocket('ws://localhost:8080');
const client2 = new WebSocket('ws://localhost:8080');
let registered = 0;
let subscribed = 0;

function checkSubscribed() {
  subscribed++;
  if (subscribed === 2) {
    client1.send(JSON.stringify({type: 'publish', channel: 'test', payload: {text: 'hello'}}));
  }
}

function checkRegistered() {
  registered++;
  if (registered === 2) {
    client1.send(JSON.stringify({type: 'subscribe', channel: 'test'}));
    client2.send(JSON.stringify({type: 'subscribe', channel: 'test'}));
  }
}

client1.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'welcome') checkRegistered();
  if (msg.type === 'subscribed') checkSubscribed();
});

client2.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'welcome') checkRegistered();
  if (msg.type === 'subscribed') checkSubscribed();
  if (msg.type === 'message') {
    console.log('✓ Message received:', msg.payload);
    client1.close();
    client2.close();
    process.exit(0);
  }
});

client1.on('open', () => client1.send(JSON.stringify({type: 'register', id: 'pub'})));
client2.on('open', () => client2.send(JSON.stringify({type: 'register', id: 'sub'})));

setTimeout(() => { console.log('✗ Timeout'); process.exit(1); }, 10000);
" || exit 1

# 7. 心跳测试
echo "[7/8] Testing heartbeat..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
let pongReceived = false;

ws.on('open', () => {
  ws.send(JSON.stringify({type: 'register', id: 'heartbeat-test'}));
  setTimeout(() => {
    ws.send(JSON.stringify({type: 'ping'}));
  }, 100);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'pong') {
    console.log('✓ Heartbeat working');
    pongReceived = true;
    ws.close();
    process.exit(0);
  }
});

setTimeout(() => { 
  if (!pongReceived) { console.log('✗ Heartbeat timeout'); process.exit(1); }
}, 5000);
" || exit 1

# 8. 压力测试
echo "[8/8] Running light pressure test..."
node -e "
const WebSocket = require('ws');
const clients = [];
const count = 50;
let connected = 0;

for (let i = 0; i < count; i++) {
  const ws = new WebSocket('ws://localhost:8080');
  ws.on('open', () => {
    ws.send(JSON.stringify({type: 'register', id: 'load-' + i}));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'registered') {
      connected++;
      if (connected === count) {
        console.log('✓ All', count, 'clients connected');
        clients.forEach(c => c.close());
        process.exit(0);
      }
    }
  });
  ws.on('error', () => {});
  clients.push(ws);
}

setTimeout(() => { console.log('✗ Only', connected, 'connected'); process.exit(1); }, 30000);
" || exit 1

echo ""
echo "=== All Smoke Tests Passed ==="

# 清理
docker-compose down