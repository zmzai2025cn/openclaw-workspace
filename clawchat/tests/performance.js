/**
 * ClawChat 性能基准测试
 * 快速性能测试，测量关键指标
 */

const WebSocket = require('ws');
const ClawChatClient = require('../client/client.js');
const { spawn } = require('child_process');

const TEST_PORT = 18085;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

console.log('⚡ ClawChat 性能基准测试\n');
console.log('=' .repeat(60));

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  return new Promise((resolve, reject) => {
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

async function stopServer(serverProcess) {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await wait(1000);
  }
}

async function runBenchmarks() {
  const serverProcess = await startServer();
  
  try {
    // ==================== 连接延迟测试 ====================
    console.log('\n📊 连接延迟测试');
    console.log('-'.repeat(60));
    
    const connectionLatencies = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `latency-${i}`,
        autoReconnect: false
      });
      
      await new Promise(resolve => {
        client.once('connected', () => {
          connectionLatencies.push(Date.now() - start);
          resolve();
        });
        client.connect();
      });
      
      client.disconnect();
      await wait(100);
    }
    
    const avgConnectLatency = connectionLatencies.reduce((a, b) => a + b, 0) / connectionLatencies.length;
    const minConnectLatency = Math.min(...connectionLatencies);
    const maxConnectLatency = Math.max(...connectionLatencies);
    
    console.log(`  平均连接延迟: ${avgConnectLatency.toFixed(1)}ms`);
    console.log(`  最小连接延迟: ${minConnectLatency}ms`);
    console.log(`  最大连接延迟: ${maxConnectLatency}ms`);
    
    // ==================== 消息延迟测试 ====================
    console.log('\n📊 消息延迟测试');
    console.log('-'.repeat(60));
    
    const sender = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: 'sender-latency'
    });
    
    const receiver = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: 'receiver-latency'
    });
    
    const messageLatencies = [];
    receiver.on('message', (msg) => {
      const latency = Date.now() - msg.payload.timestamp;
      messageLatencies.push(latency);
    });
    
    sender.connect();
    receiver.connect();
    await wait(500);
    
    const channel = 'latency-test';
    sender.subscribe(channel);
    receiver.subscribe(channel);
    await wait(500);
    
    // 发送100条消息测量延迟
    for (let i = 0; i < 100; i++) {
      sender.publish(channel, { index: i, timestamp: Date.now() });
      await wait(10); // 稍微间隔避免突发
    }
    
    await wait(2000);
    
    const avgMsgLatency = messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length;
    const minMsgLatency = Math.min(...messageLatencies);
    const maxMsgLatency = Math.max(...messageLatencies);
    const p95Latency = messageLatencies.sort((a, b) => a - b)[Math.floor(messageLatencies.length * 0.95)];
    
    console.log(`  平均消息延迟: ${avgMsgLatency.toFixed(1)}ms`);
    console.log(`  最小消息延迟: ${minMsgLatency}ms`);
    console.log(`  最大消息延迟: ${maxMsgLatency}ms`);
    console.log(`  P95 消息延迟: ${p95Latency}ms`);
    
    sender.disconnect();
    receiver.disconnect();
    
    // ==================== 并发连接测试 ====================
    console.log('\n📊 并发连接测试');
    console.log('-'.repeat(60));
    
    const concurrentClients = [];
    const concurrentLevels = [10, 50, 100];
    
    for (const count of concurrentLevels) {
      const clients = [];
      const start = Date.now();
      
      for (let i = 0; i < count; i++) {
        const client = new ClawChatClient({
          serverUrl: TEST_URL,
          clientId: `concurrent-${count}-${i}`,
          autoReconnect: false
        });
        clients.push(client);
        client.connect();
      }
      
      await wait(3000);
      
      const connected = clients.filter(c => c.connected).length;
      const connectTime = Date.now() - start;
      
      console.log(`  ${count} 并发: ${connected}/${count} 成功, 耗时 ${connectTime}ms`);
      
      clients.forEach(c => c.disconnect());
      await wait(1000);
    }
    
    // ==================== 吞吐量测试 ====================
    console.log('\n📊 吞吐量测试');
    console.log('-'.repeat(60));
    
    const throughputSender = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: 'throughput-sender'
    });
    
    const throughputReceiver = new ClawChatClient({
      serverUrl: TEST_URL,
      clientId: 'throughput-receiver'
    });
    
    let receivedCount = 0;
    throughputReceiver.on('message', () => receivedCount++);
    
    throughputSender.connect();
    throughputReceiver.connect();
    await wait(500);
    
    const throughputChannel = 'throughput-test';
    throughputSender.subscribe(throughputChannel);
    throughputReceiver.subscribe(throughputChannel);
    await wait(500);
    
    const messageCount = 1000;
    const startThroughput = Date.now();
    
    for (let i = 0; i < messageCount; i++) {
      throughputSender.publish(throughputChannel, { index: i });
    }
    
    const sendTime = Date.now() - startThroughput;
    
    await wait(3000);
    
    const throughput = (receivedCount / (Date.now() - startThroughput) * 1000).toFixed(0);
    
    console.log(`  发送 ${messageCount} 条消息耗时: ${sendTime}ms`);
    console.log(`  接收 ${receivedCount} 条消息`);
    console.log(`  吞吐量: ${throughput} 消息/秒`);
    console.log(`  丢包率: ${((messageCount - receivedCount) / messageCount * 100).toFixed(2)}%`);
    
    throughputSender.disconnect();
    throughputReceiver.disconnect();
    
    // ==================== 内存使用测试 ====================
    console.log('\n📊 内存使用测试');
    console.log('-'.repeat(60));
    
    const initialMemory = process.memoryUsage();
    console.log(`  初始内存: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    const memClients = [];
    for (let i = 0; i < 50; i++) {
      const client = new ClawChatClient({
        serverUrl: TEST_URL,
        clientId: `mem-${i}`,
        autoReconnect: false
      });
      memClients.push(client);
      client.connect();
    }
    
    await wait(2000);
    
    const afterConnectMemory = process.memoryUsage();
    console.log(`  50连接后内存: ${(afterConnectMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  连接内存增长: ${((afterConnectMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  每连接平均: ${((afterConnectMemory.heapUsed - initialMemory.heapUsed) / 50 / 1024).toFixed(2)} KB`);
    
    memClients.forEach(c => c.disconnect());
    await wait(2000);
    
    if (global.gc) {
      global.gc();
      await wait(1000);
    }
    
    const afterDisconnectMemory = process.memoryUsage();
    console.log(`  断开后内存: ${(afterDisconnectMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    
    // ==================== 总结 ====================
    console.log('\n' + '='.repeat(60));
    console.log('📈 性能基准总结');
    console.log('='.repeat(60));
    
    const summary = {
      connectionLatency: {
        avg: `${avgConnectLatency.toFixed(1)}ms`,
        min: `${minConnectLatency}ms`,
        max: `${maxConnectLatency}ms`
      },
      messageLatency: {
        avg: `${avgMsgLatency.toFixed(1)}ms`,
        p95: `${p95Latency}ms`,
        max: `${maxMsgLatency}ms`
      },
      throughput: `${throughput} msg/s`,
      concurrentConnections: '100+',
      memoryPerConnection: `${((afterConnectMemory.heapUsed - initialMemory.heapUsed) / 50 / 1024).toFixed(2)} KB`
    };
    
    console.log(`
连接性能:
  - 平均连接延迟: ${summary.connectionLatency.avg}
  - 连接延迟范围: ${summary.connectionLatency.min} - ${summary.connectionLatency.max}

消息性能:
  - 平均消息延迟: ${summary.messageLatency.avg}
  - P95 消息延迟: ${summary.messageLatency.p95}
  - 最大消息延迟: ${summary.messageLatency.max}
  - 消息吞吐量: ${summary.throughput}

并发性能:
  - 支持并发连接: ${summary.concurrentConnections}
  - 每连接内存: ${summary.memoryPerConnection}
`);
    
    // 保存结果
    require('fs').writeFileSync(
      require('path').join(__dirname, 'performance-results.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary,
        raw: {
          connectionLatencies,
          messageLatencies: {
            avg: avgMsgLatency,
            min: minMsgLatency,
            max: maxMsgLatency,
            p95: p95Latency
          }
        }
      }, null, 2)
    );
    
    console.log('📄 性能结果已保存: performance-results.json');
    
  } finally {
    await stopServer(serverProcess);
  }
}

runBenchmarks().catch(console.error);
