# SilkTalk 部署指南

**版本**: 0.1.0  
**适用场景**: 双节点验证测试

---

## 1. 部署概述

本指南描述如何在两台机器上部署 SilkTalk，实现 OpenClaw 实例间的 P2P 协作验证。

### 1.1 部署模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| 单机双节点 | 同一机器启动两个节点 | 本地开发测试 |
| 局域网双机 | 两台机器在同一局域网 | 真实网络验证 |
| 公网双机 | 两台机器有公网 IP | 远程协作验证 |

### 1.2 网络要求

- **局域网模式**: 两台机器在同一子网，mDNS 可互通
- **公网模式**: 至少一台有公网 IP，或都可通过公网访问
- **防火墙**: 需要开放 TCP 端口（默认随机，可指定）

---

## 2. 环境准备

### 2.1 节点 A 准备（第一台机器）

#### 2.1.1 系统检查

```bash
# 检查操作系统
uname -a

# 检查 Node.js
node --version  # 需要 >= 18.0.0

# 检查 npm
npm --version

# 检查 OpenClaw
which openclaw
openclaw --version  # 需要 >= 2026.2.9

# 检查网络
ip addr  # 或 ifconfig
```

#### 2.1.2 项目部署

```bash
# 创建项目目录
mkdir -p ~/silktalk-verify
cd ~/silktalk-verify

# 复制项目文件（通过 scp、git 或手动复制）
# 方式1: scp
scp -r user@source-host:/path/to/silktalk-verify/* .

# 方式2: git
git clone https://github.com/your-repo/silktalk-verify.git

# 安装依赖
npm install

# 验证安装
ls node_modules/libp2p
```

#### 2.1.3 防火墙配置

```bash
# 检查防火墙状态
sudo ufw status
# 或
sudo iptables -L

# 开放端口（如果使用固定端口）
sudo ufw allow 10001/tcp

# 或者临时关闭防火墙（仅测试）
sudo ufw disable
```

### 2.2 节点 B 准备（第二台机器）

**重复节点 A 的所有准备步骤**

额外检查：

```bash
# 测试到节点 A 的网络连通性
ping <节点A_IP>

# 测试端口连通性（节点 A 先启动监听）
nc -zv <节点A_IP> 10001
```

---

## 3. 部署步骤

### 3.1 单机双节点测试（可选前置步骤）

**终端 1 - 节点 A:**
```bash
cd ~/silktalk-verify
node src/index.js --name nodeA --port 10001
```

**终端 2 - 节点 B:**
```bash
cd ~/silktalk-verify
node src/index.js --name nodeB --port 10002 \
  --bootstrap /ip4/127.0.0.1/tcp/10001/p2p/<节点A的PeerId>
```

> 注意：节点 A 启动后会显示 PeerId，复制用于节点 B 的 bootstrap 参数

### 3.2 局域网双机部署

#### 步骤 1: 获取节点 A 的信息

在节点 A 上：
```bash
# 获取 IP 地址
ip addr show | grep "inet " | head -1
# 输出示例: inet 192.168.1.100/24

# 记录 IP: 192.168.1.100
```

#### 步骤 2: 启动节点 A

```bash
cd ~/silktalk-verify
node src/index.js --name nodeA --port 10001
```

**记录启动信息：**
```
🚀 Starting SilkTalk node: nodeA
   Port: 10001
   Bootstrap: none

Checking OpenClaw availability...
✅ OpenClaw available: 2026.2.13

[nodeA] Started with peerId: QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
[nodeA] Listening on: [ '/ip4/127.0.0.1/tcp/10001/p2p/QmNodeAPeerId...',
  '/ip4/192.168.1.100/tcp/10001/p2p/QmNodeAPeerId...' ]

✅ Node started successfully
   PeerId: QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

🕸️ SilkTalk Verification Shell

silktalk>
```

**关键信息：**
- PeerId: `QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
- IP 地址: `192.168.1.100`
- 端口: `10001`

#### 步骤 3: 启动节点 B

在节点 B 上：
```bash
cd ~/silktalk-verify
node src/index.js --name nodeB --port 10002 \
  --bootstrap /ip4/192.168.1.100/tcp/10001/p2p/QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**预期输出：**
```
🚀 Starting SilkTalk node: nodeB
   Port: 10002
   Bootstrap: /ip4/192.168.1.100/tcp/10001/p2p/QmNodeAPeerId...

[nodeB] Connected to bootstrap: /ip4/192.168.1.100/tcp/10001/p2p/QmNodeAPeerId...
[nodeB] Started with peerId: QmNodeBPeerIdYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
...
✅ Node started successfully

silktalk>
```

### 3.3 验证连接

**在节点 B 上执行：**

```bash
silktalk> peers
# 输出: 1. QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

silktalk> status
# 输出: Name: nodeB, Peers: 1

silktalk> ping QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# 输出: Ping sent
# 节点 A 显示: [nodeA] Received ping from QmNodeB...
# 节点 A 显示: [nodeA] Sent pong to QmNodeB...
# 节点 B 显示: [nodeB] Received pong from QmNodeA..., latency: Xms
```

### 3.4 任务委托测试

**在节点 B 上执行：**

```bash
# 委托节点 A 执行命令
silktalk> delegate QmNodeAPeerIdXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX --message "Hello from nodeB"

# 预期输出（在节点 B）:
# { success: true, output: "...", exitCode: 0, duration: XXXX }

# 同时节点 A 显示:
# [Router] Received task XXX from QmNodeB...
# [Router] Task XXX completed, result sent to QmNodeB
```

---

## 4. 故障排查

### 4.1 连接问题

**症状**: `Failed to connect to bootstrap`

**排查步骤：**

1. **检查网络连通性**
```bash
# 在节点 B 上
ping <节点A_IP>
```

2. **检查端口开放**
```bash
# 在节点 A 上
netstat -tlnp | grep 10001
# 或
ss -tlnp | grep 10001

# 在节点 B 上
telnet <节点A_IP> 10001
# 或
nc -zv <节点A_IP> 10001
```

3. **检查防火墙**
```bash
# 在节点 A 上
sudo ufw status
sudo iptables -L | grep 10001
```

4. **检查 PeerId 格式**
确保 bootstrap 地址格式正确：
```
/ip4/<IP>/tcp/<PORT>/p2p/<PEER_ID>
```

### 4.2 OpenClaw 不可用

**症状**: `⚠️ OpenClaw not available`

**排查步骤：**

1. **检查 OpenClaw 安装**
```bash
which openclaw
openclaw --version
```

2. **检查 PATH**
```bash
echo $PATH
```

3. **手动测试 OpenClaw**
```bash
openclaw agent --help
```

4. **指定 OpenClaw 路径**（修改代码）
```javascript
const bridge = new OpenClawBridge({ path: '/usr/local/bin/openclaw' });
```

### 4.3 任务执行失败

**症状**: `Task timeout` 或 `Execution failed`

**排查步骤：**

1. **检查本地执行**
```bash
silktalk> exec --message "Hello"
```

2. **检查远程节点负载**
远程节点可能正在执行其他任务。

3. **增加超时时间**（修改代码）
```javascript
const router = new TaskRouter({ defaultTimeout: 60000 });
```

4. **查看详细日志**
```bash
DEBUG=* node src/index.js
```

### 4.4 mDNS 发现失败

**症状**: 节点无法自动发现彼此

**说明**: 验证版主要依赖 bootstrap 连接，mDNS 是辅助功能。

**排查：**
```bash
# 检查 mDNS 服务
avahi-browse -a
# 或
dns-sd -B _p2p._tcp
```

---

## 5. 生产部署注意事项（未来）

### 5.1 安全加固

- 启用 libp2p 噪声加密（已默认启用）
- 添加节点身份验证
- 限制可执行命令白名单
- 添加速率限制

### 5.2 高可用

- 部署多个 bootstrap 节点
- 添加健康检查和自动故障转移
- 持久化任务状态

### 5.3 监控

- 添加 Prometheus 指标
- 日志集中收集
- 告警配置

---

## 6. 附录

### 6.1 快速参考卡片

**启动节点 A:**
```bash
node src/index.js --name nodeA --port 10001
```

**启动节点 B:**
```bash
node src/index.js --name nodeB --port 10002 \
  --bootstrap /ip4/<A_IP>/tcp/10001/p2p/<A_PeerId>
```

**常用命令:**
```bash
peers                    # 查看连接
ping <peerId>           # 测试连通
exec <cmd>              # 本地执行
delegate <peer> <cmd>   # 远程执行
status                   # 查看状态
quit                     # 退出
```

### 6.2 联系支持

遇到问题：
1. 查看日志输出
2. 检查本文档故障排查章节
3. 记录问题上下文（节点状态、网络环境、操作步骤）
