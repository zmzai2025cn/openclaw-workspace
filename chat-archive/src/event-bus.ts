/**
 * 事件总线系统
 * 支持实时通知和订阅
 */

import { FlexibleMessage } from './flexible-types';
import { Session } from './session-manager';

/**
 * 事件类型
 */
export type EventType = 
  | 'message.received'      // 新消息到达
  | 'message.parsed'        // 消息解析完成
  | 'session.created'       // 新会话创建
  | 'session.updated'       // 会话更新
  | 'session.resolved'      // 会话解决
  | 'ticket.created'        // 新工单
  | 'ticket.merged'         // 工单合并
  | 'alert.critical'        // 严重告警
  | 'alert.warning'         // 警告
  | 'backup.completed'      // 备份完成
  | 'cleanup.completed';    // 清理完成

/**
 * 事件数据结构
 */
export interface Event<T = any> {
  type: EventType;
  timestamp: Date;
  payload: T;
  metadata: {
    source: string;
    correlationId?: string;
  };
}

/**
 * 事件处理器
 */
export type EventHandler<T = any> = (event: Event<T>) => void | Promise<void>;

/**
 * 事件总线
 */
export class EventBus {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private middlewares: Array<(event: Event, next: () => void) => void> = [];
  
  /**
   * 订阅事件
   */
  subscribe<T>(type: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    
    this.handlers.get(type)!.add(handler);
    
    // 返回取消订阅函数
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }
  
  /**
   * 订阅多个事件
   */
  subscribeMany(types: EventType[], handler: EventHandler): () => void {
    const unsubscribes = types.map(t => this.subscribe(t, handler));
    return () => unsubscribes.forEach(u => u());
  }
  
  /**
   * 发布事件
   */
  emit<T>(type: EventType, payload: T, metadata?: Partial<Event['metadata']>): void {
    const event: Event<T> = {
      type,
      timestamp: new Date(),
      payload,
      metadata: {
        source: 'chat-archive',
        ...metadata,
      },
    };
    
    // 执行中间件
    this.executeMiddlewares(event, () => {
      this.dispatch(event);
    });
  }
  
  /**
   * 使用中间件
   */
  use(middleware: (event: Event, next: () => void) => void): void {
    this.middlewares.push(middleware);
  }
  
  /**
   * 执行中间件链
   */
  private executeMiddlewares(event: Event, finalHandler: () => void): void {
    let index = 0;
    
    const next = () => {
      if (index >= this.middlewares.length) {
        finalHandler();
        return;
      }
      
      const middleware = this.middlewares[index++];
      middleware(event, next);
    };
    
    next();
  }
  
  /**
   * 分发事件到处理器
   */
  private dispatch(event: Event): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch(err => {
            console.error(`Event handler error for ${event.type}:`, err);
          });
        }
      } catch (err) {
        console.error(`Event handler error for ${event.type}:`, err);
      }
    }
  }
  
  /**
   * 获取订阅统计
   */
  getStats(): Record<EventType, number> {
    const stats: Record<EventType, number> = {} as any;
    
    for (const [type, handlers] of this.handlers) {
      stats[type] = handlers.size;
    }
    
    return stats;
  }
}

// 全局事件总线实例
export const globalEventBus = new EventBus();

/**
 * 通知管理器
 * 基于事件总线的高级通知功能
 */
export class NotificationManager {
  private eventBus: EventBus;
  private rules: NotificationRule[] = [];
  
  constructor(eventBus: EventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.setupDefaultRules();
  }
  
  /**
   * 添加通知规则
   */
  addRule(rule: NotificationRule): void {
    this.rules.push(rule);
    
    // 订阅相关事件
    this.eventBus.subscribe(rule.eventType, async (event) => {
      if (rule.condition(event)) {
        await rule.handler(event);
      }
    });
  }
  
  /**
   * 设置默认规则
   */
  private setupDefaultRules(): void {
    // P0工单立即通知
    this.addRule({
      eventType: 'ticket.created',
      condition: (event) => {
        const payload = event.payload as { severity?: string };
        return payload.severity === 'P0';
      },
      handler: async (event) => {
        await this.sendUrgentAlert('P0工单创建', event);
      },
    });
    
    // 会话解决通知
    this.addRule({
      eventType: 'session.resolved',
      condition: () => true,
      handler: async (event) => {
        await this.sendNotification('问题已解决', event);
      },
    });
  }
  
  /**
   * 发送紧急告警
   */
  private async sendUrgentAlert(title: string, event: Event): Promise<void> {
    // 多渠道通知
    await Promise.all([
      this.sendWebhook(title, event),
      this.sendEmail(title, event),
      // this.sendSMS(title, event), // 如需短信
    ]);
  }
  
  /**
   * 发送普通通知
   */
  private async sendNotification(title: string, event: Event): Promise<void> {
    await this.sendWebhook(title, event);
  }
  
  /**
   * Webhook通知
   */
  private async sendWebhook(title: string, event: Event): Promise<void> {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) return;
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          event: event.type,
          timestamp: event.timestamp,
          payload: event.payload,
        }),
      });
    } catch (err) {
      console.error('Webhook notification failed:', err);
    }
  }
  
  /**
   * 邮件通知
   */
  private async sendEmail(title: string, event: Event): Promise<void> {
    // 集成邮件服务
    // await emailService.send({...});
  }
}

/**
 * 通知规则
 */
interface NotificationRule {
  eventType: EventType;
  condition: (event: Event) => boolean;
  handler: (event: Event) => Promise<void>;
}

/**
 * 消息流处理器
 * 实时处理消息流
 */
export class MessageStreamProcessor {
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus = globalEventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * 处理新消息
   */
  process(message: FlexibleMessage, session: Session): void {
    // 发布消息接收事件
    this.eventBus.emit('message.received', {
      messageId: message.id,
      timestamp: message.timestamp,
      userId: message.userId,
    });
    
    // 发布消息解析事件
    this.eventBus.emit('message.parsed', {
      messageId: message.id,
      type: message.messageType,
      confidence: message.metadata.parseConfidence,
      parsedData: message.parsedData,
    });
    
    // 检查是否是工单相关
    if (message.messageCategory === 'ticket') {
      this.handleTicketMessage(message, session);
    }
    
    // 检查会话状态变化
    if (session.status === 'resolved') {
      this.eventBus.emit('session.resolved', {
        sessionId: session.id,
        ticketId: session.ticketId,
        duration: session.endTime!.getTime() - session.startTime.getTime(),
      });
    }
  }
  
  /**
   * 处理工单消息
   */
  private handleTicketMessage(message: FlexibleMessage, session: Session): void {
    switch (message.messageType) {
      case 'ticket_create':
        this.eventBus.emit('ticket.created', {
          ticketId: message.parsedData?.ticketId,
          severity: message.parsedData?.severity,
          systemName: message.parsedData?.systemName,
          reporter: message.parsedData?.reporter,
        });
        break;
        
      case 'ticket_merge':
        this.eventBus.emit('ticket.merged', {
          sourceTicketId: message.parsedData?.sourceTicketId,
          targetTicketId: message.parsedData?.targetTicketId,
        });
        break;
    }
  }
}
