# 概要设计文档 (HLD)
## High-Level Design Document

**文档编号**: STP-HLD-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro 架构团队  
**审核人**: 待签字  

---

## 1. 引言

### 1.1 目的
本文档描述 SilkTalk Pro 系统的概要设计，包括系统架构、组件划分、接口定义和数据流。

### 1.2 范围
本文档覆盖整个 SilkTalk Pro P2P 通信系统的概要设计，基于 SRS 文档中的需求规格。

### 1.3 参考资料
- STP-SRS-001 需求规格说明书
- ISO/IEC 12207:2017
- libp2p 架构规范

---

## 2. 系统架构

### 2.1 架构概述

SilkTalk Pro 采用分层架构设计，遵循关注点分离原则，同时保持组件间的紧密集成。

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (CLI, Bridge, User Applications)                │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                            │
│         (Message Protocol, Serialization, Validation)        │
├─────────────────────────────────────────────────────────────┤
│                     Routing Layer                            │
│           (DHT, Peer Discovery, Content Routing)             │
├─────────────────────────────────────────────────────────────┤
│                     Network Layer                            │
│    (Transport Manager, Connection Manager, NAT Traversal)    │
├─────────────────────────────────────────────────────────────┤
│                      Core Layer                              │
│         (Node Lifecycle, Identity, Configuration)            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 架构原则

1. **模块化**: 每个组件有明确的职责边界
2. **可配置性**: 通过配置启用/禁用功能
3. **可扩展性**: 支持新协议和功能的添加
4. **容错性**: 网络故障自动恢复
5. **安全性**: 默认启用加密和认证

### 2.3 技术栈

| 层次 | 技术/库 | 版本 | 用途 |
|------|---------|------|------|
| Core | libp2p | ^2.8.2 | P2P 网络栈 |
| Network | @libp2p/tcp | ^10.1.9 | TCP 传输 |
| Network | @libp2p/websockets | ^9.2.2 | WebSocket 传输 |
| Security | @chainsafe/libp2p-noise | ^16.1.1 | 加密传输 |
| Routing | @libp2p/kad-dht | ^16.1.3 | DHT 路由 |
| Discovery | @libp2p/mdns | ^11.0.31 | 本地发现 |
| NAT | @libp2p/upnp-nat | ^3.1.17 | UPnP NAT |
| NAT | @libp2p/autonat | ^2.0.26 | NAT 检测 |
| Relay | @libp2p/circuit-relay-v2 | ^3.2.9 | 中继协议 |
| Logging | pino | ^8.0.0 | 结构化日志 |
| CLI | commander | ^12.0.0 | 命令行接口 |
| Testing | vitest | ^1.0.0 | 测试框架 |

---

## 3. 组件设计

### 3.1 Core Layer

#### 3.1.1 SilkNode (核心节点)
**职责**: 管理节点生命周期，协调各层组件

**接口**:
```typescript
class SilkNode extends EventEmitter {
  constructor(config?: Partial<SilkNodeConfig>);
  async start(): Promise<void>;
  async stop(): Promise<void>;
  isStarted(): boolean;
  get peerId(): PeerId;
  getMultiaddrs(): Multiaddr[];
  async dial(multiaddr: string | Multiaddr): Promise<Connection>;
  async hangUp(peerId: string | PeerId): Promise<void>;
  isConnected(peerId: string | PeerId): boolean;
  getPeers(): string[];
  async sendMessage(peerId: string | PeerId, message: SilkMessage): Promise<void>;
  onMessage(handler: (message: SilkMessage, peerId: string) => void): () => void;
}
```

**依赖**:
- IdentityManager
- ConnectionManager
- MessageHandler
- PeerDiscovery
- DHTRouting
- NatTraversal

#### 3.1.2 IdentityManager (身份管理)
**职责**: 管理节点的加密身份

**接口**:
```typescript
class IdentityManager {
  async loadOrCreate(options?: IdentityOptions): Promise<PeerId>;
  async createNewIdentity(): Promise<PeerId>;
  getPeerId(): PeerId;
  getPrivateKey(): Uint8Array;
  async exportToPath(path: string): Promise<void>;
}
```

**存储**:
- 私钥存储路径: `~/.silktalk/identity.key`
- 权限: 600 (owner read/write only)

#### 3.1.3 ConfigManager (配置管理)
**职责**: 加载、保存和管理配置

**接口**:
```typescript
class ConfigManager {
  async load(): Promise<SilkNodeConfig>;
  async save(): Promise<void>;
  get(): SilkNodeConfig;
  set(config: Partial<SilkNodeConfig>): void;
  setValue(key: string, value: unknown): void;
  getValue(key: string): unknown;
}
```

**配置优先级** (高到低):
1. 命令行参数
2. 环境变量
3. 配置文件
4. 默认值

### 3.2 Network Layer

#### 3.2.1 ConnectionManager (连接管理)
**职责**: 管理对等点连接池

**接口**:
```typescript
class ConnectionManager extends EventEmitter {
  addConnection(peerId: string, connection: Connection): void;
  removeConnection(peerId: string, connectionId: string): void;
  getConnection(peerId: string): Connection | null;
  getConnections(peerId?: string): Connection[];
  isConnected(peerId: string): boolean;
  closeConnection(peerId: string, connectionId?: string): void;
  closeAllConnections(): void;
  pruneConnections(): void;
  getStats(): ConnectionStats;
}
```

**配置参数**:
- maxConnections: 300 (最大连接数)
- minConnections: 10 (最小连接数)
- maxConnectionsPerPeer: 5 (每对等点最大连接数)
- connectionTimeout: 30000ms (连接超时)
- idleTimeout: 60000ms (空闲超时)

#### 3.2.2 TransportManager (传输管理)
**职责**: 管理传输协议

**接口**:
```typescript
class TransportManager {
  async initialize(): Promise<void>;
  getEnabledTransports(): string[];
  getTransportInfo(type: string): TransportInfo | undefined;
  getAllTransportInfo(): TransportInfo[];
  getListenAddresses(): string[];
  getPreferredTransport(targetAddr: string): string | null;
}
```

**支持的传输**:
- TCP (IPv4/IPv6)
- WebSocket (ws/wss)
- Circuit Relay

#### 3.2.3 NatTraversal (NAT 穿透)
**职责**: 检测和穿透 NAT

**接口**:
```typescript
class NatTraversal {
  async detectNatType(): Promise<NatInfo>;
  getNatInfo(): NatInfo;
  isPubliclyReachable(): boolean;
  requiresRelay(): boolean;
  getRecommendedStrategy(): NatStrategy;
}
```

**NAT 类型**:
- full-cone (全锥型)
- restricted (受限型)
- port-restricted (端口受限型)
- symmetric (对称型)
- unknown (未知)

### 3.3 Routing Layer

#### 3.3.1 PeerDiscovery (对等点发现)
**职责**: 发现网络中的对等点

**接口**:
```typescript
class PeerDiscovery extends EventEmitter {
  async start(): Promise<void>;
  async stop(): Promise<void>;
  addPeer(event: DiscoveryEvent): void;
  removePeer(peerId: string): boolean;
  getPeers(): DiscoveryEvent[];
  getPeer(peerId: string): DiscoveryEvent | undefined;
  hasPeer(peerId: string): boolean;
  findPeersByProtocol(protocol: string): DiscoveryEvent[];
}
```

**发现机制**:
- mDNS (本地网络)
- DHT (全局网络)
- Bootstrap (引导节点)

#### 3.3.2 DHTRouting (DHT 路由)
**职责**: DHT 操作和数据存储

**接口**:
```typescript
class DHTRouting {
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async put(key: string, value: Uint8Array, ttl?: number): Promise<void>;
  async get(key: string): Promise<Uint8Array | null>;
  async delete(key: string): Promise<boolean>;
  async has(key: string): Promise<boolean>;
  async keys(): Promise<string[]>;
  getStats(): DHTStats;
}
```

### 3.4 Protocol Layer

#### 3.4.1 MessageHandler (消息处理器)
**职责**: 处理消息协议

**接口**:
```typescript
class MessageHandler extends EventEmitter {
  async setup(libp2p: Libp2p, onMessage: (message: SilkMessage, peerId: string) => void): Promise<void>;
  async sendMessage(libp2p: Libp2p, peerId: PeerId | string, message: SilkMessage): Promise<void>;
  encodeMessage(message: SilkMessage): Uint8Array;
  decodeMessage(data: Uint8Array): SilkMessage;
  validateMessage(message: SilkMessage): void;
}
```

**协议标识**: `/silktalk/1.0.0/messages`

**消息类型**:
- HELLO (0): 握手消息
- TEXT (1): 文本消息
- DATA (2): 数据消息
- COMMAND (3): 命令消息
- ACK (4): 确认消息
- ERROR (5): 错误消息

### 3.5 Application Layer

#### 3.5.1 CLI (命令行接口)
**职责**: 提供命令行操作界面

**命令列表**:
- `start`: 启动节点
- `stop`: 停止节点
- `status`: 查看状态
- `connect`: 连接对等点
- `peers`: 列出对等点
- `send`: 发送消息
- `listen`: 监听消息
- `dht`: DHT 操作
- `config`: 配置管理

#### 3.5.2 OpenClawBridge (OpenClaw 桥接)
**职责**: 集成 OpenClaw 代理系统

**接口**:
```typescript
class OpenClawBridge extends EventEmitter {
  async start(): Promise<void>;
  async stop(): Promise<void>;
  registerCommand(name: string, handler: CommandHandler): void;
  unregisterCommand(name: string): boolean;
  async executeCommand(command: string, args: Record<string, unknown>): Promise<CommandResult>;
}
```

---

## 4. 数据流设计

### 4.1 消息发送流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application │────→│   Message   │────→│   Routing   │────→│   Network   │
│             │     │   Handler   │     │   (DHT)     │     │   Manager   │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                                                                   ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Target    │←────│   Stream    │←────│   libp2p    │←────│  Transport  │
│    Peer     │     │             │     │             │     │  (TCP/WS)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**步骤**:
1. 应用层调用 `sendMessage()`
2. MessageHandler 序列化消息
3. Routing Layer 查找对等点地址
4. Network Layer 建立连接
5. Transport Layer 发送数据
6. 目标对等点接收并处理

### 4.2 消息接收流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Source    │────→│   libp2p    │────→│   Protocol  │────→│   Message   │
│    Peer     │     │             │     │   Handler   │     │   Handler   │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                                                                   ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│   Event     │←────│ Application │←────│ Validation  │←───────────┘
│  Listeners  │     │   Handler   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**步骤**:
1. libp2p 接收传入连接
2. Protocol Handler 分发到 MessageHandler
3. MessageHandler 解码和验证消息
4. 触发应用层事件
5. 应用层处理消息

### 4.3 对等点发现流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   mDNS      │────→│             │     │             │
│  (Local)    │     │   libp2p    │     │   Peer      │
├─────────────┤     │   peer:     │────→│ Discovery   │
│   DHT       │────→│  discovery  │     │   Manager   │
│  (Global)   │     │   event     │     │             │
├─────────────┤     │             │     │             │
│  Bootstrap  │────→│             │     │             │
│   (Config)  │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 5. 接口设计

### 5.1 内部接口

#### 5.1.1 组件间通信
- **EventEmitter**: 异步事件通知
- **直接调用**: 同步方法调用
- **Callback**: 消息处理回调

#### 5.1.2 数据格式
- **Message**: JSON 序列化
- **Binary**: Uint8Array
- **Address**: Multiaddr 格式

### 5.2 外部接口

#### 5.2.1 程序化 API
详见 `docs/API.md`

#### 5.2.2 CLI 接口
详见 `docs/API.md` CLI 章节

#### 5.2.3 网络协议
- **传输**: TCP, WebSocket
- **加密**: Noise Protocol
- **复用**: Yamux
- **应用**: `/silktalk/1.0.0/messages`

---

## 6. 部署架构

### 6.1 单节点部署

```
┌─────────────────────────────────────┐
│           User Machine              │
│  ┌─────────────────────────────┐    │
│  │      SilkTalk Pro Node      │    │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │    │
│  │  │ TCP │ │ WS  │ │DHT  │   │    │
│  │  └─────┘ └─────┘ └─────┘   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 6.2 中继服务器部署

```
┌─────────────────┐         ┌─────────────────┐
│   Node A        │         │   Node B        │
│  (NATed)        │         │  (NATed)        │
│                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │ SilkTalk  │  │╲       ╱│  │ SilkTalk  │  │
│  └─────┬─────┘  │  ╲   ╱  │  └─────┬─────┘  │
└────────┼────────┘    ╲ ╱   └────────┼────────┘
         │               ╳            │
         │              ╱ ╲           │
         │   Circuit Relay V2        │
         │            ╱     ╲         │
┌────────┴────────┐  ╱       ╲  ┌────┴─────────┐
│   Relay Server  │╱           ╲│  Relay Server │
│  (Public IP)    │             │  (Public IP)  │
│                 │             │               │
│  ┌───────────┐  │             │  ┌──────────┐ │
│  │ SilkTalk  │  │             │  │ SilkTalk │ │
│  │  (Hop)    │  │             │  │  (Hop)   │ │
│  └───────────┘  │             │  └──────────┘ │
└─────────────────┘             └───────────────┘
```

### 6.3 集群部署

```
┌─────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                       │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Node 1     │  │  Node 2     │  │  Node 3     │          │
│  │ (Bootstrap) │  │ (Bootstrap) │  │ (Bootstrap) │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                   ┌──────┴──────┐                          │
│                   │  Service    │                          │
│                   │  (LB)       │                          │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 安全设计

### 7.1 传输安全
- **加密**: Noise Protocol (XX 握手模式)
- **身份验证**: 基于公钥的 PeerId 验证
- **前向保密**: 每次会话使用临时密钥

### 7.2 身份安全
- **密钥生成**: Ed25519 椭圆曲线
- **密钥存储**: 文件系统，权限 600
- **密钥备份**: 支持导出/导入

### 7.3 访问控制
- **命令授权**: 白名单机制
- **速率限制**: 连接和消息级别
- **审计日志**: 所有操作记录

---

## 8. 附录

### 8.1 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk Team | 初始版本 |

### 8.2 审核记录

| 审核轮次 | 审核日期 | 审核人 | 结果 | 备注 |
|----------|----------|--------|------|------|
| 1 | | | | |

### 8.3 批准签字

**系统架构师**: _________________ 日期: _______

**技术负责人**: _________________ 日期: _______

**项目经理**: _________________ 日期: _______

---

**文档结束**
