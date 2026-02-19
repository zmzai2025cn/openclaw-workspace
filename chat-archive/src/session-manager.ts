/**
 * 会话上下文管理
 * 关联同一事件的多条消息
 */

import { FlexibleMessage } from './flexible-types';

/**
 * 会话（事件）定义
 */
export interface Session {
  id: string;
  topic: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  
  // 时间范围
  startTime: Date;
  endTime?: Date;
  lastActivityTime: Date;
  
  // 参与者
  participants: Set<string>;
  
  // 关联数据
  ticketId?: string;
  systemName?: string;
  severity?: string;
  
  // 消息列表
  messageIds: string[];
  messages: FlexibleMessage[];
  
  // 会话摘要
  summary?: string;
  
  // 元数据
  metadata: {
    messageCount: number;
    hasResolution: boolean;
    tags: string[];
  };
}

/**
 * 会话管理器
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private messageToSession: Map<string, string> = new Map();
  private readonly sessionTimeout: number; // 会话超时时间（毫秒）
  
  constructor(sessionTimeout: number = 30 * 60 * 1000) { // 默认30分钟
    this.sessionTimeout = sessionTimeout;
  }
  
  /**
   * 处理新消息，关联到会话
   */
  processMessage(message: FlexibleMessage): Session {
    // 1. 检查是否是回复消息
    if (message.replyTo) {
      const parentSession = this.messageToSession.get(message.replyTo);
      if (parentSession) {
        return this.addToSession(parentSession, message);
      }
    }
    
    // 2. 检查是否提到已有工单
    const ticketId = this.extractTicketId(message);
    if (ticketId) {
      const existingSession = this.findSessionByTicket(ticketId);
      if (existingSession) {
        return this.addToSession(existingSession.id, message);
      }
    }
    
    // 3. 检查时间相近的会话
    const recentSession = this.findRecentSession(message);
    if (recentSession && this.isRelated(recentSession, message)) {
      return this.addToSession(recentSession.id, message);
    }
    
    // 4. 创建新会话
    return this.createSession(message);
  }
  
  /**
   * 创建新会话
   */
  private createMessage(message: FlexibleMessage): Session {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: this.generateTopic(message),
      status: 'open',
      startTime: message.timestamp,
      lastActivityTime: message.timestamp,
      participants: new Set([message.userId]),
      messageIds: [message.id],
      messages: [message],
      ticketId: this.extractTicketId(message),
      systemName: message.parsedData?.systemName,
      severity: message.parsedData?.severity,
      metadata: {
        messageCount: 1,
        hasResolution: false,
        tags: this.extractTags(message),
      },
    };
    
    this.sessions.set(session.id, session);
    this.messageToSession.set(message.id, session.id);
    
    return session;
  }
  
  /**
   * 添加消息到现有会话
   */
  private addToSession(sessionId: string, message: FlexibleMessage): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    session.messageIds.push(message.id);
    session.messages.push(message);
    session.participants.add(message.userId);
    session.lastActivityTime = message.timestamp;
    session.metadata.messageCount++;
    
    // 更新标签
    const newTags = this.extractTags(message);
    for (const tag of newTags) {
      if (!session.metadata.tags.includes(tag)) {
        session.metadata.tags.push(tag);
      }
    }
    
    // 检查是否解决
    if (this.isResolutionMessage(message)) {
      session.metadata.hasResolution = true;
      session.status = 'resolved';
    }
    
    this.messageToSession.set(message.id, sessionId);
    
    return session;
  }
  
  /**
   * 查找最近的活跃会话
   */
  private findRecentSession(message: FlexibleMessage): Session | null {
    const now = message.timestamp.getTime();
    
    for (const session of this.sessions.values()) {
      const timeDiff = now - session.lastActivityTime.getTime();
      if (timeDiff < this.sessionTimeout) {
        return session;
      }
    }
    
    return null;
  }
  
  /**
   * 按工单号查找会话
   */
  private findSessionByTicket(ticketId: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.ticketId === ticketId) {
        return session;
      }
    }
    return null;
  }
  
  /**
   * 判断消息是否与会话相关
   */
  private isRelated(session: Session, message: FlexibleMessage): boolean {
    // 同一系统
    if (session.systemName && message.parsedData?.systemName === session.systemName) {
      return true;
    }
    
    // 同一参与者
    if (session.participants.has(message.userId)) {
      return true;
    }
    
    // 标签重叠
    const messageTags = this.extractTags(message);
    const commonTags = session.metadata.tags.filter(t => messageTags.includes(t));
    if (commonTags.length > 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 提取工单号
   */
  private extractTicketId(message: FlexibleMessage): string | undefined {
    // 从解析数据中提取
    if (message.parsedData?.ticketId) {
      return message.parsedData.ticketId;
    }
    
    // 从内容中提取
    const match = message.content.match(/(HY-\d{8}-\d+)/);
    return match?.[1];
  }
  
  /**
   * 生成会话主题
   */
  private generateTopic(message: FlexibleMessage): string {
    if (message.parsedData?.systemName) {
      return `${message.parsedData.systemName}问题`;
    }
    if (message.parsedData?.phenomenon) {
      return message.parsedData.phenomenon.substring(0, 20);
    }
    return `会话_${message.id}`;
  }
  
  /**
   * 提取标签
   */
  private extractTags(message: FlexibleMessage): string[] {
    const tags: string[] = [];
    
    if (message.messageType) {
      tags.push(message.messageType);
    }
    if (message.messageCategory) {
      tags.push(message.messageCategory);
    }
    if (message.parsedData?.systemName) {
      tags.push(message.parsedData.systemName);
    }
    if (message.parsedData?.severity) {
      tags.push(message.parsedData.severity);
    }
    
    return [...new Set(tags)];
  }
  
  /**
   * 判断是否是解决消息
   */
  private isResolutionMessage(message: FlexibleMessage): boolean {
    const content = message.content;
    return content.includes('已解决') ||
           content.includes('已修复') ||
           content.includes('已关闭') ||
           content.includes('问题已处理');
  }
  
  /**
   * 获取会话
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * 获取消息所属的会话
   */
  getSessionByMessage(messageId: string): Session | undefined {
    const sessionId = this.messageToSession.get(messageId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }
  
  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): Session[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(s => {
      return now - s.lastActivityTime.getTime() < this.sessionTimeout;
    });
  }
  
  /**
   * 获取会话统计
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    resolvedSessions: number;
    avgMessagesPerSession: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = this.getActiveSessions();
    
    const totalMessages = sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0);
    
    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      resolvedSessions: sessions.filter(s => s.status === 'resolved').length,
      avgMessagesPerSession: sessions.length > 0 ? totalMessages / sessions.length : 0,
    };
  }
  
  /**
   * 清理过期会话
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityTime.getTime() > this.sessionTimeout * 2) {
        // 清理消息映射
        for (const msgId of session.messageIds) {
          this.messageToSession.delete(msgId);
        }
        // 删除会话
        this.sessions.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}
