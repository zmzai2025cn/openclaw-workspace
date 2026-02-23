/**
 * ClawChat 集成测试套件
 * 测试客户端-服务器端到端流程、多客户端并发、消息可靠性
 */

const WebSocket = require('ws');
const http = require('http');
const ClawChatClient = require('../client/client.js');

// 测试配置
const TEST_PORT = 18080;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// 测试状态
let serverProcess = null;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (err) {
      console.error(`❌ ${name}: ${err.message}`);
      testsFailed++;
    }
    resolve();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 启动测试服务器
async function startServer() {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    serverProcess = spawn('node', ['../server/server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: TEST_PORT }
    });
    
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) {
        resolve();
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      // console.error('Server stderr:', data.toString());
    });
    
    serverProcess.on('error', reject);
    
    setTimeout(() => resolve(), 2000); // 2秒超时
  });
}

// 停止测试服务器
async function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await wait(1000);
  }
}

// ==================== 基础连接测试 ====================

console.log('\n🔗 基础连接测试');

async function testBasicConnection() {
  await test('客户端连接服务器', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `test-${Date.now()}`
    });
    
    const connected = new Promise(resolve => {
      client.once('connected', resolve);
    });
    
    client.connect();
    await Promise.race([connected, wait(5000)]);
    
    if (!client.connected) {
      throw new Error('Connection failed');
    }
    
    client.disconnect();
  });
}

async function testRegistration() {
  await test('客户端注册流程', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `reg-test-${Date.now()}`
    });
    
    const registered = new Promise(resolve => {
      client.once('registered', resolve);
    });
    
    client.connect();
    await Promise.race([registered, wait(5000)]);
    
    if (!client.registered) {
      throw new Error('Registration failed');
    }
    
    client.disconnect();
  });
}

async function testSubscribe() {
  await test('订阅频道', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `sub-test-${Date.now()}`
    });
    
    const subscribed = new Promise(resolve => {
      client.once('subscribed', resolve);
    });
    
    client.connect();
    await wait(500);
    
    client.subscribe('test-channel');
    await Promise.race([subscribed, wait(5000)]);
    
    if (!client.channels.has('test-channel')) {
      throw new Error('Subscribe failed');
    }
    
    client.disconnect();
  });
}

// ==================== 消息传递测试 ====================

console.log('\n📨 消息传递测试');

async function testMessageDelivery() {
  await test('单客户端消息发布', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `pub-test-${Date.now()}`
    });
    
    client.connect();
    await wait(500);
    client.subscribe('test-channel');
    await wait(500);
    
    const msgId = client.publish('test-channel', { text: 'Hello' });
    
    if (!msgId) {
      throw new Error('Publish failed');
    }
    
    client.disconnect();
  });
}

async function testMessageReceive() {
  await test('客户端接收消息', async () => {
    const client1 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `recv1-${Date.now()}`
    });
    
    const client2 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `recv2-${Date.now()}`
    });
    
    const received = new Promise(resolve => {
      client2.once('message', resolve);
    });
    
    client1.connect();
    client2.connect();
    await wait(500);
    
    client1.subscribe('test-recv');
    client2.subscribe('test-recv');
    await wait(500);
    
    client1.publish('test-recv', { text: 'Test message' });
    
    const msg = await Promise.race([received, wait(5000)]);
    
    if (!msg || msg.payload.text !== 'Test message') {
      throw new Error('Message not received correctly');
    }
    
    client1.disconnect();
    client2.disconnect();
  });
}

async function testMessageACK() {
  await test('消息ACK确认', async () => {
    const client1 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `ack1-${Date.now()}`
    });
    
    const client2 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `ack2-${Date.now()}`
    });
    
    const ackReceived = new Promise(resolve => {
      client1.once('ack', resolve);
    });
    
    client1.connect();
    client2.connect();
    await wait(500);
    
    client1.subscribe('test-ack');
    client2.subscribe('test-ack');
    await wait(500);
    
    client1.publish('test-ack', { text: 'ACK test' });
    
    const ack = await Promise.race([ackReceived, wait(5000)]);
    
    if (!ack || !ack.msgId) {
      throw new Error('ACK not received');
    }
    
    client1.disconnect();
    client2.disconnect();
  });
}

// ==================== 多客户端并发测试 ====================

console.log('\n👥 多客户端并发测试');

async function testMultipleClients() {
  await test('10个客户端同时连接', async () => {
    const clients = [];
    const connectedPromises = [];
    
    for (let i = 0; i < 10; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `multi-${i}-${Date.now()}`
      });
      clients.push(client);
      connectedPromises.push(new Promise(resolve => client.once('connected', resolve)));
    }
    
    clients.forEach(c => c.connect());
    await Promise.race([Promise.all(connectedPromises), wait(10000)]);
    
    const connectedCount = clients.filter(c => c.connected).length;
    if (connectedCount !== 10) {
      throw new Error(`Only ${connectedCount}/10 clients connected`);
    }
    
    clients.forEach(c => c.disconnect());
  });
}

async function testBroadcast() {
  await test('消息广播到所有订阅者', async () => {
    const clients = [];
    const receivedCounts = new Map();
    const channel = `broadcast-${Date.now()}`;
    
    // 创建5个客户端
    for (let i = 0; i < 5; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `bc-${i}-${Date.now()}`
      });
      
      client.on('message', (msg) => {
        if (msg.channel === channel) {
          receivedCounts.set(client.config.clientId, (receivedCounts.get(client.config.clientId) || 0) + 1);
        }
      });
      
      clients.push(client);
    }
    
    // 连接所有客户端
    clients.forEach(c => c.connect());
    await wait(500);
    
    // 订阅频道
    clients.forEach(c => c.subscribe(channel));
    await wait(500);
    
    // 发送消息
    clients[0].publish(channel, { text: 'Broadcast test' });
    await wait(1000);
    
    // 验证接收 (发送者不接收自己的消息)
    let receivedCount = 0;
    for (let i = 1; i < 5; i++) {
      if (receivedCounts.get(clients[i].config.clientId) === 1) {
        receivedCount++;
      }
    }
    
    if (receivedCount !== 4) {
      throw new Error(`Only ${receivedCount}/4 clients received broadcast`);
    }
    
    clients.forEach(c => c.disconnect());
  });
}

async function testConcurrentMessages() {
  await test('100条并发消息', async () => {
    const client1 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `con1-${Date.now()}`
    });
    
    const client2 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `con2-${Date.now()}`
    });
    
    let receivedCount = 0;
    client2.on('message', () => receivedCount++);
    
    client1.connect();
    client2.connect();
    await wait(500);
    
    const channel = `concurrent-${Date.now()}`;
    client1.subscribe(channel);
    client2.subscribe(channel);
    await wait(500);
    
    // 发送100条消息
    for (let i = 0; i < 100; i++) {
      client1.publish(channel, { index: i });
    }
    
    await wait(3000);
    
    if (receivedCount !== 100) {
      throw new Error(`Only ${receivedCount}/100 messages received`);
    }
    
    client1.disconnect();
    client2.disconnect();
  });
}

// ==================== 重连测试 ====================

console.log('\n🔄 重连测试');

async function testAutoReconnect() {
  await test('自动重连功能', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `reconnect-${Date.now()}`,
      reconnectDelay: 100
    });
    
    const connected1 = new Promise(resolve => client.once('connected', resolve));
    client.connect();
    await Promise.race([connected1, wait(5000)]);
    
    if (!client.connected) {
      throw new Error('Initial connection failed');
    }
    
    // 强制断开
    client.ws.terminate();
    
    const connected2 = new Promise(resolve => client.once('connected', resolve));
    await Promise.race([connected2, wait(10000)]);
    
    if (!client.connected) {
      throw new Error('Reconnection failed');
    }
    
    client.disconnect();
  });
}

async function testMessageQueue() {
  await test('离线消息队列', async () => {
    const client = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `queue-${Date.now()}`
    });
    
    // 未连接时发送消息到队列
    client.subscribe('test-queue');
    client.publish('test-queue', { text: 'Queued 1' });
    client.publish('test-queue', { text: 'Queued 2' });
    
    if (client.messageQueue.length !== 2) {
      throw new Error('Messages not queued');
    }
    
    client.disconnect();
  });
}

// ==================== 错误处理测试 ====================

console.log('\n⚠️ 错误处理测试');

async function testInvalidMessage() {
  await test('服务器拒绝无效消息', async () => {
    const ws = new WebSocket(TEST_URL);
    
    await new Promise(resolve => ws.once('open', resolve));
    
    const errorReceived = new Promise(resolve => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'error') resolve(msg);
      });
    });
    
    ws.send(JSON.stringify({ type: 'invalid' }));
    
    const error = await Promise.race([errorReceived, wait(5000)]);
    
    if (!error || !error.error.includes('Unknown')) {
      throw new Error('Invalid message not rejected');
    }
    
    ws.close();
  });
}

async function testDuplicateId() {
  await test('拒绝重复ID注册', async () => {
    const id = `dup-${Date.now()}`;
    
    const client1 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: id
    });
    
    const client2 = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: id
    });
    
    let errorReceived = false;
    client2.on('serverError', () => { errorReceived = true; });
    
    client1.connect();
    await wait(500);
    
    client2.connect();
    await wait(1000);
    
    // client2 应该收到错误
    if (!errorReceived) {
      throw new Error('Duplicate ID not rejected');
    }
    
    client1.disconnect();
    client2.disconnect();
  });
}

async function testUnauthorizedPublish() {
  await test('未注册不能发布消息', async () => {
    const ws = new WebSocket(TEST_URL);
    
    await new Promise(resolve => ws.once('open', resolve));
    await wait(100);
    
    const errorReceived = new Promise(resolve => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'error') resolve(msg);
      });
    });
    
    // 不注册直接发布
    ws.send(JSON.stringify({
      type: 'publish',
      channel: 'test',
      payload: { text: 'test' }
    }));
    
    const error = await Promise.race([errorReceived, wait(5000)]);
    
    if (!error || !error.error.includes('Not registered')) {
      throw new Error('Unauthorized publish not rejected');
    }
    
    ws.close();
  });
}

// ==================== 主测试流程 ====================

async function runTests() {
  console.log('🚀 启动 ClawChat 集成测试');
  console.log(`📍 测试服务器: ${TEST_URL}`);
  
  try {
    await startServer();
    console.log('✅ 测试服务器已启动');
    
    // 基础连接测试
    await testBasicConnection();
    await testRegistration();
    await testSubscribe();
    
    // 消息传递测试
    await testMessageDelivery();
    await testMessageReceive();
    await testMessageACK();
    
    // 多客户端并发测试
    await testMultipleClients();
    await testBroadcast();
    await testConcurrentMessages();
    
    // 重连测试
    await testAutoReconnect();
    await testMessageQueue();
    
    // 错误处理测试
    await testInvalidMessage();
    await testDuplicateId();
    await testUnauthorizedPublish();
    
  } catch (err) {
    console.error('测试执行错误:', err);
  } finally {
    await stopServer();
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 集成测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
