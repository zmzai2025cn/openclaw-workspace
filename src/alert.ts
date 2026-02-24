/**
 * 告警机制
 * 异常时通知
 */

import { Logger } from './logger';

export interface AlertChannel {
  name: string;
  send(message: string, level: 'warning' | 'critical'): Promise<void>;
}

export class AlertManager {
  private channels: AlertChannel[] = [];
  private logger: Logger;
  private cooldownMs: number;
  private lastAlert: Map<string, number> = new Map();

  constructor(logger: Logger, cooldownMs: number = 300000) { // 5分钟冷却
    this.logger = logger;
    this.cooldownMs = cooldownMs;
  }

  /**
   * 添加告警渠道
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * 发送告警
   */
  async alert(message: string, level: 'warning' | 'critical' = 'warning'): Promise<void> {
    // 检查冷却
    const now = Date.now();
    const lastTime = this.lastAlert.get(message) || 0;
    
    if (now - lastTime < this.cooldownMs) {
      return; // 冷却中
    }
    
    this.lastAlert.set(message, now);
    
    this.logger.error(`ALERT [${level}]: ${message}`);
    
    // 发送到所有渠道
    for (const channel of this.channels) {
      try {
        await channel.send(message, level);
      } catch (err) {
        this.logger.error(`Failed to send alert to ${channel.name}`, err as Error);
      }
    }
  }

  /**
   * 创建Feishu告警渠道
   */
  static createFeishuChannel(webhookUrl: string): AlertChannel {
    return {
      name: 'feishu',
      async send(message, level) {
        const color = level === 'critical' ? 'red' : 'orange';
        const payload = {
          msg_type: 'text',
          content: {
            text: `[${level.toUpperCase()}] Kimiclaw Alert\n\n${message}`,
          },
        };
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`Feishu webhook failed: ${response.status}`);
        }
      },
    };
  }
}