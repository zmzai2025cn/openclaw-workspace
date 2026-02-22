# 详细设计文档 (LLD)
## Low-Level Design Document

**文档编号**: STP-LLD-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro 开发团队  
**审核人**: 待签字  

---

## 1. 引言

### 1.1 目的
本文档提供 SilkTalk Pro 系统的详细设计，包括类设计、算法、数据结构和实现细节。

### 1.2 范围
本文档基于 HLD 文档，详细描述每个模块的内部实现。

### 1.3 参考资料
- STP-SRS-001 需求规格说明书
- STP-HLD-001 概要设计文档
- TypeScript 编码规范

---

## 2. Core Layer 详细设计

### 2.1 SilkNode 类

#### 2.1.1 类定义
```typescript
export class SilkNode extends EventEmitter {
  private config: SilkNodeConfig;
  private configManager: ConfigManager;
  private logger: Logger;
  private started = false;
  private libp2p: Libp2p | null = null;
  private identityManager: IdentityManager;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private peerDiscovery: PeerDiscovery;
  private dhtRouting: DHTRouting;
  private natTraversal: NatTraversal;

  constructor(config?: Partial<SilkNodeConfig>);
  async start(): Promise<void>;
  async stop(): Promise<void>;
  // ... 其他方法
}
```

#### 2.1.2 启动流程
```
start()
  ├── 检查是否已启动
  ├── 加载/创建身份
  │   └── identityManager.loadOrCreate()
  ├── 构建 libp2p 配置
  │   └── buildLibp2pConfig()
  ├── 创建 libp2p 节点
  │   └── createLibp2p()
  ├── 设置事件处理器
  │   └── setupEventHandlers()
  ├── 设置协议处理器
  │   └── messageHandler.setup()
  ├── 启动 libp2p
  │   └── libp2p.start()
  ├── 启动组件
  │   ├── dhtRouting.start()
  │   └── peerDiscovery.start()
  ├── 检测 NAT 类型
  │   └── natTraversal.detectNatType()
  └── 标记为已启动
```

#### 2.1.3 配置合并算法
```typescript
private mergeConfig(
  base: SilkNodeConfig, 
  override: Partial<SilkNodeConfig>
): SilkNodeConfig {
  return {
    ...base,
    ...override,
    transports: { ...base.transports, ...override.transports },
    nat: { ...base.nat, ...override.nat },
    relay: {
      ...base.relay,
      hop: { ...base.relay?.hop, ...override.relay?.hop },
      autoRelay: { ...base.relay?.autoRelay, ...override.relay?.autoRelay }
    },
    discovery: { ...base.discovery, ...override.discovery },
    connection: { ...base.connection, ...override.connection },
    logging: { ...base.logging, ...override.logging }
  };
}
```

### 2.2 IdentityManager 类

#### 2.2.1 密钥生成算法
```typescript
async createNewIdentity(): Promise<PeerId> {
  // 1. 创建临时 libp2p 节点生成身份
  const node = await createLibp2p({ addresses: { listen: [] } });
  const peerId = node.peerId;
  
  // 2. 生成随机密钥 (生产环境使用 proper key export)
  const randomKey = crypto.getRandomValues(new Uint8Array(32));
  this.privateKey = randomKey;
  
  // 3. 保存到文件
  await mkdir(dir, { recursive: true });
  await writeFile(this.keyPath, this.privateKey, { mode: 0o600 });
  
  // 4. 清理临时节点
  await node.stop();
  
  return peerId;
}
```

#### 2.2.2 密钥存储格式
```
文件: ~/.silktalk/identity.key
权限: 600 (rw-------)
格式: 原始字节 (32 bytes for Ed25519 private key)
备份: 支持导出为 hex 编码
```

### 2.3 ConfigManager 类

#### 2.3.1 配置层级
```
优先级 (高 → 低):
1. 命令行参数
2. 环境变量 (SILKTALK_*)
3. 配置文件 (~/.silktalk/config.json)
4. 代码默认值 (DEFAULT_CONFIG)
```

#### 2.3.2 环境变量映射
```typescript
export function loadConfigFromEnv(): Partial<SilkNodeConfig> {
  const config: Partial<SilkNodeConfig> = {};

  if (process.env.SILKTALK_LOG_LEVEL) {
    config.logging = {
      ...config.logging,
      level: process.env.SILKTALK_LOG_LEVEL as LogLevel
    };
  }

  if (process.env.SILKTALK_PRIVATE_KEY) {
    config.privateKey = Buffer.from(
      process.env.SILKTALK_PRIVATE_KEY.replace('0x', ''), 
      'hex'
    );
  }

  if (process.env.SILKTALK_CONFIG_PATH) {
    // 配置路径由 ConfigManager 处理
  }

  return config;
}
```

### 2.4 Logger 类

#### 2.4.1 日志级别
```typescript
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

// 级别优先级
trace (10) < debug (20) < info (30) < warn (40) < error (50)
```

#### 2.4.2 结构化日志格式
```json
{
  "level": 30,
  "time": 1708617600000,
  "pid": 1234,
  "hostname": "server-01",
  "name": "silktalk",
  "component": "SilkNode",
  "msg": "Node started successfully"
}
```

---

## 3. Network Layer 详细设计

### 3.1 ConnectionManager 类

#### 3.1.1 连接池数据结构
```typescript
interface ConnectionStats {
  peerId: string;
  connection: Connection;
  establishedAt: Date;
  lastActivity: Date;
  bytesSent: number;
  bytesReceived: number;
  latency: number;
}

// 连接池存储
private connections: Map<string, ConnectionStats[]> = new Map();
```

#### 3.1.2 连接选择算法
```typescript
getConnection(peerId: string): Connection | null {
  const connections = this.connections.get(peerId);
  if (!connections || connections.length === 0) {
    return null;
  }

  // 按延迟和活跃度排序
  const sorted = connections.sort((a, b) => {
    if (a.latency !== b.latency) {
      return a.latency - b.latency;  // 优先低延迟
    }
    return b.lastActivity.getTime() - a.lastActivity.getTime();  // 其次活跃度
  });

  return sorted[0]?.connection ?? null;
}
```

#### 3.1.3 连接清理算法
```typescript
pruneConnections(): void {
  const now = Date.now();
  
  for (const [peerId, connections] of this.connections) {
    const toKeep: ConnectionStats[] = [];
    
    for (const stats of connections) {
      const idleTime = now - stats.lastActivity.getTime();
      
      if (idleTime > this.config.idleTimeout) {
        // 关闭空闲连接
        stats.connection.close();
      } else {
        toKeep.push(stats);
      }
    }
    
    if (toKeep.length === 0) {
      this.connections.delete(peerId);
    } else {
      this.connections.set(peerId, toKeep);
    }
  }
  
  // 如果连接数过多，关闭最老的连接
  const total = this.getConnectionCount();
  if (total > this.config.maxConnections) {
    this.closeOldestConnections(total - this.config.maxConnections);
  }
}
```

### 3.2 TransportManager 类

#### 3.2.1 传输协议检测
```typescript
getPreferredTransport(targetAddr: string): string | null {
  // WebSocket 优先
  if (targetAddr.includes('/ws') || targetAddr.includes('/wss')) {
    return this.transports.has('websocket') ? 'websocket' : null;
  }
  
  // TCP 次之
  if (targetAddr.includes('/tcp')) {
    return this.transports.has('tcp') ? 'tcp' : null;
  }
  
  // 中继最后
  if (targetAddr.includes('/p2p-circuit/')) {
    return this.transports.has('relay') ? 'relay' : null;
  }
  
  // 默认 TCP
  return this.transports.has('tcp') ? 'tcp' : 'websocket';
}
```

#### 3.2.2 地址同步机制
```typescript
private syncWithLibp2p(): void {
  if (!this.libp2p) return;

  const multiaddrs = this.libp2p.getMultiaddrs();
  
  for (const addr of multiaddrs) {
    const addrStr = addr.toString();
    
    if (addrStr.includes('/tcp/')) {
      if (addrStr.includes('/ws') || addrStr.includes('/wss')) {
        this.updateTransportAddress('websocket', addrStr);
      } else {
        this.updateTransportAddress('tcp', addrStr);
      }
    }
    
    if (addrStr.includes('/p2p-circuit/')) {
      this.updateTransportAddress('relay', addrStr);
    }
  }
}
```

### 3.3 NatTraversal 类

#### 3.3.1 NAT 检测算法
```typescript
async detectNatType(): Promise<NatInfo> {
  // 1. 尝试 UPnP (最可靠)
  if (this.config.upnp) {
    const upnpResult = await this.tryUpnp();
    if (upnpResult) return upnpResult;
  }

  // 2. 尝试 AutoNAT
  if (this.config.autonat) {
    const autonatResult = await this.tryAutoNat();
    if (autonatResult) return autonatResult;
  }

  // 3. 无法确定
  return {
    type: 'unknown',
    supportsUpnp: false,
    supportsPmp: false
  };
}
```

#### 3.3.2 NAT 策略映射
```typescript
getRecommendedStrategy(): NatStrategy {
  switch (this.natInfo.type) {
    case 'full-cone':
      return {
        directConnection: true,
        useStun: true,
        useTurn: false,
        useRelay: false,
        holePunching: false
      };
    
    case 'restricted':
    case 'port-restricted':
      return {
        directConnection: true,
        useStun: true,
        useTurn: false,
        useRelay: true,  // 备用
        holePunching: true
      };
    
    case 'symmetric':
      return {
        directConnection: false,
        useStun: false,
        useTurn: true,
        useRelay: true,
        holePunching: false
      };
    
    default:
      return {
        directConnection: true,
        useStun: true,
        useTurn: true,
        useRelay: true,
        holePunching: true
      };
  }
}
```

---

## 4. Routing Layer 详细设计

### 4.1 PeerDiscovery 类

#### 4.1.1 发现机制优先级
```
1. mDNS (本地网络，延迟 < 1s)
2. Bootstrap (配置节点，延迟 < 5s)
3. DHT (全局网络，延迟 < 30s)
```

#### 4.1.2 对等点存储结构
```typescript
interface DiscoveryEvent {
  type: 'peer' | 'provider';
  peerId: string;
  addresses: string[];
  protocols?: string[];
  metadata?: Record<string, unknown>;
}

// 使用 Map 存储，键为 peerId
private discoveredPeers: Map<string, DiscoveryEvent> = new Map();
```

#### 4.1.3 地址合并算法
```typescript
addPeer(event: DiscoveryEvent): void {
  const existing = this.discoveredPeers.get(event.peerId);
  
  if (existing) {
    // 合并地址（去重）
    const mergedAddresses = [
      ...new Set([...existing.addresses, ...event.addresses])
    ];
    existing.addresses = mergedAddresses;
    
    // 合并元数据
    if (event.metadata) {
      existing.metadata = { ...existing.metadata, ...event.metadata };
    }
    
    // 更新协议
    if (event.protocols) {
      existing.protocols = event.protocols;
    }
  } else {
    this.discoveredPeers.set(event.peerId, event);
    this.emit('peer', event);
  }
}
```

### 4.2 DHTRouting 类

#### 4.2.1 本地存储结构
```typescript
interface DHTRecord {
  key: string;
  value: Uint8Array;
  timestamp: number;  // 创建时间
  ttl: number;        // 存活时间 (ms)
}

private localRecords: Map<string, DHTRecord> = new Map();
```

#### 4.2.2 TTL 清理算法
```typescript
async cleanup(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of this.localRecords) {
    if (now > record.timestamp + record.ttl) {
      this.localRecords.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}
```

#### 4.2.3 读写流程
```
put(key, value, ttl)
  ├── 创建 DHTRecord
  ├── 存储到 localRecords
  └── 如果 libp2p DHT 可用
      └── 写入网络 DHT

get(key)
  ├── 检查 localRecords
  │   ├── 存在且未过期 → 返回
  │   └── 过期 → 删除
  ├── 如果 libp2p DHT 可用
  │   └── 从网络 DHT 读取
  └── 返回 null
```

---

## 5. Protocol Layer 详细设计

### 5.1 MessageHandler 类

#### 5.1.1 消息格式
```typescript
interface SilkMessage {
  header: {
    version: number;      // 协议版本
    type: MessageType;    // 消息类型
    id: string;           // 消息唯一 ID
    timestamp: number;    // 发送时间戳
    sender: string;       // 发送者 PeerId
    recipient?: string;   // 接收者 PeerId (可选)
  };
  payload: MessagePayload;  // 消息内容
  metadata?: Record<string, unknown>;  // 扩展元数据
}
```

#### 5.1.2 序列化算法
```typescript
encodeMessage(message: SilkMessage): Uint8Array {
  const data = {
    header: {
      ...message.header,
      recipient: message.header.recipient ?? null
    },
    payload: message.payload,
    metadata: message.metadata ?? null
  };
  return new TextEncoder().encode(JSON.stringify(data));
}

decodeMessage(data: Uint8Array): SilkMessage {
  const decoded = JSON.parse(new TextDecoder().decode(data));
  
  return {
    header: {
      version: decoded.header.version,
      type: decoded.header.type as MessageType,
      id: decoded.header.id,
      timestamp: decoded.header.timestamp,
      sender: decoded.header.sender,
      recipient: decoded.header.recipient ?? undefined
    },
    payload: decoded.payload as MessagePayload,
    metadata: decoded.metadata ?? undefined
  };
}
```

#### 5.1.3 消息验证规则
```typescript
validateMessage(message: SilkMessage): void {
  // 1. 版本检查
  if (message.header.version !== 1) {
    throw new ValidationError(
      `Unsupported protocol version: ${message.header.version}`
    );
  }

  // 2. 类型检查
  if (!Object.values(MessageType).includes(message.header.type)) {
    throw new ValidationError(
      `Invalid message type: ${message.header.type}`
    );
  }

  // 3. ID 检查
  if (!message.header.id || typeof message.header.id !== 'string') {
    throw new ValidationError('Invalid message ID');
  }

  // 4. 时间戳检查 (允许 ±5 分钟偏差)
  const now = Date.now();
  const messageTime = message.header.timestamp;
  if (Math.abs(now - messageTime) > 5 * 60 * 1000) {
    throw new ValidationError('Message timestamp out of acceptable range');
  }

  // 5. 发送者检查
  if (!message.header.sender || typeof message.header.sender !== 'string') {
    throw new ValidationError('Invalid sender');
  }
}
```

#### 5.1.4 协议处理流程
```
setup(libp2p, onMessage)
  └── 注册协议处理器 /silktalk/1.0.0/messages
      └── 处理传入流
          ├── 解码消息 (lp.decode)
          ├── 解析消息 (decodeMessage)
          ├── 验证消息 (validateMessage)
          ├── 触发回调 (onMessage)
          └── 发送 ACK (如果需要)
```

---

## 6. Application Layer 详细设计

### 6.1 CLI 命令处理

#### 6.1.1 命令路由表
```typescript
const commands = {
  'start': handleStart,
  'stop': handleStop,
  'status': handleStatus,
  'connect': handleConnect,
  'peers': handlePeers,
  'send': handleSend,
  'listen': handleListen,
  'dht': {
    'get': handleDhtGet,
    'put': handleDhtPut
  },
  'config': {
    'init': handleConfigInit,
    'get': handleConfigGet,
    'set': handleConfigSet,
    'list': handleConfigList
  }
};
```

#### 6.1.2 启动命令流程
```
start command
  ├── 解析命令行参数
  ├── 设置日志
  ├── 构建配置
  ├── 创建 SilkNode
  ├── 设置事件处理器
  ├── 启动节点
  ├── 启动 Bridge (如果启用)
  ├── 打印状态信息
  └── 进入事件循环
```

### 6.2 OpenClawBridge 类

#### 6.2.1 命令注册表
```typescript
private commandHandlers: Map<
  string, 
  (args: Record<string, unknown>) => Promise<CommandResult>
> = new Map();

// 默认命令
registerDefaultCommands() {
  this.registerCommand('status', async () => {...});
  this.registerCommand('peers', async () => {...});
  this.registerCommand('connect', async (args) => {...});
  this.registerCommand('disconnect', async (args) => {...});
}
```

#### 6.2.2 命令执行流程
```
executeCommand(command, args)
  ├── 查找命令处理器
  ├── 如果找到
  │   └── 执行处理器
  │       ├── 成功 → 返回 { success: true, data }
  │       └── 失败 → 返回 { success: false, error }
  └── 如果未找到
      └── 返回 { success: false, error: 'Unknown command' }
```

---

## 7. 数据结构设计

### 7.1 核心数据结构

#### 7.1.1 配置结构
```typescript
interface SilkNodeConfig {
  privateKey?: Uint8Array;
  listenAddresses?: string[];
  announceAddresses?: string[];
  transports?: {
    tcp?: boolean | TcpConfig;
    websocket?: boolean | WsConfig;
  };
  nat?: {
    upnp?: boolean;
    autonat?: boolean;
    dcutr?: boolean;
  };
  relay?: {
    enabled?: boolean;
    hop?: { enabled?: boolean; active?: boolean };
    autoRelay?: { enabled?: boolean; maxListeners?: number };
  };
  discovery?: {
    mdns?: boolean;
    dht?: boolean | DHTConfig;
    bootstrap?: string[];
  };
  connection?: {
    maxConnections?: number;
    minConnections?: number;
    maxConnectionsPerPeer?: number;
  };
  logging?: {
    level?: LogLevel;
    pretty?: boolean;
  };
}
```

#### 7.1.2 消息结构
```typescript
enum MessageType {
  HELLO = 0,
  TEXT = 1,
  DATA = 2,
  COMMAND = 3,
  ACK = 4,
  ERROR = 5
}

type MessagePayload =
  | HelloPayload
  | TextPayload
  | DataPayload
  | CommandPayload
  | AckPayload
  | ErrorPayload;
```

### 7.2 存储结构

#### 7.2.1 文件系统布局
```
~/.silktalk/
├── config.json          # 配置文件 (权限 644)
├── identity.key         # 私钥 (权限 600)
├── data/
│   ├── dht/            # DHT 数据
│   ├── logs/           # 日志文件
│   └── cache/          # 缓存数据
└── backups/            # 备份目录
```

#### 7.2.2 配置文件格式
```json
{
  "listenAddresses": ["/ip4/0.0.0.0/tcp/0"],
  "announceAddresses": [],
  "transports": {
    "tcp": true,
    "websocket": true
  },
  "nat": {
    "upnp": true,
    "autonat": true,
    "dcutr": true
  },
  "relay": {
    "enabled": true,
    "hop": { "enabled": false, "active": false },
    "autoRelay": { "enabled": true, "maxListeners": 2 }
  },
  "discovery": {
    "mdns": true,
    "dht": true,
    "bootstrap": []
  },
  "connection": {
    "maxConnections": 300,
    "minConnections": 10,
    "maxConnectionsPerPeer": 5
  },
  "logging": {
    "level": "info",
    "pretty": false
  }
}
```

---

## 8. 算法设计

### 8.1 消息 ID 生成
```typescript
private generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
// 格式: 1708617600000-abc123xyz
```

### 8.2 指数退避重连
```typescript
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000;  // 1 second
  const maxDelay = 30000;  // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000;  // 添加抖动
}
```

### 8.3 连接负载均衡
```typescript
selectBestConnection(connections: ConnectionStats[]): Connection {
  return connections
    .filter(c => Date.now() - c.lastActivity.getTime() < this.idleTimeout)
    .sort((a, b) => {
      // 优先选择低延迟连接
      if (a.latency !== b.latency) return a.latency - b.latency;
      // 其次选择活跃的连接
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    })[0]?.connection;
}
```

---

## 9. 错误处理设计

### 9.1 错误类层次
```
Error
└── SilkTalkError
    ├── ConnectionError
    ├── ProtocolError
    ├── ValidationError
    ├── DHTError
    └── NATError
```

### 9.2 错误代码定义
```typescript
enum ErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  PROTOCOL_NOT_SUPPORTED = 'PROTOCOL_NOT_SUPPORTED',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  PEER_NOT_FOUND = 'PEER_NOT_FOUND',
  DHT_TIMEOUT = 'DHT_TIMEOUT',
  NAT_DETECTION_FAILED = 'NAT_DETECTION_FAILED',
  IDENTITY_NOT_FOUND = 'IDENTITY_NOT_FOUND'
}
```

### 9.3 错误处理策略
```typescript
try {
  await operation();
} catch (error) {
  if (error instanceof ConnectionError && error.retryable) {
    // 重试逻辑
    await retryWithBackoff(operation);
  } else if (error instanceof ValidationError) {
    // 记录并继续
    logger.warn(`Validation error: ${error.message}`);
  } else {
    // 向上传播
    throw error;
  }
}
```

---

## 10. 附录

### 10.1 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk Team | 初始版本 |

### 10.2 审核记录

| 审核轮次 | 审核日期 | 审核人 | 结果 | 备注 |
|----------|----------|--------|------|------|
| 1 | | | | |

### 10.3 批准签字

**开发负责人**: _________________ 日期: _______

**架构师**: _________________ 日期: _______

**项目经理**: _________________ 日期: _______

---

**文档结束**
