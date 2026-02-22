# SilkTalk Pro 快速排查指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**用途**: 快速定位和解决常见问题

---

## 目录

1. [快速诊断](#快速诊断)
2. [错误码速查](#错误码速查)
3. [常见问题速查](#常见问题速查)
4. [诊断命令清单](#诊断命令清单)
5. [修复步骤速查](#修复步骤速查)

---

## 快速诊断

### 一键诊断

```bash
# 运行完整诊断
./scripts/troubleshoot.sh

# 自动修复
./scripts/troubleshoot.sh --auto-fix

# 验证安装
./scripts/verify-install.sh
```

### 诊断流程图

```
遇到问题
    │
    ▼
┌─────────────────┐
│ 1. 查看错误信息  │
│ 控制台输出      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 匹配错误码    │
│ 参考错误码速查   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 执行诊断命令  │
│ 参考诊断命令清单 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 应用修复方案  │
│ 参考修复步骤速查 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 验证修复结果  │
│ 重新运行验证     │
└─────────────────┘
```

---

## 错误码速查

### 部署错误码

| 错误码 | 错误名称 | 快速解决方案 |
|--------|----------|--------------|
| `E001` | NODE_NOT_FOUND | `./scripts/setup-node.sh` |
| `E002` | NODE_VERSION_LOW | `./scripts/setup-node.sh --force` |
| `E003` | PORT_IN_USE | `lsof -i:3000 && kill -15 <PID>` |
| `E004` | PERMISSION_DENIED | `sudo ./scripts/auto-deploy.sh` 或 `--prefix ~/.local` |
| `E005` | NETWORK_ERROR | `./scripts/auto-deploy.sh --mirror cn` |
| `E006` | DOWNLOAD_FAILED | 检查网络，配置代理 |
| `E007` | DEPENDENCY_MISSING | `./scripts/install-deps.sh` |
| `E008` | CONFIG_INVALID | `./scripts/generate-config.sh --force` |
| `E009` | SERVICE_FAILED | `sudo journalctl -u silktalk -n 50` |
| `E010` | VERIFY_FAILED | `./scripts/troubleshoot.sh --auto-fix` |

### 脚本返回值

| 返回值 | 说明 | 操作 |
|--------|------|------|
| `0` | 成功 | 无需操作 |
| `1` | 一般错误 | 查看日志 |
| `2` | 环境不兼容 | 更换系统 |
| `3` | 依赖安装失败 | 手动安装依赖 |
| `4` | 网络错误 | 检查网络/代理 |
| `5` | 权限错误 | 使用 sudo |
| `6` | 配置错误 | 重新生成配置 |
| `7` | 服务错误 | 查看服务日志 |

---

## 常见问题速查

### Node.js 问题

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `command not found: node` | 未安装 | `./scripts/setup-node.sh` |
| `Node.js 版本过低` | 版本 < 18 | `./scripts/setup-node.sh --force` |
| `下载超时` | 网络问题 | `--mirror cn` 或配置代理 |

### 权限问题

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `Permission denied` | 无写入权限 | `sudo` 或 `--prefix ~/.local` |
| `sudo: command not found` | 无 sudo | 使用 root 或用户级安装 |
| `EACCES` | 文件权限 | `sudo chown -R $(whoami) /usr/local/silktalk-pro` |

### 网络问题

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `Connection timed out` | 网络不通 | 检查网络，使用镜像 |
| `Could not resolve host` | DNS 问题 | 更换 DNS |
| `npm ERR! ETIMEDOUT` | npm 超时 | 更换 npm 镜像源 |

### 端口问题

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `Port 3000 in use` | 端口被占用 | `kill -15 <PID>` 或修改配置 |
| `EADDRINUSE` | 地址已被使用 | 终止占用进程 |

### 依赖问题

| 症状 | 原因 | 解决方案 |
|------|------|----------|
| `node_modules not found` | 未安装依赖 | `npm install` |
| `command not found: gcc` | 缺少编译工具 | `./scripts/install-deps.sh` |
| `g++: error` | 编译错误 | 安装 build-essential |

---

## 诊断命令清单

### 系统信息

```bash
# 操作系统
cat /etc/os-release
uname -a

# 架构
uname -m

# 内核
uname -r
```

### Node.js 检查

```bash
# Node.js 版本
node --version
npm --version
which node

# npm 配置
npm config get registry
npm config list
```

### 网络检查

```bash
# 网络连通性
ping -c 3 8.8.8.8
ping -c 3 github.com

# DNS
nslookup github.com
cat /etc/resolv.conf

# 端口
netstat -tuln | grep 3000
lsof -i:3000
ss -tuln | grep 3000
```

### 资源检查

```bash
# 内存
free -h
cat /proc/meminfo | grep Mem

# 磁盘
df -h
du -sh /usr/local/silktalk-pro

# CPU
nproc
cat /proc/cpuinfo | grep "model name"
```

### 权限检查

```bash
# 当前用户
whoami
id

# 文件权限
ls -la /usr/local/silktalk-pro
stat /usr/local/silktalk-pro

# sudo
sudo -l
```

### 服务检查

```bash
# 服务状态
sudo systemctl status silktalk
sudo systemctl is-active silktalk

# 服务日志
sudo journalctl -u silktalk -n 50
sudo journalctl -u silktalk -f

# 进程
ps aux | grep silktalk
pgrep -a silktalk
```

### 日志查看

```bash
# 部署日志
tail -f logs/deploy-*.log
cat logs/deploy-*.log | grep -i error

# 应用日志
tail -f /usr/local/silktalk-pro/logs/app.log

# 系统日志
sudo tail -f /var/log/syslog
sudo tail -f /var/log/messages
```

---

## 修复步骤速查

### 快速修复命令

```bash
# 1. 重新安装 Node.js
./scripts/setup-node.sh --force

# 2. 重新安装依赖
cd /usr/local/silktalk-pro && rm -rf node_modules && npm install

# 3. 修复权限
sudo chown -R $(whoami) /usr/local/silktalk-pro

# 4. 重启服务
sudo systemctl restart silktalk

# 5. 重新生成配置
./scripts/generate-config.sh --force

# 6. 完整重新部署
./scripts/auto-deploy.sh --force
```

### 分步修复流程

#### 场景 1: 部署失败

```bash
# 步骤 1: 诊断问题
./scripts/troubleshoot.sh

# 步骤 2: 查看日志
cat logs/deploy-*.log | tail -50

# 步骤 3: 根据错误码修复
# 参考错误码速查表

# 步骤 4: 重新验证
./scripts/verify-install.sh
```

#### 场景 2: 服务无法启动

```bash
# 步骤 1: 检查服务状态
sudo systemctl status silktalk

# 步骤 2: 查看错误日志
sudo journalctl -u silktalk -n 50

# 步骤 3: 手动测试启动
cd /usr/local/silktalk-pro && node dist/index.js

# 步骤 4: 修复问题
# 根据错误信息修复

# 步骤 5: 重启服务
sudo systemctl restart silktalk
```

#### 场景 3: 网络连接问题

```bash
# 步骤 1: 检查网络
ping 8.8.8.8
nslookup github.com

# 步骤 2: 检查端口
netstat -tuln | grep 3000

# 步骤 3: 检查防火墙
sudo ufw status
sudo iptables -L

# 步骤 4: 修复网络/防火墙
# 开放端口或关闭防火墙

# 步骤 5: 重启服务
sudo systemctl restart silktalk
```

#### 场景 4: 权限问题

```bash
# 步骤 1: 检查当前权限
ls -la /usr/local/silktalk-pro
id

# 步骤 2: 修复权限（方案 A：使用 sudo）
sudo chown -R root:root /usr/local/silktalk-pro

# 或方案 B：用户级安装
./scripts/auto-deploy.sh --prefix ~/.local

# 步骤 3: 验证
./scripts/verify-install.sh
```

### 紧急恢复

```bash
# 完全重置（警告：删除所有数据）

# 1. 停止服务
sudo systemctl stop silktalk
sudo systemctl disable silktalk

# 2. 删除安装
sudo rm -rf /usr/local/silktalk-pro
sudo rm -f /usr/local/bin/silktalk
sudo rm -f /etc/systemd/system/silktalk.service

# 3. 重新部署
./scripts/auto-deploy.sh --force
```

---

## 附录

### A. 快速参考卡片

```
┌─────────────────────────────────────────┐
│        SilkTalk Pro 快速参考            │
├─────────────────────────────────────────┤
│ 部署: ./scripts/auto-deploy.sh          │
│ 诊断: ./scripts/troubleshoot.sh         │
│ 验证: ./scripts/verify-install.sh       │
│ 日志: tail -f logs/deploy-*.log         │
├─────────────────────────────────────────┤
│ 启动: sudo systemctl start silktalk     │
│ 停止: sudo systemctl stop silktalk      │
│ 状态: sudo systemctl status silktalk    │
│ 日志: sudo journalctl -u silktalk -f    │
├─────────────────────────────────────────┤
│ 常用端口: 3000 (HTTP)                   │
│          3001 (WebSocket)               │
│          3478 (WebRTC)                  │
└─────────────────────────────────────────┘
```

### B. 相关文档

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 详细故障排查
- [COMPATIBILITY.md](COMPATIBILITY.md) - 兼容性矩阵
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
