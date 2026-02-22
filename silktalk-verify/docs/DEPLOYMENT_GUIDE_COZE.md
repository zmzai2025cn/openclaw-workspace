# SilkTalk Coze 部署指南

**版本**: 0.1.0  
**目标**: 让 Coze OpenClaw 实例独立完成 SilkTalk P2P 验证  
**适用**: 飞书传输环境下的自动化部署

---

## 快速开始 (3步部署)

```bash
# 1. 解压包
tar xzvf silktalk-lite.tar.gz
cd silktalk-verify

# 2. 一键部署
node scripts/check-env.js && npm install && ./scripts/deploy.sh coze-node 10001

# 3. 获取 PeerId
tail /tmp/silktalk-coze-node.log | grep PeerId
```

---

## 1. 前置条件

### 1.1 系统要求

| 组件 | 最低版本 | 检查命令 |
|------|----------|----------|
| Node.js | 18.0.0 | `node --version` |
| npm | 8.0.0 | `npm --version` |
| OpenClaw | 2026.2.9 | `openclaw --version` |

### 1.2 网络要求

- 端口 10001-10010 可用
- 与主节点网络互通

---

## 2. 部署流程

### 2.1 文件传输

由于飞书文件大小限制，使用精简版包：

```
silktalk-lite.tar.gz (约 64KB)
├── 完整源代码
├── 所有脚本
├── package.json + package-lock.json
└── 完整文档
```

**注意**: 此包不含 `node_modules`，部署时会自动执行 `npm install`

### 2.2 部署步骤

**步骤1**: 解压
```bash
tar xzvf silktalk-lite.tar.gz
cd silktalk-verify
```

**步骤2**: 环境检查
```bash
node scripts/check-env.js
```

预期输出:
```
🔍 SilkTalk Environment Checker
[SUCCESS] Node.js 20.x.x installed
[SUCCESS] npm 10.x.x installed
[SUCCESS] OpenClaw available: 2026.2.x
✅ All checks passed! Ready to deploy.
```

**步骤3**: 安装依赖
```bash
npm install
```

**步骤4**: 启动节点
```bash
./scripts/deploy.sh coze-node 10001
```

**步骤5**: 验证启动
```bash
# 查看日志
tail -f /tmp/silktalk-coze-node.log

# 预期输出:
# ✅ Node started successfully
# PeerId: 12D3KooW...
```

---

## 3. 与主节点连接

### 3.1 获取主节点信息

从主节点获取:
- PeerId (如: `12D3KooW...`)
- IP地址 (如: `192.168.1.100`)
- 端口 (如: `10001`)

### 3.2 启动并连接

```bash
# 停止现有节点
pkill -f silktalk

# 重新启动并连接主节点
./scripts/deploy.sh coze-node 10002 /ip4/192.168.1.100/tcp/10001/p2p/12D3KooW...
```

### 3.3 验证连接

```bash
# 查看日志中的连接信息
tail /tmp/silktalk-coze-node.log | grep -E "(connected|discovered|peers)"
```

---

## 4. 故障排查

### 4.1 启动失败

```bash
# 检查详细错误
cat /tmp/silktalk-coze-node.log

# 检查端口占用
sudo lsof -i :10001

# 手动测试
node src/index.js --name test --port 10001 --daemon
```

### 4.2 连接失败

```bash
# 测试网络连通
ping <主节点IP>
nc -zv <主节点IP> 10001

# 检查防火墙
sudo ufw status
```

### 4.3 npm install 失败

```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com

# 或使用官方镜像
npm install --registry=https://registry.npmjs.org
```

---

## 5. 关键文件说明

| 文件 | 用途 |
|------|------|
| `scripts/check-env.js` | 环境检查 |
| `scripts/deploy.sh` | 部署脚本 |
| `scripts/test-runner.js` | 测试套件 |
| `src/index.js` | 主程序入口 |
| `/tmp/silktalk-coze-node.log` | 运行日志 |

---

## 6. 成功标志

部署成功时，日志应显示:

```
============================================================
✅ Node started successfully
============================================================
Name: coze-node
PeerId: 12D3KooWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Port: 10001
Log: /tmp/silktalk-coze-node.log
PID: 12345
============================================================
```

**将 PeerId 通过飞书返回给主节点完成配对！**

---

## 7. 命令速查

```bash
# 检查环境
node scripts/check-env.js

# 运行测试
node scripts/test-runner.js

# 部署节点
./scripts/deploy.sh <name> <port> [bootstrap]

# 查看状态
ps aux | grep silktalk
tail -f /tmp/silktalk-*.log

# 停止节点
pkill -f silktalk
```

---

**部署完成后，请通过飞书发送 PeerId 给主节点！**
