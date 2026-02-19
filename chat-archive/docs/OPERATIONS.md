# 运维手册

## 1. 日常运维

### 1.1 每日检查

```bash
#!/bin/bash
# daily-check.sh

echo "=== Chat Archive Daily Check ==="

# 健康检查
if ! curl -sf http://localhost:8080/health; then
    echo "❌ Health check failed"
    exit 1
fi
echo "✅ Health check passed"

# 磁盘空间
USAGE=$(df data/ | tail -1 | awk '{print $5}' | tr -d '%')
if [ $USAGE -gt 90 ]; then
    echo "⚠️ Disk usage critical: ${USAGE}%"
else
    echo "✅ Disk usage: ${USAGE}%"
fi

# 备份状态
BACKUP_COUNT=$(ls backups/ | wc -l)
echo "📦 Backups: $BACKUP_COUNT"

# 消息统计
curl -s http://localhost:8080/metrics | grep messagesTotal
echo "=== Check Complete ==="
```

### 1.2 每周检查

- 检查日志文件大小
- 验证备份完整性
- 检查查询性能
- 审查安全日志

### 1.3 每月检查

- 数据库大小趋势
- 备份恢复演练
- 性能基准测试
- 文档更新

## 2. 监控告警

### 2.1 关键指标

| 指标 | 正常范围 | 警告阈值 | 紧急阈值 |
|------|---------|---------|---------|
| 磁盘使用率 | <70% | 80% | 90% |
| 内存使用率 | <60% | 75% | 85% |
| 写入延迟 | <10ms | 50ms | 100ms |
| 查询延迟 | <100ms | 500ms | 1s |
| 错误率 | 0% | 0.1% | 1% |

### 2.2 Prometheus集成

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'chat-archive'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 2.3 Grafana仪表板

```json
{
  "dashboard": {
    "title": "Chat Archive",
    "panels": [
      {
        "title": "Messages Total",
        "targets": [
          {
            "expr": "messagesTotal"
          }
        ]
      },
      {
        "title": "Disk Usage",
        "targets": [
          {
            "expr": "diskUsage"
          }
        ]
      }
    ]
  }
}
```

### 2.4 告警规则

```yaml
# alert-rules.yml
groups:
  - name: chat-archive
    rules:
      - alert: DiskSpaceCritical
        expr: diskUsage > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space critical"
          
      - alert: HighErrorRate
        expr: rate(flushErrors[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
```

## 3. 备份与恢复

### 3.1 手动备份

```bash
# 触发备份
curl -X POST http://localhost:8080/backup

# 查看备份列表
curl http://localhost:8080/backups

# 下载备份
curl -O http://localhost:8080/backups/backup_2024-01-01.db
```

### 3.2 自动备份验证

```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE=$1
TEMP_DB="/tmp/verify_$(date +%s).db"

# 复制备份
cp "$BACKUP_FILE" "$TEMP_DB"

# 验证数据库完整性
if duckdb "$TEMP_DB" "SELECT COUNT(*) FROM messages;" >/dev/null 2>&1; then
    echo "✅ Backup verified: $BACKUP_FILE"
    rm "$TEMP_DB"
    exit 0
else
    echo "❌ Backup corrupted: $BACKUP_FILE"
    rm "$TEMP_DB"
    exit 1
fi
```

### 3.3 灾难恢复

```bash
#!/bin/bash
# disaster-recovery.sh

BACKUP_FILE=$1

# 1. 停止服务
docker-compose down

# 2. 备份当前数据（如果存在）
if [ -f data/chat.db ]; then
    mv data/chat.db "data/chat.db.broken.$(date +%s)"
fi

# 3. 恢复备份
cp "$BACKUP_FILE" data/chat.db

# 4. 启动服务
docker-compose up -d

# 5. 验证
curl -sf http://localhost:8080/health
```

## 4. 故障处理

### 4.1 服务无法启动

**现象**: `docker-compose up` 失败

**排查步骤**:
```bash
# 1. 查看日志
docker logs chat-archive

# 2. 检查端口占用
netstat -tlnp | grep 8080

# 3. 检查权限
ls -la data/

# 4. 检查磁盘空间
df -h
```

**常见原因**:
- 端口被占用
- 数据目录权限错误
- 磁盘空间不足
- 配置错误

### 4.2 写入失败

**现象**: 消息无法归档

**排查步骤**:
```bash
# 1. 检查WAL
tail -20 data/wal.jsonl

# 2. 检查磁盘空间
df -h data/

# 3. 检查内存
free -h

# 4. 查看错误日志
grep ERROR logs/archive.log
```

**解决方案**:
- 清理磁盘空间
- 重启服务
- 从WAL恢复

### 4.3 查询缓慢

**现象**: 查询响应时间>1s

**排查步骤**:
```bash
# 1. 检查数据量
duckdb data/chat.db "SELECT COUNT(*) FROM messages;"

# 2. 检查索引
duckdb data/chat.db "SELECT * FROM duckdb_indexes() WHERE table_name='messages';"

# 3. 分析查询
duckdb data/chat.db "EXPLAIN ANALYZE SELECT * FROM messages WHERE chat_id='xxx';"
```

**优化方案**:
- 添加索引
- 分区表
- 归档旧数据

### 4.4 数据丢失

**现象**: 消息找不到

**应急步骤**:
```bash
# 1. 立即停止写入
docker-compose stop

# 2. 检查WAL
cat data/wal.jsonl

# 3. 从WAL恢复
npm run recover

# 4. 验证数据
duckdb data/chat.db "SELECT COUNT(*) FROM messages;"
```

## 5. 性能调优

### 5.1 写入性能

```typescript
// 调整缓冲区大小
const archive = new ChatArchive({
  archive: {
    bufferSize: 500,        // 增大缓冲区
    flushIntervalMs: 60000, // 延长刷新间隔
  },
});
```

### 5.2 查询性能

```sql
-- 添加复合索引
CREATE INDEX idx_chat_time ON messages(chat_id, timestamp);

-- 分析表
ANALYZE messages;
```

### 5.3 内存优化

```bash
# 限制容器内存
docker run -m 512m chat-archive

# Node.js内存限制
NODE_OPTIONS="--max-old-space-size=512"
```

## 6. 日志管理

### 6.1 日志轮转

```bash
# logrotate配置
/etc/logrotate.d/chat-archive

/app/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

### 6.2 日志分析

```bash
# 错误统计
grep ERROR logs/archive.log | wc -l

# 慢查询
grep "query.*latency.*[0-9]\{4,\}" logs/archive.log

# 实时日志
tail -f logs/archive.log | jq '.level, .message'
```

## 7. 安全运维

### 7.1 访问控制

```bash
# 限制健康检查端口访问
iptables -A INPUT -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j DROP
```

### 7.2 数据加密

```bash
# 加密备份
gpg --symmetric --cipher-algo AES256 backup.db

# 解密恢复
gpg --decrypt backup.db.gpg > backup.db
```

### 7.3 审计日志

```bash
# 记录所有管理操作
echo "$(date): User $USER executed $0" >> logs/audit.log
```

## 8. 容量规划

### 8.1 存储估算

| 数据类型 | 单条大小 | 日量(1万条) | 年量 |
|---------|---------|------------|------|
| 文本消息 | 500B | 5MB | 1.8GB |
| 富文本 | 2KB | 20MB | 7.3GB |
| 含附件引用 | 5KB | 50MB | 18GB |

### 8.2 扩容方案

**垂直扩容**:
```bash
# 增加磁盘
docker-compose down
docker volume rm chat-archive_data
# 挂载更大磁盘
docker-compose up -d
```

**水平扩容**（未来）:
- 按时间分片
- 读写分离
- 对象存储

## 9. 运维自动化

### 9.1 Cron任务

```bash
# /etc/cron.d/chat-archive

# 每日健康检查
0 9 * * * root /opt/chat-archive/scripts/daily-check.sh

# 每周备份验证
0 2 * * 0 root /opt/chat-archive/scripts/verify-backup.sh

# 每月清理日志
0 3 1 * * root /opt/chat-archive/scripts/cleanup-logs.sh
```

### 9.2 Ansible Playbook

```yaml
# deploy.yml
- name: Deploy Chat Archive
  hosts: archive_servers
  tasks:
    - name: Copy docker-compose.yml
      copy:
        src: docker-compose.yml
        dest: /opt/chat-archive/
    
    - name: Start service
      docker_compose:
        project_src: /opt/chat-archive
        state: present
```

## 10. 联系与支持

- **Issue**: GitHub Issues
- **Email**: ops@example.com
- **Slack**: #chat-archive-ops
- **On-call**: PagerDuty
