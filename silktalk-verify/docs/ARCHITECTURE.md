# SilkTalk 架构设计文档

**版本**: 0.1.0  
**日期**: 2026-02-22  
**状态**: 验证版设计

---

## 1. 设计目标

### 1.1 核心目标
验证 OpenClaw 实例间通过 P2P 网络进行任务协作的可行性。

### 1.2 设计原则

| 原则 | 说明 | 优先级 |
|------|------|--------|
| 极简 | 只实现核心功能，砍掉一切非必要特性 | P0 |
| 快速验证 | 24小时内完成端到端验证 | P0 |
| 可扩展 | 架构支持未来扩展，但不提前实现 | P1 |
| 可观测 | 日志清晰，便于调试和问题定位 | P1 |

---

## 2. 系统架构

### 2.1 分层架构

```
┌─────────────────────────────────────────┐
│ 应用层 (Application)                    │
│ - CLI 交互界面                          │
│ - 用户命令解析                          │
├─────────────────────────────────────────┤
│ 路由层 (Routing)                        │
│ - 任务路由决策                          │
│ - 本地/远程执行调度                     │
├─────────────────────────────────────────┤
│ 协议层 (Protocol)                       │
│ - 消息序列化/反序列化                   │
│ - 消息验证                              │
├─────────────────────────────────────────┤
│ 网络层 (Network)                        │
│ - P2P 连接管理                          │
│ - 消息传输                              │
├─────────────────────────────────────────┤
│ 执行层 (Execution)                      │
│ - OpenClaw Agent 调用                   │
│ - 子进程管理                            │
└─────────────────────────────────────────┘
```

### 2.2 数据流

#### 2.2.1 本地执行任务

```
用户输入 → CLI → Router(决策:local) → AgentBridge → OpenClaw → 返回结果
```

#### 2.2.2 远程委托任务

```
用户输入 → CLI → Router(决策:remote) → Network → 远程节点
                                                            ↓
结果返回 ← CLI ← Router ← Network ← 远程节点执行(OpenClaw)
```

---

## 3. 模块详细设计

### 3.1 Protocol 模块

**职责**: 定义消息格式，提供编解码能力

**核心类/函数**:
- `MessageType`: 消息类型枚举
- `createMessage(type, from, to, payload)`: 创建消息
- `createTask(from, to, command, timeout, priority)`: 创建任务消息
- `createResult(from, to, taskId, success, output, exitCode, duration)`: 创建结果消息
- `encode(msg)`: 编码为 Buffer
- `decode(data)`: 解码为消息对象
- `validateMessage(msg)`: 验证消息格式

**设计决策**:
- 使用 JSON 而非 Protobuf（简化验证）
- ID 生成: 时间戳+计数器+随机数（避免冲突）
- 无版本字段（验证版假设所有节点版本一致）

### 3.2 Network 模块

**职责**: 管理 P2P 连接，收发消息

**核心类**: `SilkNode`

**关键方法**:
- `start()`: 启动节点，返回 peerId
- `stop()`: 优雅关闭
- `send(peerId, message)`: 发送消息到指定节点
- `broadcast(message)`: 广播消息
- `getPeers()`: 获取已连接节点列表
- `on(type, handler)`: 注册消息处理器

**设计决策**:
- 使用 libp2p 1.x 版本
- 传输层: TCP（简化，不考虑 WebRTC/QUIC）
- 发现层: mDNS（局域网自动发现）
- 协议标识: `/silktalk/0.1.0`

### 3.3 Router 模块

**职责**: 决定任务执行位置，管理任务生命周期

**核心类**: `TaskRouter`

**关键方法**:
- `route(command, options)`: 路由任务
- `handleIncomingTask(taskMessage)`: 处理接收到的任务
- `handleIncomingResult(resultMessage)`: 处理返回的结果

**路由策略**:
- `target: 'local'`: 强制本地执行
- `target: 'remote'`: 强制委托给指定节点
- `target: 'auto'`: 自动选择（有可用节点则委托，否则本地）

**任务状态管理**:
- 使用 `Map<taskId, pending>` 跟踪未完成任务
- 超时自动清理
- 结果到达后 resolve Promise

### 3.4 Agent Bridge 模块

**职责**: 封装 OpenClaw 调用

**核心类**: `OpenClawBridge`

**关键方法**:
- `execute(command, timeout)`: 执行命令
- `isAvailable()`: 检查 OpenClaw 可用性

**设计决策**:
- 使用 `child_process.spawn` 调用 OpenClaw
- 命令解析: 简单 split（不支持复杂引号嵌套）
- 超时处理: 依赖 spawn 的 timeout 选项

### 3.5 CLI 模块

**职责**: 提供交互式命令行界面

**核心类**: `SilkCLI`

**设计决策**:
- 使用 Node.js readline 模块
- 命令解析: 简单 split
- 支持优雅关闭回调

---

## 4. 关键流程

### 4.1 节点启动流程

```
1. 解析命令行参数
2. 创建 SilkNode 实例
3. 创建 OpenClawBridge 实例
4. 检查 OpenClaw 可用性
5. 创建 TaskRouter 实例
6. 注册消息处理器
7. 启动 P2P 节点
8. 连接引导节点（如果有）
9. 启动 CLI
```

### 4.2 任务委托流程

```
1. 用户输入 delegate 命令
2. CLI 解析命令，调用 router.route()
3. Router 创建 Task 消息
4. Router 设置超时定时器
5. Router 调用 node.send() 发送消息
6. Network 层编码并发送
7. 远程节点接收，触发 handler
8. 远程 Router 调用 handleIncomingTask()
9. 远程 AgentBridge 执行 OpenClaw
10. 远程创建 Result 消息
11. 远程 Network 发送结果
12. 本地接收结果，触发 handler
13. 本地 Router 调用 handleIncomingResult()
14. 本地清理 pending 任务，resolve Promise
15. CLI 显示结果
```

### 4.3 错误处理流程

| 错误场景 | 处理方式 | 用户感知 |
|----------|----------|----------|
| 网络发送失败 | 抛出异常，CLI catch 打印 | 控制台错误信息 |
| 任务执行失败 | Result 消息标记 failure | 显示失败状态和输出 |
| 任务超时 | timeout 触发，reject Promise | 显示超时错误 |
| OpenClaw 不可用 | 本地执行直接抛出异常 | 控制台错误信息 |
| 消息格式错误 | decode 返回 null，记录警告 | 无（仅日志） |

---

## 5. 接口契约

### 5.1 模块间接口

**Protocol → Network**
- `encode(msg): Buffer`
- `decode(data): Message | null`

**Network → Router**
- `handler(message, { peerId, connection }): Promise<void>`

**Router → AgentBridge**
- `execute(command, timeout): Promise<{ output, exitCode, success }>`

**CLI → Router**
- `route(command, options): Promise<result>`

### 5.2 外部接口

**OpenClaw CLI**
- `openclaw agent [args]`: 执行 agent 命令

**libp2p**
- `createLibp2p(config): Promise<Node>`
- `node.dialProtocol(peerId, protocol): Promise<Stream>`
- `node.handle(protocol, handler)`

---

## 6. 非功能性设计

### 6.1 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| 启动时间 | < 5s | 从命令执行到 CLI 就绪 |
| 消息延迟 | < 100ms | 局域网内往返延迟 |
| 任务执行 | < 60s | 默认超时时间 |
| 并发任务 | 10 | 同时进行的任务数 |

### 6.2 可靠性设计

- **连接保持**: 依赖 libp2p 自动重连
- **任务超时**: 可配置，默认 30s
- **优雅关闭**: SIGINT 处理，关闭连接和清理资源
- **错误隔离**: handler 异常不影响其他消息处理

### 6.3 可观测性

- **日志**: 控制台输出，包含节点名称和操作类型
- **状态查询**: `status` 命令显示节点信息
- **网络诊断**: `peers` 和 `ping` 命令

---

## 7. 技术债务与限制

### 7.1 已知限制

| 限制 | 影响 | 缓解措施 |
|------|------|----------|
| 仅支持局域网 | 无法跨公网协作 | 使用公网 IP 或 VPN |
| 无持久化 | 重启丢失状态 | 验证版可接受 |
| 简单命令解析 | 复杂命令可能解析错误 | 避免使用嵌套引号 |
| 无加密传输 | 依赖 libp2p 默认加密 | 验证版可接受 |
| 单线程 | 无法利用多核 | 验证版可接受 |

### 7.2 未来扩展点

- 添加 DHT 支持，实现广域网发现
- 添加中继节点支持，解决 NAT 穿透
- 添加消息持久化和重传
- 添加更复杂的负载均衡策略
- 添加任务队列和优先级调度

---

## 8. 附录

### 8.1 术语表

| 术语 | 说明 |
|------|------|
| P2P | Peer-to-Peer，点对点网络 |
| PeerId | libp2p 节点唯一标识符 |
| mDNS | 多播 DNS，用于局域网服务发现 |
| Bootstrap | 引导节点，用于初始网络连接 |
| Task | 需要执行的任务，包含命令和参数 |
| Result | 任务执行结果 |

### 8.2 参考资料

- libp2p 文档: https://docs.libp2p.io/
- OpenClaw 文档: https://docs.openclaw.ai/
- Node.js child_process: https://nodejs.org/api/child_process.html
