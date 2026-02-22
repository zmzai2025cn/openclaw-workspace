# SilkTalk Mini - 详细使用说明

## 快速开始（3分钟）

### 1. 下载文件
```bash
# 下载两个文件
wget [mini-silktalk.js 链接]
wget [deploy-mini.sh 链接]
chmod +x deploy-mini.sh
```

### 2. 启动节点
```bash
# 方式A: 一键自动化（推荐）
./deploy-mini.sh

# 方式B: 手动启动
node mini-silktalk.js
```

### 3. 连接测试
```bash
# 在另一台机器上
./deploy-mini.sh ws://<对方IP>:8080
```

---

## 自动化部署脚本功能

### deploy-mini.sh 特点
- ✅ **自动检查**: Node.js 版本、网络、端口
- ✅ **自动安装**: 下载并安装 ws 模块
- ✅ **自动启动**: 后台运行，保存 PID
- ✅ **自动测试**: 连接目标节点并验证
- ✅ **生成报告**: 完整的部署测试报告

### 使用方式

**主节点模式**（等待连接）：
```bash
./deploy-mini.sh
```
输出示例：
```
[✓] 步骤1/5: 环境检查
[✓] Node.js: v22.22.0 ✓
[✓] 步骤2/5: 安装依赖
[✓] 步骤3/5: 启动节点
[✓] 节点启动成功 (PID: 12345)
[✓] WebSocket: ws://192.168.1.100:8080
```

**客户端模式**（连接对方）：
```bash
./deploy-mini.sh ws://192.168.1.100:8080
```

---

## 详细功能说明

### 网络发现
- 自动检测本机 IP 地址
- 自动选择可用端口（默认 8080）
- 生成唯一的节点 ID

### 连接管理
- 支持多客户端同时连接
- 自动维护连接列表
- 断线自动清理

### 消息传输
- 支持广播消息（发送给所有节点）
- 支持确认回执（ack）
- 消息格式：JSON

### 日志记录
- 完整的操作日志
- 保存到 /tmp/silktalk-mini-*.log
- 包含时间戳和节点信息

---

## 测试验证清单

### 基础测试
- [ ] 节点启动成功
- [ ] 能获取本机 IP
- [ ] 端口监听正常
- [ ] 日志输出正常

### 连接测试
- [ ] 客户端能连接到主节点
- [ ] 收到 welcome 消息
- [ ] 能发送 broadcast 消息
- [ ] 收到 ack 确认

### 双向测试
- [ ] A → B 消息传输
- [ ] B → A 消息传输
- [ ] 多节点同时连接

---

## 故障排查

### 问题1: 端口被占用
```bash
# 查看占用
netstat -tlnp | grep 8080

# 更换端口
PORT=9000 ./deploy-mini.sh
```

### 问题2: 连接超时
```bash
# 检查防火墙
sudo ufw status
sudo iptables -L | grep 8080

# 测试连通性
curl http://<对方IP>:8080
```

### 问题3: 依赖安装失败
```bash
# 手动安装
npm install ws

# 或使用淘宝镜像
npm install ws --registry=https://registry.npmmirror.com
```

---

## 进阶用法

### 自定义端口
```bash
PORT=9000 ./deploy-mini.sh
```

### 后台运行
```bash
nohup ./deploy-mini.sh > /dev/null 2>&1 &
echo $! > node.pid
```

### 查看状态
```bash
# 查看进程
ps aux | grep mini-silktalk

# 查看端口
netstat -tlnp | grep node

# 查看日志
tail -f /tmp/silktalk-mini-*.log
```

### 停止节点
```bash
kill $(cat node.pid)
# 或
pkill -f mini-silktalk
```

---

## 与 Layer 3 的关系

```
Layer 1 (Mini)        Layer 3 (Pro)
    ↓                      ↑
  验证连通性    →    完整功能
  快速测试      →    生产部署
  环境检查      →    企业级方案
```

**流程**：
1. 先用 Mini 验证双方网络连通
2. 确认环境无问题
3. 再部署 Pro 版本
4. 享受完整功能

---

## 文件清单

| 文件 | 大小 | 用途 |
|------|------|------|
| mini-silktalk.js | 4KB | 核心程序 |
| deploy-mini.sh | 7KB | 自动化部署 |
| node-info.json | 生成 | 节点信息 |
| node.pid | 生成 | 进程ID |
| /tmp/silktalk-mini-*.log | 生成 | 运行日志 |

---

## 支持

如有问题，请提供：
1. 日志文件 (/tmp/silktalk-mini-*.log)
2. 节点信息 (node-info.json)
3. 错误截图
