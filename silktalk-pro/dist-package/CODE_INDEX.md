# SilkTalk Pro 代码索引

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**用途**: 源代码导航和快速定位

---

## 📁 目录结构总览

```
src/
├── index.ts              # 主入口，导出公共 API
├── core/                 # 核心模块 - 节点生命周期、身份、配置
├── network/              # 网络模块 - 连接、传输、NAT
├── protocol/             # 协议模块 - 消息处理
├── routing/              # 路由模块 - DHT、节点发现
├── bridge/               # 桥接模块 - OpenClaw 集成
└── cli/                  # CLI 模块 - 命令行接口
```

---

## 🔧 核心模块 (src/core/)

### node.ts - 主节点实现

**文件**: [src/core/node.ts](src/core/node.ts)

**描述**: SilkNode 是系统的核心类，管理 libp2p 节点生命周期，协调各层组件。

**主要类**:
- `SilkNode` - 主节点类，P2P 网络入口

**关键方法**:
```typescript
// 生命周期
async start(): Promise<void>      // 启动节点
async stop(): Promise<void>       // 停止节点
isStarted(): boolean              // 检查启动状态

// 连接管理
async dial(multiaddr: string): Promise<Connection>  // 连接对等点
async hangUp(peerId: string): Promise<void>         // 断开连接
isConnected(peerId: string): boolean                // 检查连接状态
getPeers(): string[]                                // 获取对等点列表

// 消息通信
async sendMessage(peerId: string, message: SilkMessage): Promise<void>
onMessage(handler: MessageHandler): () => void

// 信息获取
get peerId(): PeerId              // 获取节点 ID
getMultiaddrs(): Multiaddr[]      // 获取监听地址
```

**使用场景**:
- 启动/停止 P2P 节点
- 发送/接收消息
- 管理对等点连接

---

### config.ts - 配置管理

**文件**: [src/core/config.ts](src/core/config.ts)

**描述**: 负责配置的加载、保存、合并和管理。

**主要类**:
- `ConfigManager` - 配置管理器

**关键方法**:
```typescript
async load(): Promise<SilkNodeConfig>     // 加载配置
async save(): Promise<void>               // 保存配置
get(): SilkNodeConfig                     // 获取当前配置
set(config: Partial<SilkNodeConfig>): void // 更新配置
setValue(key: string, value: unknown): void // 设置单个值
getValue(key: string): unknown            // 获取单个值
```

**配置优先级** (高到低):
1. 命令行参数
2. 环境变量 (SILKTALK_*)
3. 配置文件 (~/.silktalk/config.json)
4. 代码默认值

**使用场景**:
- 读取/修改节点配置
- 环境感知配置

---

### identity.ts - 身份管理

**文件**: [src/core/identity.ts](src/core/identity.ts)

**描述**: 管理节点的加密身份，包括密钥生成、加载和导出。

**主要类**:
- `IdentityManager` - 身份管理器

**关键方法**:
```typescript
async loadOrCreate(options?: IdentityOptions): Promise<PeerId>  // 加载或创建身份
async createNewIdentity(): Promise<PeerId>                     // 创建新身份
getPeerId(): PeerId                                            // 获取 PeerId
getPrivateKey(): Uint8Array                                    // 获取私钥
async exportToPath(path: string): Promise<void>               // 导出身份
```

**密钥存储**:
- 路径: `~/.silktalk/identity.key`
- 权限: 600 (rw-------)
- 格式: 原始字节 (32 bytes for Ed25519)

**使用场景**:
- 节点身份管理
- 密钥备份/恢复

---

### logger.ts - 日志系统

**文件**: [src/core/logger.ts](src/core/logger.ts)

**描述**: 结构化日志系统，基于 Pino。

**主要类**:
- `Logger` - 日志记录器

**日志级别**:
```typescript
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'
// 优先级: trace(10) < debug(20) < info(30) < warn(40) < error(50)
```

**使用场景**:
- 应用日志记录
- 调试和监控

---

### types.ts - 类型定义

**文件**: [src/core/types.ts](src/core/types.ts)

**描述**: 核心类型定义，包括配置、消息、状态等接口。

**主要类型**:
```typescript
interface SilkNodeConfig      // 节点配置
interface SilkMessage         // 消息结构
interface ConnectionStats     // 连接统计
enum MessageType              // 消息类型枚举
enum ConnectionState          // 连接状态枚举
type LogLevel                 // 日志级别
type TransportType            // 传输类型
```

**使用场景**:
- 类型导入和引用
- 接口定义

---

## 🌐 网络模块 (src/network/)

### connection-manager.ts - 连接管理

**文件**: [src/network/connection-manager.ts](src/network/connection-manager.ts)

**描述**: 管理对等点连接池，维护最优连接。

**主要类**:
- `ConnectionManager` - 连接管理器

**关键方法**:
```typescript
addConnection(peerId: string, connection: Connection): void      // 添加连接
removeConnection(peerId: string, connectionId: string): void     // 移除连接
getConnection(peerId: string): Connection | null                 // 获取连接
getConnections(peerId?: string): Connection[]                    // 获取所有连接
isConnected(peerId: string): boolean                             // 检查连接状态
closeConnection(peerId: string, connectionId?: string): void      // 关闭连接
closeAllConnections(): void                                      // 关闭所有连接
pruneConnections(): void                                         // 清理空闲连接
getStats(): ConnectionStats                                      // 获取统计信息
```

**配置参数**:
- maxConnections: 300 (最大连接数)
- minConnections: 10 (最小连接数)
- maxConnectionsPerPeer: 5 (每对等点最大连接数)
- connectionTimeout: 30000ms (连接超时)
- idleTimeout: 60000ms (空闲超时)

**使用场景**:
- 连接池管理
- 连接负载均衡
- 空闲连接清理

---

### transport-manager.ts - 传输管理

**文件**: [src/network/transport-manager.ts](src/network/transport-manager.ts)

**描述**: 管理多种传输协议 (TCP, WebSocket, Circuit Relay)。

**主要类**:
- `TransportManager` - 传输管理器

**关键方法**:
```typescript
async initialize(): Promise<void>                    // 初始化传输
getEnabledTransports(): string[]                     // 获取启用的传输
getTransportInfo(type: string): TransportInfo        // 获取传输信息
getAllTransportInfo(): TransportInfo[]               // 获取所有传输信息
getListenAddresses(): string[]                       // 获取监听地址
getPreferredTransport(targetAddr: string): string    // 获取首选传输
```

**支持的传输**:
| 传输 | 优先级 | 用途 |
|------|--------|------|
| TCP | 高 | 默认直接连接 |
| WebSocket | 中 | 防火墙友好 |
| Circuit Relay | 低 | 直接连接失败时回退 |

**使用场景**:
- 传输协议选择
- 地址管理

---

### nat-traversal.ts - NAT 穿透

**文件**: [src/network/nat-traversal.ts](src/network/nat-traversal.ts)

**描述**: 检测和穿透 NAT，支持 UPnP、AutoNAT、DCUtR。

**主要类**:
- `NatTraversal` - NAT 穿透管理器

**关键方法**:
```typescript
async detectNatType(): Promise<NatInfo>              // 检测 NAT 类型
getNatInfo(): NatInfo                                // 获取 NAT 信息
isPubliclyReachable(): boolean                       // 检查公网可达性
requiresRelay(): boolean                             // 检查是否需要中继
getRecommendedStrategy(): NatStrategy                // 获取推荐策略
```

**NAT 类型**:
- full-cone (全锥型)
- restricted (受限型)
- port-restricted (端口受限型)
- symmetric (对称型)
- unknown (未知)

**使用场景**:
- NAT 类型检测
- 穿透策略选择

---

## 📡 协议模块 (src/protocol/)

### handler.ts - 消息协议处理

**文件**: [src/protocol/handler.ts](src/protocol/handler.ts)

**描述**: 处理 SilkTalk 消息协议，包括编码、解码、验证。

**主要类**:
- `MessageHandler` - 消息处理器

**关键方法**:
```typescript
async setup(libp2p: Libp2p, onMessage: MessageCallback): Promise<void>  // 设置处理器
async sendMessage(libp2p: Libp2p, peerId: PeerId, message: SilkMessage): Promise<void>
encodeMessage(message: SilkMessage): Uint8Array        // 编码消息
decodeMessage(data: Uint8Array): SilkMessage          // 解码消息
validateMessage(message: SilkMessage): void           // 验证消息
```

**协议标识**: `/silktalk/1.0.0/messages`

**消息类型**:
| 类型 | 值 | 用途 |
|------|-----|------|
| HELLO | 0 | 握手消息 |
| TEXT | 1 | 文本消息 |
| DATA | 2 | 数据消息 |
| COMMAND | 3 | 命令消息 |
| ACK | 4 | 确认消息 |
| ERROR | 5 | 错误消息 |

**消息格式**:
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

**使用场景**:
- 消息发送/接收
- 协议处理

---

## 🗺️ 路由模块 (src/routing/)

### dht.ts - DHT 路由

**文件**: [src/routing/dht.ts](src/routing/dht.ts)

**描述**: DHT 操作和数据存储，基于 Kademlia。

**主要类**:
- `DHTRouting` - DHT 路由管理器

**关键方法**:
```typescript
async start(): Promise<void>                          // 启动 DHT
async stop(): Promise<void>                           // 停止 DHT
async put(key: string, value: Uint8Array, ttl?: number): Promise<void>  // 存储数据
async get(key: string): Promise<Uint8Array | null>    // 检索数据
async delete(key: string): Promise<boolean>           // 删除数据
async has(key: string): Promise<boolean>              // 检查存在
async keys(): Promise<string[]>                       // 获取所有键
getStats(): DHTStats                                  // 获取统计信息
```

**使用场景**:
- 分布式数据存储
- 内容路由

---

### discovery.ts - 节点发现

**文件**: [src/routing/discovery.ts](src/routing/discovery.ts)

**描述**: 对等点发现机制，支持 mDNS、DHT、Bootstrap。

**主要类**:
- `PeerDiscovery` - 节点发现管理器

**关键方法**:
```typescript
async start(): Promise<void>                          // 启动发现
async stop(): Promise<void>                           // 停止发现
addPeer(event: DiscoveryEvent): void                  // 添加对等点
removePeer(peerId: string): boolean                   // 移除对等点
getPeers(): DiscoveryEvent[]                          // 获取所有对等点
getPeer(peerId: string): DiscoveryEvent | undefined   // 获取单个对等点
hasPeer(peerId: string): boolean                      // 检查对等点存在
findPeersByProtocol(protocol: string): DiscoveryEvent[]  // 按协议查找
```

**发现机制优先级**:
1. mDNS (本地网络，延迟 < 1s)
2. Bootstrap (配置节点，延迟 < 5s)
3. DHT (全局网络，延迟 < 30s)

**使用场景**:
- 节点发现
- 网络加入

---

## 🔗 桥接模块 (src/bridge/)

### openclaw.ts - OpenClaw 桥接

**文件**: [src/bridge/openclaw.ts](src/bridge/openclaw.ts)

**描述**: OpenClaw 代理系统集成，提供外部通信接口。

**主要类**:
- `OpenClawBridge` - OpenClaw 桥接器

**关键方法**:
```typescript
async start(): Promise<void>                          // 启动桥接
async stop(): Promise<void>                           // 停止桥接
registerCommand(name: string, handler: CommandHandler): void      // 注册命令
unregisterCommand(name: string): boolean              // 注销命令
async executeCommand(command: string, args: Record<string, unknown>): Promise<CommandResult>
```

**默认命令**:
- `status` - 获取节点状态
- `peers` - 获取对等点列表
- `connect` - 连接到对等点
- `disconnect` - 断开连接

**使用场景**:
- OpenClaw 集成
- 外部命令执行

---

## 💻 CLI 模块 (src/cli/)

### index.ts - 命令行接口

**文件**: [src/cli/index.ts](src/cli/index.ts)

**描述**: 命令行界面，基于 Commander.js。

**命令列表**:
| 命令 | 描述 |
|------|------|
| `start` | 启动节点 |
| `stop` | 停止节点 |
| `status` | 查看节点状态 |
| `connect <addr>` | 连接对等点 |
| `peers` | 列出对等点 |
| `send <peer> <msg>` | 发送消息 |
| `listen` | 监听消息 |
| `dht get <key>` | DHT 获取 |
| `dht put <key> <value>` | DHT 存储 |
| `config init` | 初始化配置 |
| `config get <key>` | 获取配置项 |
| `config set <key> <value>` | 设置配置项 |
| `config list` | 列出所有配置 |

**使用场景**:
- 节点管理
- 交互式操作

---

## 📊 代码依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (CLI, OpenClawBridge)                          │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                            │
│              (MessageHandler)                               │
├─────────────────────────────────────────────────────────────┤
│                     Routing Layer                            │
│           (PeerDiscovery, DHTRouting)                       │
├─────────────────────────────────────────────────────────────┤
│                     Network Layer                            │
│    (ConnectionManager, TransportManager, NatTraversal)      │
├─────────────────────────────────────────────────────────────┤
│                      Core Layer                              │
│         (SilkNode, ConfigManager, IdentityManager)          │
└─────────────────────────────────────────────────────────────┘
```

### 核心依赖图

```
SilkNode
├── IdentityManager
├── ConfigManager
├── ConnectionManager
│   └── TransportManager
│       └── NatTraversal
├── MessageHandler
├── PeerDiscovery
│   └── DHTRouting
└── OpenClawBridge (可选)
```

---

## 🔍 快速定位指南

### 按功能定位

| 功能 | 查看文件 |
|------|----------|
| 启动/停止节点 | src/core/node.ts |
| 修改配置 | src/core/config.ts |
| 管理身份密钥 | src/core/identity.ts |
| 建立连接 | src/network/connection-manager.ts |
| 添加传输协议 | src/network/transport-manager.ts |
| NAT 穿透 | src/network/nat-traversal.ts |
| 发送/接收消息 | src/protocol/handler.ts |
| 节点发现 | src/routing/discovery.ts |
| DHT 操作 | src/routing/dht.ts |
| OpenClaw 集成 | src/bridge/openclaw.ts |
| 添加 CLI 命令 | src/cli/index.ts |

### 按问题定位

| 问题 | 查看文件 |
|------|----------|
| 节点无法启动 | src/core/node.ts, src/core/config.ts |
| 连接失败 | src/network/connection-manager.ts, src/network/nat-traversal.ts |
| 消息发送失败 | src/protocol/handler.ts, src/network/connection-manager.ts |
| 无法发现节点 | src/routing/discovery.ts |
| 配置不生效 | src/core/config.ts |
| 日志问题 | src/core/logger.ts |

---

## 📝 编码规范速查

### 文件命名
- 小写字母，连字符分隔: `connection-manager.ts`

### 类命名
- PascalCase: `class ConnectionManager`

### 接口命名
- PascalCase，无 I 前缀: `interface ConnectionConfig`

### 变量命名
- camelCase: `const maxConnections = 300`

### 常量命名
- UPPER_SNAKE_CASE: `const DEFAULT_PORT = 4001`

### 私有成员
- 下划线前缀: `private _connectionPool`

### 布尔变量
- is/has/can/should 前缀: `isConnected`, `hasPermission`

详细规范参见: [docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md)

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
