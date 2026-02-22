# SilkTalk Pro 架构设计文档

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**作者**: SilkTalk Team

---

## 目录

1. [概述](#概述)
2. [架构总览](#架构总览)
3. [分层架构](#分层架构)
4. [数据流](#数据流)
5. [组件交互](#组件交互)
6. [关键设计决策](#关键设计决策)
7. [可扩展性](#可扩展性)
8. [容错设计](#容错设计)
9. [安全架构](#安全架构)

---

## 概述

SilkTalk Pro 采用分层架构设计，将关注点分离的同时保持组件间的紧密集成。这种设计确保了系统的可维护性、可扩展性和可靠性。

### 设计原则

| 原则 | 说明 |
|------|------|
| **关注点分离** | 每层负责特定功能，层间通过明确定义的接口通信 |
| **模块化** | 组件可独立开发、测试和部署 |
| **可配置性** | 通过配置而非代码修改来适应不同环境 |
| **容错性** | 单点故障不影响整体系统可用性 |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (CLI, Bridge, User Applications)                │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                            │
│         (Message Protocol, Serialization, Encryption)        │
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

---

## 分层架构

### Core Layer（核心层）

系统的基础层，负责：

- **Node Lifecycle**: 启动、停止和管理 libp2p 节点
- **Identity**: 加密密钥生成和管理
- **Configuration**: 环境感知配置管理

```typescript
// 核心层接口示例
interface CoreLayer {
  node: {
    start(): Promise<void>;
    stop(): Promise<void>;
    status: NodeStatus;
  };
  identity: {
    peerId: PeerId;
    keyPair: KeyPair;
  };
  config: Configuration;
}
```

### Network Layer（网络层）

处理所有网络连接问题：

| 组件 | 功能 |
|------|------|
| **Transport Manager** | 管理多种传输协议 (TCP, WebSocket, WebRTC) |
| **Connection Manager** | 维护最优连接池，处理重连 |
| **NAT Traversal** | STUN/TURN, UPnP, AutoNAT 网络检测 |
| **Circuit Relay** | 直接连接失败时的中继回退 |

### Routing Layer（路由层）

节点和内容发现：

- **Kademlia DHT**: 分布式哈希表用于节点路由
- **mDNS**: 本地网络发现
- **Bootstrap**: 初始节点发现（可选）

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Bootstrap │────→│  Kademlia   │←────│    mDNS     │
│    Nodes    │     │     DHT     │     │  (Local)    │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ↓
                    ┌─────────────┐
                    │  Peer       │
                    │  Routing    │
                    └─────────────┘
```

### Protocol Layer（协议层）

应用级通信：

- **Message Protocol**: 结构化消息格式
- **Serialization**: Protocol Buffers / CBOR
- **Encryption**: 端到端消息加密

### Application Layer（应用层）

用户界面：

- **CLI**: 节点管理命令行界面
- **Bridge**: OpenClaw 集成用于外部通信

---

## 数据流

### 出站消息流程

```
Application
    ↓
Protocol Layer (序列化, 加密)
    ↓
Routing Layer (查找节点路由)
    ↓
Network Layer (选择传输, 建立连接)
    ↓
Wire (TCP/WebSocket/Relay)
```

### 入站消息流程

```
Wire (TCP/WebSocket/Relay)
    ↓
Network Layer (多路复用到协议)
    ↓
Protocol Layer (解密, 反序列化)
    ↓
Application Layer (传递到处理器)
```

### 时序图

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  App    │    │ Protocol│    │ Routing │    │ Network │    │  Peer   │
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │  send(msg)   │              │              │              │
     │─────────────→│              │              │              │
     │              │  serialize   │              │              │
     │              │─────────────→│              │              │
     │              │              │  findRoute   │              │
     │              │              │─────────────→│              │
     │              │              │              │  connect     │
     │              │              │              │─────────────→│
     │              │              │              │              │
     │              │              │              │  send(data)  │
     │              │              │              │─────────────→│
     │              │              │              │              │
```

---

## 组件交互

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     CLI     │────→│  SilkNode   │←────│   Bridge    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           ↓               ↓               ↓
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Network   │ │   Routing   │ │  Protocol   │
    │   Manager   │ │   Manager   │ │   Handler   │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
    ┌──────┴──────┐ ┌──────┴──────┐
    │  Transports │ │     DHT     │
    │  (TCP/WS)   │ │  (Kademlia) │
    └─────────────┘ └─────────────┘
```

---

## 关键设计决策

### 1. 多传输策略

系统同时监听多种传输协议：

| 传输协议 | 用途 | 优先级 |
|----------|------|--------|
| **TCP** | 默认直接连接 | 高 |
| **WebSocket** | 防火墙友好 | 中 |
| **Circuit Relay** | 直接连接失败时回退 | 低 |

### 2. 连接管理器

智能连接管理：

- 维持最小可行连接数
- 优先低延迟路径
- 自动将中继连接升级为直接连接 (DCUtR)

### 3. 零引导节点理念

系统可在无引导节点的情况下运行：

- mDNS 用于本地发现
- DHT 用于全局发现
- 可选引导节点加速初始连接

### 4. 模块化协议栈

协议动态注册：

- 核心协议（identify, ping）始终启用
- 可选协议（DHT, relay）可配置
- 自定义协议可在不修改核心的情况下添加

---

## 可扩展性

### 水平扩展

- 每个节点独立运行
- 无中央协调器
- DHT 提供 O(log n) 查找性能

### 资源管理

| 资源 | 管理策略 |
|------|----------|
| 连接 | 每节点连接限制 |
| 带宽 | 可配置节流 |
| 内存 | 高效流式处理 |

---

## 容错设计

### 连接恢复能力

- 指数退避自动重连
- 多传输尝试
- 直接连接失败时中继回退

### 网络分区处理

```
分区前:        分区:          恢复:
A ←──→ B       A     B       A ←──→ B
↑      ↑       ↑     ↑       ↑      ↑
└──C───┘       C     D       └──C───┘
               ↑     ↑            ↑
               └──D──┘            └──D──┘

- DHT 维护路由表
- mDNS 重新发现本地节点
- 分区愈合时引导重新连接
```

---

## 安全架构

详见 [SECURITY.md](SECURITY.md)

### 安全亮点

- 所有连接加密（Noise 协议）
- 通过对等密钥验证节点身份
- 无明文通信

### 安全层

```
┌─────────────────┐
│  Application    │
├─────────────────┤
│  Encryption     │  ← 端到端加密
├─────────────────┤
│  Transport      │  ← TLS/Noise
├─────────────────┤
│  Network        │
└─────────────────┘
```

---

## 附录

### A. 架构决策记录 (ADR)

| ADR | 决策 | 状态 |
|-----|------|------|
| ADR-001 | 使用 libp2p 作为网络基础 | 已接受 |
| ADR-002 | 多传输并行策略 | 已接受 |
| ADR-003 | 模块化协议设计 | 已接受 |

### B. 相关文档

- [API.md](API.md) - API 参考
- [SECURITY.md](SECURITY.md) - 安全指南
- [NETWORK.md](NETWORK.md) - 网络配置
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
