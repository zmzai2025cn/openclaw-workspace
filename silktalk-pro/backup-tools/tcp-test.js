#!/usr/bin/env node
/**
 * tcp-test.js - 原生TCP连接测试
 * 用于测试基本的TCP连通性
 */

const net = require('net');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 服务器模式
function startServer(port = 9001, host = '0.0.0.0') {
  const server = net.createServer((socket) => {
    const clientInfo = `${socket.remoteAddress}:${socket.remotePort}`;
    log(`新客户端连接: ${clientInfo}`, 'green');
    
    // 发送欢迎消息
    socket.write(JSON.stringify({
      type: 'welcome',
      message: 'SilkTalk TCP Test Server',
      timestamp: Date.now()
    }) + '\n');
    
    socket.on('data', (data) => {
      const message = data.toString().trim();
      log(`收到来自 ${clientInfo}: ${message.substring(0, 100)}`, 'cyan');
      
      // 回复
      socket.write(JSON.stringify({
        type: 'response',
        received: message,
        timestamp: Date.now()
      }) + '\n');
    });
    
    socket.on('close', () => {
      log(`客户端断开: ${clientInfo}`, 'yellow');
    });
    
    socket.on('error', (err) => {
      log(`客户端错误 ${clientInfo}: ${err.message}`, 'red');
    });
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log(`端口 ${port} 已被占用`, 'red');
    } else {
      log(`服务器错误: ${err.message}`, 'red');
    }
    process.exit(1);
  });
  
  server.listen(port, host, () => {
    log('========================================', 'blue');
    log('  SilkTalk TCP 测试服务器', 'blue');
    log('========================================', 'blue');
    log(`监听: ${host}:${port}`, 'green');
    log('', 'reset');
    log('命令:', 'yellow');
    log(`  客户端: node tcp-test.js client <host> ${port}`, 'reset');
    log(`  测试连接: node tcp-test.js test <host> ${port}`, 'reset');
    log('========================================', 'blue');
  });
  
  // 优雅关闭
  process.on('SIGINT', () => {
    log('\n正在关闭服务器...', 'yellow');
    server.close(() => {
      process.exit(0);
    });
  });
}

// 客户端模式
function startClient(host, port) {
  log(`连接到 ${host}:${port}...`, 'blue');
  
  const client = net.createConnection({ host, port }, () => {
    log('已连接到服务器!', 'green');
    
    // 发送测试消息
    const sendMessage = () => {
      const message = JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        data: 'Hello from TCP client'
      });
      client.write(message + '\n');
      log(`发送: ${message}`, 'cyan');
    };
    
    // 立即发送一条
    sendMessage();
    
    // 每5秒发送一条
    const interval = setInterval(sendMessage, 5000);
    
    client.on('close', () => {
      clearInterval(interval);
    });
  });
  
  let buffer = '';
  client.on('data', (data) => {
    buffer += data.toString();
    
    // 处理按行分割的JSON
    let lines = buffer.split('\n');
    buffer = lines.pop(); // 保留不完整的行
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const msg = JSON.parse(line);
          log(`收到: ${JSON.stringify(msg, null, 2)}`, 'green');
        } catch (e) {
          log(`收到(原始): ${line}`, 'cyan');
        }
      }
    }
  });
  
  client.on('error', (err) => {
    log(`连接错误: ${err.message}`, 'red');
    process.exit(1);
  });
  
  client.on('close', () => {
    log('连接已关闭', 'yellow');
    process.exit(0);
  });
  
  // 交互模式
  process.stdin.on('data', (data) => {
    const input = data.toString().trim();
    if (input && client.writable) {
      client.write(input + '\n');
    }
  });
  
  process.on('SIGINT', () => {
    log('\n正在断开...', 'yellow');
    client.end();
  });
}

// 简单连接测试
function testConnection(host, port, timeout = 5000) {
  log(`测试连接到 ${host}:${port}...`, 'blue');
  
  const startTime = Date.now();
  const socket = net.createConnection({ host, port });
  
  socket.setTimeout(timeout);
  
  socket.on('connect', () => {
    const latency = Date.now() - startTime;
    log(`✓ 连接成功! 延迟: ${latency}ms`, 'green');
    socket.end();
  });
  
  socket.on('timeout', () => {
    log(`✗ 连接超时 (${timeout}ms)`, 'red');
    socket.destroy();
    process.exit(1);
  });
  
  socket.on('error', (err) => {
    log(`✗ 连接失败: ${err.message}`, 'red');
    process.exit(1);
  });
  
  socket.on('close', () => {
    process.exit(0);
  });
}

// 端口扫描
function scanPorts(host, startPort = 1, endPort = 1000) {
  log(`扫描 ${host} 的端口 ${startPort}-${endPort}...`, 'blue');
  
  const openPorts = [];
  let checked = 0;
  const total = endPort - startPort + 1;
  
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        log(`  端口 ${port} 开放`, 'green');
        openPorts.push(port);
        socket.destroy();
        resolve();
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve();
      });
      
      socket.on('error', () => {
        resolve();
      });
    });
  };
  
  // 并发扫描
  const scan = async () => {
    const batch = [];
    for (let port = startPort; port <= endPort; port++) {
      batch.push(checkPort(port));
      
      if (batch.length >= 50 || port === endPort) {
        await Promise.all(batch);
        batch.length = 0;
        checked = port - startPort + 1;
        process.stdout.write(`\r进度: ${checked}/${total} (${Math.round(checked/total*100)}%)`);
      }
    }
    
    console.log('');
    log('\n========================================', 'blue');
    log(`扫描完成! 发现 ${openPorts.length} 个开放端口:`, 'blue');
    openPorts.forEach(p => log(`  ${p}`, 'green'));
    log('========================================', 'blue');
    process.exit(0);
  };
  
  scan();
}

// 主程序
const command = process.argv[2];

switch (command) {
  case 'server':
    startServer(process.argv[3] || 9001, process.argv[4] || '0.0.0.0');
    break;
    
  case 'client':
    if (!process.argv[3]) {
      log('用法: node tcp-test.js client <host> [port]', 'yellow');
      process.exit(1);
    }
    startClient(process.argv[3], process.argv[4] || 9001);
    break;
    
  case 'test':
    if (!process.argv[3]) {
      log('用法: node tcp-test.js test <host> [port]', 'yellow');
      process.exit(1);
    }
    testConnection(process.argv[3], process.argv[4] || 9001);
    break;
    
  case 'scan':
    scanPorts(
      process.argv[3] || '127.0.0.1',
      parseInt(process.argv[4]) || 1,
      parseInt(process.argv[5]) || 1000
    );
    break;
    
  default:
    log('========================================', 'blue');
    log('  SilkTalk TCP 测试工具', 'blue');
    log('========================================', 'blue');
    log('', 'reset');
    log('用法:', 'yellow');
    log('  node tcp-test.js server [port] [host]  - 启动服务器', 'reset');
    log('  node tcp-test.js client <host> [port]  - 连接客户端', 'reset');
    log('  node tcp-test.js test <host> [port]    - 测试连接', 'reset');
    log('  node tcp-test.js scan <host> [start] [end] - 端口扫描', 'reset');
    log('', 'reset');
    log('示例:', 'yellow');
    log('  node tcp-test.js server 9001', 'reset');
    log('  node tcp-test.js client localhost 9001', 'reset');
    log('  node tcp-test.js scan localhost 1 1000', 'reset');
    log('========================================', 'blue');
    process.exit(0);
}
