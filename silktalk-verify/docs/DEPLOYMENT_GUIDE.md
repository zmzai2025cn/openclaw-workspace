# SilkTalk 部署指南 (Deployment Guide)

**版本**: 0.1.0  
**适用版本**: SilkTalk Verification  
**目标读者**: 系统管理员、开发人员

---

## 快速开始 (5分钟部署)

### 方式一：一键部署（推荐）

```bash
# 1. 进入项目目录
cd silktalk-verify

# 2. 执行一键部署
./scripts/deploy.sh nodeA 10001

# 3. 查看状态
tail -f /tmp/silktalk-nodeA.log
```

### 方式二：主控脚本

```bash
# 检查环境
./silktalk.sh check

# 安装依赖
./silktalk.sh install

# 启动节点
./silktalk.sh start nodeA 10001
```

---

## 1. 部署前准备

### 1.1 系统要求

| 组件 | 最低版本 | 推荐版本 | 检查命令 |
|------|----------|----------|----------|
| Node.js | 18.0.0 | 20.x | `node --version` |
| npm | 8.0.0 | 10.x | `npm --version` |
| OpenClaw | 2026.2.9 | 最新 | `openclaw --version` |
| 操作系统 | Linux | Ubuntu 20+ | `uname -a` |

### 1.2 网络要求

- **局域网部署**: 两台机器在同一子网
- **端口**: 10001-10010（可配置）
- **防火墙**: 需开放TCP端口

### 1.3 获取项目代码

```bash
# 方式1: Git克隆
git clone https://github.com/your-repo/silktalk-verify.git
cd silktalk-verify

# 方式2: 压缩包解压
wget https://example.com/silktalk-verify.tar.gz
tar xzvf silktalk-verify.tar.gz
cd silktalk-verify

# 方式3: 直接复制
scp -r user@source-host:/path/to/silktalk-verify .
cd silktalk-verify
```

---

## 2. 环境检查

### 2.1 自动检查

```bash
# 运行环境检查脚本
node scripts/check-env.js
```

**预期输出**:
```
🔍 SilkTalk Environment Checker

[INFO] Checking Node.js...
[SUCCESS] Node.js 20.x.x installed (>= 18.0.0)
[INFO] Checking npm...
[SUCCESS] npm 10.x.x installed (>= 8.0.0)
[INFO] Checking OpenClaw...
[SUCCESS] OpenClaw available: 2026.2.x
...
✅ All checks passed! Ready to deploy.
```

### 2.2 手动检查

如果自动检查失败，手动验证：

```bash
# 检查Node.js
node --version  # 应显示 v18.x.x 或更高

# 检查npm
npm --version   # 应显示 8.x.x 或更高

# 检查OpenClaw
which openclaw        # 应显示路径
openclaw --version    # 应显示版本号

# 检查端口
netstat -tlnp | grep 10001  # 应无输出（端口空闲）
```

### 2.3 常见问题修复

#### Node.js未安装

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

#### OpenClaw未安装

```bash
# 全局安装
sudo npm install -g openclaw

# 验证
openclaw --version
```

#### 端口被占用

```bash
# 查找占用端口的进程
sudo lsof -i :10001

# 或
sudo netstat -tlnp | grep 10001

# 结束进程（谨慎操作）
kill <PID>
```

---

## 3. 安装依赖

### 3.1 自动安装

```bash
# 运行安装脚本
node scripts/install.js

# 或使用主控脚本
./silktalk.sh install
```

### 3.2 手动安装

```bash
# 安装npm依赖
npm install

# 验证安装
ls node_modules/libp2p  # 应存在
```

### 3.3 离线安装

如果目标机器无互联网：

```bash
# 在有网络的机器上
npm install
npm pack

# 复制node_modules和package到目标机器
tar czvf silktalk-deps.tar.gz node_modules
scp silktalk-deps.tar.gz target-host:/tmp/

# 在目标机器上
cd silktalk-verify
tar xzvf /tmp/silktalk-deps.tar.gz
```

---

## 4. 部署节点

### 4.1 单机部署（测试）

**部署第一个节点（节点A）**:

```bash
./scripts/deploy.sh nodeA 10001
```

**查看日志，记录PeerId**:

```bash
tail -f /tmp/silktalk-nodeA.log
# 找到类似: PeerId: 12D3KooW...
```

**部署第二个节点（节点B）连接A**:

```bash
# 使用节点A的PeerId
./scripts/deploy.sh nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/<节点A的PeerId>
```

### 4.2 局域网双机部署

**机器A - 部署节点A**:

```bash
# 获取本机IP
ip addr show | grep "inet " | head -1
# 假设IP为: 192.168.1.100

# 部署
./scripts/deploy.sh nodeA 10001

# 记录PeerId
tail /tmp/silktalk-nodeA.log | grep PeerId
```

**机器B - 部署节点B**:

```bash
# 使用机器A的IP和PeerId
./scripts/deploy.sh nodeB 10002 /ip4/192.168.1.100/tcp/10001/p2p/<节点A的PeerId>
```

### 4.3 远程部署

从本地部署到远程服务器：

```bash
# 基本用法
./scripts/remote-deploy.sh <远程IP> [用户名] [远程目录] [节点名] [端口] [bootstrap]

# 示例: 部署到192.168.1.100
./scripts/remote-deploy.sh 192.168.1.100 root /opt/silktalk nodeB 10002

# 示例: 部署并连接到现有节点
./scripts/remote-deploy.sh 192.168.1.100 root /opt/silktalk nodeB 10002 /ip4/192.168.1.101/tcp/10001/p2p/Qm...
```

**远程部署过程**:
1. 打包本地项目
2. 上传到远程服务器
3. 解压并安装依赖
4. 可选: 自动启动节点

---

## 5. 验证部署

### 5.1 检查节点状态

```bash
# 查看进程
ps aux | grep silktalk

# 查看端口
netstat -tlnp | grep 10001

# 查看日志
tail -f /tmp/silktalk-nodeA.log
```

### 5.2 测试命令

```bash
# 进入交互模式（如果节点以前台运行）
./silktalk.sh start nodeA 10001

# 在silktalk>提示符下执行:
silktalk> peers          # 查看连接的对端
silktalk> status         # 查看节点状态
silktalk> exec --message "Hello"  # 本地执行
silktalk> quit           # 退出
```

### 5.3 双节点验证

```bash
# 在节点B上执行
silktalk> peers                    # 应显示节点A
silktalk> ping <节点A的PeerId>     # 测试连通性
silktalk> delegate <节点A的PeerId> --message "Hello from B"
```

---

## 6. 管理节点

### 6.1 查看状态

```bash
# 使用主控脚本
./silktalk.sh status

# 或手动查看
ps aux | grep "node src/index"
cat /tmp/silktalk-*.pid
```

### 6.2 停止节点

```bash
# 使用主控脚本（停止所有节点）
./silktalk.sh stop

# 或手动停止特定节点
kill $(cat /tmp/silktalk-nodeA.pid)

# 强制停止
pkill -f "silktalk"
```

### 6.3 重启节点

```bash
# 停止后重新部署
./silktalk.sh stop
./scripts/deploy.sh nodeA 10001
```

### 6.4 查看日志

```bash
# 实时查看
tail -f /tmp/silktalk-nodeA.log

# 查看最后100行
tail -100 /tmp/silktalk-nodeA.log

# 搜索错误
grep ERROR /tmp/silktalk-nodeA.log
```

---

## 7. 故障排查

### 7.1 启动失败

**症状**: 部署脚本报告"Node failed to start"

**排查步骤**:

```bash
# 1. 查看详细错误日志
cat /tmp/silktalk-nodeA.log

# 2. 检查端口占用
sudo lsof -i :10001

# 3. 手动测试启动
node src/index.js --name test --port 10001 --daemon

# 4. 检查依赖
npm ls libp2p
```

### 7.2 节点无法发现

**症状**: `peers`命令显示为空

**排查步骤**:

```bash
# 1. 确认两节点在同一网络
ping <对方IP>

# 2. 检查防火墙
sudo ufw status
sudo iptables -L | grep DROP

# 3. 检查mDNS
avahi-browse -a  # 或 dns-sd -B _p2p._tcp

# 4. 查看日志中的发现记录
grep "Discovered" /tmp/silktalk-*.log
```

### 7.3 连接被拒绝

**症状**: "connection refused"错误

**解决方案**:

```bash
# 1. 确认目标节点已启动
ps aux | grep silktalk

# 2. 检查目标端口监听
netstat -tlnp | grep 10001

# 3. 检查防火墙规则
sudo ufw allow 10001/tcp

# 4. 使用IP地址替代localhost
# 将 127.0.0.1 替换为实际IP
```

### 7.4 OpenClaw执行失败

**症状**: "OpenClaw not available"或执行超时

**排查步骤**:

```bash
# 1. 检查OpenClaw安装
which openclaw
openclaw --version

# 2. 测试OpenClaw执行
openclaw agent --message "test"

# 3. 检查PATH环境变量
echo $PATH

# 4. 指定OpenClaw路径（修改代码）
const bridge = new OpenClawBridge({ path: '/usr/local/bin/openclaw' });
```

---

## 8. 高级配置

### 8.1 环境变量

```bash
# 创建.env文件
cat > .env << EOF
SILKTALK_NODE_NAME=nodeA
SILKTALK_NODE_PORT=10001
SILKTALK_LOG_LEVEL=debug
OPENCLAW_PATH=/usr/local/bin/openclaw
EOF
```

### 8.2 Systemd服务（生产环境）

创建服务文件 `/etc/systemd/system/silktalk.service`:

```ini
[Unit]
Description=SilkTalk P2P Node
After=network.target

[Service]
Type=simple
User=silktalk
WorkingDirectory=/opt/silktalk-verify
ExecStart=/usr/bin/node src/index.js --name nodeA --port 10001 --daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable silktalk
sudo systemctl start silktalk
sudo systemctl status silktalk
```

### 8.3 Docker部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 10001-10010
CMD ["node", "src/index.js", "--name", "node", "--port", "10001", "--daemon"]
```

构建和运行：

```bash
docker build -t silktalk .
docker run -d -p 10001:10001 --name silktalk-node silktalk
```

---

## 9. 附录

### 9.1 命令速查表

| 命令 | 说明 |
|------|------|
| `./silktalk.sh check` | 环境检查 |
| `./silktalk.sh install` | 安装依赖 |
| `./silktalk.sh start <name> <port>` | 启动节点 |
| `./silktalk.sh status` | 查看状态 |
| `./silktalk.sh stop` | 停止节点 |
| `./silktalk.sh test` | 运行测试 |

### 9.2 文件位置

| 文件/目录 | 说明 |
|-----------|------|
| `src/` | 源代码 |
| `scripts/` | 部署脚本 |
| `node_modules/` | 依赖包 |
| `/tmp/silktalk-*.log` | 日志文件 |
| `/tmp/silktalk-*.pid` | PID文件 |

### 9.3 获取帮助

```bash
# 查看帮助
./silktalk.sh help

# 查看脚本帮助
node scripts/check-env.js --help

# 查看项目文档
cat README.md
cat docs/DEPLOYMENT.md
```

---

**部署完成！** 如果遇到问题，请查看日志文件或参考故障排查章节。
