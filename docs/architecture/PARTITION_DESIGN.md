# 数据分区策略

## 问题
单表数据量增长后查询性能下降，历史数据清理困难。

## 方案：时间范围分区

```sql
-- 按月份自动分区
CREATE TABLE events (
  id VARCHAR(100),
  timestamp TIMESTAMP NOT NULL,
  user_id VARCHAR(50),
  -- ...
) PARTITION BY RANGE (timestamp);

-- 创建月度分区
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 自动创建未来分区
```

## 自动分区管理

```typescript
// src/partition/manager.ts
export class PartitionManager {
  private db: duckdb.Database;

  // 每月1号创建下月分区
  async createNextPartition(): Promise<void> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const tableName = `events_${year}_${month}`;
    
    const startDate = `${year}-${month}-01`;
    const endMonth = nextMonth.getMonth() + 2;
    const endYear = endMonth > 12 ? year + 1 : year;
    const endMonthStr = String(endMonth > 12 ? endMonth - 12 : endMonth).padStart(2, '0');
    const endDate = `${endYear}-${endMonthStr}-01`;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} 
      PARTITION OF events
      FOR VALUES FROM ('${startDate}') TO ('${endDate}')
    `);
  }

  // 归档3个月前的数据
  async archiveOldPartitions(): Promise<void> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const oldPartitions = await this.getPartitionsBefore(threeMonthsAgo);
    
    for (const partition of oldPartitions) {
      // 导出到冷存储
      await this.exportToColdStorage(partition);
      // 从热存储删除
      await this.db.exec(`DROP TABLE ${partition.tableName}`);
    }
  }

  // 查询时自动路由到对应分区
  async queryWithPartition(
    sql: string, 
    startTime: Date, 
    endTime: Date
  ): Promise<any[]> {
    // DuckDB自动分区裁剪
    return this.db.all(sql, [startTime, endTime]);
  }
}
```

## 冷热数据分离

```
热数据 (最近3个月)
    └── DuckDB 本地存储
    └── 快速查询

温数据 (3-12个月)
    └── 对象存储 (S3/OSS)
    └── 按需加载

冷数据 (>12个月)
    └── 归档存储
    └── 仅审计使用
```

## 实现代码

```typescript
// src/storage/tiered-storage.ts
export class TieredStorage {
  private hot: duckdb.Database;      // 本地
  private warm: S3Client;            // 对象存储

  async read(userId: string, start: Date, end: Date): Promise<Event[]> {
    const results: Event[] = [];

    // 1. 查询热数据
    if (this.isHot(start, end)) {
      const hotData = await this.queryHot(userId, start, end);
      results.push(...hotData);
    }

    // 2. 查询温数据
    if (this.isWarm(start, end)) {
      const warmData = await this.queryWarm(userId, start, end);
      results.push(...warmData);
    }

    // 3. 冷数据需人工申请
    if (this.isCold(start, end)) {
      throw new Error('Cold data access requires approval');
    }

    return results;
  }

  private async queryWarm(userId: string, start: Date, end: Date): Promise<Event[]> {
    // 从S3下载对应时间段的数据文件
    const key = `events/${userId}/${start.getFullYear()}/${start.getMonth() + 1}.parquet`;
    const file = await this.warm.download(key);
    
    // 临时加载到DuckDB查询
    return this.queryParquet(file, userId, start, end);
  }
}
```

## 配置

```yaml
# config/partition.yml
partition:
  strategy: monthly
  hotRetentionDays: 90
  warmRetentionDays: 365
  coldRetentionDays: 2555  # 7年

  autoCreate: true
  autoArchive: true
  archiveSchedule: "0 2 1 * *"  # 每月1号2点
```