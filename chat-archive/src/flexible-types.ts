/**
 * 灵活的运维消息类型系统
 * 支持动态扩展，插件化解析器
 */

// ==================== 基础类型 ====================

/**
 * 通用消息接口
 */
export interface FlexibleMessage {
  id: string;
  timestamp: Date;
  channel: string;
  chatId: string;
  chatName?: string;
  userId: string;
  userName: string;
  content: string;
  isMentioned: boolean;
  replyTo?: string;
  
  // 动态类型系统
  messageType: string;           // 任意字符串，不限制枚举
  messageCategory: string;       // 大类：ticket/status/tech/process/analysis/env/other
  
  // 动态结构化数据
  parsedData?: Record<string, any>;  // 任意结构，根据parser动态生成
  
  // 扩展元数据
  metadata: MessageMetadata;
  
  // 原始信息保留
  raw: {
    content: string;             // 原始内容
    attachments: Attachment[];   // 附件列表
    mentions: string[];          // @人员
  };
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  // 内容特征
  hasImage: boolean;
  hasAttachment: boolean;
  hasLink: boolean;
  mentionedUsers: string[];
  
  // 消息属性
  isSystemMessage: boolean;
  isForwarded: boolean;
  isReply: boolean;
  
  // 解析信息
  parseConfidence: number;       // 0-1
  parserVersion: string;         // 解析器版本
  parserName: string;            // 使用的解析器
  
  // 扩展字段（任意键值）
  [key: string]: any;
}

/**
 * 附件
 */
export interface Attachment {
  type: 'image' | 'file' | 'link' | 'other';
  name?: string;
  url?: string;
  size?: number;
  mimeType?: string;
}

// ==================== 字段定义系统 ====================

/**
 * 字段类型定义
 */
export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'array' 
  | 'object' 
  | 'enum';

/**
 * 字段定义
 */
export interface FieldDefinition {
  name: string;                  // 字段名
  type: FieldType;               // 字段类型
  description: string;           // 描述
  required: boolean;             // 是否必填
  default?: any;                 // 默认值
  
  // 枚举类型专用
  enumValues?: string[];
  
  // 验证规则
  validation?: {
    pattern?: string;            // 正则
    min?: number;                // 最小值/长度
    max?: number;                // 最大值/长度
  };
  
  // 提取规则
  extraction?: {
    patterns: string[];          // 匹配正则列表
    priority: number;            // 优先级
    transform?: string;          // 转换函数名
  };
}

/**
 * 消息类型定义
 */
export interface MessageTypeDefinition {
  type: string;                  // 类型标识
  category: string;              // 所属大类
  description: string;           // 描述
  
  // 识别规则
  detection: {
    patterns: string[];          // 正则匹配
    keywords: string[];          // 关键词
    score: number;               // 匹配阈值
  };
  
  // 字段定义
  fields: FieldDefinition[];
  
  // 版本
  version: string;
  
  // 父类型（继承）
  extends?: string;
}

// ==================== 预定义类型（可扩展） ====================

/**
 * 基础工单类型
 */
export const BaseTicketType: MessageTypeDefinition = {
  type: 'base_ticket',
  category: 'ticket',
  description: '基础工单类型',
  detection: {
    patterns: [],
    keywords: [],
    score: 0,
  },
  fields: [
    {
      name: 'ticketId',
      type: 'string',
      description: '工单号',
      required: false,
      extraction: {
        patterns: ['(HY-\\d{8}-\\d+)', '(TK-\\d+)'],
        priority: 1,
      },
    },
    {
      name: 'severity',
      type: 'enum',
      description: '严重等级',
      required: false,
      enumValues: ['P0', 'P1', 'P2', 'P3', 'P4'],
      extraction: {
        patterns: ['问题等级[:：]\\s*(P\\d)'],
        priority: 1,
      },
    },
    {
      name: 'systemName',
      type: 'string',
      description: '系统名称',
      required: false,
      extraction: {
        patterns: ['系统名称[:：]\\s*(.+?)(?:\\n|$)'],
        priority: 1,
      },
    },
    {
      name: 'occurrenceTime',
      type: 'date',
      description: '发生时间',
      required: false,
      extraction: {
        patterns: [
          '发生时间[:：]\\s*(\\d{2,4}年\\d{1,2}月\\d{1,2}日\\d{1,2}时\\d{1,2}分)',
          '发生时间[:：]\\s*(\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})',
        ],
        priority: 1,
        transform: 'parseChineseDate',
      },
    },
    {
      name: 'phenomenon',
      type: 'string',
      description: '问题现象',
      required: false,
      extraction: {
        patterns: ['问题现象[:：]\\s*(.+?)(?:影响范围|反馈人员|$)'],
        priority: 1,
      },
    },
    {
      name: 'impactScope',
      type: 'enum',
      description: '影响范围',
      required: false,
      enumValues: ['personal', 'department', 'company', 'external', 'unknown'],
      extraction: {
        patterns: ['影响范围[:：]\\s*(个人|部门|公司|外部|未知)'],
        priority: 1,
      },
    },
    {
      name: 'reporter',
      type: 'object',
      description: '反馈人员',
      required: false,
      extraction: {
        patterns: ['反馈人员[:：]\\s*(.+?)(?:\\(|（| |\\n|$)'],
        priority: 1,
      },
    },
  ],
  version: '1.0.0',
};

/**
 * 邮件系统工单（继承基础工单）
 */
export const EmailTicketType: MessageTypeDefinition = {
  type: 'email_ticket',
  category: 'ticket',
  description: '邮件系统工单',
  detection: {
    patterns: ['邮件系统', '邮箱', '退信', '收发'],
    keywords: ['邮件', '邮箱', '退信', 'eml'],
    score: 0.7,
  },
  fields: [
    // 继承基础字段
    ...BaseTicketType.fields,
    // 邮件系统特有字段
    {
      name: 'sender',
      type: 'string',
      description: '发件人',
      required: false,
      extraction: {
        patterns: ['发件人[:：]\\s*(\\S+@\\S+)'],
        priority: 2,
      },
    },
    {
      name: 'recipient',
      type: 'string',
      description: '收件人',
      required: false,
      extraction: {
        patterns: ['收件人[:：]\\s*(\\S+@\\S+)'],
        priority: 2,
      },
    },
    {
      name: 'bounceTime',
      type: 'date',
      description: '退信时间',
      required: false,
      extraction: {
        patterns: ['退信提示邮件时间为[:：]\\s*(\\d{4}-\\d{1,2}-\\d{1,2}\\s+\\d{1,2}:\\d{2})'],
        priority: 2,
      },
    },
    {
      name: 'clientType',
      type: 'enum',
      description: '客户端类型',
      required: false,
      enumValues: ['pc', 'web', 'mobile', 'vip'],
      extraction: {
        patterns: ['(PC端|网页版|移动端|VIP邮箱)'],
        priority: 2,
      },
    },
  ],
  version: '1.0.0',
  extends: 'base_ticket',
};

/**
 * 服务器询问
 */
export const ServerInquiryType: MessageTypeDefinition = {
  type: 'server_inquiry',
  category: 'tech',
  description: '服务器信息询问',
  detection: {
    patterns: ['\\d+\\.\\d+\\.\\d+\\.\\d+', '服务器', '灰度'],
    keywords: ['IP', '服务器', '域名', '灰度'],
    score: 0.6,
  },
  fields: [
    {
      name: 'serverIp',
      type: 'string',
      description: '服务器IP',
      required: false,
      extraction: {
        patterns: ['(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})'],
        priority: 1,
      },
    },
    {
      name: 'hostname',
      type: 'string',
      description: '主机名',
      required: false,
      extraction: {
        patterns: ['(\\S+\\.\\S+\\.\\S+)'],
        priority: 2,
      },
    },
    {
      name: 'domain',
      type: 'string',
      description: '域名',
      required: false,
      extraction: {
        patterns: ['(\\S+\\.com\\.cn)', '(\\S+\\.cn)', '(\\S+\\.com)'],
        priority: 2,
      },
    },
    {
      name: 'isGrayRelease',
      type: 'boolean',
      description: '是否灰度服务器',
      required: false,
      default: false,
      extraction: {
        patterns: ['灰度'],
        priority: 1,
      },
    },
    {
      name: 'askedPersons',
      type: 'array',
      description: '被询问人员',
      required: false,
      extraction: {
        patterns: ['@(\\S+)'],
        priority: 1,
      },
    },
  ],
  version: '1.0.0',
};

/**
 * 状态报告
 */
export const StatusReportType: MessageTypeDefinition = {
  type: 'status_report',
  category: 'status',
  description: '系统状态报告',
  detection: {
    patterns: ['正常', '异常'],
    keywords: ['正常', '异常', '状态', '检查'],
    score: 0.5,
  },
  fields: [
    {
      name: 'overallStatus',
      type: 'enum',
      description: '整体状态',
      required: true,
      enumValues: ['normal', 'abnormal', 'degraded', 'unknown'],
      extraction: {
        patterns: ['(正常|异常|降级)'],
        priority: 1,
      },
    },
    {
      name: 'components',
      type: 'array',
      description: '各组件状态',
      required: false,
      extraction: {
        patterns: ['(PC端|网页版|移动端|VIP邮箱|客户端)[：:]\\s*(正常|异常)'],
        priority: 2,
      },
    },
    {
      name: 'reportTime',
      type: 'date',
      description: '报告时间',
      required: false,
      default: 'now',
    },
  ],
  version: '1.0.0',
};

/**
 * 流程要求
 */
export const ProcessRequestType: MessageTypeDefinition = {
  type: 'process_request',
  category: 'process',
  description: '流程/文档要求',
  detection: {
    patterns: ['测试报告', '测试用例', '验证测试', '提供'],
    keywords: ['报告', '用例', '验证', '协调', '提供'],
    score: 0.6,
  },
  fields: [
    {
      name: 'requestType',
      type: 'enum',
      description: '要求类型',
      required: true,
      enumValues: ['test_report', 'test_case', 'document', 'verification', 'resource'],
      extraction: {
        patterns: ['(测试报告|测试用例|文档|验证|资源)'],
        priority: 1,
      },
    },
    {
      name: 'requirements',
      type: 'array',
      description: '具体要求',
      required: false,
      extraction: {
        patterns: ['(完整测试报告|测试问题记录表|测试用例)'],
        priority: 2,
      },
    },
    {
      name: 'assignee',
      type: 'string',
      description: '负责人',
      required: false,
      extraction: {
        patterns: ['@(\\S+)'],
        priority: 1,
      },
    },
    {
      name: 'deadline',
      type: 'date',
      description: '截止时间',
      required: false,
      extraction: {
        patterns: ['(今天|明天|下周|月底)'],
        priority: 2,
      },
    },
  ],
  version: '1.0.0',
};

/**
 * 分析记录
 */
export const AnalysisNoteType: MessageTypeDefinition = {
  type: 'analysis_note',
  category: 'analysis',
  description: '问题分析记录',
  detection: {
    patterns: ['分析', '素材', '类似', '归类'],
    keywords: ['分析', '素材', '类似', '归类', '看一下'],
    score: 0.5,
  },
  fields: [
    {
      name: 'analysisType',
      type: 'enum',
      description: '分析类型',
      required: false,
      enumValues: ['similar_issue', 'root_cause', 'material_collection', 'classification'],
      extraction: {
        patterns: ['(类似|根因|素材|归类)'],
        priority: 1,
      },
    },
    {
      name: 'relatedTickets',
      type: 'array',
      description: '关联工单',
      required: false,
      extraction: {
        patterns: ['(HY-\\d{8}-\\d+)'],
        priority: 1,
      },
    },
    {
      name: 'nextActions',
      type: 'array',
      description: '下一步行动',
      required: false,
      extraction: {
        patterns: ['(明天|今天|下周)(.+?)(?:，|。|$)'],
        priority: 2,
      },
    },
  ],
  version: '1.0.0',
};

/**
 * 环境信息
 */
export const EnvironmentInfoType: MessageTypeDefinition = {
  type: 'env_info',
  category: 'env',
  description: '环境/配置信息',
  detection: {
    patterns: ['操作系统', '版本', '信创'],
    keywords: ['系统', '版本', '信创', 'OS'],
    score: 0.4,
  },
  fields: [
    {
      name: 'osName',
      type: 'string',
      description: '操作系统',
      required: false,
      extraction: {
        patterns: ['(信创|Windows|Linux|MacOS|统信|麒麟)'],
        priority: 1,
      },
    },
    {
      name: 'osVersion',
      type: 'string',
      description: '系统版本',
      required: false,
      extraction: {
        patterns: ['版本[:：]\\s*(.+?)(?:\\n|$)'],
        priority: 1,
      },
    },
    {
      name: 'isTrustedComputer',
      type: 'boolean',
      description: '是否信创电脑',
      required: false,
      default: false,
      extraction: {
        patterns: ['信创'],
        priority: 1,
      },
    },
  ],
  version: '1.0.0',
};

// ==================== 类型注册表 ====================

/**
 * 类型注册表
 */
export class TypeRegistry {
  private types: Map<string, MessageTypeDefinition> = new Map();
  
  /**
   * 注册类型
   */
  register(typeDef: MessageTypeDefinition): void {
    // 处理继承
    if (typeDef.extends) {
      const parent = this.types.get(typeDef.extends);
      if (parent) {
        typeDef.fields = [...parent.fields, ...typeDef.fields];
      }
    }
    
    this.types.set(typeDef.type, typeDef);
  }
  
  /**
   * 获取类型定义
   */
  get(type: string): MessageTypeDefinition | undefined {
    return this.types.get(type);
  }
  
  /**
   * 获取所有类型
   */
  getAll(): MessageTypeDefinition[] {
    return Array.from(this.types.values());
  }
  
  /**
   * 按分类获取类型
   */
  getByCategory(category: string): MessageTypeDefinition[] {
    return this.getAll().filter(t => t.category === category);
  }
  
  /**
   * 从JSON加载类型定义
   */
  loadFromJSON(json: string): void {
    const typeDefs: MessageTypeDefinition[] = JSON.parse(json);
    typeDefs.forEach(t => this.register(t));
  }
  
  /**
   * 导出为JSON
   */
  exportToJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}

// 默认注册表实例
export const defaultRegistry = new TypeRegistry();

// 注册默认类型
defaultRegistry.register(BaseTicketType);
defaultRegistry.register(EmailTicketType);
defaultRegistry.register(ServerInquiryType);
defaultRegistry.register(StatusReportType);
defaultRegistry.register(ProcessRequestType);
defaultRegistry.register(AnalysisNoteType);
defaultRegistry.register(EnvironmentInfoType);
