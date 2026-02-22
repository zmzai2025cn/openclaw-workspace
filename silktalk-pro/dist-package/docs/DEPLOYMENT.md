# SilkTalk Pro 自动化部署指南

## 快速开始

### 一键部署

```bash
curl -fsSL https://raw.githubusercontent.com/silktalk/silktalk-pro/main/scripts/auto-deploy.sh | bash
```

或本地执行：

```bash
cd silktalk-pro
./scripts/auto-deploy.sh
```

## 部署模式

### 1. 全自动模式 (默认)

```bash
./scripts/auto-deploy.sh -m auto
```

- 零交互，一键完成所有步骤
- 适合 CI/CD 和批量部署

### 2. 半自动模式

```bash
./scripts/auto-deploy.sh -m semi
```

- 关键步骤需要确认
- 适合首次部署或生产环境

### 3. 诊断模式

```bash
./scripts/auto-deploy.sh -m diagnose
```

- 仅检测环境，不执行部署
- 生成详细的环境报告

### 4. 修复模式

```bash
./scripts/auto-deploy.sh -m repair
```

- 针对问题自动修复
- 保留现有配置

## 高级选项

### 指定版本

```bash
./scripts/auto-deploy.sh -v 1.2.0
```

### 指定 Node.js 版本

```bash
./scripts/auto-deploy.sh -n 18
```

### 指定安装路径

```bash
./scripts/auto-deploy.sh -p /opt/silktalk
```

### 使用中国镜像

```bash
./scripts/auto-deploy.sh --mirror cn
```

### 强制重新安装

```bash
./scripts/auto-deploy.sh --force
```

## 分步执行

### 1. 环境检测

```bash
./scripts/check-env.sh
```

检测项：
- 操作系统和架构
- Node.js 版本
- 网络连通性
- 系统资源
- 依赖完整性
- 权限状态

### 2. 安装依赖

```bash
./scripts/install-deps.sh
```

自动适配：
- apt (Debian/Ubuntu)
- yum/dnf (RHEL/CentOS)
- pacman (Arch)
- apk (Alpine)

### 3. 安装 Node.js

```bash
./scripts/setup-node.sh --version 20
```

支持：
- 二进制安装
- nvm 安装
- fnm 安装
- 用户级安装 (无 root)

### 4. 部署项目

```bash
./scripts/deploy-silktalk.sh --version latest
```

### 5. 生成配置

```bash
./scripts/generate-config.sh
```

### 6. 验证安装

```bash
./scripts/verify-install.sh
```

## 故障排查

### 运行诊断

```bash
./scripts/troubleshoot.sh
```

### 自动修复

```bash
./scripts/troubleshoot.sh --auto-fix
```

### 查看日志

```bash
tail -f /usr/local/silktalk-pro/logs/app.log
```

## 环境兼容性

| 环境 | 支持 | 备注 |
|------|------|------|
| Ubuntu 20.04+ | ✅ | 原生支持 |
| Debian 11+ | ✅ | 原生支持 |
| CentOS 8+ | ✅ | 原生支持 |
| Alpine Linux | ✅ | 需安装 build-base |
| Docker | ✅ | 提供 Dockerfile |
| WSL2 | ✅ | 完全支持 |
| WSL1 | ⚠️ | 可能有网络问题 |
| 无 root | ✅ | 用户级安装 |
| ARM64 | ✅ | 原生支持 |

## 配置说明

### 主配置文件

位置：`/usr/local/silktalk-pro/config/silktalk.config.json`

关键配置项：
- `http.port`: HTTP 服务端口 (默认 3000)
- `websocket.port`: WebSocket 端口 (默认 3001)
- `webrtc.port`: WebRTC 端口 (默认 3478)
- `security.jwt_secret`: JWT 密钥

### 环境变量

位置：`/usr/local/silktalk-pro/.env`

```bash
SILKTALK_HTTP_PORT=3000
SILKTALK_JWT_SECRET=your-secret-key
SILKTALK_LOG_LEVEL=info
```

## 服务管理

### Systemd

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

### Docker

```bash
# 构建镜像
docker build -t silktalk-pro .

# 运行容器
docker run -d -p 3000:3000 -p 3001:3001 silktalk-pro

# 使用 Docker Compose
docker-compose up -d
```

## 安全建议

1. **修改默认密钥**
   ```bash
   ./scripts/generate-config.sh
   ```

2. **配置防火墙**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 3001/tcp
   sudo ufw allow 3478/udp
   ```

3. **使用 HTTPS**
   - 配置 Nginx 反向代理
   - 或使用自带 TLS 支持

4. **定期更新**
   ```bash
   ./scripts/auto-deploy.sh --force
   ```

## 获取帮助

```bash
./scripts/auto-deploy.sh --help
```

## 报告问题

如遇到问题，请提供：
1. 环境检测报告：`reports/env-report-*.md`
2. 验证报告：`reports/verify-report-*.md`
3. 部署日志：`logs/deploy-*.log`
