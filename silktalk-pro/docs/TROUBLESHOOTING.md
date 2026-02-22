# SilkTalk Pro 故障排查手册

## 快速诊断

```bash
# 运行全面诊断
./scripts/troubleshoot.sh

# 自动修复问题
./scripts/troubleshoot.sh --auto-fix
```

## 常见问题

### 1. Node.js 相关问题

#### 1.1 Node.js 未安装

**症状**:
```
command not found: node
```

**解决**:
```bash
./scripts/setup-node.sh
```

#### 1.2 Node.js 版本过低

**症状**:
```
Error: Node.js version must be >= 18.0.0
```

**解决**:
```bash
./scripts/setup-node.sh --version 20 --force
```

#### 1.3 npm 安装失败

**症状**:
```
npm ERR! code EACCES
npm ERR! syscall mkdir
```

**解决**:
```bash
# 方法1: 使用 sudo
sudo npm install -g npm

# 方法2: 修复权限
sudo chown -R $(whoami) ~/.npm

# 方法3: 使用 nvm
./scripts/setup-node.sh --use-nvm
```

### 2. 依赖安装问题

#### 2.1 原生模块编译失败

**症状**:
```
gyp ERR! build error
```

**解决**:
```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# CentOS/RHEL
sudo yum groupinstall "Development Tools"

# Alpine
sudo apk add build-base python3
```

#### 2.2 网络超时

**症状**:
```
npm ERR! network timeout
```

**解决**:
```bash
# 使用中国镜像
npm config set registry https://registry.npmmirror.com

# 或增加超时时间
npm install --timeout=60000
```

### 3. 端口问题

#### 3.1 端口被占用

**症状**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 或
netstat -tulpn | grep 3000

# 终止进程
kill -15 <PID>

# 或修改配置使用其他端口
./scripts/generate-config.sh
```

#### 3.2 防火墙阻止

**症状**:
```
连接超时，无法访问服务
```

**解决**:
```bash
# UFW
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 3478/udp

# Firewalld
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=3478/udp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
```

### 4. 权限问题

#### 4.1 无法写入目录

**症状**:
```
EACCES: permission denied, mkdir '/usr/local/silktalk-pro/logs'
```

**解决**:
```bash
# 修复权限
sudo chown -R $(whoami):$(whoami) /usr/local/silktalk-pro

# 或使用用户级安装
./scripts/auto-deploy.sh -p ~/.local
```

#### 4.2 无法绑定特权端口

**症状**:
```
Error: bind EACCES 0.0.0.0:80
```

**解决**:
```bash
# 使用非特权端口 (>1024)
# 或授予权限
sudo setcap cap_net_bind_service=+ep $(which node)
```

### 5. 服务启动问题

#### 5.1 服务无法启动

**症状**:
```
Failed to start silktalk.service
```

**解决**:
```bash
# 查看详细错误
sudo systemctl status silktalk

# 查看日志
sudo journalctl -u silktalk -f

# 手动测试
node /usr/local/silktalk-pro/dist/index.js
```

#### 5.2 配置文件错误

**症状**:
```
Error: Cannot parse config file
```

**解决**:
```bash
# 验证 JSON 格式
node -e "JSON.parse(require('fs').readFileSync('/usr/local/silktalk-pro/config/silktalk.config.json'))"

# 重新生成配置
./scripts/generate-config.sh
```

### 6. 网络连接问题

#### 6.1 WebRTC 连接失败

**症状**:
```
ICE connection failed
```

**解决**:
```bash
# 检查 STUN 服务器
# 配置 TURN 服务器
# 检查防火墙 UDP 端口
```

#### 6.2 P2P 无法建立

**症状**:
```
无法直接连接，使用中继
```

**解决**:
- 配置 TURN 服务器
- 检查 NAT 类型
- 开放更多 UDP 端口

### 7. 性能问题

#### 7.1 内存不足

**症状**:
```
FATAL ERROR: Reached heap limit
```

**解决**:
```bash
# 增加 Node.js 内存限制
node --max-old-space-size=4096 dist/index.js

# 或减少连接数限制
# 修改 config: limits.max_connections
```

#### 7.2 CPU 占用高

**症状**:
```
CPU 使用率持续 100%
```

**解决**:
```bash
# 查看进程
htop

# 分析性能
node --prof dist/index.js
```

## 日志分析

### 日志位置

```
/usr/local/silktalk-pro/logs/app.log
```

### 常见日志模式

#### 正常启动
```
[INFO] Server starting...
[INFO] HTTP server listening on port 3000
[INFO] WebSocket server listening on port 3001
[INFO] Server ready
```

#### 连接错误
```
[WARN] Connection timeout
[ERROR] Failed to handshake
```

#### 认证错误
```
[WARN] Invalid token
[ERROR] Authentication failed
```

## 调试模式

### 启用详细日志

```bash
export DEBUG=silktalk:*
npm start
```

### 使用 Node.js 调试器

```bash
node --inspect dist/index.js
```

然后打开 Chrome DevTools 调试。

## 恢复出厂设置

```bash
# 停止服务
sudo systemctl stop silktalk

# 备份配置
cp /usr/local/silktalk-pro/config/silktalk.config.json ~/config.backup.json

# 重新部署
./scripts/auto-deploy.sh --force

# 恢复配置
cp ~/config.backup.json /usr/local/silktalk-pro/config/silktalk.config.json

# 重启服务
sudo systemctl start silktalk
```

## 获取帮助

### 收集诊断信息

```bash
# 环境信息
./scripts/check-env.sh

# 验证报告
./scripts/verify-install.sh

# 日志
./scripts/troubleshoot.sh
```

### 提交问题报告

请提供以下信息：
1. 操作系统版本
2. Node.js 版本
3. 部署日志
4. 应用日志
5. 配置文件 (脱敏)

## 紧急恢复

### 服务完全无法启动

```bash
# 1. 检查端口占用
sudo lsof -i :3000

# 2. 检查磁盘空间
df -h

# 3. 检查内存
free -h

# 4. 手动启动查看错误
cd /usr/local/silktalk-pro
node dist/index.js

# 5. 如果仍有问题，重新安装
sudo rm -rf /usr/local/silktalk-pro
./scripts/auto-deploy.sh
```
