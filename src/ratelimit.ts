/**
 * 速率限制
 * 防止API被刷爆
 */

import { Logger } from './logger';

export interface RateLimitConfig {
  windowMs: number;      // 时间窗口
  maxRequests: number;   // 最大请求数
  keyPrefix?: string;    // 键前缀
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private logger: Logger;
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig, logger: Logger) {
    this.config = {
      windowMs: config.windowMs || 60000,  // 默认1分钟
      maxRequests: config.maxRequests || 100,
      keyPrefix: config.keyPrefix || 'ratelimit:',
    };
    this.logger = logger;
    this.startCleanup();
  }

  /**
   * 检查是否允许请求
   */
  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const storeKey = `${this.config.keyPrefix}${key}`;
    
    let entry = this.store.get(storeKey);
    
    // 窗口过期，重置
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
    }
    
    // 检查限制
    const allowed = entry.count < this.config.maxRequests;
    
    if (allowed) {
      entry.count++;
      this.store.set(storeKey, entry);
    } else {
      this.logger.warn(`Rate limit exceeded for key: ${key}`);
    }
    
    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  /**
   * 清理过期条目
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store) {
        if (now > entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, this.config.windowMs);
  }

  /**
   * 停止清理
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}