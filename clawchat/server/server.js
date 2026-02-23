const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// 配置
const PORT = process.env.PORT || 8080;
const HEARTBEAT_INTERVAL = 30000; // 30秒
const HEARTBEAT_TIMEOUT = 150000; // 150秒（5次心跳）
const MAX_MESSAGE_SIZE = 10240; // 10KB
const MAX_RETRY = 3;
const RETRY_TIMEOUT = 5000; // 5秒
const MAX_CONNECTIONS = 1000; // 最大连接数

// 存储
const clients = new Map();      // clientId -> {ws, id, channels, lastHeartbeat, isRegistered}
const clientById = new Map();   // id -> clientId (快速查找)
const channels = new Map();     // channelName -> Set(clientIds)
const messages = new Map();     // msgId -> message (临时存储)
const pendingACK = new Map();   // msgId -> {clientId, retryCount, timeout}

// 验证消息格式
function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'Message must be object' };
  }
  if (!msg.type || typeof msg.type !== 'string') {
    return { valid: false, error: 'Message type required' };
  }
  if (!['register', 'subscribe', 'publish', 'ping', 'ack'].includes(msg.type)) {
    return { valid: false, error: `Unknown type: ${msg.type}` };
  }
  return { valid: true };
}

// 验证payload大小
function validatePayload(payload) {
  const size = JSON.stringify(payload).length;
  if (size > MAX_MESSAGE_SIZE) {
    return { valid: false, error: `Payload too large: ${size} > ${MAX_MESSAGE_SIZE}` };
  }
  return { valid: true };
}

// 发送错误
function sendError(ws, error) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        type: 'error',
        error: error,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('[!] Failed to send error:', err.message);
    }
  }
}

// 广播给频道
function broadcastToChannel(channel, message, excludeId) {
  const members = channels.get(channel);
  if (!members) {
    return [];
  }

  const data = JSON.stringify(message);
  const memberIds = Array.from(members);

  for (const memberId of memberIds) {
    if (excludeId && memberId === excludeId) {
      continue;
    }

    const targetClientId = clientById.get(memberId);
    if (!targetClientId) {
      continue;
    }

    const client = clients.get(targetClientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch (err) {
        console.error(`[!] Failed to send to ${memberId}:`, err.message);
        // 发送失败，不中断其他客户端
      }
    }
  }

  return memberIds;
}

// 清理客户端
function cleanupClient(clientId) {
  const client = clients.get(clientId);
  if (!client) {
    return;
  }

  // 清理注册超时定时器
  if (client.regTimeout) {
    clearTimeout(client.regTimeout);
  }

  // 从clientById移除
  if (client.id) {
    clientById.delete(client.id);
  }

  // 从所有频道移除
  for (const channel of client.channels) {
    const members = channels.get(channel);
    if (members) {
      members.delete(client.id);

      // 广播离开消息
      broadcastToChannel(channel, {
        type: 'member_left',
        channel: channel,
        member: client.id,
        members: Array.from(members),
        timestamp: Date.now()
      });

      // 清理空频道
      if (members.size === 0) {
        channels.delete(channel);
      }
    }
  }

  // 清理待确认消息
  for (const [key, pending] of pendingACK) {
    if (pending.clientId === client.id) {
      clearTimeout(pending.timeout);
      pendingACK.delete(key);
    }
  }

  clients.delete(clientId);
}

// 处理注册
function handleRegister(clientId, msg) {
  const client = clients.get(clientId);
  if (!client) {
    return;
  }

  // 验证id
  const id = msg.id;
  if (!id || typeof id !== 'string' || id.length < 1 || id.length > 32) {
    sendError(client.ws, 'Invalid ID: must be 1-32 characters');
    return;
  }

  // 检查ID是否已被使用
  const existingClientId = clientById.get(id);
  if (existingClientId && existingClientId !== clientId) {
    sendError(client.ws, `ID ${id} already in use`);
    return;
  }

  // 如果之前注册过，清理旧映射
  if (client.id && clientById.get(client.id) === clientId) {
    clientById.delete(client.id);
  }

  client.id = id;
  client.isRegistered = true;
  clientById.set(id, clientId);

  console.log(`[R] Client registered: ${id}`);

  try {
    client.ws.send(JSON.stringify({
      type: 'registered',
      id: id,
      channels: Array.from(client.channels),
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error(`[!] Failed to send registered to ${id}:`, err.message);
  }
}

// 订阅频道
function handleSubscribe(clientId, msg) {
  const client = clients.get(clientId);
  if (!client || !client.isRegistered) {
    sendError(client.ws, 'Not registered');
    return;
  }

  const channel = msg.channel;
  if (!channel || typeof channel !== 'string' || channel.length < 1 || channel.length > 64) {
    sendError(client.ws, 'Invalid channel name: must be 1-64 characters');
    return;
  }

  // 添加到频道
  client.channels.add(channel);

  if (!channels.has(channel)) {
    channels.set(channel, new Set());
  }
  channels.get(channel).add(client.id);

  console.log(`[S] ${client.id} subscribed to ${channel}`);

  try {
    client.ws.send(JSON.stringify({
      type: 'subscribed',
      channel: channel,
      members: Array.from(channels.get(channel)),
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error(`[!] Failed to send subscribed to ${client.id}:`, err.message);
  }

  // 广播成员变化
  broadcastToChannel(channel, {
    type: 'member_joined',
    channel: channel,
    member: client.id,
    members: Array.from(channels.get(channel)),
    timestamp: Date.now()
  }, client.id);
}

// 发布消息
function handlePublish(clientId, msg) {
  const client = clients.get(clientId);
  if (!client || !client.isRegistered) {
    sendError(client.ws, 'Not registered');
    return;
  }

  const channel = msg.channel;
  const payload = msg.payload;

  if (!channel || !payload) {
    sendError(client.ws, 'Channel and payload required');
    return;
  }

  // 验证payload大小
  const payloadValidation = validatePayload(payload);
  if (!payloadValidation.valid) {
    sendError(client.ws, payloadValidation.error);
    return;
  }

  if (!client.channels.has(channel)) {
    sendError(client.ws, `Not subscribed to ${channel}`);
    return;
  }

  const msgId = uuidv4();
  const message = {
    type: 'message',
    msgId: msgId,
    channel: channel,
    from: client.id,
    payload: payload,
    timestamp: Date.now()
  };

  // 临时存储（10分钟）
  messages.set(msgId, message);
  setTimeout(() => {
    messages.delete(msgId);
  }, 600000);

  console.log(`[P] ${client.id} -> ${channel}: ${JSON.stringify(payload).slice(0, 50)}`);

  // 广播给频道所有成员
  const memberIds = broadcastToChannel(channel, message);

  // 记录待确认
  for (const memberId of memberIds) {
    if (memberId === client.id) {
      continue; // 不发给自己
    }

    const timeout = setTimeout(() => {
      handleAckTimeout(msgId, memberId);
    }, RETRY_TIMEOUT);

    pendingACK.set(`${msgId}:${memberId}`, {
      clientId: memberId,
      retryCount: 0,
      timeout: timeout,
      message: message
    });
  }

  // 发送ACK给发送方
  try {
    client.ws.send(JSON.stringify({
      type: 'ack',
      msgId: msgId,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error(`[!] Failed to send ack to ${client.id}:`, err.message);
  }
}

// 处理ACK确认
function handleACK(clientId, msg) {
  const client = clients.get(clientId);
  if (!client || !client.isRegistered) {
    return;
  }

  const msgId = msg.msgId;
  if (!msgId) {
    return;
  }

  const key = `${msgId}:${client.id}`;
  const pending = pendingACK.get(key);

  if (pending) {
    clearTimeout(pending.timeout);
    pendingACK.delete(key);
    console.log(`[A] ACK received: ${client.id} for ${msgId}`);
  }
}

// ACK超时处理
function handleAckTimeout(msgId, clientId) {
  const key = `${msgId}:${clientId}`;
  const pending = pendingACK.get(key);

  if (!pending) {
    return;
  }

  if (pending.retryCount < MAX_RETRY) {
    // 重试
    pending.retryCount++;
    console.log(`[R] Retry ${pending.retryCount} for ${msgId} to ${clientId}`);

    // 重新发送
    const targetClientId = clientById.get(clientId);
    if (targetClientId) {
      const target = clients.get(targetClientId);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        try {
          target.ws.send(JSON.stringify(pending.message));
        } catch (err) {
          console.error(`[!] Retry failed for ${clientId}:`, err.message);
        }
      }
    }

    // 设置新的超时
    pending.timeout = setTimeout(() => {
      handleAckTimeout(msgId, clientId);
    }, RETRY_TIMEOUT);
  } else {
    // 重试失败，放弃
    console.log(`[!] Max retry reached for ${msgId} to ${clientId}`);
    pendingACK.delete(key);
  }
}

// 心跳处理
function handlePing(clientId) {
  const client = clients.get(clientId);
  if (!client) {
    return;
  }

  client.lastHeartbeat = Date.now();

  try {
    client.ws.send(JSON.stringify({
      type: 'pong',
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error(`[!] Failed to send pong to ${clientId}:`, err.message);
  }
}

// 消息处理
function handleMessage(clientId, msg) {
  const client = clients.get(clientId);
  if (!client) {
    return;
  }

  // 更新心跳时间
  client.lastHeartbeat = Date.now();

  console.log(`[${clientId}] ${msg.type}`);

  try {
    switch (msg.type) {
      case 'register':
        handleRegister(clientId, msg);
        break;

      case 'subscribe':
        handleSubscribe(clientId, msg);
        break;

      case 'publish':
        handlePublish(clientId, msg);
        break;

      case 'ping':
        handlePing(clientId);
        break;

      case 'ack':
        handleACK(clientId, msg);
        break;

      default:
        sendError(client.ws, `Unknown message type: ${msg.type}`);
    }
  } catch (err) {
    console.error(`[!] Error handling ${msg.type} from ${clientId}:`, err.message);
    sendError(client.ws, 'Internal error');
  }
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ClawChat Server Running',
    version: '1.0.0',
    clients: clients.size,
    registered: Array.from(clientById.keys()).length,
    channels: Array.from(channels.keys()),
    timestamp: new Date().toISOString()
  }));
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({
  server,
  maxPayload: MAX_MESSAGE_SIZE * 2 // 允许稍大的原始帧
});

console.log(`[${new Date().toISOString()}] ClawChat Server starting...`);
console.log(`[Config] Port: ${PORT}, Heartbeat: ${HEARTBEAT_INTERVAL}ms, Timeout: ${HEARTBEAT_TIMEOUT}ms`);

wss.on('connection', (ws, req) => {
  // 检查最大连接数
  if (clients.size >= MAX_CONNECTIONS) {
    console.log(`[!] Max connections reached, rejecting new connection`);
    ws.close(4003, 'Server full');
    return;
  }

  const clientId = uuidv4();
  const ip = req.socket.remoteAddress;
  console.log(`[+] Client connected: ${clientId} from ${ip}`);

  // 存储客户端
  const clientData = {
    ws,
    id: null,
    channels: new Set(),
    lastHeartbeat: Date.now(),
    isRegistered: false,
    connectTime: Date.now(),
    regTimeout: null
  };
  clients.set(clientId, clientData);

  // 发送欢迎消息
  try {
    ws.send(JSON.stringify({
      type: 'welcome',
      clientId: clientId,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error(`[!] Failed to send welcome to ${clientId}:`, err.message);
  }

  // 设置消息大小限制
  ws.on('message', (data) => {
    try {
      // 检查消息大小
      if (data.length > MAX_MESSAGE_SIZE) {
        sendError(ws, `Message too large: ${data.length} > ${MAX_MESSAGE_SIZE}`);
        return;
      }

      const msg = JSON.parse(data);

      // 验证消息格式
      const validation = validateMessage(msg);
      if (!validation.valid) {
        sendError(ws, validation.error);
        return;
      }

      handleMessage(clientId, msg);
    } catch (err) {
      console.error(`[!] Invalid message from ${clientId}:`, err.message);
      sendError(ws, 'Invalid message format');
    }
  });

  // 处理关闭
  ws.on('close', (code, reason) => {
    console.log(`[-] Client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
    cleanupClient(clientId);
  });

  // 处理错误
  ws.on('error', (err) => {
    console.error(`[!] WebSocket error for ${clientId}:`, err.message);
  });

  // 连接超时检测（30秒内必须注册）
  const regTimeout = setTimeout(() => {
    const client = clients.get(clientId);
    if (client && !client.isRegistered) {
      console.log(`[!] Registration timeout: ${clientId}`);
      ws.close(4001, 'Registration timeout');
    }
  }, 30000);
  clientData.regTimeout = regTimeout;
});

// 心跳检查
setInterval(() => {
  const now = Date.now();
  for (const [clientId, client] of clients) {
    if (now - client.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log(`[!] Heartbeat timeout: ${clientId} (${client.id || 'unregistered'})`);
      try {
        client.ws.close(4002, 'Heartbeat timeout');
      } catch (err) {
        // 忽略关闭错误
      }
      cleanupClient(clientId);
    }
  }
}, HEARTBEAT_INTERVAL);

// 启动服务器
server.listen(PORT, () => {
  console.log(`[=] ClawChat Server v1.0.0 running on port ${PORT}`);
  console.log(`[=] WebSocket: ws://localhost:${PORT}`);
  console.log(`[=] Health: http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[=] Shutting down gracefully...');

  // 关闭所有客户端连接
  const closePromises = [];
  for (const [clientId, client] of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      closePromises.push(new Promise((resolve) => {
        client.ws.once('close', resolve);
        client.ws.close(1001, 'Server shutting down');
        setTimeout(resolve, 5000); // 5秒超时
      }));
    }
  }

  await Promise.all(closePromises);

  wss.close(() => {
    server.close(() => {
      console.log('[=] Server closed');
      process.exit(0);
    });
  });
});

// 未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('[!] Uncaught Exception:', err);
  // 保持运行，记录错误
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[!] Unhandled Rejection at:', promise, 'reason:', reason);
  // 保持运行，记录错误
});
