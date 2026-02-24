/**
 * 文件锁模块
 * 防止多进程同时写入 DuckDB
 */

import * as fs from 'fs';
import * as path from 'path';

export class FileLock {
  private lockFile: string;
  private lockTimeout: number;

  constructor(dbPath: string, timeoutMs: number = 5000) {
    // 锁文件与数据库同目录
    const dir = path.dirname(dbPath);
    const base = path.basename(dbPath, '.db');
    this.lockFile = path.join(dir, `${base}.lock`);
    this.lockTimeout = timeoutMs;
  }

  /**
   * 获取锁
   */
  async acquire(): Promise<void> {
    const startTime = Date.now();
    
    while (true) {
      try {
        // 尝试创建锁文件（独占模式）
        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return; // 获取锁成功
      } catch (err) {
        // 锁已存在，检查是否过期
        if (this.isLockExpired()) {
          // 强制释放过期锁
          this.forceRelease();
          continue;
        }
        
        // 超时检查
        if (Date.now() - startTime > this.lockTimeout) {
          throw new Error(`Failed to acquire lock within ${this.lockTimeout}ms`);
        }
        
        // 等待重试
        await this.sleep(100);
      }
    }
  }

  /**
   * 释放锁
   */
  release(): void {
    try {
      fs.unlinkSync(this.lockFile);
    } catch (err) {
      // 锁已不存在，忽略
    }
  }

  /**
   * 检查锁是否过期
   */
  private isLockExpired(): boolean {
    try {
      const stats = fs.statSync(this.lockFile);
      const lockAge = Date.now() - stats.mtime.getTime();
      return lockAge > this.lockTimeout * 2; // 2倍超时时间视为过期
    } catch (err) {
      return false;
    }
  }

  /**
   * 强制释放锁
   */
  private forceRelease(): void {
    try {
      fs.unlinkSync(this.lockFile);
    } catch (err) {
      // 忽略错误
    }
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}