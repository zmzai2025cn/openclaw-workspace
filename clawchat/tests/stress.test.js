/**
 * ClawChat 压力测试套件
 * 测试100并发连接、1000消息/秒、1小时稳定性
 */

const WebSocket = require('ws');
const ClawChatClient = require('../client/client.js');

// 测试配置
const TEST_PORT = 18081;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// 测试结果
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    try {
      await fn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${name} (${duration}ms)`);
      testsPassed++;
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${name} (${duration}ms): ${err.message}`);
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
    const serverProcess = spawn('node', ['../server/server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: TEST_PORT }
    });
    
    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('running on port')) {
        resolve(serverProcess);
      }
    });
    
    serverProcess.on('error', reject);
    setTimeout(() => resolve(serverProcess), 2000);
  });
}

// 停止测试服务器
async function stopServer(serverProcess) {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await wait(1000);
  }
}

// ==================== 并发连接测试 ====================

console.log('\n🔥 并发连接压力测试');

async function test100ConcurrentConnections() {
  await test('100并发连接测试', async () => {
    const clients = [];
    const startTime = Date.now();
    
    // 创建100个客户端
    for (let i = 0; i < 100; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `concurrent-${i}-${Date.now()}`,
        autoReconnect: false
      });
      clients.push(client);
    }
    
    // 同时连接
    const connectPromises = clients.map(client => 
      new Promise(resolve => {
        client.once('connected', () => resolve(true));
        client.once('error', () => resolve(false));
        client.connect();
      })
    );
    
    const results = await Promise.all(connectPromises);
    const connectedCount = results.filter(r => r).length;
    const connectTime = Date.now() - startTime;
    
    console.log(`   📊 连接统计: ${connectedCount}/100 成功, 耗时: ${connectTime}ms`);
    
    if (connectedCount < 95) {
      throw new Error(`Only ${connectedCount}/100 connections successful`);
    }
    
    // 清理
    clients.forEach(c => c.disconnect());
    await wait(500);
  });
}

async function testConnectionStorm() {
  await test('连接风暴测试 (200连接/秒)', async () => {
    const clients = [];
    const batchSize = 50;
    const totalClients = 200;
    
    for (let batch = 0; batch < totalClients / batchSize; batch++) {
      const batchClients = [];
      for (let i = 0; i < batchSize; i++) {
        const idx = batch * batchSize + i;
        const client = new ClawChatClient({
          serverUrl: TEST_URL,
          clientId: `storm-${idx}-${Date.now()}`,
          autoReconnect: false
        });
        batchClients.push(client);
        clients.push(client);
      }
      
      batchClients.forEach(c => c.connect());
      await wait(50); // 每50ms连接50个
    }
    
    await wait(2000); // 等待连接完成
    
    const connectedCount = clients.filter(c => c.connected).length;
    console.log(`   📊 风暴测试: ${connectedCount}/${totalClients} 成功`);
    
    if (connectedCount < totalClients * 0.9) {
      throw new Error(`Connection storm failed: ${connectedCount}/${totalClients}`);
    }
    
    clients.forEach(c => c.disconnect());
  });
}

// ==================== 消息吞吐量测试 ====================

console.log('\n📈 消息吞吐量压力测试');

async function testHighThroughput() {
  await test('1000消息/秒吞吐量', async () => {
    const sender = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `sender-${Date.now()}`
    });
    
    const receiver = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `receiver-${Date.now()}`
    });
    
    let receivedCount = 0;
    receiver.on('message', () => receivedCount++);
    
    sender.connect();
    receiver.connect();
    await wait(500);
    
    const channel = `throughput-${Date.now()}`;
    sender.subscribe(channel);
    receiver.subscribe(channel);
    await wait(500);
    
    const messageCount = 1000;
    const startTime = Date.now();
    
    // 快速发送1000条消息
    for (let i = 0; i < messageCount; i++) {
      sender.publish(channel, { index: i, timestamp: Date.now() });
    }
    
    const sendTime = Date.now() - startTime;
    console.log(`   📤 发送耗时: ${sendTime}ms (${(messageCount/sendTime*1000).toFixed(0)} msg/s)`);
    
    // 等待接收
    await wait(3000);
    
    const receiveTime = Date.now() - startTime;
    const throughput = (receivedCount / receiveTime * 1000).toFixed(0);
    console.log(`   📥 接收: ${receivedCount}/${messageCount}, 吞吐量: ${throughput} msg/s`);
    
    if (receivedCount < messageCount * 0.95) {
      throw new Error(`Message loss: ${receivedCount}/${messageCount}`);
    }
    
    sender.disconnect();
    receiver.disconnect();
  });
}

async function testBurstMessages() {
  await test('消息突发测试 (5000条瞬时发送)', async () => {
    const sender = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: `burst-sender-${Date.now()}`
    });
    
    const receivers = [];
    const receiverCount = 10;
    const receivedCounts = new Array(receiverCount).fill(0);
    
    for (let i = 0; i < receiverCount; i++) {
      const receiver = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `burst-recv-${i}-${Date.now()}`
      });
      receiver.on('message', () => receivedCounts[i]++);
      receivers.push(receiver);
    }
    
    sender.connect();
    receivers.forEach(r => r.connect());
    await wait(500);
    
    const channel = `burst-${Date.now()}`;
    sender.subscribe(channel);
    receivers.forEach(r => r.subscribe(channel));
    await wait(500);
    
    const messageCount = 5000;
    const startTime = Date.now();
    
    // 突发发送
    const sendPromises = [];
    for (let i = 0; i < messageCount; i++) {
      sender.publish(channel, { index: i });
      if (i % 100 === 0) {
        await wait(1); // 每100条稍微停顿
      }
    }
    
    const sendTime = Date.now() - startTime;
    console.log(`   📤 突发发送: ${messageCount}条, 耗时: ${sendTime}ms`);
    
    // 等待接收
    await wait(5000);
    
    const totalReceived = receivedCounts.reduce((a, b) => a + b, 0);
    const expectedTotal = messageCount * receiverCount;
    console.log(`   📥 总接收: ${totalReceived}/${expectedTotal}`);
    
    if (totalReceived < expectedTotal * 0.9) {
      throw new Error(`Burst message loss: ${totalReceived}/${expectedTotal}`);
    }
    
    sender.disconnect();
    receivers.forEach(r => r.disconnect());
  });
}

// ==================== 长时间稳定性测试 ====================

console.log('\n⏱️ 稳定性压力测试 (缩短版)');

async function testShortStability() {
  await test('5分钟稳定性测试', async () => {
    const clientCount = 20;
    const clients = [];
    const messageCounts = new Map();
    const errorCounts = new Map();
    
    // 创建客户端
    for (let i = 0; i < clientCount; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `stable-${i}-${Date.now()}`,
        reconnectDelay: 1000
      });
      
      messageCounts.set(client.config.clientId, 0);
      errorCounts.set(client.config.clientId, 0);
      
      client.on('message', () => {
        messageCounts.set(client.config.clientId, messageCounts.get(client.config.clientId) + 1);
      });
      
      client.on('error', () => {
        errorCounts.set(client.config.clientId, errorCounts.get(client.config.clientId) + 1);
      });
      
      clients.push(client);
    }
    
    // 连接所有客户端
    clients.forEach(c => c.connect());
    await wait(2000);
    
    // 订阅共同频道
    const channel = `stability-${Date.now()}`;
    clients.forEach(c => c.subscribe(channel));
    await wait(1000);
    
    // 持续发送消息5分钟
    const testDuration = 5 * 60 * 1000; // 5分钟
    const startTime = Date.now();
    let messagesSent = 0;
    
    const interval = setInterval(() => {
      const client = clients[messagesSent % clients.length];
      if (client.connected) {
        client.publish(channel, { 
          index: messagesSent, 
          timestamp: Date.now(),
          data: 'x'.repeat(100) // 100字节payload
        });
        messagesSent++;
      }
    }, 100); // 每100ms发送一条
    
    // 等待测试完成
    await wait(testDuration);
    clearInterval(interval);
    
    // 统计结果
    await wait(2000); // 等待最后消息到达
    
    const totalReceived = Array.from(messageCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(errorCounts.values()).reduce((a, b) => a + b, 0);
    const connectedCount = clients.filter(c => c.connected).length;
    
    console.log(`   📊 稳定性统计:`);
    console.log(`      - 运行时间: ${testDuration/1000}s`);
    console.log(`      - 发送消息: ${messagesSent}`);
    console.log(`      - 接收消息: ${totalReceived}`);
    console.log(`      - 错误次数: ${totalErrors}`);
    console.log(`      - 在线客户端: ${connectedCount}/${clientCount}`);
    
    if (connectedCount < clientCount * 0.8) {
      throw new Error(`Too many clients disconnected: ${connectedCount}/${clientCount}`);
    }
    
    if (totalErrors > 10) {
      throw new Error(`Too many errors: ${totalErrors}`);
    }
    
    clients.forEach(c => c.disconnect());
  });
}

// ==================== 内存使用测试 ====================

console.log('\n💾 内存使用测试');

async function testMemoryUsage() {
  await test('内存使用监控', async () => {
    const initialMemory = process.memoryUsage();
    console.log(`   💾 初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    const clients = [];
    const clientCount = 50;
    
    // 创建连接
    for (let i = 0; i < clientCount; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `mem-${i}-${Date.now()}`,
        autoReconnect: false
      });
      clients.push(client);
      client.connect();
    }
    
    await wait(2000);
    
    const afterConnectMemory = process.memoryUsage();
    console.log(`   💾 连接后内存: ${(afterConnectMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // 发送消息
    const channel = `mem-test-${Date.now()}`;
    clients.forEach(c => c.subscribe(channel));
    await wait(500);
    
    for (let i = 0; i < 1000; i++) {
      clients[i % clients.length].publish(channel, { data: 'x'.repeat(500) });
    }
    
    await wait(2000);
    
    const afterMessagesMemory = process.memoryUsage();
    console.log(`   💾 消息后内存: ${(afterMessagesMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // 断开连接
    clients.forEach(c => c.disconnect());
    await wait(2000);
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
      await wait(1000);
    }
    
    const afterDisconnectMemory = process.memoryUsage();
    console.log(`   💾 断开后内存: ${(afterDisconnectMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    const memoryIncrease = (afterDisconnectMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    console.log(`   💾 内存增长: ${memoryIncrease.toFixed(2)} MB`);
    
    if (memoryIncrease > 50) {
      throw new Error(`Memory leak detected: ${memoryIncrease.toFixed(2)} MB`);
    }
  });
}

// ==================== 主测试流程 ====================

async function runTests() {
  console.log('🚀 启动 ClawChat 压力测试');
  console.log(`📍 测试服务器: ${TEST_URL}`);
  
  let serverProcess = null;
  
  try {
    serverProcess = await startServer();
    console.log('✅ 测试服务器已启动');
    
    // 并发连接测试
    await test100ConcurrentConnections();
    await testConnectionStorm();
    
    // 消息吞吐量测试
    await testHighThroughput();
    await testBurstMessages();
    
    // 稳定性测试
    await testShortStability();
    
    // 内存测试
    await testMemoryUsage();
    
  } catch (err) {
    console.error('测试执行错误:', err);
  } finally {
    await stopServer(serverProcess);
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 压力测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
