# 高可用架构设计

## 目标
消除单点故障，实现故障自动切换。

## 架构图

```
┌─────────────────────────────────────────┐
│              客户端层                    │
│         (多服务端地址配置)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              负载均衡层                  │
│            (Nginx/HAProxy)              │
│         健康检查 + 故障切换              │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐   ┌────────┐   ┌────────┐
│Primary │──►│Replica1│   │Replica2│
│  写    │   │  读    │   │  读    │
│DuckDB  │   │DuckDB  │   │DuckDB  │
└────────┘   └────────┘   └────────┘
    │
    ▼
┌────────┐
│WAL日志  │
│(实时同步)│
└────────┘
```

## 实现方案

### 方案A: DuckDB + 文件同步 (推荐MVP)

```typescript
// src/ha/database-cluster.ts
export class DatabaseCluster {
  private primary: duckdb.Database;
  private replicas: duckdb.Database[];
  private currentReplica = 0;

  constructor(config: ClusterConfig) {
    this.primary = new duckdb.Database(config.primaryPath);
    this.replicas = config.replicaPaths.map(p => new duckdb.Database(p));
    
    // 启动WAL同步
    this.startWalReplication();
  }

  // 写操作走主库
  async write(sql: string, params: any[]): Promise<void> {
    return this.primary.exec(sql, params);
  }

  // 读操作轮询从库
  async read(sql: string, params: any[]): Promise<any[]> {
    const replica = this.replicas[this.currentReplica];
    this.currentReplica = (this.currentReplica + 1) % this.replicas.length;
    return replica.all(sql, params);
  }

  // WAL实时同步
  private startWalReplication(): void {
    setInterval(async () => {
      const wal = await this.primary.exportWAL();
      for (const replica of this.replicas) {
        await replica.importWAL(wal);
      }
    }, 1000); // 1秒同步
  }

  // 故障切换
  async failover(): Promise<void> {
    // 提升replica1为primary
    const newPrimary = this.replicas[0];
    this.replicas = this.replicas.slice(1);
    this.replicas.push(this.primary);
    this.primary = newPrimary;
  }
}
```

### 方案B: 迁移到PostgreSQL (长期)

DuckDB分析性能优秀但高可用方案不成熟。用户量增长后可迁移：

```sql
-- PostgreSQL主从配置
-- primary
CREATE PUBLICATION events_pub FOR TABLE events;

-- replica
CREATE SUBSCRIPTION events_sub 
CONNECTION 'host=primary dbname=kimiclaw' 
PUBLICATION events_pub;
```

## 客户端多地址配置

```typescript
// 客户端支持多个服务端地址
interface ClientConfig {
  servers: string[];  // ['http://db1:3000', 'http://db2:3000']
  retryPolicy: {
    maxRetries: 3;
    backoffMs: 1000;
  };
}

class ResilientUploader {
  private servers: string[];
  private currentServer = 0;

  async upload(data: any): Promise<void> {
    for (let i = 0; i < this.servers.length; i++) {
      const server = this.servers[this.currentServer];
      try {
        await axios.post(`${server}/upload`, data);
        return; // 成功
      } catch (e) {
        this.currentServer = (this.currentServer + 1) % this.servers.length;
      }
    }
    throw new Error('All servers failed');
  }
}
```

## 部署配置

```yaml
# docker-compose.ha.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx-ha.conf:/etc/nginx/nginx.conf
    ports:
      - "3000:3000"

  db-primary:
    image: kimiclaw-db:latest
    volumes:
      - db-primary-data:/app/data
    environment:
      - ROLE=primary

  db-replica1:
    image: kimiclaw-db:latest
    volumes:
      - db-replica1-data:/app/data
    environment:
      - ROLE=replica
      - PRIMARY_HOST=db-primary

  db-replica2:
    image: kimiclaw-db:latest
    volumes:
      - db-replica2-data:/app/data
    environment:
      - ROLE=replica
      - PRIMARY_HOST=db-primary

volumes:
  db-primary-data:
  db-replica1-data:
  db-replica2-data:
```

## 故障场景处理

| 场景 | 检测 | 处理 | 恢复 |
|------|------|------|------|
| Primary宕机 | 心跳超时 | 自动failover | 人工修复后作为replica加入 |
| Replica宕机 | 心跳超时 | 从轮询列表移除 | 自动恢复后重新加入 |
| 网络分区 | 连接失败 | 客户端切换server | 网络恢复后自动同步 |
| 数据不一致 | 校验和失败 | 从primary重新同步 | - |