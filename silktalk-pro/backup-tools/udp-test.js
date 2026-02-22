#!/usr/bin/env node
/**
 * udp-test.js - UDP打洞测试
 * 用于测试UDP连通性和NAT穿透
 */

const dgram = require('dgram');
const crypto = require('crypto');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// STUN服务器列表
const STUN_SERVERS = [
  { host: 'stun.l.google.com', port: 19302 },
  { host: 'stun1.l.google.com', port: 19302 },
  { host: 'stun2.l.google.com', port: 19302 },
  { host: 'stun.cloudflare.com', port: 3478 },
  { host: 'stun.miwifi.com', port: 3478 }
];

// 简单的STUN绑定请求 (RFC 5389)
function createStunRequest() {
  // STUN消息头: 2字节类型 + 2字节长度 + 4字节魔法cookie + 12字节事务ID
  const header = Buffer.alloc(20);
  header.writeUInt16BE(0x0001, 0); // 绑定请求
  header.writeUInt16BE(0, 2); // 消息长度
  header.writeUInt32BE(0x2112A442, 4); // 魔法cookie
  
  // 随机事务ID
  const txId = crypto.randomBytes(12);
  txId.copy(header, 8);
  
  return { buffer: header, txId };
}

// 解析STUN响应
function parseStunResponse(buffer) {
  if (buffer.length < 20) return null;
  
  const type = buffer.readUInt16BE(0);
  const length = buffer.readUInt16BE(2);
  const cookie = buffer.readUInt32BE(4);
  
  if (cookie !== 0x2112A442) return null;
  
  const attrs = {};
  let offset = 20;
  
  while (offset < buffer.length) {
    const attrType = buffer.readUInt16BE(offset);
    const attrLen = buffer.readUInt16BE(offset + 2);
    
    // XOR-MAPPED-ADDRESS (0x0020)
    if (attrType === 0x0020 && attrLen >= 8) {
      const family = buffer.readUInt8(offset + 5);
      const xPort = buffer.readUInt16BE(offset + 6);
      const port = xPort ^ 0x2112;
      
      if (family === 0x01) { // IPv4
        const xAddr = buffer.readUInt32BE(offset + 8);
        const addr = [
          (xAddr >> 24) & 0xFF ^ 0x21,
          (xAddr >> 16) & 0xFF ^ 0x12,
          (xAddr >> 8) & 0xFF ^ 0xA4,
          xAddr & 0xFF ^ 0x42
        ].join('.');
        attrs.mappedAddress = { address: addr, port };
      }
    }
    
    offset += 4 + attrLen;
    // 对齐到4字节边界
    if (offset % 4 !== 0) offset += 4 - (offset % 4);
  }
  
  return { type, attrs };
}

// STUN测试
async function stunTest() {
  log('========================================', 'blue');
  log('  UDP/STUN 测试', 'blue');
  log('========================================', 'blue');
  
  const socket = dgram.createSocket('udp4');
  
  return new Promise((resolve) => {
    let completed = 0;
    const results = [];
    
    socket.on('message', (msg, rinfo) => {
      const response = parseStunResponse(msg);
      if (response && response.attrs.mappedAddress) {
        const { address, port } = response.attrs.mappedAddress;
        log(`  ✓ ${rinfo.address}:${rinfo.port} -> 公网: ${address}:${port}`, 'green');
        results.push({ server: rinfo, public: { address, port } });
      }
      completed++;
      if (completed >= STUN_SERVERS.length) {
        socket.close();
        resolve(results);
      }
    });
    
    socket.on('error', (err) => {
      log(`Socket错误: ${err.message}`, 'red');
    });
    
    socket.bind(() => {
      const localPort = socket.address().port;
      log(`本地UDP端口: ${localPort}`, 'cyan');
      log('', 'reset');
      log('测试STUN服务器...', 'yellow');
      
      // 向所有STUN服务器发送请求
      STUN_SERVERS.forEach((server, index) => {
        const { buffer } = createStunRequest();
        socket.send(buffer, server.port, server.host, (err) => {
          if (err) {
            log(`  ✗ ${server.host}:${server.port} - 发送失败`, 'red');
            completed++;
          }
        });
        
        // 超时处理
        setTimeout(() => {
          if (completed <= index) {
            log(`  ✗ ${server.host}:${server.port} - 超时`, 'red');
            completed++;
            if (completed >= STUN_SERVERS.length) {
              socket.close();
              resolve(results);
            }
          }
        }, 3000);
      });
    });
  });
}

// UDP服务器
function startServer(port = 9002) {
  const socket = dgram.createSocket('udp4');
  const clients = new Map();
  
  socket.on('message', (msg, rinfo) => {
    const clientKey = `${rinfo.address}:${rinfo.port}`;
    const message = msg.toString();
    
    log(`收到来自 ${clientKey}: ${message.substring(0, 100)}`, 'cyan');
    
    // 存储客户端信息
    if (!clients.has(clientKey)) {
      clients.set(clientKey, rinfo);
      log(`新客户端: ${clientKey}`, 'green');
    }
    
    // 尝试解析JSON
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        // 注册请求 - 返回所有已知客户端
        const response = {
          type: 'registered',
          yourAddress: rinfo.address,
          yourPort: rinfo.port,
          peers: Array.from(clients.keys()).filter(k => k !== clientKey)
        };
        socket.send(JSON.stringify(response), rinfo.port, rinfo.address);
        
      } else if (data.type === 'punch') {
        // 打洞请求 - 转发给目标
        const target = data.target;
        if (target && clients.has(target)) {
          const targetInfo = clients.get(target);
          socket.send(JSON.stringify({
            type: 'punch_request',
            from: clientKey,
            fromAddress: rinfo.address,
            fromPort: rinfo.port
          }), targetInfo.port, targetInfo.address);
          
          log(`转发打洞请求: ${clientKey} -> ${target}`, 'yellow');
        }
        
      } else if (data.type === 'ping') {
        // 心跳
        socket.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          serverTime: new Date().toISOString()
        }), rinfo.port, rinfo.address);
      }
    } catch (e) {
      // 非JSON消息，直接回复
      socket.send(`Echo: ${message}`, rinfo.port, rinfo.address);
    }
  });
  
  socket.on('error', (err) => {
    log(`服务器错误: ${err.message}`, 'red');
  });
  
  socket.bind(port, () => {
    log('========================================', 'blue');
    log('  UDP 打洞测试服务器', 'blue');
    log('========================================', 'blue');
    log(`监听端口: ${port}`, 'green');
    log('', 'reset');
    log('命令:', 'yellow');
    log(`  客户端: node udp-test.js client <服务器IP> ${port}`, 'reset');
    log(`  打洞测试: node udp-test.js punch <服务器IP> ${port} <目标ID>`, 'reset');
    log('========================================', 'blue');
  });
  
  process.on('SIGINT', () => {
    log('\n正在关闭服务器...', 'yellow');
    socket.close();
    process.exit(0);
  });
}

// UDP客户端
function startClient(serverHost, serverPort) {
  const socket = dgram.createSocket('udp4');
  
  log(`连接到服务器 ${serverHost}:${serverPort}...`, 'blue');
  
  socket.on('message', (msg, rinfo) => {
    const message = msg.toString();
    log(`收到: ${message}`, 'green');
    
    try {
      const data = JSON.parse(message);
      if (data.type === 'punch_request') {
        log(`收到打洞请求来自: ${data.from}`, 'yellow');
        // 回复打洞
        socket.send(JSON.stringify({
          type: 'punch_response',
          to: data.from
        }), data.fromPort, data.fromAddress);
      }
    } catch (e) {
      // 忽略解析错误
    }
  });
  
  socket.on('error', (err) => {
    log(`错误: ${err.message}`, 'red');
  });
  
  socket.bind(() => {
    const localPort = socket.address().port;
    log(`本地端口: ${localPort}`, 'cyan');
    
    // 注册到服务器
    socket.send(JSON.stringify({
      type: 'register',
      timestamp: Date.now()
    }), serverPort, serverHost);
    
    // 定期心跳
    setInterval(() => {
      socket.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }), serverPort, serverHost);
    }, 5000);
  });
  
  process.on('SIGINT', () => {
    log('\n正在断开...', 'yellow');
    socket.close();
    process.exit(0);
  });
}

// 打洞测试
function punchTest(serverHost, serverPort, targetId) {
  const socket = dgram.createSocket('udp4');
  
  log(`打洞测试: 目标=${targetId}`, 'blue');
  
  socket.on('message', (msg, rinfo) => {
    log(`收到来自 ${rinfo.address}:${rinfo.port}: ${msg}`, 'green');
  });
  
  socket.bind(() => {
    // 发送打洞请求
    socket.send(JSON.stringify({
      type: 'punch',
      target: targetId,
      timestamp: Date.now()
    }), serverPort, serverHost);
    
    log('打洞请求已发送', 'yellow');
    
    // 同时直接尝试连接目标
    if (targetId.includes(':')) {
      const [host, port] = targetId.split(':');
      setTimeout(() => {
        log(`直接发送打洞包到 ${host}:${port}...`, 'cyan');
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            socket.send(JSON.stringify({
              type: 'direct_punch',
              from: 'initiator',
              attempt: i + 1
            }), parseInt(port), host);
          }, i * 200);
        }
      }, 1000);
    }
  });
  
  setTimeout(() => {
    log('测试完成', 'blue');
    socket.close();
    process.exit(0);
  }, 10000);
}

// 主程序
const command = process.argv[2];

switch (command) {
  case 'stun':
    stunTest().then(results => {
      log('\n========================================', 'blue');
      if (results.length > 0) {
        const first = results[0].public;
        const consistent = results.every(r => 
          r.public.address === first.address && r.public.port === first.port
        );
        
        if (consistent) {
          log(`公网地址: ${first.address}:${first.port}`, 'green');
          log('NAT类型: 锥形NAT (可能)', 'green');
        } else {
          log('NAT类型: 对称NAT', 'yellow');
          log('不同STUN服务器返回不同地址/端口', 'yellow');
        }
      } else {
        log('无法获取公网地址', 'red');
      }
      log('========================================', 'blue');
      process.exit(0);
    });
    break;
    
  case 'server':
    startServer(process.argv[3] || 9002);
    break;
    
  case 'client':
    if (!process.argv[3]) {
      log('用法: node udp-test.js client <服务器IP> [port]', 'yellow');
      process.exit(1);
    }
    startClient(process.argv[3], process.argv[4] || 9002);
    break;
    
  case 'punch':
    if (!process.argv[3] || !process.argv[5]) {
      log('用法: node udp-test.js punch <服务器IP> <port> <目标ID>', 'yellow');
      process.exit(1);
    }
    punchTest(process.argv[3], process.argv[4] || 9002, process.argv[5]);
    break;
    
  default:
    log('========================================', 'blue');
    log('  UDP 打洞测试工具', 'blue');
    log('========================================', 'blue');
    log('', 'reset');
    log('用法:', 'yellow');
    log('  node udp-test.js stun                    - STUN测试', 'reset');
    log('  node udp-test.js server [port]           - 启动服务器', 'reset');
    log('  node udp-test.js client <host> [port]    - 连接客户端', 'reset');
    log('  node udp-test.js punch <host> <port> <target> - 打洞测试', 'reset');
    log('', 'reset');
    log('示例:', 'yellow');
    log('  node udp-test.js stun', 'reset');
    log('  node udp-test.js server 9002', 'reset');
    log('  node udp-test.js client localhost 9002', 'reset');
    log('========================================', 'blue');
    process.exit(0);
}
