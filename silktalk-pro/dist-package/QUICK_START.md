# SilkTalk Pro 快速上手指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**预计阅读时间**: 15分钟

---

## 🚀 5分钟快速开始

### 1. 一键部署

```bash
# 进入项目目录
cd silktalk-pro

# 一键部署（全自动）
./scripts/auto-deploy.sh
```

### 2. 验证安装

```bash
# 运行验证脚本
./scripts/verify-install.sh

# 或检查服务状态
sudo systemctl status silktalk
```

### 3. 开始使用

```bash
# 查看节点状态
silktalk status

# 查看帮助
silktalk --help
```

---

## 📋 部署前检查

### 系统要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Linux (内核 >= 4.0) | Ubuntu 22.04 LTS |
| 架构 | x64 或 arm64 | x64 |
| 内存 | 512MB | 2GB |
| 磁盘 | 2GB | 10GB |
| Node.js | 18.x | 20.x LTS |

### 快速检查命令

```bash
# 检查操作系统
cat /etc/os-release

# 检查 Node.js
node --version  # 需要 >= 18.0.0

# 检查内存
free -h

# 检查磁盘空间
df -h
```

---

## 🔧 部署模式选择

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| **全自动** | `./scripts/auto-deploy.sh` | CI/CD、批量部署 |
| **半自动** | `./scripts/auto-deploy.sh -m semi` | 首次部署、生产环境 |
| **诊断** | `./scripts/auto-deploy.sh -m diagnose` | 环境评估 |
| **修复** | `./scripts/auto-deploy.sh -m repair` | 问题修复 |

---

## 📁 重要文件位置

### 安装目录

```
/usr/local/silktalk-pro/          # 默认安装路径
├── config/                       # 配置文件
│   └── silktalk.config.json     # 主配置
├── logs/                         # 日志文件
│   └── app.log                  # 应用日志
├── dist/                         # 编译输出
└── node_modules/                 # 依赖包
```

### 配置文件

| 文件 | 路径 | 用途 |
|------|------|------|
| 主配置 | `/usr/local/silktalk-pro/config/silktalk.config.json` | 节点配置 |
| 环境变量 | `/usr/local/silktalk-pro/.env` | 环境变量 |
| 部署日志 | `logs/deploy-*.log` | 部署过程日志 |

---

## 🛠️ 常用命令

### 服务管理

```bash
# 启动服务
sudo systemctl start silktalk

# 停止服务
sudo systemctl stop silktalk

# 重启服务
sudo systemctl restart silktalk

# 查看状态
sudo systemctl status silktalk

# 开机自启
sudo systemctl enable silktalk
```

### 日志查看

```bash
# 实时查看应用日志
tail -f /usr/local/silktalk-pro/logs/app.log

# 查看系统日志
sudo journalctl -u silktalk -f

# 查看部署日志
tail -f logs/deploy-*.log
```

### 节点操作

```bash
# 查看节点状态
silktalk status

# 列出对等点
silktalk peers

# 连接到对等点
silktalk connect /ip4/192.168.1.1/tcp/4001/p2p/12D3...

# 发送消息
silktalk send <peer-id> "Hello World"
```

---

## 🔍 故障排查速查

### 常见问题

| 问题 | 诊断命令 | 解决方案 |
|------|----------|----------|
| 服务无法启动 | `sudo systemctl status silktalk` | 查看日志，检查配置 |
| 端口被占用 | `lsof -i :3000` | 终止占用进程或修改端口 |
| 权限不足 | `ls -la /usr/local/silktalk-pro` | 使用 sudo 或修复权限 |
| 网络超时 | `ping 8.8.8.8` | 检查网络，使用镜像源 |

### 一键诊断

```bash
# 运行完整诊断
./scripts/troubleshoot.sh

# 自动修复
./scripts/troubleshoot.sh --auto-fix
```

---

## 🌐 网络配置

### 默认端口

| 端口 | 协议 | 用途 |
|------|------|------|
| 3000 | TCP | HTTP API |
| 3001 | TCP | WebSocket |
| 3478 | UDP | STUN/TURN |

### 防火墙配置

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
```

---

## 📚 下一步

### 深入了解

1. **架构设计** → 阅读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. **详细配置** → 阅读 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
3. **故障排查** → 阅读 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
4. **开发指南** → 阅读 [docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md)

### 测试验证

1. **双机测试** → 阅读 [docs/DUAL_MACHINE_TEST.md](docs/DUAL_MACHINE_TEST.md)
2. **运行测试** → 阅读 [docs/testing/EXECUTION_MANUAL.md](docs/testing/EXECUTION_MANUAL.md)

---

## 💡 提示

- 首次部署建议使用 `--mode semi` 了解部署过程
- 遇到问题时先运行 `./scripts/troubleshoot.sh`
- 保留部署日志便于问题排查
- 生产环境部署前先在测试环境验证

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
