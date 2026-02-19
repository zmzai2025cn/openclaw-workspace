# 部署指南

## 1. 环境要求

### 1.1 硬件要求

| 场景 | CPU | 内存 | 磁盘 | 说明 |
|------|-----|------|------|------|
| 开发测试 | 1核 | 512MB | 10GB | 单机即可 |
| 小规模生产 | 2核 | 1GB | 50GB | 日1万条 |
| 中等规模 | 4核 | 2GB | 200GB | 日10万条 |
| 大规模 | 8核 | 4GB | 1TB | 日100万条 |

### 1.2 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- 或 Node.js 18+

## 2. 部署方式

### 2.1 Docker Compose（推荐）

```bash
# 1. 克隆代码
git clone <repo>
cd chat-archive

# 2. 配置环境变量
cp .env.example .env
vim .env

# 3. 启动服务
docker-compose up -d

# 4. 检查状态
docker-compose ps
curl http://localhost:8080/health
```

### 2.2 手动部署

```bash
# 1. 安装依赖
npm install

# 2. 构建
npm run build

# 3. 配置环境变量
cp .env.example .env
vim .env

# 4. 创建数据目录
mkdir -p data backups logs

# 5. 启动
npm start
```

### 2.3 Kubernetes（高级）

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-archive
spec:
  replicas: 1
  selector:
    matchLabels:
      app: chat-archive
  template:
    metadata:
      labels:
        app: chat-archive
    spec:
      containers:
      - name: chat-archive
        image: chat-archive:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_PATH
          value: /app/data/chat.db
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: backups
          mountPath: /app/backups
        - name: logs
          mountPath: /app/logs
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: chat-archive-data
      - name: backups
        persistentVolumeClaim:
          claimName: chat-archive-backups
      - name: logs
        emptyDir: {}
```

## 3. 配置详解

### 3.1 环境变量

```bash
# 基础配置
NODE_ENV=production
DB_PATH=/app/data/chat.db

# 日志配置
LOG_LEVEL=info              # debug/info/warn/error
LOG_FILE=/app/logs/archive.log
LOG_MAX_SIZE_MB=100
LOG_MAX_FILES=5

# 备份配置
BACKUP_ENABLED=true
BACKUP_DIR=/app/backups
BACKUP_INTERVAL_HOURS=24
BACKUP_RETAIN_COUNT=7

# 清理配置
CLEANUP_ENABLED=true
RETENTION_DAYS=90
MAX_DB_SIZE_MB=1024
ARCHIVE_OLD_DATA=false
ARCHIVE_DIR=/app/archives

# 健康检查
HEALTH_PORT=8080

# 缓冲配置
BUFFER_SIZE=100
FLUSH_INTERVAL_MS=300000
```

### 3.2 配置文件

支持从文件加载配置：

```typescript
import { loadConfig } from 'chat-archive';

const config = loadConfig('./config/production.env');
```

## 4. 数据持久化

### 4.1 Docker Volume

```yaml
volumes:
  chat-data:
    driver: local
  chat-backups:
    driver: local
```

### 4.2 宿主机挂载

```yaml
volumes:
  - /host/data:/app/data
  - /host/backups:/app/backups
  - /host/logs:/app/logs
```

### 4.3 云存储（高级）

```yaml
# AWS EBS
volumes:
  - name: data
    awsElasticBlockStore:
      volumeID: vol-12345
      fsType: ext4
```

## 5. 网络配置

### 5.1 端口映射

```yaml
ports:
  - "8080:8080"  # 健康检查
```

### 5.2 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name archive.example.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 6. 安全加固

### 6.1 文件权限

```bash
chmod 700 data
chmod 600 data/chat.db
```

### 6.2 网络安全

```bash
# 防火墙
ufw allow 8080/tcp
ufw deny 8080/tcp from 10.0.0.0/8
```

### 6.3 容器安全

```dockerfile
# 使用非root用户
USER node

# 只读文件系统
read_only: true

# 资源限制
resources:
  limits:
    cpus: '2'
    memory: 1G
```

## 7. 验证部署

### 7.1 健康检查

```bash
# 健康状态
curl http://localhost:8080/health

# 就绪检查
curl http://localhost:8080/ready

# 监控指标
curl http://localhost:8080/metrics
```

### 7.2 功能测试

```bash
# 写入测试消息
curl -X POST http://localhost:8080/test/archive \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test_001",
    "channel": "test",
    "chatId": "test_chat",
    "userId": "test_user",
    "userName": "Test",
    "content": "Hello",
    "isMentioned": false
  }'

# 查询
curl "http://localhost:8080/test/query?start=2024-01-01&end=2024-12-31"
```

## 8. 升级维护

### 8.1 滚动升级

```bash
# 1. 备份数据
docker exec chat-archive npm run backup

# 2. 拉取新版本
docker-compose pull

# 3. 重启服务
docker-compose up -d

# 4. 验证
curl http://localhost:8080/health
```

### 8.2 回滚

```bash
# 1. 停止服务
docker-compose down

# 2. 从备份恢复
docker exec chat-archive npm run restore backup_2024-01-01.db

# 3. 启动旧版本
docker-compose up -d
```

## 9. 常见问题

### Q1: 启动失败

```bash
# 检查日志
docker logs chat-archive

# 检查权限
ls -la data/

# 检查磁盘空间
df -h
```

### Q2: 写入失败

```bash
# 检查WAL
cat data/wal.jsonl

# 检查磁盘空间
df -h data/

# 检查内存
free -h
```

### Q3: 查询慢

```bash
# 检查数据量
sqlite3 data/chat.db "SELECT COUNT(*) FROM messages;"

# 检查索引
sqlite3 data/chat.db ".indexes messages"
```

## 10. 生产检查清单

- [ ] 环境变量配置正确
- [ ] 数据目录权限正确
- [ ] 磁盘空间充足（>20%）
- [ ] 健康检查通过
- [ ] 备份策略生效
- [ ] 日志正常输出
- [ ] 监控告警配置
- [ ] 防火墙规则配置
- [ ] SSL证书配置（如有）
- [ ] 文档已更新
