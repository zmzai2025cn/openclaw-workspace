/**
 * 飞书消息解析器
 * 支持9种格式 + 上下文关联 + 人员画像
 */

import { Logger } from './logger';

export interface ParsedMessage {
  // 基础信息
  rawText: string;
  timestamp: Date;
  source: 'feishu';
  
  // 解析结果
  formatType: FormatType;
  confidence: number;
  
  // 提取的字段
  extracted: ExtractedFields;
  
  // 上下文
  context?: MessageContext;
  
  // 动作建议
  suggestedActions: SuggestedAction[];
}

export type FormatType = 
  | 'ticket_create'      // 格式1: 工单创建
  | 'task_assign'        // 格式2: 任务分配
  | 'status_update'      // 格式3: 状态更新
  | 'status_report'      // 格式4: 状态报告
  | 'tech_discuss'       // 格式5: 技术讨论
  | 'resource_coord'     // 格式6: 资源协调
  | 'problem_classify'   // 格式7: 问题归类
  | 'info_fragment'      // 格式8: 信息片段
  | 'ticket_complex'     // 格式9: 复杂工单
  | 'unknown';           // 未知

export interface ExtractedFields {
  // 人员
  mentionedUsers?: string[];
  reporter?: string;
  reporterId?: string;
  contactPerson?: string;
  
  // 工单
  ticketId?: string;
  relatedTicketId?: string;
  priority?: string;
  system?: string;
  
  // 问题
  problemDescription?: string;
  impactScope?: string;
  occurrenceTime?: string;
  
  // 处理
  temporaryAction?: string;
  actionResult?: string;
  nextStep?: string;
  
  // 技术
  ipOrDomain?: string;
  
  // 状态
  status?: string;
  components?: string[];
  
  // 交付物
  deliverables?: string[];
}

export interface MessageContext {
  threadId?: string;
  replyTo?: string;
  previousMessages?: string[];
  isFragment: boolean;
}

export interface SuggestedAction {
  type: 'create_ticket' | 'assign_task' | 'notify' | 'schedule' | 'link_ticket' | 'store_raw';
  priority: 'high' | 'medium' | 'low';
  description: string;
  params?: Record<string, any>;
}

// 人员画像（静态配置，后续可扩展）
const USER_ROLES: Record<string, { role: string; expertise: string[] }> = {
  '李志明': { role: '运维负责人', expertise: ['邮件系统', '故障处理'] },
  '代宏基': { role: '研发工程师', expertise: ['开发', '代码审查'] },
  '王晓青': { role: '客服', expertise: ['问题受理', '用户沟通'] },
  '刘少杰': { role: '测试负责人', expertise: ['测试', '质量保障'] },
  '李向前': { role: '系统管理员', expertise: ['服务器', '网络'] },
};

export class FeishuMessageParser {
  private logger: Logger;
  private recentMessages: Map<string, string[]> = new Map(); // threadId -> messages

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 解析消息
   */
  parse(text: string, options: { threadId?: string; timestamp?: Date } = {}): ParsedMessage {
    const timestamp = options.timestamp || new Date();
    const threadId = options.threadId || 'default';

    // 保存到上下文
    if (!this.recentMessages.has(threadId)) {
      this.recentMessages.set(threadId, []);
    }
    const thread = this.recentMessages.get(threadId)!;
    thread.push(text);
    if (thread.length > 10) thread.shift(); // 保留最近10条

    // 尝试匹配各种格式
    const result = this.tryParseFormats(text, thread);
    
    this.logger.info(`Parsed message as ${result.formatType}`, { 
      confidence: result.confidence,
      hasContext: result.context?.isFragment || false 
    });

    return result;
  }

  /**
   * 尝试解析各种格式
   */
  private tryParseFormats(text: string, thread: string[]): ParsedMessage {
    // 按优先级尝试
    const parsers = [
      this.parseTicketCreate,
      this.parseTicketComplex,
      this.parseTaskAssign,
      this.parseStatusUpdate,
      this.parseResourceCoord,
      this.parseProblemClassify,
      this.parseTechDiscuss,
      this.parseStatusReport,
      this.parseInfoFragment,
    ];

    for (const parser of parsers) {
      const result = parser.call(this, text, thread);
      if (result.confidence > 0.7) {
        return result;
      }
    }

    // 未知格式
    return {
      rawText: text,
      timestamp: new Date(),
      source: 'feishu',
      formatType: 'unknown',
      confidence: 0,
      extracted: {},
      suggestedActions: [{
        type: 'store_raw',
        priority: 'low',
        description: '无法解析，原始存储待人工标注',
      }],
    };
  }

  /**
   * 格式1: 工单创建
   * - 问题等级： - 系统名称：... - 发生时间：...
   */
  private parseTicketCreate(text: string, thread: string[]): ParsedMessage {
    const patterns = {
      priority: /-\s*问题等级[：:]\s*(\S*)/,
      system: /-\s*系统名称[：:]\s*(.+?)(?=\s*-|$)/,
      time: /-\s*发生时间[：:]\s*(.+?)(?=\s*-|$)/,
      problem: /-\s*问题现象[：:]\s*(.+?)(?=\s*-|$)/,
      impact: /-\s*影响范围[：:]\s*(.+?)(?=\s*-|$)/,
      reporter: /-\s*反馈人员[：:]\s*(\S+?)(?:\s*\(|\s|$)/,
      action: /-\s*临时处理动作[：:]\s*(.+?)(?=\s*-|$)/,
    };

    const extracted: ExtractedFields = {};
    let matchCount = 0;

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        matchCount++;
        switch (key) {
          case 'priority': extracted.priority = match[1].trim(); break;
          case 'system': extracted.system = match[1].trim(); break;
          case 'time': extracted.occurrenceTime = match[1].trim(); break;
          case 'problem': extracted.problemDescription = match[1].trim(); break;
          case 'impact': extracted.impactScope = match[1].trim(); break;
          case 'reporter': extracted.reporter = match[1].trim(); break;
          case 'action': extracted.temporaryAction = match[1].trim(); break;
        }
      }
    }

    // 提取 reporter ID（括号内的内容）
    const reporterMatch = text.match(/反馈人员[：:]\s*\S+\s*\(([a-z0-9_]+)\)/i) || 
                          text.match(/\(([a-z0-9_]+)\)/i);
    if (reporterMatch) {
      extracted.reporterId = reporterMatch[1];
    }

    const confidence = matchCount >= 4 ? 0.9 : matchCount >= 2 ? 0.7 : 0;

    return {
      rawText: text,
      timestamp: new Date(),
      source: 'feishu',
      formatType: confidence > 0.7 ? 'ticket_create' : 'unknown',
      confidence,
      extracted,
      suggestedActions: confidence > 0.7 ? [{
        type: 'create_ticket',
        priority: extracted.priority?.includes('P0') ? 'high' : 'medium',
        description: `创建工单: ${extracted.problemDescription?.substring(0, 50)}...`,
        params: extracted,
      }] : [{
        type: 'store_raw',
        priority: 'low',
        description: '格式不完整，原始存储',
      }],
    };
  }

  /**
   * 格式2: 任务分配
   * @XXX @XXX 问题...工单号：XXX
   */
  private parseTaskAssign(text: string, thread: string[]): ParsedMessage {
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    const ticketMatch = text.match(/工单号[：:]\s*(HY-\d{8}-\d+)/);
    const problemMatch = text.match(/@\S+\s+(.+?)(?=工单号|$)/);

    if (mentions.length > 0 && ticketMatch) {
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'task_assign',
        confidence: 0.9,
        extracted: {
          mentionedUsers: mentions,
          relatedTicketId: ticketMatch[1],
          problemDescription: problemMatch?.[1]?.trim(),
        },
        suggestedActions: mentions.map(user => ({
          type: 'assign_task',
          priority: 'high',
          description: `分配任务给 ${user} (${USER_ROLES[user]?.role || '未知角色'})`,
          params: { user, ticketId: ticketMatch[1] },
        })),
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式3: 状态更新
   * @XXX @XXX 已经...工单号：XXX
   */
  private parseStatusUpdate(text: string, thread: string[]): ParsedMessage {
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    const ticketMatch = text.match(/工单号[：:]\s*(HY-\d{8}-\d+)/);
    const statusMatch = text.match(/(已经.+?|已.+?)(?=工单号|$)/);

    if (mentions.length > 0 && ticketMatch && statusMatch) {
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'status_update',
        confidence: 0.9,
        extracted: {
          mentionedUsers: mentions,
          relatedTicketId: ticketMatch[1],
          status: statusMatch[1].trim(),
        },
        suggestedActions: [{
          type: 'link_ticket',
          priority: 'medium',
          description: `更新工单 ${ticketMatch[1]} 状态`,
          params: { ticketId: ticketMatch[1], status: statusMatch[1].trim() },
        }],
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式4: 状态报告
   * 今天...正常...
   */
  private parseStatusReport(text: string, thread: string[]): ParsedMessage {
    const patterns = [
      /今天(.+?)正常/,
      /今日(.+?)正常/,
      /目前(.+?)正常/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const components = match[1].split(/[、，,]/).map(s => s.trim()).filter(Boolean);
        
        return {
          rawText: text,
          timestamp: new Date(),
          source: 'feishu',
          formatType: 'status_report',
          confidence: 0.85,
          extracted: {
            status: '正常',
            components,
          },
          suggestedActions: [{
            type: 'store_raw',
            priority: 'low',
            description: '状态正常，记录日志',
          }],
        };
      }
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式5: 技术讨论
   * IP/域名 @XXX @XXX 确认...
   */
  private parseTechDiscuss(text: string, thread: string[]): ParsedMessage {
    const ipPattern = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/;
    const domainPattern = /([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    
    const ipMatch = text.match(ipPattern);
    const domainMatch = text.match(domainPattern);
    
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let m;
    while ((m = mentionPattern.exec(text)) !== null) {
      mentions.push(m[1]);
    }

    if ((ipMatch || domainMatch) && mentions.length > 0) {
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'tech_discuss',
        confidence: 0.85,
        extracted: {
          ipOrDomain: ipMatch?.[1] || domainMatch?.[1],
          mentionedUsers: mentions,
        },
        suggestedActions: mentions.map(user => ({
          type: 'notify',
          priority: 'medium',
          description: `技术确认: ${ipMatch?.[1] || domainMatch?.[1]} 请 ${user} 确认`,
          params: { user, topic: ipMatch?.[1] || domainMatch?.[1] },
        })),
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式6: 资源协调
   * @XXX ...协调...提供...
   */
  private parseResourceCoord(text: string, thread: string[]): ParsedMessage {
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    const coordMatch = text.match(/协调|安排|提供/);
    const deliverableMatch = text.match(/报告|用例|文档|表/);

    if (mentions.length > 0 && coordMatch) {
      const deliverables = text.match(/(测试报告|测试用例|问题记录表|[^，。,]+?报告|[^，。,]+?用例|[^，。,]+?文档)/g) || [];
      
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'resource_coord',
        confidence: 0.8,
        extracted: {
          mentionedUsers: mentions,
          deliverables: [...new Set(deliverables.map(d => d.trim()))].filter(d => d.length < 20),
        },
        suggestedActions: mentions.map(user => ({
          type: 'assign_task',
          priority: 'medium',
          description: `协调资源: ${user} 需提供 ${deliverables.join(', ')}`,
          params: { user, deliverables },
        })),
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式7: 问题归类
   * @XXX @XXX 这个和...类似...
   */
  private parseProblemClassify(text: string, thread: string[]): ParsedMessage {
    const mentionPattern = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionPattern.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    const similarMatch = text.match(/和.+?类似|和.+?相同|之前出现过/);
    const nextStepMatch = text.match(/明天|稍后|让.+?看/);

    if (mentions.length > 0 && similarMatch) {
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'problem_classify',
        confidence: 0.8,
        extracted: {
          mentionedUsers: mentions,
          nextStep: nextStepMatch?.[0],
        },
        suggestedActions: [{
          type: 'schedule',
          priority: 'medium',
          description: `定时跟进: ${nextStepMatch?.[0] || '待安排'}`,
          params: { mentions, schedule: nextStepMatch?.[0] },
        }],
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式8: 信息片段
   * 短句，不完整，需关联上下文
   */
  private parseInfoFragment(text: string, thread: string[]): ParsedMessage {
    // 特征：短（<30字），无@，无明确动作，可能是回复或独立信息
    const isShort = text.length < 30;
    const hasMention = text.includes('@');
    const hasAction = /协调|处理|解决|看|分析|排查|请|需要/.test(text);
    const isQuestion = /[？?]/.test(text);
    
    // 如果是短句且无@无动作，或者是疑问句，可能是片段
    if ((isShort && !hasMention && !hasAction) || (isShort && isQuestion && !hasMention)) {
      // 尝试关联前文
      const context = this.findContext(text, thread);
      
      return {
        rawText: text,
        timestamp: new Date(),
        source: 'feishu',
        formatType: 'info_fragment',
        confidence: 0.7,
        extracted: {
          problemDescription: text.trim(),
        },
        context: {
          isFragment: true,
          previousMessages: context ? [context] : undefined,
        },
        suggestedActions: context ? [{
          type: 'link_ticket',
          priority: 'low',
          description: `关联到上下文: ${context.substring(0, 30)}...`,
        }] : [{
          type: 'store_raw',
          priority: 'low',
          description: '信息片段，等待更多上下文',
        }],
      };
    }

    return { rawText: text, timestamp: new Date(), source: 'feishu', formatType: 'unknown', confidence: 0, extracted: {}, suggestedActions: [] };
  }

  /**
   * 格式9: 复杂工单（格式1的扩展）
   * 包含联系人、座机、处理结果等
   */
  private parseTicketComplex(text: string, thread: string[]): ParsedMessage {
    // 先检查是否有复杂特征
    const hasContact = /联系[itIT]|座机|电话/.test(text);
    const hasResult = /无法解决|已解决|已处理|待跟进/.test(text);
    
    // 复用格式1的解析
    const baseResult = this.parseTicketCreate(text, thread);
    
    if (baseResult.confidence > 0.5 && (hasContact || hasResult)) {
      // 额外提取复杂字段
      const contactMatch = text.match(/联系[itIT][：:]\s*(.+?)(?:，|,|$)/);
      const phoneMatch = text.match(/座机|电话[：:]\s*(\d+)/);
      const resultMatch = text.match(/(无法解决|已解决|已处理|待跟进)/);

      baseResult.formatType = 'ticket_complex';
      baseResult.confidence = 0.95;
      
      if (contactMatch) {
        baseResult.extracted.contactPerson = contactMatch[1].trim();
      }
      if (resultMatch) {
        baseResult.extracted.actionResult = resultMatch[1];
      }
      
      if (resultMatch?.[1] === '无法解决') {
        baseResult.suggestedActions[0].priority = 'high';
      }
    }

    return baseResult;
  }

  /**
   * 查找上下文
   */
  private findContext(text: string, thread: string[]): string | null {
    // 简单匹配：找包含相关关键词的历史消息
    const keywords = text.split(/\s+/).filter(w => w.length >= 2);
    
    for (let i = thread.length - 2; i >= 0; i--) {
      const prev = thread[i];
      const matchCount = keywords.filter(k => prev.includes(k)).length;
      if (matchCount >= 2) {
        return prev;
      }
    }
    
    return null;
  }
}