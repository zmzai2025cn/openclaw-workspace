# SilkTalk Pro 脚本故障排查指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**适用范围**: 自动化部署脚本套件

---

## 目录

1. [概述](#概述)
2. [错误码对照表](#错误码对照表)
3. [常见问题](#常见问题)
4. [诊断流程](#诊断流程)
5. [修复步骤](#修复步骤)
6. [日志分析](#日志分析)
7. [获取帮助](#获取帮助)

---

## 概述

本文档提供 SilkTalk Pro 自动化部署脚本的故障排查指南，帮助用户快速定位和解决部署过程中遇到的问题。

### 故障排查原则

1. **先诊断，后修复** - 使用 `troubleshoot.sh` 诊断问题
2. **查看日志** - 日志包含详细的错误信息
3. **循序渐进** - 从简单修复开始，逐步深入
4. **记录变更** - 记录所有修复操作，便于回滚

---

## 错误码对照表

### 部署错误码

| 错误码 | 错误名称 | 说明 | 严重程度 |
|--------|----------|------|----------|
| `E001` | NODE_NOT_FOUND | Node.js 未安装 | 🔴 高 |
| `E002` | NODE_VERSION_LOW | Node.js 版本过低 | 🔴 高 |
| `E003` | PORT_IN_USE | 端口被占用 | 🟡 中 |
| `E004` | PERMISSION_DENIED | 权限不足 | 🔴 高 |
| `E005` | NETWORK_ERROR | 网络错误 | 🟡 中 |
| `E006` | DOWNLOAD_FAILED | 下载失败 | 🟡 中 |
| `E007` | DEPENDENCY_MISSING | 依赖缺失 | 🔴 高 |
| `E008` | CONFIG_INVALID | 配置无效 | 🟡 中 |
| `E009` | SERVICE_FAILED | 服务启动失败 | 🔴 高 |
| `E010` | VERIFY_FAILED | 验证失败 | 🟡 中 |

### 脚本返回值

| 返回值 | 说明 |
|--------|------|
| `0` | 成功 |
| `1` | 一般错误 |
| `2` | 环境不兼容 |
| `3` | 依赖安装失败 |
| `4` | 网络错误 |
| `5` | 权限错误 |
| `6` | 配置错误 |
| `7` | 服务错误 |

---

## 常见问题

### 1. Node.js 相关问题

#### 问题 1.1: Node.js 未安装 (E001)

**症状**:
```
[ERROR] Node.js 未安装
```

**原因**:
- 系统未安装 Node.js
- Node.js 不在 PATH 中

**解决方案**:
```bash
# 方案 1: 运行 Node.js 安装脚本
./scripts/setup-node.sh --version 20

# 方案 2: 使用包管理器安装
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

#### 问题 1.2: Node.js 版本过低 (E002)

**症状**:
```
[WARN] Node.js 版本过低: v16.20.0 (需要 >= 18)
```

**原因**:
- 系统 Node.js 版本低于要求

**解决方案**:
```bash
# 方案 1: 强制升级
./scripts/setup-node.sh --version 20 --force

# 方案 2: 使用 nvm 管理版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### 问题 1.3: Node.js 下载失败

**症状**:
```
[ERROR] 下载失败: https://nodejs.org/dist/...
curl: (28) Connection timed out
```

**原因**:
- 网络连接问题
- 防火墙限制
- DNS 解析失败

**解决方案**:
```bash
# 方案 1: 使用国内镜像
./scripts/setup-node.sh --mirror cn

# 方案 2: 配置代理
export HTTP_PROXY=http://proxy.example.com:8080
export HTTPS_PROXY=http://proxy.example.com:8080
./scripts/setup-node.sh

# 方案 3: 手动下载安装
wget https://npmmirror.com/mirrors/node/v20.11.0/node-v20.11.0-linux-x64.tar.xz
tar -xf node-v20.11.0-linux-x64.tar.xz
sudo cp -r node-v20.11.0-linux-x64/* /usr/local/
```

### 2. 权限相关问题

#### 问题 2.1: 权限不足 (E004)

**症状**:
```
[ERROR] mkdir: cannot create directory '/usr/local/silktalk-pro': Permission denied
```

**原因**:
- 当前用户无 root 权限
- 目标目录不可写

**解决方案**:
```bash
# 方案 1: 使用 sudo
sudo ./scripts/auto-deploy.sh

# 方案 2: 用户级安装
./scripts/auto-deploy.sh --prefix ~/.local

# 方案 3: 修改目录权限
sudo chown -R $(whoami) /usr/local
```

#### 问题 2.2: sudo 需要密码

**症状**:
```
sudo: a password is required
```

**原因**:
- sudo 配置需要密码
- 非交互式环境

**解决方案**:
```bash
# 方案 1: 配置免密 sudo (谨慎使用)
echo "$(whoami) ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$(whoami)

# 方案 2: 使用用户级安装
./scripts/auto-deploy.sh --prefix ~/.local
```

### 3. 网络相关问题

#### 问题 3.1: 下载失败 (E006)

**症状**:
```
[ERROR] 无法获取 SilkTalk Pro
curl: (6) Could not resolve host: github.com
```

**原因**:
- DNS 解析失败
- 网络连接中断
- 防火墙限制

**解决方案**:
```bash
# 方案 1: 检查网络连接
ping 8.8.8.8
nslookup github.com

# 方案 2: 使用国内镜像
./scripts/auto-deploy.sh --mirror cn

# 方案 3: 配置 DNS
echo "nameserver 223.5.5.5" | sudo tee /etc/resolv.conf

# 方案 4: 配置代理
export HTTP_PROXY=http://proxy.example.com:8080
./scripts/auto-deploy.sh
```

#### 问题 3.2: npm 安装超时

**症状**:
```
npm ERR! code ETIMEDOUT
npm ERR! errno ETIMEDOUT
npm ERR! network request to https://registry.npmjs.org/... failed
```

**原因**:
- npm 官方源访问慢
- 网络不稳定

**解决方案**:
```bash
# 方案 1: 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 方案 2: 使用 yarn
npm install -g yarn
yarn config set registry https://registry.npmmirror.com

# 方案 3: 增加超时时间
npm config set fetch-timeout 120000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
```

### 4. 端口相关问题

#### 问题 4.1: 端口被占用 (E003)

**症状**:
```
[WARN] 端口 3000 被占用 (PID: 1234)
```

**原因**:
- 其他程序占用了端口
- 上次部署未完全清理

**解决方案**:
```bash
# 方案 1: 查找并终止进程
lsof -i:3000
kill -15 <PID>

# 方案 2: 强制终止
kill -9 <PID>

# 方案 3: 修改配置使用其他端口
./scripts/generate-config.sh  # 自动生成，选择可用端口

# 方案 4: 编辑配置文件
vim /usr/local/silktalk-pro/config/silktalk.config.json
# 修改 http.port 为其他值
```

### 5. 依赖相关问题

#### 问题 5.1: 系统依赖缺失 (E007)

**症状**:
```
[ERROR] 缺少依赖: git curl wget
```

**原因**:
- 最小化安装的系统缺少基础工具
- 包管理器未配置

**解决方案**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y curl wget git tar unzip

# CentOS/RHEL
sudo yum install -y curl wget git tar unzip

# Alpine
apk add curl wget git tar unzip
```

#### 问题 5.2: 编译依赖缺失

**症状**:
```
g++: command not found
make: command not found
```

**原因**:
- 缺少构建工具
- 开发包未安装

**解决方案**:
```bash
# Ubuntu/Debian
sudo apt-get install -y build-essential python3

# CentOS/RHEL
sudo yum groupinstall -y "Development Tools"
sudo yum install -y python3

# Alpine
apk add build-base python3
```

### 6. 配置相关问题

#### 问题 6.1: 配置格式错误 (E008)

**症状**:
```
[ERROR] 配置文件 JSON 格式无效
```

**原因**:
- 配置文件被手动修改
- 编码问题

**解决方案**:
```bash
# 方案 1: 重新生成配置
./scripts/generate-config.sh --force

# 方案 2: 验证 JSON 格式
node -e "JSON.parse(require('fs').readFileSync('config/silktalk.config.json'))"

# 方案 3: 使用 jq 修复
jq '.' config/silktalk.config.json > config/silktalk.config.json.tmp
mv config/silktalk.config.json.tmp config/silktalk.config.json
```

### 7. 服务相关问题

#### 问题 7.1: 服务启动失败 (E009)

**症状**:
```
[ERROR] 服务启动失败
systemctl status silktalk: failed
```

**原因**:
- 配置错误
- 端口冲突
- 权限问题

**解决方案**:
```bash
# 查看详细错误
sudo journalctl -u silktalk -n 50

# 检查配置
sudo systemctl cat silktalk

# 手动测试启动
cd /usr/local/silktalk-pro && node dist/index.js

# 修复后重启
sudo systemctl daemon-reload
sudo systemctl restart silktalk
```

---

## 诊断流程

### 快速诊断

```bash
# 1. 运行诊断脚本
./scripts/troubleshoot.sh

# 2. 查看诊断报告
cat reports/env-report-*.md

# 3. 自动修复（谨慎使用）
./scripts/troubleshoot.sh --auto-fix
```

### 详细诊断流程图

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
│ 2. 检查日志文件  │
│ logs/deploy-*.log│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 运行诊断脚本  │
│ troubleshoot.sh │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 定位问题类别  │
│ 根据错误码      │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┬────────┐
    │         │        │        │        │
    ▼         ▼        ▼        ▼        ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│Node.js│ │权限   │ │网络   │ │端口   │ │依赖   │
│问题   │ │问题   │ │问题   │ │问题   │ │问题   │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │
    └─────────┴─────────┴─────────┴─────────┘
                        │
                        ▼
            ┌─────────────────┐
            │ 5. 应用解决方案  │
            │ 参考常见问题    │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ 6. 重新验证     │
            │ verify-install.sh│
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────┐            ┌─────────┐
    │ 问题解决 │            │ 问题依旧 │
    └─────────┘            └────┬────┘
                                │
                                ▼
                    ┌─────────────────┐
                    │ 7. 寻求支持      │
                    │ 提交 Issue      │
                    └─────────────────┘
```

---

## 修复步骤

### 标准修复流程

```bash
# 1. 停止现有服务
sudo systemctl stop silktalk 2>/dev/null || true

# 2. 备份现有配置
cp -r /usr/local/silktalk-pro/config ~/silktalk-config-backup

# 3. 运行诊断
./scripts/troubleshoot.sh

# 4. 尝试自动修复
./scripts/troubleshoot.sh --auto-fix

# 5. 验证修复结果
./scripts/verify-install.sh

# 6. 启动服务
sudo systemctl start silktalk
```

### 完全重置

```bash
# 警告：这将删除所有数据和配置！

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

## 日志分析

### 日志位置

| 日志文件 | 位置 | 内容 |
|----------|------|------|
| 部署日志 | `logs/deploy-YYYYmmdd-HHMMSS.log` | 完整部署过程 |
| 环境报告 | `reports/env-report-*.md` | 环境检测结果 |
| 验证报告 | `reports/verify-report-*.md` | 安装验证结果 |
| 应用日志 | `/usr/local/silktalk-pro/logs/app.log` | 应用运行日志 |
| 系统日志 | `/var/log/syslog` 或 `journalctl` | 系统服务日志 |

### 日志分析命令

```bash
# 查看最新部署日志
tail -f logs/deploy-*.log

# 搜索错误
grep -i "error\|fail\|fatal" logs/deploy-*.log

# 查看应用日志
tail -f /usr/local/silktalk-pro/logs/app.log

# 查看系统服务日志
sudo journalctl -u silktalk -f

# 查看特定时间段的日志
sudo journalctl -u silktalk --since "1 hour ago"
```

### 关键日志模式

| 模式 | 含义 | 操作 |
|------|------|------|
| `Permission denied` | 权限问题 | 检查用户权限 |
| `Connection refused` | 连接被拒绝 | 检查服务状态 |
| `No such file` | 文件缺失 | 检查安装完整性 |
| `EACCES` | 访问被拒绝 | 检查文件权限 |
| `ECONNRESET` | 连接重置 | 检查网络/防火墙 |
| `ENOMEM` | 内存不足 | 增加内存或优化配置 |

---

## 获取帮助

### 自助资源

1. **查看文档**
   - [README.md](README.md) - 快速开始
   - [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
   - [COMPATIBILITY.md](COMPATIBILITY.md) - 兼容性矩阵

2. **运行诊断**
   ```bash
   ./scripts/troubleshoot.sh --verbose
   ```

3. **查看日志**
   ```bash
   cat logs/deploy-*.log
   cat reports/env-report-*.md
   ```

### 提交问题

如果以上方法无法解决问题，请提交 Issue 并提供以下信息：

1. **环境信息**
   ```bash
   cat /etc/os-release
   uname -a
   node --version
   ```

2. **错误信息**
   - 控制台完整输出
   - 相关日志片段

3. **已尝试的解决方案**
   - 已执行的命令
   - 产生的结果

4. **环境报告**
   ```bash
   ./scripts/check-env.sh --mode diagnose
   cat reports/env-report-*.md
   ```

---

## 附录

### A. 快速修复命令速查表

| 问题 | 命令 |
|------|------|
| 重新安装 Node.js | `./scripts/setup-node.sh --force` |
| 重新安装依赖 | `cd /usr/local/silktalk-pro && rm -rf node_modules && npm install` |
| 修复权限 | `sudo chown -R $(whoami) /usr/local/silktalk-pro` |
| 重启服务 | `sudo systemctl restart silktalk` |
| 查看日志 | `tail -f /usr/local/silktalk-pro/logs/app.log` |
| 完全重置 | `./scripts/auto-deploy.sh --force` |

### B. 诊断命令速查表

| 目的 | 命令 |
|------|------|
| 检查 Node.js | `node --version && npm --version` |
| 检查端口 | `netstat -tuln \| grep 3000` |
| 检查进程 | `ps aux \| grep silktalk` |
| 检查服务 | `sudo systemctl status silktalk` |
| 检查磁盘 | `df -h` |
| 检查内存 | `free -h` |

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
