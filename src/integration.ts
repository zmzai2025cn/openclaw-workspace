/**
 * OpenClaw 消息接收集成
 * 接收消息，解析，写入缓冲
 */

import { BufferedWriter, Event } from './buffer';

export interface Message {
  id: string;
  timestamp: string;
  source: 'feishu' | 'wechat' | 'email' | 'webhook';
  sender: {
    id: string;
    name: string;
    role?: string;
  };
  content: {
    type: 'text' | 'image' | 'file' | 'system';
    text?: string;
    metadata?: Record<string, any>;
  };
  context?: {
    chatId?: string;
    threadId?: string;
    isMentioned?: boolean;
  };
}

export interface ParsedEvent {
  event: Event;
  confidence: number;  // 解析置信度
  needsAttention: boolean;  // 是否需要我响应
}

export class OpenClawIntegration {
  private writer: BufferedWriter;

  constructor(writer: BufferedWriter) {
    this.writer = writer;
  }

  /**
   * 接收消息入口
   */
  async receiveMessage(message: Message): Promise<ParsedEvent> {
    // 解析消息为事件
    const parsed = this.parseMessage(message);
    
    // 写入数据库
    await this.writer.write(parsed.event);
    
    return parsed;
  }

  /**
   * 解析消息为结构化事件
   */
  private parseMessage(message: Message): ParsedEvent {
    const text = message.content.text || '';
    
    // 基础事件
    const event: Event = {
      timestamp: new Date(message.timestamp),
      source: this.mapSource(message.source),
      type: 'message',
      actor: message.sender.name,
      target: message.context?.chatId,
      content: {
        messageId: message.id,
        text: text.substring(0, 500),  // 截断过长文本
        senderRole: message.sender.role,
        isMentioned: message.context?.isMentioned,
      },
      tags: this.extractTags(text),
    };

    // 判断是否需要我响应
    const needsAttention = this.checkNeedsAttention(message, text);
    
    // 计算置信度
    const confidence = this.calculateConfidence(message);

    return {
      event,
      confidence,
      needsAttention,
    };
  }

  /**
   * 映射消息源
   */
  private mapSource(source: Message['source']): string {
    const mapping: Record<string, string> = {
      feishu: 'im',
      wechat: 'im',
      email: 'mail',
      webhook: 'system',
    };
    return mapping[source] || 'unknown';
  }

  /**
   * 提取标签
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    
    // 关键词标签
    if (text.includes(' urgent') || text.includes('紧急')) tags.push('urgent');
    if (text.includes('bug') || text.includes('故障')) tags.push('bug');
    if (text.includes('question') || text.includes('问题')) tags.push('question');
    if (text.includes('task') || text.includes('任务')) tags.push('task');
    
    return tags;
  }

  /**
   * 判断是否需要我响应
   */
  private checkNeedsAttention(message: Message, text: string): boolean {
    // 明确@我
    if (message.context?.isMentioned) return true;
    
    // 关键词触发
    const triggerWords = ['kimiclaw', 'kimiclaw', '帮忙', ' help'];
    if (triggerWords.some(w => text.toLowerCase().includes(w))) return true;
    
    // 系统消息
    if (message.content.type === 'system') return true;
    
    return false;
  }

  /**
   * 计算解析置信度
   */
  private calculateConfidence(message: Message): number {
    let confidence = 0.8;
    
    // 有明确发送者
    if (message.sender.id) confidence += 0.05;
    
    // 有文本内容
    if (message.content.text) confidence += 0.05;
    
    // 有上下文
    if (message.context?.chatId) confidence += 0.05;
    
    // 未知来源降低置信度
    if (!['feishu', 'wechat', 'email', 'webhook'].includes(message.source)) {
      confidence -= 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 批量接收（用于历史导入）
   */
  async receiveBatch(messages: Message[]): Promise<ParsedEvent[]> {
    const results: ParsedEvent[] = [];
    
    for (const message of messages) {
      const parsed = this.parseMessage(message);
      results.push(parsed);
    }
    
    // 批量写入
    const events = results.map(r => r.event);
    await this.writer.writeBatch(events);
    
    return results;
  }
}