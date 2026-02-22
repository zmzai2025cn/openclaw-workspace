# SilkTalk Pro 双机测试指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**适用范围**: 自动化部署脚本套件

---

## 目录

1. [概述](#概述)
2. [测试目标](#测试目标)
3. [测试环境](#测试环境)
4. [测试准备](#测试准备)
5. [测试执行](#测试执行)
6. [验证步骤](#验证步骤)
7. [故障排查](#故障排查)
8. [测试报告](#测试报告)

---

## 概述

双机测试用于验证 SilkTalk Pro 在分布式环境下的部署和通信能力。通过在两台独立的机器上部署系统，测试节点发现、连接建立和消息传输功能。

### 测试范围

- 双机独立部署
- 节点发现和连接
- 消息传输验证
- 网络容错测试

---

## 测试目标

| 目标 ID | 目标描述 | 验收标准 |
|---------|----------|----------|
| DT-001 | 双机独立部署成功 | 两台机器都能完成部署 |
| DT-002 | 节点互相发现 | 节点 A 能发现节点 B |
| DT-003 | 建立 P2P 连接 | 节点间能建立直接连接 |
| DT-004 | 消息传输正常 | 消息能在节点间传输 |
| DT-005 | 网络容错 | 断线后能自动重连 |

---

## 测试环境

### 硬件要求

| 资源 | 机器 A | 机器 B |
|------|--------|--------|
| CPU | 1 核+ | 1 核+ |
| 内存 | 512MB+ | 512MB+ |
| 磁盘 | 2GB+ | 2GB+ |
| 网络 | 互通 | 互通 |

### 网络要求

```
┌─────────────┐         ┌─────────────┐
│   机器 A    │ ◄─────► │   机器 B    │
│ 192.168.1.10│         │ 192.168.1.11│
└─────────────┘         └─────────────┘
       │                       │
       └───────────┬───────────┘
                   │
              网络互通
       - TCP 端口 3000-4000
       - UDP 端口 3478
```

### 软件要求

| 软件 | 版本 | 两台机器 |
|------|------|----------|
| Linux | 内核 4.0+ | 必需 |
| Node.js | 18+ | 脚本自动安装 |
| bash | 4.0+ | 必需 |
| curl/wget | 任意 | 必需 |

---

## 测试准备

### 准备清单

#### 机器 A (主节点)

- [ ] 操作系统已安装
- [ ] 网络配置完成
- [ ] 能访问互联网
- [ ] 已知 IP 地址

#### 机器 B (从节点)

- [ ] 操作系统已安装
- [ ] 网络配置完成
- [ ] 能访问互联网
- [ ] 已知 IP 地址
- [ ] 能与机器 A 通信

### 网络连通性测试

在机器 A 上执行：

```bash
# 测试到机器 B 的连通性
ping 192.168.1.11

# 测试端口连通性 (机器 B 需先启动服务)
nc -zv 192.168.1.11 3000
```

在机器 B 上执行：

```bash
# 测试到机器 A 的连通性
ping 192.168.1.10

# 测试端口连通性
nc -zv 192.168.1.10 3000
```

### 防火墙配置

如果启用了防火墙，需要开放以下端口：

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3478/udp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --reload

# 通用 (iptables)
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
```

---

## 测试执行

### 步骤 1: 在机器 A 上部署

```bash
# 1. 登录机器 A
ssh user@192.168.1.10

# 2. 克隆仓库
git clone https://github.com/silktalk/silktalk-pro.git
cd silktalk-pro

# 3. 执行部署
./scripts/auto-deploy.sh --mode auto --verbose

# 4. 记录部署结果
cat reports/deploy-report-*.md
```

### 步骤 2: 在机器 B 上部署

```bash
# 1. 登录机器 B
ssh user@192.168.1.11

# 2. 克隆仓库
git clone https://github.com/silktalk/silktalk-pro.git
cd silktalk-pro

# 3. 执行部署
./scripts/auto-deploy.sh --mode auto --verbose

# 4. 记录部署结果
cat reports/deploy-report-*.md
```

### 步骤 3: 启动服务

在机器 A 上：

```bash
# 启动服务
cd /usr/local/silktalk-pro
npm start

# 或使用 systemd
sudo systemctl start silktalk

# 查看日志
tail -f logs/app.log
```

在机器 B 上：

```bash
# 启动服务
cd /usr/local/silktalk-pro
npm start

# 或使用 systemd
sudo systemctl start silktalk

# 查看日志
tail -f logs/app.log
```

### 步骤 4: 运行双机测试脚本

在机器 A 上：

```bash
# 运行双机测试
./scripts/test-two-nodes.sh --peer 192.168.1.11
```

---

## 验证步骤

### 验证 1: 节点信息检查

在机器 A 上：

```bash
# 获取节点 ID
curl http://localhost:3000/api/node/info
```

预期输出：
```json
{
  "nodeId": "12D3KooW...",
  "addresses": ["/ip4/192.168.1.10/tcp/3000"],
  "status": "online"
}
```

### 验证 2: 节点发现

在机器 A 上：

```bash
# 发现节点 B
curl http://localhost:3000/api/peers/discover?addr=/ip4/192.168.1.11/tcp/3000
```

预期输出：
```json
{
  "success": true,
  "peers": [
    {
      "id": "12D3KooW...",
      "address": "/ip4/192.168.1.11/tcp/3000"
    }
  ]
}
```

### 验证 3: 连接建立

在机器 A 上：

```bash
# 连接到节点 B
curl -X POST http://localhost:3000/api/peers/connect \
  -H "Content-Type: application/json" \
  -d '{"address": "/ip4/192.168.1.11/tcp/3000"}'
```

预期输出：
```json
{
  "success": true,
  "peerId": "12D3KooW...",
  "connection": "established"
}
```

### 验证 4: 消息传输

在机器 A 上发送消息：

```bash
# 发送测试消息
curl -X POST http://localhost:3000/api/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "12D3KooW...",
    "content": "Hello from Node A"
  }'
```

在机器 B 上查看：

```bash
# 查看接收到的消息
curl http://localhost:3000/api/message/received
```

预期输出：
```json
{
  "messages": [
    {
      "from": "12D3KooW...",
      "content": "Hello from Node A",
      "timestamp": "2026-02-22T10:00:00Z"
    }
  ]
}
```

### 验证 5: 网络容错

测试断线重连：

```bash
# 1. 在机器 B 上停止服务
sudo systemctl stop silktalk

# 2. 在机器 A 上检查连接状态
curl http://localhost:3000/api/peers/list
# 预期：节点 B 显示为 disconnected

# 3. 在机器 B 上重新启动服务
sudo systemctl start silktalk

# 4. 等待 30 秒后，在机器 A 上检查
curl http://localhost:3000/api/peers/list
# 预期：节点 B 自动重新连接
```

---

## 故障排查

### 问题 1: 节点无法发现

**症状**：
```
{"success": false, "error": "peer not found"}
```

**排查步骤**：

1. 检查网络连通性
   ```bash
   ping 192.168.1.11
   ```

2. 检查服务状态
   ```bash
   curl http://192.168.1.11:3000/health
   ```

3. 检查防火墙
   ```bash
   sudo iptables -L | grep 3000
   ```

4. 检查日志
   ```bash
   tail -f logs/app.log | grep -i "error\|fail"
   ```

### 问题 2: 连接建立失败

**症状**：
```
{"success": false, "error": "connection refused"}
```

**排查步骤**：

1. 检查端口监听
   ```bash
   netstat -tuln | grep 3000
   ```

2. 检查配置中的绑定地址
   ```bash
   cat config/silktalk.config.json | grep bind
   ```

3. 检查 NAT 设置
   ```bash
   # 确保绑定到 0.0.0.0 而不是 127.0.0.1
   ```

### 问题 3: 消息传输失败

**症状**：
```
{"success": false, "error": "message delivery failed"}
```

**排查步骤**：

1. 检查连接状态
   ```bash
   curl http://localhost:3000/api/peers/list
   ```

2. 检查对端节点状态
   ```bash
   curl http://192.168.1.11:3000/api/node/info
   ```

3. 检查日志
   ```bash
   tail -f logs/app.log
   ```

---

## 测试报告

### 报告模板

```markdown
# SilkTalk Pro 双机测试报告

**测试日期**: 2026-02-22  
**测试人员**: [姓名]  
**测试环境**: [环境描述]

## 测试环境

### 机器 A
- IP: 192.168.1.10
- OS: Ubuntu 22.04
- Node.js: v20.11.0

### 机器 B
- IP: 192.168.1.11
- OS: Ubuntu 22.04
- Node.js: v20.11.0

## 测试结果

| 测试项 | 结果 | 备注 |
|--------|------|------|
| DT-001 双机部署 | ✅ 通过 | |
| DT-002 节点发现 | ✅ 通过 | |
| DT-003 P2P 连接 | ✅ 通过 | |
| DT-004 消息传输 | ✅ 通过 | |
| DT-005 网络容错 | ✅ 通过 | |

## 问题记录

[记录测试过程中遇到的问题]

## 结论

[测试结论和建议]
```

### 自动生成报告

```bash
# 生成测试报告
./scripts/test-two-nodes.sh --report

# 查看报告
cat reports/dual-machine-test-report.md
```

---

## 附录

### A. 快速测试脚本

```bash
#!/bin/bash
# quick-dual-test.sh - 快速双机测试

PEER_IP=${1:-"192.168.1.11"}

echo "=== SilkTalk Pro 双机快速测试 ==="
echo "本机 IP: $(hostname -I | awk '{print $1}')"
echo "对端 IP: $PEER_IP"
echo ""

# 1. 检查服务
echo "[1/5] 检查服务状态..."
curl -s http://localhost:3000/health >/dev/null && echo "✅ 本机服务正常" || echo "❌ 本机服务异常"

# 2. 检查网络
echo "[2/5] 检查网络连通性..."
ping -c 1 $PEER_IP >/dev/null 2>&1 && echo "✅ 网络连通" || echo "❌ 网络不通"

# 3. 检查对端服务
echo "[3/5] 检查对端服务..."
curl -s http://$PEER_IP:3000/health >/dev/null && echo "✅ 对端服务正常" || echo "❌ 对端服务异常"

# 4. 节点发现
echo "[4/5] 测试节点发现..."
curl -s "http://localhost:3000/api/peers/discover?addr=/ip4/$PEER_IP/tcp/3000" | grep -q "success.*true" && echo "✅ 节点发现成功" || echo "❌ 节点发现失败"

# 5. 消息传输
echo "[5/5] 测试消息传输..."
# [消息传输测试代码]

echo ""
echo "=== 测试完成 ==="
```

### B. 相关文档

- [README.md](README.md) - 脚本概览
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排查

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
