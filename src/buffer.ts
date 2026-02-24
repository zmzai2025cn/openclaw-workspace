/**
 * 内存缓冲写入模块
 * 批量缓冲，定期刷盘，防止数据丢失
 */

import * as duckdb from 'duckdb';
import { FileLock } from './lock';

export interface BufferConfig {
  maxSize: number;           // 缓冲最大条数
  flushIntervalMs: number;   // 刷盘间隔
  dbPath: string;            // 数据库路径
}

export interface Event {
  id?: string;                     // 唯一标识（用于幂等）
  timestamp: Date;
  source: string;
  type: string;
  actor?: string;
  target?: string;
  action?: string;
  status?: 'success' | 'fail' | 'pending';
  content?: Record<string, any>;
  tags?: string[];
}

export class BufferedWriter {
  private buffer: Event[] = [];
  private db: duckdb.Database;
  private lock: FileLock;
  private config: BufferConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config: Partial<BufferConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      flushIntervalMs: config.flushIntervalMs || 5000,
      dbPath: config.dbPath || ':memory:',
    };

    this.db = new duckdb.Database(this.config.dbPath);
    this.lock = new FileLock(this.config.dbPath);
    this.init();
  }

  /**
   * 初始化数据库
   */
  private async init(): Promise<void> {
    const conn = this.db.connect();
    
    // 创建表
    conn.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(100) PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL,
        source VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        actor VARCHAR(100),
        target VARCHAR(200),
        action VARCHAR(100),
        status VARCHAR(20),
        content JSON,
        tags VARCHAR(100)[]
      )
    `);

    conn.close();
    
    // 启动定时刷盘
    this.startFlushTimer();
  }

  /**
   * 写入事件（缓冲，自动生成ID）
   */
  async write(event: Event): Promise<void> {
    // 自动生成唯一ID
    if (!event.id) {
      event.id = `${event.source}_${event.timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    this.buffer.push(event);

    // 缓冲满，立即刷盘
    if (this.buffer.length >= this.config.maxSize) {
      await this.flush();
    }
  }

  /**
   * 批量写入
   */
  async writeBatch(events: Event[]): Promise<void> {
    this.buffer.push(...events);

    if (this.buffer.length >= this.config.maxSize) {
      await this.flush();
    }
  }

  /**
   * 刷盘到 DuckDB（带锁）
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;
    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      // 获取文件锁
      await this.lock.acquire();

      const conn = this.db.connect();
      
      // 使用 INSERT OR IGNORE 实现幂等
      const stmt = conn.prepare(`
        INSERT OR IGNORE INTO events 
        (id, timestamp, source, type, actor, target, action, status, content, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const event of eventsToFlush) {
        stmt.run(
          event.id,
          event.timestamp,
          event.source,
          event.type,
          event.actor || null,
          event.target || null,
          event.action || null,
          event.status || null,
          event.content ? JSON.stringify(event.content) : null,
          event.tags || []
        );
      }

      stmt.finalize();
      conn.close();
      
      console.log(`Flushed ${eventsToFlush.length} events to DuckDB`);
    } catch (error) {
      // 刷盘失败，数据回滚到缓冲
      this.buffer.unshift(...eventsToFlush);
      console.error('Flush failed:', error);
      throw error;
    } finally {
      this.lock.release();
      this.isFlushing = false;
    }
  }

  /**
   * 启动定时刷盘
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs);
  }

  /**
   * 停止定时刷盘
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 优雅关闭（刷盘剩余数据）
   */
  async close(): Promise<void> {
    this.stop();
    await this.flush();
    
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 获取缓冲统计
   */
  getStats(): { buffered: number; config: BufferConfig } {
    return {
      buffered: this.buffer.length,
      config: this.config,
    };
  }
}