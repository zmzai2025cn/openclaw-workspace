/**
 * 运维消息解析器
 * 自动识别和提取工单消息中的结构化信息
 */

import {
  ChatMessage,
  TicketData,
  TicketMergeData,
  StatusData,
  TechData,
  ProcessData,
  AnalysisData,
  EnvironmentData,
} from './ticket-types';

/**
 * 消息解析器
 */
export class TicketMessageParser {
  /**
   * 解析消息内容，识别类型并提取结构化数据
   */
  parse(message: ChatMessage): ChatMessage {
    const content = message.content;
    
    // 1. 识别消息类型
    const messageType = this.detectMessageType(content);
    message.messageType = messageType;
    
    // 2. 根据类型解析数据
    switch (messageType) {
      case 'ticket_create':
      case 'ticket_update':
        message.parsedData = this.parseTicketData(content);
        break;
      case 'ticket_merge':
        message.parsedData = this.parseMergeData(content);
        break;
      case 'status_report':
        message.parsedData = this.parseStatusData(content);
        break;
      case 'tech_inquiry':
        message.parsedData = this.parseTechData(content);
        break;
      case 'process_request':
        message.parsedData = this.parseProcessData(content);
        break;
      case 'analysis_note':
        message.parsedData = this.parseAnalysisData(content);
        break;
      case 'env_info':
        message.parsedData = this.parseEnvironmentData(content);
        break;
      default:
        message.parsedData = undefined;
    }
    
    // 3. 提取元数据
    message.metadata = {
      ...message.metadata,
      hasImage: this.hasImage(content),
      hasAttachment: this.hasAttachment(content),
      mentionedUsers: this.extractMentions(content),
      isSystemMessage: this.isSystemMessage(content),
      isForwarded: this.isForwarded(content),
      parseConfidence: this.calculateConfidence(messageType, content),
    };
    
    return message;
  }

  /**
   * 检测消息类型
   */
  private detectMessageType(content: string): ChatMessage['messageType'] {
    // 工单创建/更新：包含标准化工单字段
    if (/问题等级|系统名称|发生时间|问题现象|影响范围|反馈人员/.test(content)) {
      return 'ticket_create';
    }
    
    // 工单合并
    if (/合并到|关联工单|工单号/.test(content) && /HY-\d{8}-\d+/.test(content)) {
      return 'ticket_merge';
    }
    
    // 状态报告
    if (/正常|异常|状态|检查/.test(content) && 
        (content.includes('邮箱') || content.includes('系统'))) {
      return 'status_report';
    }
    
    // 技术询问
    if (/\d+\.\d+\.\d+\.\d+|服务器|灰度|版本/.test(content) && 
        content.includes('？') || content.includes('吧')) {
      return 'tech_inquiry';
    }
    
    // 流程要求
    if (/测试报告|测试用例|验证测试|提供.*表|协调/.test(content)) {
      return 'process_request';
    }
    
    // 分析记录
    if (/分析|素材|类似|归类/.test(content) && 
        /工单|问题/.test(content)) {
      return 'analysis_note';
    }
    
    // 环境信息
    if (/操作系统|版本|信创|电脑/.test(content) && 
        content.length < 100) {
      return 'env_info';
    }
    
    return 'general';
  }

  /**
   * 解析工单数据
   */
  private parseTicketData(content: string): TicketData {
    const data: TicketData = {
      ticketType: content.includes('临时处理') ? 'update' : 'create',
      systemName: this.extractField(content, '系统名称[:：]\s*(.+)') || '未知系统',
      occurrenceTime: this.parseDate(this.extractField(content, '发生时间[:：]\s*(.+)')),
      phenomenon: this.extractField(content, '问题现象[:：]\s*(.+)') || '',
      impactScope: this.parseImpactScope(this.extractField(content, '影响范围[:：]\s*(.+)')),
      reporter: this.parseReporter(this.extractField(content, '反馈人员[:：]\s*(.+)')),
      temporaryAction: this.extractField(content, '临时处理动作[:：]\s*(.+)'),
      ticketId: this.extractTicketId(content),
      relatedTickets: this.extractAllTicketIds(content),
      serverInfo: this.parseServerInfo(content),
      environment: this.parseEnvironment(content),
    };
    
    // 提取严重等级
    const severity = this.extractField(content, '问题等级[:：]\s*(.+)');
    data.severity = this.parseSeverity(severity);
    
    return data;
  }

  /**
   * 解析合并数据
   */
  private parseMergeData(content: string): TicketMergeData {
    const ticketIds = this.extractAllTicketIds(content);
    
    return {
      mergeType: 'merge',
      sourceTicketId: ticketIds[1] || '',
      targetTicketId: ticketIds[0] || '',
      mergedBy: this.extractMentions(content)[0] || '',
      reason: content,
    };
  }

  /**
   * 解析状态数据
   */
  private parseStatusData(content: string): StatusData {
    const isNormal = content.includes('正常') && !content.includes('异常');
    
    return {
      reportType: 'system_status',
      systemStatus: isNormal ? 'normal' : 'abnormal',
      components: this.extractComponents(content),
      reportTime: new Date(),
      notifications: this.extractNotifications(content),
    };
  }

  /**
   * 解析技术询问
   */
  private parseTechData(content: string): TechData {
    return {
      inquiryType: 'server_confirm',
      server: {
        ip: this.extractIP(content),
        hostname: this.extractField(content, '(\S+\.\S+\.\S+)') || '',
        domain: this.extractField(content, '(\S+\.com\.cn)'),
        isGrayRelease: content.includes('灰度'),
      },
      askedPersons: this.extractMentions(content),
      context: content,
    };
  }

  /**
   * 解析流程要求
   */
  private parseProcessData(content: string): ProcessData {
    const requirements: string[] = [];
    
    if (content.includes('完整测试报告')) requirements.push('完整测试报告');
    if (content.includes('测试问题记录表')) requirements.push('测试问题记录表');
    if (content.includes('测试用例')) requirements.push('测试用例');
    
    return {
      requestType: content.includes('测试用例') ? 'test_case' : 'test_report',
      requirements,
      deliverables: requirements.map(r => ({
        name: r,
        description: r,
        mandatory: true,
      })),
      assignee: this.extractMentions(content)[0] || '',
      relatedTicket: this.extractTicketId(content),
    };
  }

  /**
   * 解析分析数据
   */
  private parseAnalysisData(content: string): AnalysisData {
    const ticketIds = this.extractAllTicketIds(content);
    
    return {
      analysisType: content.includes('素材') ? 'material_collection' : 'similar_issue',
      conclusion: content,
      relatedIssues: ticketIds.map(id => ({
        ticketId: id,
        similarity: '类似问题',
      })),
      nextActions: this.extractNextActions(content),
      materials: content.includes('素材') ? ['问题记录'] : undefined,
    };
  }

  /**
   * 解析环境数据
   */
  private parseEnvironmentData(content: string): EnvironmentData {
    return {
      infoType: 'os_version',
      os: {
        name: content.includes('信创') ? '信创OS' : '未知',
        version: this.extractField(content, '版本[:：]\s*(.+)') || content,
        isTrustedComputer: content.includes('信创'),
      },
      relatedUser: this.extractMentions(content)[0],
    };
  }

  // ==================== 辅助方法 ====================

  private extractField(content: string, pattern: string): string | undefined {
    const match = content.match(new RegExp(pattern, 'i'));
    return match?.[1]?.trim();
  }

  private extractTicketId(content: string): string | undefined {
    const match = content.match(/(HY-\d{8}-\d+)/);
    return match?.[1];
  }

  private extractAllTicketIds(content: string): string[] {
    const matches = content.matchAll(/(HY-\d{8}-\d+)/g);
    return Array.from(matches).map(m => m[1]);
  }

  private extractMentions(content: string): string[] {
    const matches = content.matchAll(/@(\S+)/g);
    return Array.from(matches).map(m => m[1]);
  }

  private extractIP(content: string): string {
    const match = content.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    return match?.[1] || '';
  }

  private parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    
    // 尝试多种格式
    const formats = [
      /(\d{2})年(\d{2})月(\d{2})日(\d{2})时(\d{2})分/,
      /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/,
      /(\d{4})年(\d{2})月(\d{2})日/,
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const year = match[1].length === 2 ? '20' + match[1] : match[1];
        return new Date(
          parseInt(year),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4] || '0'),
          parseInt(match[5] || '0')
        );
      }
    }
    
    return new Date();
  }

  private parseSeverity(severity: string | undefined): TicketData['severity'] {
    if (!severity) return 'unknown';
    if (severity.includes('P0')) return 'P0';
    if (severity.includes('P1')) return 'P1';
    if (severity.includes('P2')) return 'P2';
    if (severity.includes('P3')) return 'P3';
    return 'unknown';
  }

  private parseImpactScope(scope: string | undefined): TicketData['impactScope'] {
    if (!scope) return 'unknown';
    if (scope.includes('个人')) return 'personal';
    if (scope.includes('部门')) return 'department';
    if (scope.includes('公司')) return 'company';
    return 'unknown';
  }

  private parseReporter(reporterStr: string | undefined): TicketData['reporter'] {
    if (!reporterStr) return { name: '未知', username: 'unknown' };
    
    // 格式：姓名username 或 姓名(username) 或 姓名 username
    const match = reporterStr.match(/(\S+?)[\s(]*(\S+?)[\s)]*$/);
    if (match) {
      return {
        name: match[1],
        username: match[2],
      };
    }
    
    return { name: reporterStr, username: reporterStr };
  }

  private parseServerInfo(content: string): TicketData['serverInfo'] {
    const ip = this.extractIP(content);
    if (!ip) return undefined;
    
    return {
      ip,
      hostname: this.extractField(content, '(\S+\.\S+\.\S+)') || '',
      isGrayRelease: content.includes('灰度'),
    };
  }

  private parseEnvironment(content: string): TicketData['environment'] {
    if (!content.includes('信创') && !content.includes('版本')) {
      return undefined;
    }
    
    return {
      osVersion: this.extractField(content, '版本[:：]\s*(.+)'),
      isTrustedComputer: content.includes('信创'),
    };
  }

  private extractComponents(content: string): StatusData['components'] {
    const components: StatusData['components'] = [];
    
    if (content.includes('PC端')) {
      components.push({ name: 'PC客户端', status: content.includes('正常') ? 'normal' : 'abnormal' });
    }
    if (content.includes('网页版')) {
      components.push({ name: '网页版', status: content.includes('正常') ? 'normal' : 'abnormal' });
    }
    if (content.includes('VIP邮箱')) {
      components.push({ name: 'VIP邮箱', status: content.includes('正常') ? 'normal' : 'abnormal' });
    }
    
    return components;
  }

  private extractNotifications(content: string): StatusData['notifications'] {
    const notifications: StatusData['notifications'] = [];
    
    if (content.includes('容量通知')) {
      notifications.push({ type: 'capacity', status: content.includes('正常') ? 'normal' : 'abnormal' });
    }
    
    return notifications;
  }

  private extractNextActions(content: string): AnalysisData['nextActions'] {
    const actions: AnalysisData['nextActions'] = [];
    
    // 提取"明天让XX看一下"这类行动
    const timeMatch = content.match(/(明天|今天|下周)(.+?)(?:，|。|$)/);
    if (timeMatch) {
      actions.push({
        action: timeMatch[2].trim(),
        assignee: this.extractMentions(content)[0] || '',
        timeline: timeMatch[1],
      });
    }
    
    return actions;
  }

  private hasImage(content: string): boolean {
    return content.includes('[图片]') || content.includes('image');
  }

  private hasAttachment(content: string): boolean {
    return content.includes('[文件]') || content.includes('attachment');
  }

  private isSystemMessage(content: string): boolean {
    return content.startsWith('- 问题等级：') || 
           content.includes('系统名称：') ||
           content.includes('工单号：');
  }

  private isForwarded(content: string): boolean {
    return content.includes('转发') || content.includes('Forwarded');
  }

  private calculateConfidence(messageType: string, content: string): number {
    // 简单的置信度计算
    if (messageType === 'general') return 0.5;
    
    // 包含标准化工单字段的置信度更高
    const hasStandardFields = /问题等级|系统名称|发生时间|问题现象/.test(content);
    if (hasStandardFields) return 0.95;
    
    // 包含工单号的置信度较高
    if (/HY-\d{8}-\d+/.test(content)) return 0.9;
    
    return 0.75;
  }
}
