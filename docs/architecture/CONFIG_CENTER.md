# 服务发现与配置中心

## 问题
- 客户端硬编码服务端地址
- 配置变更需重启客户端
- 多环境管理困难

## 方案：轻量级配置中心

```
┌─────────────────────────────────────┐
│           配置中心 (etcd/consul)      │
│  /services/kimiclaw/primary → db1:3000│
│  /services/kimiclaw/replica1 → db2:3000│
│  /config/client/flushInterval → 5000  │
└─────────────────┬───────────────────┘
                  │ Watch
┌─────────────────▼───────────────────┐
│              客户端                  │
│  - 启动时拉取配置                    │
│  - 运行时监听变更                    │
│  - 服务端地址动态更新                 │
└─────────────────────────────────────┘
```

## 实现

```typescript
// src/config/config-center.ts
import { Etcd3 } from 'etcd3';

export class ConfigCenter {
  private etcd: Etcd3;
  private cache: Map<string, any> = new Map();
  private watchers: Map<string, Function[]> = new Map();

  constructor(endpoints: string[]) {
    this.etcd = new Etcd3({ endpoints });
  }

  // 获取配置
  async get(key: string, defaultValue?: any): Promise<any> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const value = await this.etcd.get(key).json();
    this.cache.set(key, value);
    return value ?? defaultValue;
  }

  // 设置配置
  async set(key: string, value: any): Promise<void> {
    await this.etcd.put(key).value(JSON.stringify(value));
    this.cache.set(key, value);
  }

  // 监听变更
  watch(key: string, callback: (value: any) => void): void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
      
      // 启动etcd watch
      this.etcd.watch().key(key).create().then(watcher => {
        watcher.on('put', (res) => {
          const value = JSON.parse(res.value.toString());
          this.cache.set(key, value);
          this.watchers.get(key)?.forEach(cb => cb(value));
        });
      });
    }
    
    this.watchers.get(key)!.push(callback);
  }

  // 服务注册
  async registerService(name: string, endpoint: string, ttl: number = 30): Promise<void> {
    const key = `/services/${name}/${endpoint}`;
    const lease = this.etcd.lease(ttl);
    await this.etcd.put(key).value('healthy').lease(lease);
    
    // 心跳续期
    setInterval(() => {
      lease.keepalive();
    }, (ttl / 3) * 1000);
  }

  // 服务发现
  async discoverService(name: string): Promise<string[]> {
    const results = await this.etcd.getAll().prefix(`/services/${name}/`);
    return Object.keys(results).map(k => k.replace(`/services/${name}/`, ''));
  }
}

// 客户端使用示例
export class SmartClient {
  private config: ConfigCenter;
  private servers: string[] = [];

  async init(): Promise<void> {
    // 连接配置中心
    this.config = new ConfigCenter(['http://etcd:2379']);

    // 获取初始服务端列表
    this.servers = await this.config.discoverService('kimiclaw');

    // 监听服务端变更
    this.config.watch('/services/kimiclaw', (endpoints) => {
      this.servers = endpoints;
      console.log('Server list updated:', endpoints);
    });

    // 监听配置变更
    this.config.watch('/config/client/flushInterval', (interval) => {
      this.updateFlushInterval(interval);
    });
  }

  private updateFlushInterval(ms: number): void {
    // 动态调整刷盘间隔，无需重启
    this.uploadQueue.setFlushInterval(ms);
  }
}
```

## 配置结构

```
/config/
  /client/
    flushInterval: 5000
    maxBufferSize: 1000
    whiteList: ["vscode", "chrome"]
  /server/
    maxConnections: 10000
    retentionDays: 90

/services/
  /kimiclaw/
    /primary: db1:3000
    /replica1: db2:3000
    /replica2: db3:3000
```

## 降级方案

若etcd不可用，客户端使用本地缓存+默认配置：

```typescript
async getWithFallback(key: string): Promise<any> {
  try {
    return await this.get(key);
  } catch (e) {
    // etcd不可用，使用本地文件
    return this.loadFromLocalFile(key);
  }
}
```