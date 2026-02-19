# 灾备与恢复方案

## RPO/RTO目标

| 场景 | RPO (数据丢失) | RTO (恢复时间) |
|------|---------------|---------------|
| 单点故障 | 0 | 5分钟 |
| 可用区故障 | < 1分钟 | 15分钟 |
| 地域故障 | < 5分钟 | 1小时 |
| 数据损坏 | 0 | 30分钟 |

## 备份策略

### 多层备份

```
┌─────────────────────────────────────────┐
│  L0: 实时复制                            │
│  Primary → Replica (同步)                │
│  RPO: 0                                 │
└─────────────────────────────────────────┘
                   │
┌─────────────────▼───────────────────────┐
│  L1: 本地快照                            │
│  每小时一次，保留24小时                   │
│  存储: 本地SSD                            │
└─────────────────────────────────────────┘
                   │
┌─────────────────▼───────────────────────┐
│  L2: 异地备份                            │
│  每天一次，保留30天                       │
│  存储: 对象存储 (S3/OSS)                  │
└─────────────────────────────────────────┘
                   │
┌─────────────────▼───────────────────────┐
│  L3: 归档存储                            │
│  每月一次，保留7年                        │
│  存储: 冷存储/Glacier                     │
└─────────────────────────────────────────┘
```

### 自动备份脚本

```bash
#!/bin/bash
# scripts/backup.sh

set -e

DB_PATH=${DB_PATH:-"/data/kimiclaw.db"}
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
S3_BUCKET=${S3_BUCKET:-"kimiclaw-backups"}
RETENTION_DAYS=${RETENTION_DAYS:-30}

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="kimiclaw_${TIMESTAMP}.db"

# 1. 创建本地备份
echo "Creating backup..."
cp "${DB_PATH}" "${BACKUP_DIR}/${BACKUP_FILE}"

# 2. 验证备份完整性
echo "Verifying backup..."
if ! duckdb "${BACKUP_DIR}/${BACKUP_FILE}" "SELECT COUNT(*) FROM events;" > /dev/null; then
    echo "Backup verification failed!"
    exit 1
fi

# 3. 压缩
echo "Compressing..."
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# 4. 上传到S3
echo "Uploading to S3..."
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" "s3://${S3_BUCKET}/daily/"

# 5. 清理旧备份
echo "Cleaning old backups..."
find "${BACKUP_DIR}" -name "kimiclaw_*.db.gz" -mtime +7 -delete
aws s3 ls "s3://${S3_BUCKET}/daily/" | awk '$1 < "'$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)'" {print $4}' | xargs -I {} aws s3 rm "s3://${S3_BUCKET}/daily/{}"

echo "Backup completed: ${BACKUP_FILE}.gz"
```

### 定时任务

```yaml
# k8s/cronjob-backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: kimiclaw-backup
spec:
  schedule: "0 */6 * * *"  # 每6小时
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: kimiclaw-db:latest
              command: ["/scripts/backup.sh"]
              volumeMounts:
                - name: data
                  mountPath: /data
                - name: backups
                  mountPath: /backups
          volumes:
            - name: data
              persistentVolumeClaim:
                claimName: kimiclaw-data
            - name: backups
              emptyDir: {}
          restartPolicy: OnFailure
```

## 恢复流程

### 自动故障切换

```typescript
// src/disaster-recovery/failover.ts
export class FailoverManager {
  async handleFailure(failedNode: string): Promise<void> {
    // 1. 确认故障
    const isReallyDown = await this.confirmFailure(failedNode);
    if (!isReallyDown) return;

    // 2. 选举新主节点
    const newPrimary = await this.electNewPrimary(failedNode);
    
    // 3. 更新配置中心
    await this.configCenter.set('/services/kimiclaw/primary', newPrimary);
    
    // 4. 通知客户端
    await this.notifyClients({
      type: 'failover',
      oldPrimary: failedNode,
      newPrimary: newPrimary,
    });

    // 5. 启动故障节点恢复
    this.scheduleRecovery(failedNode);
  }
}
```

### 手动恢复流程

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1
DB_PATH=${DB_PATH:-"/data/kimiclaw.db"}

# 1. 停止服务
echo "Stopping service..."
systemctl stop kimiclaw

# 2. 备份当前数据（如果存在）
if [ -f "${DB_PATH}" ]; then
    mv "${DB_PATH}" "${DB_PATH}.corrupted.$(date +%Y%m%d_%H%M%S)"
fi

# 3. 下载备份
echo "Downloading backup..."
aws s3 cp "s3://kimiclaw-backups/${BACKUP_FILE}" /tmp/

# 4. 解压
echo "Extracting..."
gunzip -c "/tmp/${BACKUP_FILE}" > "${DB_PATH}"

# 5. 验证
echo "Verifying..."
duckdb "${DB_PATH}" "SELECT COUNT(*) FROM events;"

# 6. 启动服务
echo "Starting service..."
systemctl start kimiclaw

echo "Restore completed!"
```

## 灾难演练

```yaml
# 季度演练计划
disaster_drill:
  frequency: quarterly
  scenarios:
    - name: "单节点故障"
      steps:
        - 停止主节点
        - 验证自动切换
        - 恢复主节点
      expected_rto: 5m

    - name: "数据损坏"
      steps:
        - 模拟数据损坏
        - 从备份恢复
        - 验证数据完整性
      expected_rto: 30m

    - name: "可用区故障"
      steps:
        - 切换流量到备用AZ
        - 验证服务可用
        - 恢复主AZ
      expected_rto: 15m
```

## 监控指标

```
backup_last_success_timestamp  # 上次成功备份时间
backup_duration_seconds        # 备份耗时
backup_size_bytes             # 备份大小
restore_test_last_run         # 上次恢复测试时间
rpo_seconds                   # 实际RPO
rto_seconds                   # 实际RTO
```