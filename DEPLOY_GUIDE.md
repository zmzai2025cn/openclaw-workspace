# 生产部署指南

## 系统要求

### 服务端（Kimiclaw DB）
- OS: Linux (Ubuntu 20.04+)
- CPU: 2核+
- RAM: 4GB+
- Disk: 50GB+
- Network: 公网访问

### 客户端（WinCapture）
- OS: Windows 10/11, macOS 12+, Ubuntu 20.04+
- CPU: 2核+
- RAM: 2GB+
- Disk: 1GB+

---

## 服务端部署

### 方式1：Docker（推荐）

```bash
# 1. 克隆代码
git clone <repo-url>
cd kimiclaw-db

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置密钥和数据库路径

# 3. 启动服务
docker-compose up -d

# 4. 验证
curl http://localhost:3000/health
```

### 方式2：Kubernetes

```bash
# 1. 应用配置
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml

# 2. 查看状态
kubectl get pods -l app=kimiclaw-db
```

### 方式3：裸机部署

```bash
# 1. 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装依赖
npm install

# 3. 编译
npm run build

# 4. 启动
npm start
```

---

## 客户端部署

### Windows（Electron版）

```bash
# 1. 安装Node.js
# 下载 https://nodejs.org/dist/v18.17.0/node-v18.17.0-x64.msi

# 2. 安装依赖
npm install

# 3. 构建
npm run build

# 4. 分发
dist/WinCapture-1.0.0.exe
```

### 配置

首次运行会弹出配置窗口：
- 服务器地址：`https://your-server.com/api/capture/upload`
- 用户ID：员工唯一标识
- API Key：从服务端获取

---

## 安全配置

### 1. HTTPS（必须）

使用Nginx反向代理：

```nginx
server {
    listen 443 ssl;
    server_name your-server.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. 防火墙

```bash
# 仅开放必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 3. 数据备份

```bash
# 定时备份（crontab -e）
0 2 * * * /path/to/kimiclaw-db/scripts/backup.sh
```

---

## 监控告警

### 健康检查

```bash
# 服务端健康
curl https://your-server.com/health

# 数据库状态
curl https://your-server.com/metrics
```

### 告警规则

| 指标 | 阈值 | 告警方式 |
|------|------|----------|
| CPU使用率 | > 80% | 邮件 |
| 内存使用率 | > 90% | 邮件+短信 |
| 磁盘使用率 | > 85% | 邮件 |
| 服务不可用 | - | 邮件+短信 |

---

## 故障排查

### 服务端无法启动

```bash
# 查看日志
docker logs kimiclaw-db

# 检查端口占用
sudo lsof -i :3000

# 验证数据库
ls -la data/kimiclaw.db
```

### 客户端无法连接

1. 检查网络连通性
2. 验证API Key
3. 查看客户端日志：`%LOCALAPPDATA%/WinCapture/logs`

### 数据丢失

1. 检查备份文件：`backups/`
2. 执行恢复：`./scripts/restore.sh backup_xxx.db`

---

## 升级维护

### 服务端升级

```bash
# 1. 备份数据
docker exec kimiclaw-db cp /app/data/kimiclaw.db /app/backups/

# 2. 拉取新版本
git pull origin main

# 3. 重启服务
docker-compose up -d --build
```

### 客户端升级

自动更新：服务端推送新版本时，客户端自动下载安装。

---

## 验证清单

部署完成后检查：

- [ ] 服务端健康检查通过
- [ ] 客户端能正常连接
- [ ] 数据能正常上传
- [ ] 备份任务正常运行
- [ ] 告警通知能正常接收
- [ ] HTTPS证书有效
- [ ] 防火墙规则正确

---

## 联系支持

遇到问题：
1. 查看日志文件
2. 检查本指南故障排查章节
3. 提交Issue到项目仓库