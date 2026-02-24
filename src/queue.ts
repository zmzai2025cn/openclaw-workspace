/**
 * 持久化队列接口
 * 优先用内存，崩溃后用 Redis 恢复
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PersistentQueueConfig {
  queueFile: string;      // 持久化文件路径
  maxMemorySize: number;  // 内存最大条数
}

export class PersistentQueue<T> {
  private memory: T[] = [];
  private config: PersistentQueueConfig;

  constructor(config: Partial<PersistentQueueConfig> = {}) {
    this.config = {
      queueFile: config.queueFile || './queue.jsonl',
      maxMemorySize: config.maxMemorySize || 1000,
    };
    this.loadFromDisk();
  }

  /**
   * 入队
   */
  enqueue(item: T): void {
    this.memory.push(item);
    
    // 超限时刷盘
    if (this.memory.length >= this.config.maxMemorySize) {
      this.flushToDisk();
    }
  }

  /**
   * 批量入队
   */
  enqueueBatch(items: T[]): void {
    this.memory.push(...items);
    
    if (this.memory.length >= this.config.maxMemorySize) {
      this.flushToDisk();
    }
  }

  /**
   * 出队（全部）
   */
  dequeueAll(): T[] {
    // 先加载磁盘数据
    const diskItems = this.loadFromDisk();
    
    // 合并内存和磁盘
    const all = [...diskItems, ...this.memory];
    
    // 清空
    this.memory = [];
    this.clearDisk();
    
    return all;
  }

  /**
   * 刷盘到文件
   */
  private flushToDisk(): void {
    if (this.memory.length === 0) return;
    
    const lines = this.memory.map(item => JSON.stringify(item)).join('\n') + '\n';
    fs.appendFileSync(this.config.queueFile, lines);
    this.memory = [];
  }

  /**
   * 从磁盘加载
   */
  private loadFromDisk(): T[] {
    try {
      if (!fs.existsSync(this.config.queueFile)) return [];
      
      const content = fs.readFileSync(this.config.queueFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      return lines.map(line => JSON.parse(line));
    } catch (err) {
      console.error('Failed to load queue from disk:', err);
      return [];
    }
  }

  /**
   * 清空磁盘
   */
  private clearDisk(): void {
    try {
      fs.unlinkSync(this.config.queueFile);
    } catch (err) {
      // 忽略
    }
  }

  /**
   * 优雅关闭（刷盘）
   */
  close(): void {
    this.flushToDisk();
  }

  /**
   * 获取统计
   */
  getStats(): { memory: number; diskExists: boolean } {
    return {
      memory: this.memory.length,
      diskExists: fs.existsSync(this.config.queueFile),
    };
  }
}