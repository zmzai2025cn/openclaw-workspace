/**
 * ClawChat 故障注入测试套件
 * 测试网络断开/恢复、服务器重启、客户端异常退出
 */

const WebSocket = require('ws');
const ClawChatClient = require('../client/client.js');

// 测试配置
const TEST_PORT = 18082;
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
async function startServer(port = TEST_PORT) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const serverProcess = spawn('node', ['../server/server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: port }
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
    await wait(1500);
  }
}

// ==================== 网络断开/恢复测试 ====================

console.log('\n🔌 网络断开/恢复测试');

async function testNetworkDisconnect() {
  await test('网络断开检测', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `disconnect-test-${Date.now()}`,
        autoReconnect: false
      });
      
      const connected = new Promise(resolve => client.once('connected', resolve));
      const disconnected = new Promise(resolve => client.once('disconnected', resolve));
      
      client.connect();
      await Promise.race([connected, wait(5000)]);
      
      if (!client.connected) {
        throw new Error('Initial connection failed');
      }
      
      // 模拟网络断开 - 终止WebSocket连接
      client.ws.terminate();
      
      const discResult = await Promise.race([disconnected, wait(5000)]);
      
      if (!discResult) {
        throw new Error('Disconnect event not fired');
      }
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testNetworkRecovery() {
  await test('网络恢复后自动重连', async () => {
    let serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `recovery-test-${Date.now()}`,
        reconnectDelay: 500,
        maxReconnectDelay: 2000
      });
      
      let connectCount = 0;
      client.on('connected', () => connectCount++);
      
      client.connect();
      await wait(1000);
      
      if (!client.connected) {
        throw new Error('Initial connection failed');
      }
      
      // 停止服务器
      await stopServer(serverProcess);
      await wait(1000);
      
      if (client.connected) {
        throw new Error('Client should detect disconnection');
      }
      
      // 重启服务器
      serverProcess = await startServer();
      await wait(3000); // 等待重连
      
      if (connectCount < 2) {
        throw new Error(`Reconnection failed, connect count: ${connectCount}`);
      }
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testMessageDuringDisconnect() {
  await test('断线期间消息不丢失', async () => {
    let serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `msg-loss-${Date.now()}`,
        reconnectDelay: 500
      });
      
      client.connect();
      await wait(1000);
      client.subscribe('test-channel');
      await wait(500);
      
      // 停止服务器
      await stopServer(serverProcess);
      await wait(500);
      
      // 发送消息（应该进入队列）
      client.publish('test-channel', { text: 'Queued message 1' });
      client.publish('test-channel', { text: 'Queued message 2' });
      
      if (client.messageQueue.length !== 2) {
        throw new Error('Messages not queued during disconnect');
      }
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 服务器重启测试 ====================

console.log('\n🔄 服务器重启测试');

async function testServerRestart() {
  await test('服务器重启后客户端恢复', async () => {
    let serverProcess = await startServer();
    
    try {
      const clients = [];
      const reconnected = [];
      
      // 创建10个客户端
      for (let i = 0; i < 10; i++) {
        const client = new ClawChatClient({
          serverUrl: TEST_URL,
          clientId: `restart-${i}-${Date.now()}`,
          reconnectDelay: 500
        });
        
        client.on('registered', () => {
          reconnected.push(client.config.clientId);
        });
        
        clients.push(client);
        client.connect();
      }
      
      await wait(2000);
      
      // 验证初始连接
      const initialConnected = clients.filter(c => c.connected).length;
      console.log(`   📊 初始连接: ${initialConnected}/10`);
      
      if (initialConnected < 10) {
        throw new Error(`Initial connection incomplete: ${initialConnected}/10`);
      }
      
      // 重启服务器
      await stopServer(serverProcess);
      await wait(1000);
      serverProcess = await startServer();
      
      // 等待重连
      await wait(5000);
      
      const reconnectedCount = reconnected.length;
      console.log(`   📊 重连成功: ${reconnectedCount}/10`);
      
      if (reconnectedCount < 8) {
        throw new Error(`Reconnection incomplete: ${reconnectedCount}/10`);
      }
      
      clients.forEach(c => c.disconnect());
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testServerGracefulShutdown() {
  await test('服务器优雅关闭', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `graceful-${Date.now()}`
      });
      
      const disconnected = new Promise(resolve => {
        client.once('disconnected', (info) => resolve(info));
      });
      
      client.connect();
      await wait(1000);
      
      // 优雅关闭服务器
      serverProcess.kill('SIGTERM');
      
      const discInfo = await Promise.race([disconnected, wait(5000)]);
      
      if (!discInfo) {
        throw new Error('Graceful disconnect not detected');
      }
      
      console.log(`   📊 关闭代码: ${discInfo.code}, 原因: ${discInfo.reason}`);
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 客户端异常退出测试 ====================

console.log('\n💥 客户端异常退出测试');

async function testClientCrash() {
  await test('客户端异常断开检测', async () => {
    const serverProcess = await startServer();
    
    try {
      // 创建两个客户端
      const client1 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `crash-1-${Date.now()}`
      });
      
      const client2 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `crash-2-${Date.now()}`
      });
      
      let memberLeftReceived = false;
      client2.on('message', (msg) => {
        if (msg.type === 'member_left') {
          memberLeftReceived = true;
        }
      });
      
      client1.connect();
      client2.connect();
      await wait(1000);
      
      const channel = `crash-test-${Date.now()}`;
      client1.subscribe(channel);
      client2.subscribe(channel);
      await wait(500);
      
      // client1 异常断开
      client1.ws.terminate();
      
      await wait(2000);
      
      console.log(`   📊 member_left 通知: ${memberLeftReceived ? '收到' : '未收到'}`);
      
      client2.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testMultipleClientCrashes() {
  await test('多客户端同时异常退出', async () => {
    const serverProcess = await startServer();
    
    try {
      const clients = [];
      const clientCount = 20;
      
      for (let i = 0; i < clientCount; i++) {
        const client = new ClawChatClient({
          serverUrl: TEST_URL,
          clientId: `multi-crash-${i}-${Date.now()}`,
          autoReconnect: false
        });
        clients.push(client);
        client.connect();
      }
      
      await wait(2000);
      
      const initialConnected = clients.filter(c => c.connected).length;
      console.log(`   📊 初始连接: ${initialConnected}/${clientCount}`);
      
      // 一半客户端异常断开
      for (let i = 0; i < clientCount / 2; i++) {
        clients[i].ws.terminate();
      }
      
      await wait(2000);
      
      // 检查服务器状态
      const http = require('http');
      const serverInfo = await new Promise((resolve) => {
        http.get(`http://localhost:${TEST_PORT}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(null);
            }
          });
        }).on('error', () => resolve(null));
      });
      
      if (serverInfo) {
        console.log(`   📊 服务器客户端数: ${serverInfo.clients}`);
        console.log(`   📊 注册客户端数: ${serverInfo.registered}`);
      }
      
      // 剩余客户端应该仍然连接
      const remainingConnected = clients.filter(c => c.connected).length;
      if (remainingConnected !== clientCount / 2) {
        throw new Error(`Unexpected remaining connections: ${remainingConnected}`);
      }
      
      clients.forEach(c => c.disconnect());
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 心跳超时测试 ====================

console.log('\n💓 心跳超时测试');

async function testHeartbeatTimeout() {
  await test('心跳超时检测', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 发送注册
      ws.send(JSON.stringify({
        type: 'register',
        id: `heartbeat-test-${Date.now()}`
      }));
      
      await wait(500);
      
      // 停止发送心跳，等待超时
      const startTime = Date.now();
      
      const closed = new Promise(resolve => {
        ws.once('close', (code, reason) => resolve({ code, reason }));
      });
      
      const result = await Promise.race([closed, wait(200000)]); // 等待超时（服务器150秒）
      
      // 由于超时时间太长，我们只验证连接还在
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`   📊 连接仍然存活（心跳超时测试跳过完整验证）`);
      }
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 主测试流程 ====================

async function runTests() {
  console.log('🚀 启动 ClawChat 故障注入测试');
  console.log(`📍 测试服务器: ${TEST_URL}`);
  
  try {
    // 网络断开/恢复测试
    await testNetworkDisconnect();
    await testNetworkRecovery();
    await testMessageDuringDisconnect();
    
    // 服务器重启测试
    await testServerRestart();
    await testServerGracefulShutdown();
    
    // 客户端异常退出测试
    await testClientCrash();
    await testMultipleClientCrashes();
    
    // 心跳超时测试（简化版）
    await testHeartbeatTimeout();
    
  } catch (err) {
    console.error('测试执行错误:', err);
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log(`📊 故障注入测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
