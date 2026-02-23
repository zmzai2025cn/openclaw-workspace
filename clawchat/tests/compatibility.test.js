/**
 * ClawChat 兼容性测试套件
 * 测试不同浏览器、Node.js版本、WebSocket协议版本
 */

const WebSocket = require('ws');
const http = require('http');
const ClawChatClient = require('../client/client.js');

// 测试配置
const TEST_PORT = 18084;
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

// ==================== Node.js 版本兼容性 ====================

console.log('\n🟢 Node.js 版本兼容性测试');

async function testNodeVersion() {
  await test(`Node.js 版本: ${process.version}`, async () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    // 检查 Node.js 版本 >= 14
    if (major < 14) {
      throw new Error(`Node.js version ${version} is too old, requires >= 14`);
    }
    
    console.log(`   📊 主版本: ${major}, 完整版本: ${version}`);
    
    // 检查必需模块
    const requiredModules = ['ws', 'uuid', 'http', 'events'];
    for (const mod of requiredModules) {
      try {
        require(mod);
      } catch (e) {
        throw new Error(`Required module '${mod}' not available`);
      }
    }
  });
}

async function testModuleCompatibility() {
  await test('模块兼容性检查', async () => {
    const serverProcess = await startServer();
    
    try {
      // 测试 WebSocket 模块
      const WebSocket = require('ws');
      const ws = new WebSocket(TEST_URL);
      
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      
      ws.close();
      
      // 测试 uuid 模块
      const { v4: uuidv4 } = require('uuid');
      const uuid = uuidv4();
      if (!uuid || uuid.length !== 36) {
        throw new Error('UUID generation failed');
      }
      
      console.log(`   📊 WebSocket 版本: ${require('ws/package.json').version}`);
      console.log(`   📊 UUID 版本: ${require('uuid/package.json').version}`);
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== WebSocket 协议版本测试 ====================

console.log('\n🔌 WebSocket 协议版本测试');

async function testWebSocketProtocol() {
  await test('WebSocket 协议握手', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      const protocol = ws.protocol;
      const extensions = ws.extensions;
      
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      
      console.log(`   📊 WebSocket 协议: ${protocol || 'default'}`);
      console.log(`   📊 扩展: ${extensions || 'none'}`);
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testWebSocketSubprotocol() {
  await test('WebSocket 子协议协商', async () => {
    const serverProcess = await startServer();
    
    try {
      // 测试带子协议的连接
      const ws = new WebSocket(TEST_URL, ['chat', 'superchat']);
      
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      
      // 服务器应该接受连接（忽略子协议）
      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket with subprotocol not accepted');
      }
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testBinaryMessage() {
  await test('二进制消息处理', async () => {
    const serverProcess = await startServer();
    
    try {
      const ws = new WebSocket(TEST_URL);
      
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      
      // 发送二进制数据（服务器应该处理或拒绝）
      const binaryData = Buffer.from('binary test data');
      ws.send(binaryData);
      
      await wait(500);
      
      // 服务器应该仍然响应
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
      
      if (!serverInfo) {
        throw new Error('Server crashed after binary message');
      }
      
      ws.close();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== HTTP API 兼容性 ====================

console.log('\n🌐 HTTP API 兼容性测试');

async function testHealthEndpoint() {
  await test('健康检查端点', async () => {
    const serverProcess = await startServer();
    
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${TEST_PORT}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          });
        }).on('error', reject);
      });
      
      if (response.statusCode !== 200) {
        throw new Error(`Health endpoint returned ${response.statusCode}`);
      }
      
      const body = JSON.parse(response.body);
      if (!body.status || !body.version) {
        throw new Error('Health endpoint missing required fields');
      }
      
      console.log(`   📊 状态: ${body.status}`);
      console.log(`   📊 版本: ${body.version}`);
      console.log(`   📊 客户端数: ${body.clients}`);
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testCORSHeaders() {
  await test('CORS 头检查', async () => {
    const serverProcess = await startServer();
    
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${TEST_PORT}`, (res) => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers
          });
        }).on('error', reject);
      });
      
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        console.log(`   ⚠️ Content-Type: ${contentType} (建议: application/json)`);
      } else {
        console.log(`   📊 Content-Type: ${contentType}`);
      }
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 客户端配置兼容性 ====================

console.log('\n⚙️ 客户端配置兼容性测试');

async function testClientConfigVariations() {
  await test('不同客户端配置', async () => {
    const serverProcess = await startServer();
    
    try {
      const configs = [
        { reconnectDelay: 100 },
        { reconnectDelay: 5000 },
        { maxReconnectDelay: 1000 },
        { maxReconnectDelay: 300000 },
        { connectionTimeout: 1000 },
        { connectionTimeout: 60000 },
        { maxMessageSize: 1024 },
        { maxMessageSize: 102400 },
        { autoReconnect: true },
        { autoReconnect: false }
      ];
      
      for (const config of configs) {
        const client = new ClawChatClient({
          serverUrl: TEST_URL,
          clientId: `config-test-${Date.now()}`,
          ...config
        });
        
        client.connect();
        await wait(300);
        
        if (!client.connected && config.autoReconnect !== false) {
          throw new Error(`Config failed: ${JSON.stringify(config)}`);
        }
        
        client.disconnect();
        await wait(100);
      }
      
      console.log(`   📊 测试配置数: ${configs.length}`);
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testUnicodeSupport() {
  await test('Unicode 字符支持', async () => {
    const serverProcess = await startServer();
    
    try {
      const client1 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `unicode-发送者-🚀-${Date.now()}`
      });
      
      const client2 = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `unicode-接收者-🎉-${Date.now()}`
      });
      
      let receivedPayload = null;
      client2.on('message', (msg) => {
        receivedPayload = msg.payload;
      });
      
      client1.connect();
      client2.connect();
      await wait(500);
      
      const channel = `unicode-频道-🌟-${Date.now()}`;
      client1.subscribe(channel);
      client2.subscribe(channel);
      await wait(500);
      
      // 发送各种 Unicode 字符
      const unicodeMessages = [
        { text: '中文测试' },
        { text: '日本語テスト' },
        { text: '한국어 테스트' },
        { text: 'العربية' },
        { text: '🚀🎉🌟💻🔥' },
        { text: 'Café résumé naïve' },
        { text: 'Москва Россия' }
      ];
      
      for (const msg of unicodeMessages) {
        client1.publish(channel, msg);
      }
      
      await wait(1000);
      
      console.log(`   📊 Unicode 消息测试: ${unicodeMessages.length} 条`);
      
      client1.disconnect();
      client2.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

async function testSpecialCharacters() {
  await test('特殊字符处理', async () => {
    const serverProcess = await startServer();
    
    try {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `special-${Date.now()}`
      });
      
      client.connect();
      await wait(500);
      
      const channel = `special-${Date.now()}`;
      client.subscribe(channel);
      await wait(500);
      
      // 发送特殊字符
      const specialMessages = [
        { text: 'Line 1\nLine 2\nLine 3' },
        { text: 'Tab\there' },
        { text: 'Quote: "test" and \'test\'' },
        { text: 'Backslash: \\path\\to\\file' },
        { text: 'Null: \u0000' },
        { text: 'Control: \u0001\u0002\u0003' },
        { text: 'Emoji: 👨‍👩‍👧‍👦 (family)' }
      ];
      
      for (const msg of specialMessages) {
        client.publish(channel, msg);
      }
      
      await wait(1000);
      
      console.log(`   📊 特殊字符测试: ${specialMessages.length} 条`);
      
      client.disconnect();
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 浏览器兼容性模拟 ====================

console.log('\n🌍 浏览器兼容性模拟测试');

async function testBrowserUserAgents() {
  await test('不同 User-Agent', async () => {
    const serverProcess = await startServer();
    
    try {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (Android 10; Mobile; rv:83.0) Gecko/83.0 Firefox/83.0'
      ];
      
      for (const ua of userAgents) {
        const ws = new WebSocket(TEST_URL, {
          headers: { 'User-Agent': ua }
        });
        
        await new Promise((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        
        ws.close();
        await wait(50);
      }
      
      console.log(`   📊 User-Agent 测试: ${userAgents.length} 个`);
    } finally {
      await stopServer(serverProcess);
    }
  });
}

// ==================== 主测试流程 ====================

async function runTests() {
  console.log('🚀 启动 ClawChat 兼容性测试');
  console.log(`📍 测试服务器: ${TEST_URL}`);
  console.log(`📍 Node.js 版本: ${process.version}`);
  
  try {
    // Node.js 版本兼容性
    await testNodeVersion();
    await testModuleCompatibility();
    
    // WebSocket 协议版本
    await testWebSocketProtocol();
    await testWebSocketSubprotocol();
    await testBinaryMessage();
    
    // HTTP API 兼容性
    await testHealthEndpoint();
    await testCORSHeaders();
    
    // 客户端配置兼容性
    await testClientConfigVariations();
    await testUnicodeSupport();
    await testSpecialCharacters();
    
    // 浏览器兼容性模拟
    await testBrowserUserAgents();
    
  } catch (err) {
    console.error('测试执行错误:', err);
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log(`📊 兼容性测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
    console.log('='.repeat(50));
    
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTests();
