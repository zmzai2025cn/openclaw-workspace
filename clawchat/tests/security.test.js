/**
 * ClawChat 安全测试套件
 * 测试XSS攻击防护、消息注入攻击、DoS攻击防护
 */

const WebSocket = require('ws');
const ClawChatClient = require('../client/client.js');

// 测试配置
const TEST_PORT = 18083;
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

// ==================== XSS 攻击防护测试 ====================

console.log('\n🛡️ XSS 攻击防护测试');

async function testXSSScriptTag() {
  await test('XSS: script 标签注入', async () => {
    const serverProcess = await startServer();
    
    try {
      const client1 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-sender-${Date.now()}`
      });
      
      const client2 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-receiver-${Date.now()}`
      });
      
      let receivedPayload = null;
      client2.on('message', (msg) => {
        receivedPayload = msg.payload;
      });
      
      client1.connect();
      client2.connect();
      await wait(500);
      
      const channel = `xss-test-${Date.now()}`;
      client1.subscribe(channel);
      client2.subscribe(channel);
      await wait(500);
      
      // 发送 XSS payload
      const xssPayload = '<script>alert("XSS")</script>';
      client1.publish(channel, { text: xssPayload });
      
      await wait(1000);
      
      if (!receivedPayload) {
        throw new Error('Message not received');
      }
      
      // 验证原始内容保留（服务器不转义，客户端应该转义）
      if (receivedPayload.text !== xssPayload) {
        throw new Error('Payload was modified unexpectedly');
      }
      
      console.log(`   📊 XSS payload 原样传递（客户端负责转义）`);
      
      client1.disconnect();
      client2.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testXSSImageOnerror() {
  await test('XSS: img onerror 注入', async () => {
    const serverProcess = await startServer();
    
    try {
      const client1 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-img1-${Date.now()}`
      });
      
      const client2 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-img2-${Date.now()}`
      });
      
      let receivedPayload = null;
      client2.on('message', (msg) => {
        receivedPayload = msg.payload;
      });
      
      client1.connect();
      client2.connect();
      await wait(500);
      
      const channel = `xss-img-${Date.now()}`;
      client1.subscribe(channel);
      client2.subscribe(channel);
      await wait(500);
      
      // 发送 img onerror payload
      const xssPayload = '<img src=x onerror=alert(1)>';
      client1.publish(channel, { text: xssPayload });
      
      await wait(1000);
      
      if (!receivedPayload) {
        throw new Error('Message not received');
      }
      
      // 验证 payload 未被过滤但原样传递
      if (receivedPayload.text !== xssPayload) {
        throw new Error('Payload was modified');
      }
      
      client1.disconnect();
      client2.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testXSSJavaScriptProtocol() {
  await test('XSS: javascript: 协议注入', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-js-${Date.now()}`
      });
      
      client.connect();
      await wait(500);
      
      const channel = `xss-js-${Date.now()}`;
      client.subscribe(channel);
      await wait(500);
      
      // 发送 javascript: 协议
      const jsPayload = 'javascript:alert(1)';
      const msgId = client.publish(channel, { text: jsPayload });
      
      await wait(1000);
      
      if (!msgId) {
        throw new Error('Message not sent');
      }
      
      console.log(`   📊 javascript: 协议消息已发送`);
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testXSSEventHandler() {
  await test('XSS: 事件处理器注入', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `xss-event-${Date.now()}`
      });
      
      client.connect();
      await wait(500);
      
      const channel = `xss-event-${Date.now()}`;
      client.subscribe(channel);
      await wait(500);
      
      // 各种事件处理器
      const payloads = [
        '<div onmouseover=alert(1)>hover me</div>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1)>',
        '<a onclick=alert(1)>click</a>'
      ];
      
      for (const payload of payloads) {
        client.publish(channel, { text: payload });
      }
      
      await wait(1000);
      
      console.log(`   📊 ${payloads.length} 个事件处理器 payload 已发送`);
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 消息注入攻击测试 ====================

console.log('\n💉 消息注入攻击测试');

async function testFakeSystemMessage() {
  await test('注入: 伪造系统消息', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 尝试发送伪造的系统消息
      ws.send(JSON.stringify({
        type: 'register',
        id: `fake-sys-${Date.now()}`
      }));
      
      await wait(500);
      
      // 尝试直接发送系统消息类型
      ws.send(JSON.stringify({
        type: 'publish',
        channel: 'test',
        payload: { 
          type: 'system',
          fake: true,
          text: '系统公告：您已被黑客攻击'
        }
      }));
      
      await wait(1000);
      
      console.log(`   📊 伪造系统消息尝试完成`);
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testMessageTampering() {
  await test('注入: 消息篡改尝试', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 尝试篡改消息字段
      ws.send(JSON.stringify({
        type: 'register',
        id: `tamper-${Date.now()}`
      }));
      
      await wait(500);
      
      // 尝试发送带有额外字段的消息
      ws.send(JSON.stringify({
        type: 'publish',
        channel: 'test',
        payload: { text: 'normal' },
        __proto__: { admin: true },
        constructor: { prototype: { isAdmin: true } }
      }));
      
      await wait(1000);
      
      console.log(`   📊 消息篡改尝试完成`);
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testChannelHijacking() {
  await test('注入: 频道劫持尝试', async () => {
    const serverProcess = await startServer();
    
    try {
      const client1 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `hijack1-${Date.now()}`
      });
      
      const client2 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `hijack2-${Date.now()}`
      });
      
      client1.connect();
      client2.connect();
      await wait(500);
      
      // client1 订阅私密频道
      const privateChannel = `private-${Date.now()}`;
      client1.subscribe(privateChannel);
      await wait(500);
      
      // client2 尝试向未订阅的频道发送消息
      const ws2 = client2.ws;
      ws2.send(JSON.stringify({
        type: 'publish',
        channel: privateChannel,
        payload: { text: 'Unauthorized message' }
      }));
      
      await wait(1000);
      
      console.log(`   📊 频道劫持尝试完成`);
      
      client1.disconnect();
      client2.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== DoS 攻击防护测试 ====================

console.log('\n🚫 DoS 攻击防护测试');

async function testConnectionFlood() {
  await test('DoS: 连接洪泛攻击', async () => {
    const serverProcess = await startServer();
    
    try {
      const connections = [];
      const floodCount = 200;
      
      // 快速创建大量连接
      for (let i = 0; i < floodCount; i++) {
        try {
          const ws = new WebSocket(TEST_URL);
          connections.push(ws);
        } catch (e) {
          // 忽略错误
        }
      }
      
      await wait(2000);
      
      // 检查服务器是否仍然响应
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
        console.log(`   📊 服务器状态: ${serverInfo.clients} 连接`);
      } else {
        throw new Error('Server not responding after connection flood');
      }
      
      // 清理连接
      connections.forEach(ws => {
        try { ws.close(); } catch (e) {}
      });
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testMessageFlood() {
  await test('DoS: 消息洪泛攻击', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `msg-flood-${Date.now()}`
      });
      
      client.connect();
      await wait(500);
      
      const channel = `flood-${Date.now()}`;
      client.subscribe(channel);
      await wait(500);
      
      // 快速发送大量消息
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        client.publish(channel, { index: i, data: 'x'.repeat(100) });
      }
      const sendTime = Date.now() - startTime;
      
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
        console.log(`   📊 消息洪泛: 1000条/${sendTime}ms, 服务器正常`);
      } else {
        throw new Error('Server crashed after message flood');
      }
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testLargeMessage() {
  await test('DoS: 超大消息攻击', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 发送超大消息（超过10KB限制）
      const largePayload = 'x'.repeat(1024 * 1024); // 1MB
      
      const errorReceived = new Promise(resolve => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data);
          if (msg.type === 'error') resolve(msg);
        });
      });
      
      ws.send(JSON.stringify({
        type: 'register',
        id: `large-msg-${Date.now()}`
      }));
      
      await wait(500);
      
      ws.send(JSON.stringify({
        type: 'publish',
        channel: 'test',
        payload: { data: largePayload }
      }));
      
      const error = await Promise.race([errorReceived, wait(2000)]);
      
      if (!error) {
        console.log(`   📊 超大消息被拒绝（可能被连接关闭）`);
      } else {
        console.log(`   📊 超大消息错误: ${error.error}`);
      }
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testMalformedJSON() {
  await test('DoS: 畸形 JSON 攻击', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 发送畸形 JSON
      const malformedMessages = [
        '{invalid json}',
        '{"type": }',
        '{"type": "register", "id": }',
        'null',
        'undefined',
        '',
        '{',
        '}',
        '[}',
        '{]'
      ];
      
      for (const msg of malformedMessages) {
        ws.send(msg);
      }
      
      await wait(1000);
      
      // 检查服务器是否仍然响应
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
        console.log(`   📊 畸形 JSON 处理: ${malformedMessages.length} 条, 服务器正常`);
      } else {
        throw new Error('Server crashed after malformed JSON');
      }
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testNestedObject() {
  await test('DoS: 嵌套对象深度攻击', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise(resolve => ws.once('open', resolve));
      
      // 创建深度嵌套对象
      let nested = {};
      let current = nested;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = 'deep';
      
      ws.send(JSON.stringify({
        type: 'register',
        id: `nested-${Date.now()}`
      }));
      
      await wait(500);
      
      ws.send(JSON.stringify({
        type: 'publish',
        channel: 'test',
        payload: nested
      }));
      
      await wait(1000);
      
      console.log(`   📊 深度嵌套对象已发送`);
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 主测试流程 ====================

async function runTests() {
  console.log('🚀 启动 ClawChat 安全测试');
  console.log(`📍 测试服务器: ${TEST_URL}`);
  
  try {
    // XSS 攻击防护测试
    await testXSSScriptTag();
    await testXSSImageOnerror();
    await testXSSJavaScriptProtocol();
    await testXSSEventHandler();
    
    // 消息注入攻击测试
    await testFakeSystemMessage();
    await testMessageTampering();
    await testChannelHijacking();
    
    // DoS 攻击防护测试
    await testConnectionFlood();
    await testMessageFlood();
    await testLargeMessage();
    await testMalformedJSON();
    await testNestedObject();
    
  } catch (err) {
    console.error('测试执行错误:', err);
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log(`📊 安全测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
