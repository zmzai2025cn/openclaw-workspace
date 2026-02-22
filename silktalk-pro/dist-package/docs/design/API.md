# 接口设计文档 (API)
## Application Programming Interface Design

**文档编号**: STP-API-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro 开发团队  
**审核人**: 待签字  

---

## 1. 引言

### 1.1 目的
本文档定义 SilkTalk Pro 的编程接口和命令行接口规范。

### 1.2 范围
涵盖程序化 API、CLI 接口和网络协议接口。

### 1.3 参考资料
- STP-SRS-001 需求规格说明书
- STP-HLD-001 概要设计文档
- STP-LLD-001 详细设计文档

---

## 2. 程序化 API

### 2.1 SilkNode 类

#### 2.1.1 构造函数
```typescript
constructor(config?: Partial<SilkNodeConfig>)
```

**参数**:
- `config`: 可选的部分配置对象

**示例**:
```typescript
import { SilkNode } from 'silktalk-pro';

const node = new SilkNode({
  listenAddresses: ['/ip4/0.0.0.0/tcp/4001'],
  transports: { tcp: true, websocket: true }
});
```

#### 2.1.2 生命周期方法

##### start()
```typescript
async start(): Promise<void>
```

启动节点，初始化所有组件。

**抛出**:
- `ConnectionError`: 网络初始化失败
- `ValidationError`: 配置无效

**示例**:
```typescript
try {
  await node.start();
  console.log('Node started:', node.peerId.toString());
} catch (error) {
  console.error('Failed to start:', error.message);
}
```

##### stop()
```typescript
async stop(): Promise<void>
```

停止节点，优雅地关闭所有连接。

**示例**:
```typescript
await node.stop();
console.log('Node stopped');
```

##### isStarted()
```typescript
isStarted(): boolean
```

检查节点是否已启动。

**返回**: 节点状态

#### 2.1.3 身份和地址

##### peerId
```typescript
get peerId(): PeerId
```

获取节点的 PeerId。

**抛出**: `Error` - 节点未启动

##### getMultiaddrs()
```typescript
getMultiaddrs(): Multiaddr[]
```

获取节点的监听地址列表。

**返回**: 多地址数组

#### 2.1.4 连接管理

##### dial()
```typescript
async dial(multiaddr: string | Multiaddr): Promise<Connection>
```

连接到指定地址的对等点。

**参数**:
- `multiaddr`: 目标地址，如 `/ip4/192.168.1.100/tcp/4001/p2p/12D3KooW...`

**返回**: Connection 对象

**抛出**:
- `ConnectionError`: 连接失败

**示例**:
```typescript
const conn = await node.dial('/ip4/192.168.1.100/tcp/4001/p2p/12D3KooW...');
console.log('Connected to:', conn.remotePeer.toString());
```

##### hangUp()
```typescript
async hangUp(peerId: string | PeerId): Promise<void>
```

断开与指定对等点的连接。

**参数**:
- `peerId`: 对等点 ID

##### isConnected()
```typescript
isConnected(peerId: string | PeerId): boolean
```

检查是否与指定对等点连接。

**参数**:
- `peerId`: 对等点 ID

**返回**: 连接状态

##### getPeers()
```typescript
getPeers(): string[]
```

获取所有连接的对等点 ID 列表。

**返回**: PeerId 字符串数组

##### getConnections()
```typescript
getConnections(): Connection[]
```

获取所有活跃的连接。

**返回**: Connection 对象数组

#### 2.1.5 消息传递

##### sendMessage()
```typescript
async sendMessage(
  peerId: string | PeerId, 
  message: SilkMessage
): Promise<void>
```

向指定对等点发送消息。

**参数**:
- `peerId`: 目标对等点 ID
- `message`: 消息对象

**抛出**:
- `ConnectionError`: 未连接目标对等点
- `ProtocolError`: 消息格式无效

**示例**:
```typescript
import { MessageType } from 'silktalk-pro';

await node.sendMessage(peerId, {
  header: {
    version: 1,
    type: MessageType.TEXT,
    id: 'msg-001',
    timestamp: Date.now(),
    sender: node.peerId.toString()
  },
  payload: {
    content: 'Hello, World!',
    encoding: 'utf-8'
  }
});
```

##### onMessage()
```typescript
onMessage(
  handler: (message: SilkMessage, peerId: string) => void
): () => void
```

注册消息接收处理器。

**参数**:
- `handler`: 消息处理函数

**返回**: 取消订阅函数

**示例**:
```typescript
const unsubscribe = node.onMessage((message, peerId) => {
  console.log(`Received from ${peerId}:`, message.payload);
});

// 稍后取消订阅
unsubscribe();
```

#### 2.1.6 协议处理

##### handle()
```typescript
handle(
  protocol: string, 
  handler: (data: Uint8Array, peerId: string) => Promise<Uint8Array>
): void
```

注册自定义协议处理器。

**参数**:
- `protocol`: 协议标识符
- `handler`: 处理函数

**示例**:
```typescript
node.handle('/myapp/1.0.0', async (data, peerId) => {
  const request = JSON.parse(new TextDecoder().decode(data));
  const response = await processRequest(request);
  return new TextEncoder().encode(JSON.stringify(response));
});
```

#### 2.1.7 网络信息

##### getNetworkInfo()
```typescript
async getNetworkInfo(): Promise<NetworkInfo>
```

获取网络信息。

**返回**: NetworkInfo 对象

```typescript
interface NetworkInfo {
  natType: 'full-cone' | 'restricted' | 'port-restricted' | 'symmetric' | 'unknown';
  publicAddresses: string[];
  privateAddresses: string[];
  transports: string[];
  relayReservations: string[];
}
```

#### 2.1.8 DHT 操作

##### dhtGet()
```typescript
async dhtGet(key: string): Promise<Uint8Array | null>
```

从 DHT 获取值。

**参数**:
- `key`: 键名

**返回**: 值或 null

**示例**:
```typescript
const value = await node.dhtGet('my-key');
if (value) {
  console.log('Value:', new TextDecoder().decode(value));
}
```

##### dhtPut()
```typescript
async dhtPut(key: string, value: Uint8Array): Promise<void>
```

存储值到 DHT。

**参数**:
- `key`: 键名
- `value`: 值

**示例**:
```typescript
await node.dhtPut('my-key', new TextEncoder().encode('my-value'));
```

#### 2.1.9 对等点发现

##### findPeers()
```typescript
async findPeers(protocol?: string): Promise<Array<{
  id: string;
  addresses: string[];
}>>
```

发现网络中的对等点。

**参数**:
- `protocol`: 可选，筛选支持特定协议的对等点

**返回**: 对等点信息数组

### 2.2 配置接口

#### 2.2.1 SilkNodeConfig
```typescript
interface SilkNodeConfig {
  // 身份
  privateKey?: Uint8Array;
  
  // 网络
  listenAddresses?: string[];
  announceAddresses?: string[];
  
  // 传输
  transports?: {
    tcp?: boolean | TcpConfig;
    websocket?: boolean | WsConfig;
  };
  
  // NAT 穿透
  nat?: {
    upnp?: boolean;
    autonat?: boolean;
    dcutr?: boolean;
  };
  
  // 中继
  relay?: {
    enabled?: boolean;
    hop?: {
      enabled?: boolean;
      active?: boolean;
    };
    autoRelay?: {
      enabled?: boolean;
      maxListeners?: number;
    };
  };
  
  // 发现
  discovery?: {
    mdns?: boolean;
    dht?: boolean | DHTConfig;
    bootstrap?: string[];
  };
  
  // 连接
  connection?: {
    maxConnections?: number;
    minConnections?: number;
    maxConnectionsPerPeer?: number;
  };
  
  // 日志
  logging?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
  };
}
```

#### 2.2.2 配置示例
```typescript
const config: SilkNodeConfig = {
  listenAddresses: [
    '/ip4/0.0.0.0/tcp/4001',
    '/ip4/0.0.0.0/tcp/8080/ws'
  ],
  transports: {
    tcp: true,
    websocket: true
  },
  nat: {
    upnp: true,
    autonat: true,
    dcutr: true
  },
  relay: {
    enabled: true,
    hop: {
      enabled: false,
      active: false
    },
    autoRelay: {
      enabled: true,
      maxListeners: 2
    }
  },
  discovery: {
    mdns: true,
    dht: true,
    bootstrap: [
      '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'
    ]
  },
  connection: {
    maxConnections: 300,
    minConnections: 10,
    maxConnectionsPerPeer: 5
  },
  logging: {
    level: 'info',
    pretty: true
  }
};
```

### 2.3 消息类型

#### 2.3.1 MessageType 枚举
```typescript
enum MessageType {
  HELLO = 0,
  TEXT = 1,
  DATA = 2,
  COMMAND = 3,
  ACK = 4,
  ERROR = 5
}
```

#### 2.3.2 SilkMessage 接口
```typescript
interface SilkMessage {
  header: MessageHeader;
  payload: MessagePayload;
  metadata?: Record<string, unknown>;
}

interface MessageHeader {
  version: number;
  type: MessageType;
  id: string;
  timestamp: number;
  sender: string;
  recipient?: string;
}

type MessagePayload =
  | HelloPayload
  | TextPayload
  | DataPayload
  | CommandPayload
  | AckPayload
  | ErrorPayload;
```

#### 2.3.3 Payload 类型
```typescript
interface HelloPayload {
  clientVersion: string;
  capabilities: string[];
  nonce: string;
}

interface TextPayload {
  content: string;
  encoding: 'utf-8';
}

interface DataPayload {
  mimeType: string;
  size: number;
  data: Uint8Array;
  chunk?: {
    index: number;
    total: number;
  };
}

interface CommandPayload {
  command: string;
  args: Record<string, unknown>;
}

interface AckPayload {
  messageId: string;
  status: 'received' | 'processed' | 'failed';
  details?: string;
}

interface ErrorPayload {
  code: number;
  message: string;
  retryable: boolean;
}
```

### 2.4 事件接口

#### 2.4.1 NodeEvents
```typescript
interface NodeEvents {
  'peer:connect': (peerId: string) => void;
  'peer:disconnect': (peerId: string) => void;
  'message:received': (message: SilkMessage, peerId: string) => void;
  'message:sent': (messageId: string, peerId: string) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'stop': () => void;
}
```

#### 2.4.2 事件使用示例
```typescript
node.on('peer:connect', (peerId) => {
  console.log(`Peer connected: ${peerId}`);
});

node.on('peer:disconnect', (peerId) => {
  console.log(`Peer disconnected: ${peerId}`);
});

node.on('ready', () => {
  console.log('Node is ready');
});

node.on('error', (error) => {
  console.error('Node error:', error);
});
```

### 2.5 错误类型

#### 2.5.1 SilkTalkError
```typescript
class SilkTalkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  );
}
```

#### 2.5.2 具体错误类型
```typescript
class ConnectionError extends SilkTalkError {
  constructor(message: string, retryable = true);
}

class ProtocolError extends SilkTalkError {
  constructor(message: string);
}

class ValidationError extends SilkTalkError {
  constructor(message: string);
}
```

#### 2.5.3 错误代码
| 代码 | 描述 | 可重试 |
|------|------|--------|
| CONNECTION_FAILED | 连接失败 | 是 |
| CONNECTION_TIMEOUT | 连接超时 | 是 |
| PROTOCOL_NOT_SUPPORTED | 协议不支持 | 否 |
| MESSAGE_TOO_LARGE | 消息过大 | 否 |
| INVALID_MESSAGE | 消息格式无效 | 否 |
| PEER_NOT_FOUND | 对等点未找到 | 是 |
| DHT_TIMEOUT | DHT 操作超时 | 是 |

---

## 3. CLI 接口

### 3.1 全局选项
```bash
silktalk [options] [command]

Options:
  -V, --version                    输出版本号
  -c, --config <path>             配置文件路径
  -v, --verbose                    启用详细日志
  -h, --help                       显示帮助
```

### 3.2 start 命令
```bash
silktalk start [options]

Options:
  -p, --port <port>               TCP 监听端口 (默认: 0)
  -w, --ws-port <port>            WebSocket 监听端口
  --ws                             启用 WebSocket 传输
  --wss                            启用安全 WebSocket
  --mdns                           启用 mDNS 发现 (默认: true)
  --dht                            启用 DHT (默认: true)
  --relay                          启用中继客户端 (默认: true)
  --relay-hop                      启用中继跳 (作为中继服务器)
  --bootstrap <addrs...>          引导节点地址
  --upnp                           启用 UPnP NAT 穿透 (默认: true)
  --autonat                        启用 AutoNAT (默认: true)
  --max-connections <n>           最大连接数 (默认: 300)
  --log-level <level>             日志级别 (默认: info)
  --bridge                         启用 OpenClaw 桥接
```

**示例**:
```bash
# 基本启动
silktalk start

# 指定端口
silktalk start --port 4001 --ws-port 8080

# 作为中继服务器
silktalk start --port 4001 --relay-hop

# 使用引导节点
silktalk start --bootstrap /dns4/bootstrap.example.com/tcp/4001/p2p/Qm...
```

### 3.3 status 命令
```bash
silktalk status [options]

Options:
  --json                           以 JSON 格式输出
```

**输出示例**:
```json
{
  "peerId": "12D3KooW...",
  "started": true,
  "addresses": [
    "/ip4/127.0.0.1/tcp/4001",
    "/ip4/192.168.1.100/tcp/4001"
  ],
  "peers": {
    "total": 10,
    "connected": 5
  },
  "transports": ["tcp", "websocket"],
  "nat": {
    "type": "full-cone",
    "reachable": true
  }
}
```

### 3.4 connect 命令
```bash
silktalk connect <multiaddr>

Arguments:
  multiaddr                       对等点多地址
```

**示例**:
```bash
silktalk connect /ip4/192.168.1.100/tcp/4001/p2p/12D3KooW...
```

### 3.5 peers 命令
```bash
silktalk peers [options]

Options:
  --json                           以 JSON 格式输出
  --connected                      仅显示已连接的对等点
```

### 3.6 send 命令
```bash
silktalk send <peer> <message>

Arguments:
  peer                            对等点 ID 或别名
  message                         消息内容

Options:
  --wait-ack                       等待确认
  --timeout <ms>                  超时时间 (毫秒)
```

**示例**:
```bash
silktalk send 12D3KooW... "Hello, World!"
silktalk send 12D3KooW... "Urgent message" --wait-ack --timeout 5000
```

### 3.7 listen 命令
```bash
silktalk listen [options]

Options:
  --format <format>               输出格式 (json, pretty)
  --filter <pattern>              按模式过滤消息
```

**示例**:
```bash
# 监听所有消息
silktalk listen

# JSON 格式输出
silktalk listen --format json
```

### 3.8 dht 命令
```bash
silktalk dht <subcommand>

Subcommands:
  get <key>                       从 DHT 获取值
  put <key> <value>               存储值到 DHT
  find-peer <peerId>              在 DHT 中查找对等点
  provide <cid>                   宣布提供内容
  find-providers <cid>            查找内容提供者
```

**示例**:
```bash
silktalk dht put my-key "my-value"
silktalk dht get my-key
silktalk dht find-peer 12D3KooW...
```

### 3.9 config 命令
```bash
silktalk config <subcommand>

Subcommands:
  init                             初始化默认配置
  get <key>                       获取配置值
  set <key> <value>               设置配置值
  list                             列出所有配置
```

**示例**:
```bash
silktalk config init
silktalk config set log.level debug
silktalk config get log.level
silktalk config list
```

### 3.10 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `SILKTALK_LOG_LEVEL` | 日志级别 | `info` |
| `SILKTALK_CONFIG_PATH` | 配置文件路径 | `~/.silktalk/config.json` |
| `SILKTALK_DATA_PATH` | 数据目录 | `~/.silktalk/data` |
| `SILKTALK_PRIVATE_KEY` | 私钥 (hex) | 自动生成 |

---

## 4. 网络协议接口

### 4.1 传输协议

#### 4.1.1 TCP
- **协议**: TCP
- **地址格式**: `/ip4/{ip}/tcp/{port}` 或 `/ip6/{ip}/tcp/{port}`
- **加密**: Noise Protocol
- **复用**: Yamux

#### 4.1.2 WebSocket
- **协议**: WebSocket
- **地址格式**: `/ip4/{ip}/tcp/{port}/ws` 或 `/ip4/{ip}/tcp/{port}/wss`
- **加密**: TLS (wss) 或 Noise (ws)

#### 4.1.3 Circuit Relay
- **协议**: Circuit Relay V2
- **地址格式**: `/p2p/{relay-peer}/p2p-circuit/p2p/{target-peer}`
- **用途**: NAT 穿透失败时的备用连接

### 4.2 应用协议

#### 4.2.1 SilkTalk 消息协议
- **协议 ID**: `/silktalk/1.0.0/messages`
- **编码**: JSON
- **流复用**: Yamux

**协议流程**:
```
1. 发起方打开到目标的对流
2. 使用 /silktalk/1.0.0/messages 协议
3. 发送 length-prefixed 消息
4. 可选接收 ACK
5. 关闭流
```

#### 4.2.2 消息格式
```
[Length (varint)] [Message JSON (UTF-8)]
```

**示例**:
```json
{
  "header": {
    "version": 1,
    "type": 1,
    "id": "1708617600000-abc123",
    "timestamp": 1708617600000,
    "sender": "12D3KooW..."
  },
  "payload": {
    "content": "Hello, World!",
    "encoding": "utf-8"
  },
  "metadata": null
}
```

### 4.3 发现协议

#### 4.3.1 mDNS
- **服务类型**: `_p2p._udp.local`
- **端口**: 随机
- **TTL**: 120 秒

#### 4.3.2 DHT (Kademlia)
- **协议**: `/ipfs/kad/1.0.0`
- **K值**: 20
- **Alpha**: 3
- **刷新间隔**: 1 小时

---

## 5. 附录

### 5.1 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk Team | 初始版本 |

### 5.2 审核记录

| 审核轮次 | 审核日期 | 审核人 | 结果 | 备注 |
|----------|----------|--------|------|------|
| 1 | | | | |

### 5.3 批准签字

**API 设计师**: _________________ 日期: _______

**开发负责人**: _________________ 日期: _______

**项目经理**: _________________ 日期: _______

---

**文档结束**
