const WebSocket = require('ws');
const EventEmitter = require('events');

class ClawChatClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:8080',
      clientId: config.clientId || 'anonymous',
      autoReconnect: config.autoReconnect !== false,
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectDelay: config.maxReconnectDelay || 60000,
      connectionTimeout: config.connectionTimeout || 10000,
      maxMessageSize: config.maxMessageSize || 10240,
      ...config
    };

    this.ws = null;
    this.connected = false;
    this.registered = false;
    this.currentDelay = this.config.reconnectDelay;
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.heartbeatTimer = null;
    this.channels = new Set();
    this.messageQueue = [];
    this.pendingMessages = new Map();
    this.isConnecting = false;
  }

  connect() {
    // 防止重复连接
    if (this.isConnecting || this.connected) {
      console.log('[ClawChat] Already connecting or connected');
      return;
    }

    this.isConnecting = true;

    // 清理旧连接
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    // 清理旧定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.log(`[ClawChat] Connecting to ${this.config.serverUrl}...`);

    try {
      this.ws = new WebSocket(this.config.serverUrl);

      // 连接超时
      this.connectionTimer = setTimeout(() => {
        if (!this.connected) {
          console.error('[ClawChat] Connection timeout');
          this.ws.terminate();
          this.ws = null;
          this.isConnecting = false;
          this.emit('error', new Error('Connection timeout'));
          this.scheduleReconnect();
        }
      }, this.config.connectionTimeout);

      this.ws.on('open', () => {
        clearTimeout(this.connectionTimer);
        this.connectionTimer = null;
        this.isConnecting = false;

        console.log('[ClawChat] Connected');
        this.connected = true;
        this.currentDelay = this.config.reconnectDelay;
        this.emit('connected');

        // 注册
        this.send({
          type: 'register',
          id: this.config.clientId,
          timestamp: Date.now()
        });

        // 启动心跳
        this.startHeartbeat();

        // 发送离线队列中的消息
        this.flushQueue();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[ClawChat] Invalid message:', err.message);
          this.emit('error', new Error(`Invalid message: ${err.message}`));
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[ClawChat] Disconnected: ${code} ${reason}`);
        this.connected = false;
        this.registered = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code, reason });

        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        console.error('[ClawChat] WebSocket error:', err.message);
        this.isConnecting = false;
        this.emit('error', err);
        // 错误会自动触发close事件
      });

    } catch (err) {
      console.error('[ClawChat] Connection error:', err.message);
      this.isConnecting = false;
      this.emit('error', err);
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        console.log(`[ClawChat] Server assigned ID: ${msg.clientId}`);
        this.emit('welcome', msg);
        break;

      case 'registered':
        this.registered = true;
        console.log(`[ClawChat] Registered as: ${msg.id}`);
        this.emit('registered', msg);

        // 重新订阅之前的频道
        for (const channel of this.channels) {
          this.subscribe(channel);
        }
        break;

      case 'subscribed':
        console.log(`[ClawChat] Subscribed to: ${msg.channel}`);
        this.channels.add(msg.channel);
        this.emit('subscribed', msg);
        break;

      case 'message':
        // 发送ACK
        this.send({
          type: 'ack',
          msgId: msg.msgId,
          timestamp: Date.now()
        });
        this.emit('message', msg);
        break;

      case 'ack':
        this.pendingMessages.delete(msg.msgId);
        this.emit('ack', msg);
        break;

      case 'pong':
        // 心跳响应，无需处理
        break;

      case 'error':
        console.error('[ClawChat] Server error:', msg.error);
        this.emit('serverError', msg.error);
        break;

      default:
        this.emit(msg.type, msg);
    }
  }

  send(data) {
    // 检查消息大小
    const dataStr = JSON.stringify(data);
    if (dataStr.length > this.config.maxMessageSize) {
      console.error(`[ClawChat] Message too large: ${dataStr.length} > ${this.config.maxMessageSize}`);
      return false;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(dataStr);
        return true;
      } catch (err) {
        console.error('[ClawChat] Send error:', err.message);
        // 加入离线队列
        this.messageQueue.push(data);
        return false;
      }
    }
    // 未连接，加入离线队列
    this.messageQueue.push(data);
    console.log('[ClawChat] Queued message (offline)');
    return false;
  }

  flushQueue() {
    if (this.messageQueue.length === 0) {
      return;
    }
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('[ClawChat] Cannot flush queue: not connected');
      return;
    }

    console.log(`[ClawChat] Flushing ${this.messageQueue.length} queued messages`);
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const data of queue) {
      this.send(data);
    }
  }

  subscribe(channel) {
    this.channels.add(channel);
    return this.send({
      type: 'subscribe',
      channel: channel,
      timestamp: Date.now()
    });
  }

  publish(channel, payload) {
    // 生成唯一msgId
    const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;

    // 记录待确认
    this.pendingMessages.set(msgId, {
      channel,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    });

    const sent = this.send({
      type: 'publish',
      channel: channel,
      payload: payload,
      timestamp: Date.now()
    });

    if (!sent) {
      // 未发送成功，保留在pending中，重连后重试
      console.log('[ClawChat] Message pending (offline)');
    }

    return msgId;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        const sent = this.send({ type: 'ping', timestamp: Date.now() });
        if (!sent) {
          console.log('[ClawChat] Ping failed, connection may be lost');
        }
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    // 清除旧定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 防止重复调度
    if (this.isConnecting || this.connected) {
      return;
    }

    console.log(`[ClawChat] Reconnecting in ${this.currentDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.currentDelay);

    // 指数退避
    this.currentDelay = Math.min(
      this.currentDelay * 2,
      this.config.maxReconnectDelay
    );
  }

  disconnect() {
    this.config.autoReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.connected = false;
    this.registered = false;
    this.isConnecting = false;

    // 清空队列
    this.messageQueue = [];
    this.pendingMessages.clear();
  }

  getStats() {
    return {
      connected: this.connected,
      registered: this.registered,
      channels: Array.from(this.channels),
      queuedMessages: this.messageQueue.length,
      pendingMessages: this.pendingMessages.size
    };
  }
}

module.exports = ClawChatClient;

// 如果直接运行
if (require.main === module) {
  const client = new ClawChatClient({
    serverUrl: process.env.SERVER_URL || 'ws://localhost:8080',
    clientId: process.env.CLIENT_ID || `test-client-${Date.now()}`
  });

  client.on('connected', () => {
    console.log('Connected!');
  });

  client.on('registered', () => {
    console.log('Registered!');
    client.subscribe('test-channel');

    setTimeout(() => {
      client.publish('test-channel', { text: 'Hello from ' + client.config.clientId });
    }, 1000);
  });

  client.on('message', (msg) => {
    console.log('Received:', msg);
  });

  client.on('error', (err) => {
    console.error('Error:', err.message);
  });

  client.connect();

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\nDisconnecting...');
    client.disconnect();
    process.exit(0);
  });
}
