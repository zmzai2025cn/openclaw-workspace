/**
 * 运维工单消息类型定义
 * 针对中国海油邮件系统运维群的消息特点设计
 */

// 基础消息类型
export interface ChatMessage {
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
  
  // 消息类型识别
  messageType: 'ticket_create' | 'ticket_update' | 'ticket_merge' | 
               'status_report' | 'tech_inquiry' | 'process_request' | 
               'analysis_note' | 'env_info' | 'general';
  
  // 解析后的结构化数据
  parsedData?: TicketData | StatusData | TechData | ProcessData | AnalysisData;
  
  // 元数据
  metadata: {
    // 原始消息属性
    hasImage: boolean;
    hasAttachment: boolean;
    mentionedUsers: string[];
    
    // 业务属性
    isSystemMessage: boolean;
    isForwarded: boolean;
    
    // 解析置信度
    parseConfidence: number;
  };
}

// ==================== 工单相关 ====================

/**
 * 工单创建/上报
 */
export interface TicketData {
  ticketType: 'create' | 'update';
  
  // 标准化工单字段
  severity?: 'P0' | 'P1' | 'P2' | 'P3' | 'unknown';
  systemName: string;
  occurrenceTime: Date;
  phenomenon: string;
  impactScope: 'personal' | 'department' | 'company' | 'unknown';
  reporter: {
    name: string;
    username: string;
    contact?: string;
  };
  
  // 临时处理
  temporaryAction?: string;
  
  // 关联信息
  ticketId?: string;           // 工单号，如 HY-20260205-2
  relatedTickets?: string[];   // 关联工单
  
  // 技术信息
  serverInfo?: {
    ip?: string;
    hostname?: string;
    isGrayRelease?: boolean;
  };
  
  // 环境信息
  environment?: {
    osVersion?: string;
    clientVersion?: string;
    isTrustedComputer?: boolean;
  };
}

/**
 * 工单合并
 */
export interface TicketMergeData {
  mergeType: 'merge';
  sourceTicketId: string;
  targetTicketId: string;
  mergedBy: string;
  reason: string;
}

// ==================== 状态报告 ====================

/**
 * 系统状态报告
 */
export interface StatusData {
  reportType: 'system_status' | 'component_status' | 'daily_check';
  
  // 系统状态
  systemStatus: 'normal' | 'abnormal' | 'degraded';
  
  // 各组件状态
  components: Array<{
    name: string;
    status: 'normal' | 'abnormal';
    details?: string;
  }>;
  
  // 报告时间范围
  reportTime?: Date;
  
  // 特殊通知
  notifications?: Array<{
    type: string;
    status: string;
  }>;
}

// ==================== 技术询问 ====================

/**
 * 技术询问/确认
 */
export interface TechData {
  inquiryType: 'server_confirm' | 'version_confirm' | 'config_confirm';
  
  // 服务器信息
  server?: {
    ip: string;
    hostname: string;
    domain?: string;
    isGrayRelease?: boolean;
  };
  
  // 询问对象
  askedPersons: string[];
  
  // 上下文
  context?: string;
}

// ==================== 流程要求 ====================

/**
 * 流程/文档要求
 */
export interface ProcessData {
  requestType: 'test_report' | 'test_case' | 'document' | 'verification';
  
  // 要求详情
  requirements: string[];
  
  // 交付物
  deliverables: Array<{
    name: string;
    description: string;
    mandatory: boolean;
  }>;
  
  // 负责人
  assignee: string;
  
  // 截止时间
  deadline?: Date;
  
  // 关联工单/项目
  relatedTicket?: string;
}

// ==================== 分析记录 ====================

/**
 * 问题分析/归类
 */
export interface AnalysisData {
  analysisType: 'similar_issue' | 'root_cause' | 'material_collection';
  
  // 分析结论
  conclusion: string;
  
  // 关联问题
  relatedIssues: Array<{
    ticketId: string;
    similarity: string;
  }>;
  
  // 下一步行动
  nextActions: Array<{
    action: string;
    assignee: string;
    timeline: string;
  }>;
  
  // 用于分析的素材
  materials?: string[];
}

// ==================== 环境信息 ====================

/**
 * 环境/配置信息
 */
export interface EnvironmentData {
  infoType: 'os_version' | 'software_version' | 'hardware_info';
  
  // 操作系统
  os?: {
    name: string;
    version: string;
    arch?: string;
    isTrustedComputer?: boolean;
  };
  
  // 软件版本
  software?: Array<{
    name: string;
    version: string;
  }>;
  
  // 关联用户
  relatedUser?: string;
}

// ==================== 查询接口 ====================

/**
 * 工单查询条件
 */
export interface TicketQuery {
  // 时间范围
  startTime?: Date;
  endTime?: Date;
  
  // 工单属性
  systemName?: string;
  severity?: string[];
  status?: string[];
  reporter?: string;
  
  // 内容搜索
  keyword?: string;
  phenomenon?: string;
  
  // 关联查询
  ticketId?: string;
  relatedTo?: string;
  
  // 分页
  limit?: number;
  offset?: number;
}

/**
 * 统计分析查询
 */
export interface StatsQuery {
  // 统计维度
  groupBy: 'system' | 'severity' | 'reporter' | 'day' | 'week' | 'month';
  
  // 时间范围
  startTime: Date;
  endTime: Date;
  
  // 过滤
  systemName?: string;
}

// ==================== 扩展元数据 ====================

/**
 * 消息血缘（用于追踪消息流转）
 */
export interface MessageLineage {
  messageId: string;
  
  // 来源
  source: {
    system: string;
    channel: string;
    timestamp: Date;
  };
  
  // 处理历史
  processing: Array<{
    stage: string;
    system: string;
    timestamp: Date;
    transform: string;
  }>;
  
  // 下游消费
  consumers: Array<{
    system: string;
    consumedAt: Date;
    purpose: string;
  }>;
}

/**
 * 会话上下文（用于关联同一事件的多条消息）
 */
export interface SessionContext {
  sessionId: string;
  
  // 会话主题
  topic: string;
  
  // 关联工单
  ticketId?: string;
  
  // 参与人员
  participants: string[];
  
  // 会话状态
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  
  // 消息时间范围
  startTime: Date;
  endTime?: Date;
  
  // 消息列表
  messageIds: string[];
}
