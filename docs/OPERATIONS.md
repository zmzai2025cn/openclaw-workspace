# 运维手册

## 日常巡检

### 每日检查清单

- [ ] 服务健康状态
- [ ] 磁盘空间使用
- [ ] 备份任务执行
- [ ] 错误日志检查

### 检查命令

```bash
# 服务健康
curl https://api.kimiclaw.com/health

# 磁盘空间
df -h

# 内存使用
free -h

# 进程状态
ps aux | grep kimiclaw

# 日志查看
docker logs --tail 100 kimiclaw-db
tail -f /var/log/kimiclaw/app.log
```

---

## 监控告警

### 关键指标

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| CPU | < 60% | > 80% |
| 内存 | < 70% | > 85% |
| 磁盘 | < 70% | > 85% |
| 响应时间 | < 100ms | > 500ms |
| 错误率 | < 1% | > 5% |

### 告警配置

```yaml
# alertmanager.yml
groups:
  - name: kimiclaw
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "错误率过高"
```

---

## 备份恢复

### 自动备份

```bash
# 查看备份任务
crontab -l

# 备份脚本位置
/opt/kimiclaw/scripts/backup.sh
```

### 手动备份

```bash
# 数据库备份
docker exec kimiclaw-db cp /app/data/kimiclaw.db /app/backups/kimiclaw_$(date +%Y%m%d).db

# 配置备份
tar czf config_backup_$(date +%Y%m%d).tar.gz /etc/kimiclaw/
```

### 数据恢复

```bash
# 1. 停止服务
docker-compose down

# 2. 恢复数据
cp backups/kimiclaw_20240220.db data/kimiclaw.db

# 3. 启动服务
docker-compose up -d

# 4. 验证
curl http://localhost:3000/health
```

---

## 扩容操作

### 垂直扩容

```bash
# 修改docker-compose.yml
services:
  kimiclaw-db:
    deploy:
      resources:
        limits:
          memory: 8G  # 从4G扩容

# 重启生效
docker-compose up -d
```

### 水平扩容

```bash
# K8s扩容
kubectl scale deployment kimiclaw-db --replicas=3

# 查看Pod
kubectl get pods -l app=kimiclaw-db
```

---

## 故障处理

### 服务无响应

```bash
# 1. 检查进程
ps aux | grep kimiclaw

# 2. 查看日志
docker logs kimiclaw-db --tail 200

# 3. 重启服务
docker-compose restart

# 4. 检查资源
free -h && df -h
```

### 数据库损坏

```bash
# 1. 停止服务
docker-compose down

# 2. 使用备份恢复
cp backups/kimiclaw_latest.db data/kimiclaw.db

# 3. 启动并检查
docker-compose up -d
docker logs kimiclaw-db
```

### 客户端批量离线

1. 检查服务端状态
2. 检查网络连通性
3. 查看API限流情况
4. 检查证书是否过期

---

## 日志管理

### 日志位置

| 组件 | 日志路径 |
|------|----------|
| 服务端 | `/var/log/kimiclaw/` |
| Nginx | `/var/log/nginx/` |
| 客户端 | `~/.wincapture/logs/` |

### 日志轮转

```bash
# logrotate配置
/etc/logrotate.d/kimiclaw

# 手动轮转
logrotate -f /etc/logrotate.d/kimiclaw
```

---

## 安全维护

### 证书更新

```bash
# Let's Encrypt证书续期
certbot renew

# 重启Nginx
systemctl restart nginx
```

### 安全更新

```bash
# 系统更新
apt update && apt upgrade -y

# 容器镜像更新
docker pull kimiclaw-db:latest
docker-compose up -d
```

---

## 联系信息

| 角色 | 联系方式 |
|------|----------|
| 运维值班 | ops@kimiclaw.com |
| 技术支持 | support@kimiclaw.com |
| 紧急热线 | +86-xxx-xxxx-xxxx |