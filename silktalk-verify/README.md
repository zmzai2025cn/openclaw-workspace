# SilkTalk Verification

**版本**: 0.1.0  
**状态**: 验证版 (MVP)  
**目标**: 验证 OpenClaw 实例间 P2P 协作可行性

---

## 快速开始 (一键部署)

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/silktalk-verify.git
cd silktalk-verify

# 2. 检查环境
./silktalk.sh check

# 3. 安装依赖
./silktalk.sh install

# 4. 启动第一个节点
./silktalk.sh start nodeA 10001

# 5. 在另一个终端启动第二个节点
./silktalk.sh start nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/<节点A的PeerId>
```

---

## 1. 项目概述

SilkTalk 是一个用于 OpenClaw 实例间点对点通信的验证项目。它实现了：

- **P2P 网络层**: 基于 libp2p 的节点发现与连接
- **消息协议**: 极简 JSON 协议，支持任务委托与结果返回
- **任务路由**: 本地执行或远程委托的决策逻辑
- **OpenClaw 集成**: 通过子进程调用本地 OpenClaw agent
- **自动化部署**: 一键检查、安装、部署到任意环境

### 1.1 核心能力

| 能力 | 状态 | 说明 |
|------|------|------|
| 节点发现 | ✅ | mDNS 局域网自动发现 |
| 消息传输 | ✅ | TCP 传输，JSON 编码 |
| 任务委托 | ✅ | A 节点委托 B 节点执行命令 |
| 结果返回 | ✅ | 执行结果返回给调用方 |
| 错误处理 | ✅ | 超时、异常、网络错误处理 |
| 自动化部署 | ✅ | 一键部署到任意环境 |

### 1.2 非目标（明确排除）

- NAT 穿透（仅支持局域网或公网直连）
- 加密传输（依赖 libp2p 默认加密）
- 持久化存储
- 复杂的负载均衡策略
- 生产级容错与恢复

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      OpenClaw Instance A                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   CLI       │───▶│ Task Router │───▶│  P2P Node   │─────┼──▶ 网络
│  │  (用户交互)  │    │ (路由决策)   │    │ (libp2p)    │     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                            │                                │
│                     ┌──────┴──────┐                        │
│                     ▼             ▼                        │
│              ┌──────────┐   ┌──────────┐                   │
│              │  Local   │   │ Remote   │                   │
│              │ Executor │   │  Sender  │                   │
│              └────┬─────┘   └────┬─────┘                   │
│                   │              │                         │
│                   ▼              │                         │
│            ┌─────────────┐       │                         │
│            │ OpenClaw    │       │                         │
│            │   Agent     │       │                         │
│            └─────────────┘       │                         │
│                                  │                         │
└──────────────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────┼─────────────────────────┐
│                      OpenClaw Instance B                   │
│                                  │                         │
│  ┌─────────────┐    ┌───────────┴─────┐                   │
│  │   P2P Node  │───▶│  Task Handler   │                   │
│  │  (libp2p)   │    │ (接收远程任务)   │                   │
│  └─────────────┘    └────────┬────────┘                   │
│                              │                             │
│                              ▼                             │
│                       ┌─────────────┐                      │
│                       │ Local       │                      │
│                       │ Executor    │                      │
│                       └──────┬──────┘                      │
│                              │                             │
│                              ▼                             │
│                       ┌─────────────┐                      │
│                       │ OpenClaw    │                      │
│                       │   Agent     │                      │
│                       └─────────────┘                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 文件 | 职责 | 行数 |
|------|------|------|------|
| Protocol | `protocol/message.js` | 消息类型定义、编解码、验证 | 117 |
| Network | `network/node.js` | P2P 节点管理、连接、消息收发 | 199 |
| Router | `router/router.js` | 任务路由、委托、结果处理 | 170 |
| Agent Bridge | `agent-bridge/bridge.js` | OpenClaw 子进程调用 | 42 |
| CLI | `cli/cli.js` | 交互式命令行界面 | 72 |
| Entry | `index.js` | 程序入口、初始化、生命周期 | 166 |

### 2.3 消息协议规范

#### 2.3.1 消息格式

```typescript
interface SilkMessage {
  type: 'ping' | 'pong' | 'task' | 'result' | 'error';
  id: string;           // 唯一标识符
  from: string;         // 发送方 peerId
  to: string;           // 接收方 peerId 或 'broadcast'
  payload: object;      // 消息载荷
  timestamp: number;    // Unix 时间戳（毫秒）
}
```

#### 2.3.2 消息类型详情

**Ping 消息**
```json
{
  "type": "ping",
  "id": "1234567890-1-abc12",
  "from": "QmSender...",
  "to": "QmTarget...",
  "payload": { "ts": 1234567890 },
  "timestamp": 1234567890
}
```

**Task 消息**
```json
{
  "type": "task",
  "id": "1234567890-2-def34",
  "from": "QmSender...",
  "to": "QmTarget...",
  "payload": {
    "command": "--message 'Hello'",
    "timeout": 30000,
    "priority": 2
  },
  "timestamp": 1234567890
}
```

**Result 消息**
```json
{
  "type": "result",
  "id": "1234567890-3-ghi56",
  "from": "QmExecutor...",
  "to": "QmSender...",
  "payload": {
    "taskId": "1234567890-2-def34",
    "status": "success",
    "output": "Hello world",
    "exitCode": 0,
    "duration": 1500
  },
  "timestamp": 1234567890
}
```

---

## 3. 快速开始

### 3.1 环境要求

| 依赖 | 版本 | 检查命令 |
|------|------|----------|
| Node.js | >= 18.0.0 | `node --version` |
| OpenClaw | >= 2026.2.9 | `openclaw --version` |
| 网络 | TCP 互通 | `nc -zv <ip> <port>` |

### 3.2 安装

```bash
# 克隆或复制项目目录
cd silktalk-verify

# 安装依赖
npm install

# 验证安装
npm ls libp2p
```

### 3.3 单节点测试（本地）

```bash
# 启动节点
node src/index.js --name nodeA --port 10001

# 在交互式 shell 中测试
silktalk> help
silktalk> status
silktalk> exec --message "Hello from local"
silktalk> quit
```

### 3.4 双节点测试（局域网）

**节点 A（第一台机器）:**
```bash
node src/index.js --name nodeA --port 10001
# 记录输出的 PeerId，如: QmNodeAPeerId...
```

**节点 B（第二台机器）:**
```bash
node src/index.js --name nodeB --port 10002 \
  --bootstrap /ip4/<节点A_IP>/tcp/10001/p2p/<节点A_PeerId>
```

**测试命令:**
```bash
# 在节点 B 上
silktalk> peers                    # 查看是否发现节点 A
silktalk> ping <节点A_PeerId>      # 测试连通性
silktalk> delegate <节点A_PeerId> --message "Hello from B"
```

---

## 4. CLI 命令参考

| 命令 | 语法 | 说明 |
|------|------|------|
| help | `help` | 显示帮助信息 |
| peers | `peers` | 列出已连接的对等节点 |
| ping | `ping <peerId>` | 向指定节点发送 ping |
| exec | `exec <command>` | 在本地执行 OpenClaw 命令 |
| delegate | `delegate <peerId> <command>` | 委托远程节点执行命令 |
| status | `status` | 显示当前节点状态 |
| quit | `quit` | 退出程序 |

### 4.1 命令示例

```bash
# 本地执行
silktalk> exec --message "What is the weather?"

# 远程委托
silktalk> delegate QmRemotePeer --message "Summarize logs"

# 批量检查所有连接
silktalk> peers
silktalk> ping QmPeer1
silktalk> ping QmPeer2
```

---

## 5. 配置说明

### 5.1 命令行参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--name` | `-n` | `anonymous` | 节点名称（用于日志） |
| `--port` | `-p` | `0` | 监听端口（0=随机） |
| `--bootstrap` | `-b` | 无 | 引导节点地址（可重复） |
| `--help` | `-h` | - | 显示帮助 |

### 5.2 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCLAW_PATH` | OpenClaw 可执行文件路径 | `openclaw` |
| `NODE_ENV` | 运行环境 | `development` |

---

## 6. 故障排查

### 6.1 常见问题

**问题**: `Error: Cannot find module 'libp2p'`
- **原因**: 依赖未安装
- **解决**: 运行 `npm install`

**问题**: `Failed to connect to bootstrap`
- **原因**: 网络不通或节点未启动
- **解决**: 检查防火墙、确认目标节点运行中

**问题**: `OpenClaw not available`
- **原因**: OpenClaw 未安装或不在 PATH
- **解决**: 安装 OpenClaw 或设置 `OPENCLAW_PATH`

**问题**: `Task timeout`
- **原因**: 远程执行超时
- **解决**: 增加超时时间或检查远程节点负载

### 6.2 调试模式

```bash
# 启用详细日志
DEBUG=silktalk* node src/index.js

# 检查网络连接
netstat -tlnp | grep node
```

---

## 7. 项目结构

```
silktalk-verify/
├── src/
│   ├── index.js              # 程序入口
│   ├── protocol/
│   │   └── message.js        # 消息协议
│   ├── network/
│   │   └── node.js           # P2P 网络节点
│   ├── router/
│   │   └── router.js         # 任务路由
│   ├── agent-bridge/
│   │   └── bridge.js         # OpenClaw 桥接
│   └── cli/
│       └── cli.js            # 命令行界面
├── test/                     # 测试文件（待补充）
├── docs/                     # 文档
│   ├── ARCHITECTURE.md       # 架构设计文档
│   ├── DEPLOYMENT.md         # 部署指南
│   └── API.md                # API 文档
├── package.json              # 项目配置
├── README.md                 # 本文件
└── CHANGELOG.md              # 变更日志
```

---

## 8. 版本历史

### v0.1.0 (2026-02-22)
- 初始验证版本
- 实现 P2P 连接、任务委托、结果返回
- 支持 mDNS 局域网发现
- 集成 OpenClaw agent 执行

---

## 9. 许可证

MIT License - 验证用途

---

## 10. 联系方式

- 项目维护: OpenClaw Team
- 问题反馈: 通过 OpenClaw 实例提交
