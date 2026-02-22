#!/usr/bin/env node
/**
 * SilkTalk Client - 带中继支持的客户端
 */

const WebSocket = require('ws');
const readline = require('readline');

const NODE_ID = 'node-' + Math.random().toString(36).substring(2, 8);
let ws = null;
let mode = 'direct'; // 'direct' 或 'relay'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function connect(url) {
  log(`Connecting to ${url}...`);
  
  ws = new WebSocket(url);
  
  ws.on('open', () => {
    log('✅ Connected!');
    log(`Node ID: ${NODE_ID}`);
    
    // 发送ping保持连接
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    showMenu();
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(msg);
    } catch (e) {
      log(`Received: ${data}`);
    }
  });
  
  ws.on('close', () => {
    log('❌ Disconnected');
    process.exit(0);
  });
  
  ws.on('error', (err) => {
    log(`❌ Error: ${err.message}`);
    if (mode === 'direct') {
      log('Trying relay mode...');
      mode = 'relay';
      // 这里可以切换到中继服务器
    }
  });
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      log(`Welcome! My ID: ${msg.nodeId}`);
      if (msg.nodes && msg.nodes.length > 0) {
        log(`Online nodes: ${msg.nodes.join(', ')}`);
      }
      break;
      
    case 'message':
      log(`📨 From ${msg.from}: ${msg.data}`);
      break;
      
    case 'direct':
      log(`📩 Direct from ${msg.from}: ${msg.data}`);
      break;
      
    case 'node-joined':
      log(`👤 Node joined: ${msg.nodeId} (total: ${msg.totalNodes})`);
      break;
      
    case 'node-left':
      log(`👋 Node left: ${msg.nodeId} (total: ${msg.totalNodes})`);
      break;
      
    case 'nodes':
      log(`Online nodes (${msg.nodes.length}):`);
      msg.nodes.forEach(n => log(`  - ${n.id}`));
      break;
      
    case 'pong':
      // 心跳响应，忽略
      break;
      
    case 'error':
      log(`⚠️  Error: ${msg.message}`);
      break;
      
    default:
      log(`Received [${msg.type}]: ${JSON.stringify(msg)}`);
  }
}

function showMenu() {
  console.log('');
  console.log('Commands:');
  console.log('  /broadcast <message>  - Broadcast to all nodes');
  console.log('  /direct <nodeId> <message>  - Send to specific node');
  console.log('  /list  - List online nodes');
  console.log('  /quit  - Exit');
  console.log('');
  
  rl.question('> ', (input) => {
    handleCommand(input.trim());
  });
}

function handleCommand(input) {
  if (!input) {
    showMenu();
    return;
  }
  
  if (input === '/quit') {
    ws.close();
    rl.close();
    return;
  }
  
  if (input === '/list') {
    ws.send(JSON.stringify({ type: 'list-nodes' }));
    showMenu();
    return;
  }
  
  if (input.startsWith('/broadcast ')) {
    const message = input.substring(11);
    ws.send(JSON.stringify({
      type: 'broadcast',
      data: message
    }));
    log(`📤 Broadcast: ${message}`);
    showMenu();
    return;
  }
  
  if (input.startsWith('/direct ')) {
    const parts = input.substring(8).split(' ');
    const target = parts[0];
    const message = parts.slice(1).join(' ');
    ws.send(JSON.stringify({
      type: 'direct',
      target,
      data: message
    }));
    log(`📤 Direct to ${target}: ${message}`);
    showMenu();
    return;
  }
  
  // 默认广播
  ws.send(JSON.stringify({
    type: 'broadcast',
    data: input
  }));
  log(`📤 Broadcast: ${input}`);
  showMenu();
}

// 主函数
function main() {
  const target = process.argv[2];
  
  if (!target) {
    console.log('Usage: node client.js <ws://target:port>');
    console.log('');
    console.log('Examples:');
    console.log('  node client.js ws://localhost:8080');
    console.log('  node client.js ws://relay.example.com:8080');
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('  SilkTalk Client');
  console.log('========================================');
  console.log('');
  
  connect(target);
}

main();
