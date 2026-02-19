/**
 * 缓冲写入器 - 批量写入DuckDB
 */

import { ChatMessage, ArchiveConfig } from './types';
import { ArchiveDB } from './db';
import { WAL } from './wal';

export class BufferedWriter {
  private buffer: ChatMessage[] = [];
  private db: ArchiveDB;
  private wal: WAL;
  private config: ArchiveConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(db: ArchiveDB, wal: WAL, config: ArchiveConfig) {
    this.db = db;
    this.wal = wal;
    this.config = config;
    this.startFlushTimer();
  }

  /**
   * 添加消息到缓冲区（带WAL双写）
   */
  async add(message: ChatMessage): Promise<void> {
    // 先写WAL，确保数据不丢
    await this.wal.append(message);
    this.buffer.push(message);
    
    // 达到缓冲区大小，立即刷新
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * 批量添加消息（带WAL双写）
   */
  async addBatch(messages: ChatMessage[]): Promise<void> {
    // 先写WAL
    await this.wal.appendBatch(messages);
    this.buffer.push(...messages);
    
    if (this.buffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * 立即刷新缓冲区到数据库
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;
    
    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    
    try {
      await this.db.insertBatch(batch);
      // 成功写入后清空WAL
      this.wal.clear();
      console.log(`[Archive] Flushed ${batch.length} messages to DB`);
    } catch (err) {
      console.error('[Archive] Flush failed:', err);
      // 失败时把消息放回缓冲区（WAL还在，数据不丢）
      this.buffer.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 获取缓冲区状态
   */
  getStatus(): { buffered: number; isFlushing: boolean } {
    return {
      buffered: this.buffer.length,
      isFlushing: this.isFlushing,
    };
  }

  /**
   * 关闭写入器（强制刷新）
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.config.flushIntervalMs);
  }
}
