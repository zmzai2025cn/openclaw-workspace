/**
 * 速率控制消息发送器
 * 防止消息发送过快导致丢失或限流
 */

import { message } from './message';

export interface RateLimitConfig {
  minIntervalMs: number;      // 最小发送间隔（毫秒）
  maxBurstSize: number;       // 最大突发发送数
  burstIntervalMs: number;    // 突发间隔（毫秒）
}

export const defaultRateLimitConfig: RateLimitConfig = {
  minIntervalMs: 500,         // 默认500ms间隔
  maxBurstSize: 3,            // 最多连续发3条
  burstIntervalMs: 2000,      // 突发后发2秒
};

/**
 * 消息队列项
 */
interface QueueItem {
  content: string;
  target: string;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

/**
 * 速率控制发送器
 */
export class RateLimitedMessenger {
  private config: RateLimitConfig;
  private queue: QueueItem[] = [];
  private lastSendTime: number = 0;
  private burstCount: number = 0;
  private lastBurstTime: number = 0;
  private isProcessing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...defaultRateLimitConfig, ...config };
  }

  /**
   * 发送消息（带速率控制）
   */
  async send(content: string, target: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // 加入队列
      this.queue.push({ content, target, resolve, reject });
      
      // 启动处理
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * 批量发送（自动分段和间隔）
   */
  async sendBatch(
    contents: string[],
    target: string,
    options: {
      maxLength?: number;
      prefix?: string;
    } = {}
  ): Promise<any[]> {
    const { maxLength = 1500, prefix = '' } = options;
    const results: any[] = [];

    // 1. 分割超长内容
    const segments: string[] = [];
    for (const content of contents) {
      if (content.length <= maxLength) {
        segments.push(content);
      } else {
        // 分割长内容
        const parts = this.splitContent(content, maxLength);
        segments.push(...parts);
      }
    }

    // 2. 顺序发送，带间隔
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const partPrefix = segments.length > 1 ? `[${i + 1}/${segments.length}] ` : '';
      
      try {
        const result = await this.send(prefix + partPrefix + segment, target);
        results.push(result);
      } catch (err) {
        console.error(`Failed to send segment ${i + 1}:`, err);
        results.push(null);
      }
    }

    return results;
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      // 计算等待时间
      const waitTime = this.calculateWaitTime();
      
      if (waitTime > 0) {
        await this.sleep(waitTime);
      }

      try {
        // 发送消息
        const result = await message({
          action: 'send',
          message: item.content,
          target: item.target,
        });
        
        item.resolve(result);
        
        // 更新发送时间
        this.lastSendTime = Date.now();
        this.burstCount++;
        
        // 检查是否需要重置突发计数
        if (Date.now() - this.lastBurstTime > this.config.burstIntervalMs) {
          this.burstCount = 1;
          this.lastBurstTime = Date.now();
        }
      } catch (err) {
        item.reject(err);
      }
    }

    this.isProcessing = false;
  }

  /**
   * 计算需要等待的时间
   */
  private calculateWaitTime(): number {
    const now = Date.now();
    
    // 检查突发限制
    if (this.burstCount >= this.config.maxBurstSize) {
      const burstWait = this.config.burstIntervalMs - (now - this.lastBurstTime);
      if (burstWait > 0) {
        // 重置突发计数
        this.burstCount = 0;
        return burstWait;
      }
    }
    
    // 检查最小间隔
    const timeSinceLastSend = now - this.lastSendTime;
    if (timeSinceLastSend < this.config.minIntervalMs) {
      return this.config.minIntervalMs - timeSinceLastSend;
    }
    
    return 0;
  }

  /**
   * 分割长内容
   */
  private splitContent(content: string, maxLength: number): string[] {
    const parts: string[] = [];
    let remaining = content;

    while (remaining.length > maxLength) {
      // 找合适的分割点（优先在换行处分割）
      let splitPoint = remaining.lastIndexOf('\n', maxLength);
      if (splitPoint < maxLength * 0.5) {
        // 如果没有合适的换行，在空格处分割
        splitPoint = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitPoint < 0) {
        // 强制分割
        splitPoint = maxLength;
      }

      parts.push(remaining.substring(0, splitPoint));
      remaining = remaining.substring(splitPoint).trim();
    }

    if (remaining.length > 0) {
      parts.push(remaining);
    }

    return parts;
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    lastSendTime: number;
    burstCount: number;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      lastSendTime: this.lastSendTime,
      burstCount: this.burstCount,
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// 全局实例
export const globalMessenger = new RateLimitedMessenger({
  minIntervalMs: 500,      // 500ms间隔
  maxBurstSize: 3,         // 最多连发3条
  burstIntervalMs: 2000,   // 突发后等2秒
});

/**
 * 便捷函数：发送单条消息
 */
export async function sendMessage(
  content: string,
  target: string,
  options?: {
    maxLength?: number;
    autoSplit?: boolean;
  }
): Promise<any> {
  const { maxLength = 1500, autoSplit = true } = options || {};

  if (autoSplit && content.length > maxLength) {
    // 使用批量发送，自动分割
    return globalMessenger.sendBatch([content], target, { maxLength });
  }

  return globalMessenger.send(content, target);
}

/**
 * 便捷函数：批量发送
 */
export async function sendMessages(
  contents: string[],
  target: string,
  options?: {
    maxLength?: number;
    prefix?: string;
  }
): Promise<any[]> {
  return globalMessenger.sendBatch(contents, target, options);
}
