/**
 * 插件化消息解析器
 * 支持动态扩展解析规则
 */

import {
  FlexibleMessage,
  MessageTypeDefinition,
  FieldDefinition,
  TypeRegistry,
  defaultRegistry,
} from './flexible-types';

/**
 * 字段转换函数注册表
 */
export const transforms: Record<string, (value: string) => any> = {
  // 解析中文日期
  parseChineseDate: (value: string): Date => {
    const patterns = [
      { regex: /(\d{2,4})年(\d{1,2})月(\d{1,2})日(\d{1,2})时(\d{1,2})分/, fields: ['year', 'month', 'day', 'hour', 'minute'] },
      { regex: /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/, fields: ['year', 'month', 'day', 'hour', 'minute'] },
      { regex: /(\d{4})年(\d{2})月(\d{2})日/, fields: ['year', 'month', 'day'] },
    ];
    
    for (const { regex, fields } of patterns) {
      const match = value.match(regex);
      if (match) {
        const year = match[1].length === 2 ? 2000 + parseInt(match[1]) : parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hour = fields.includes('hour') ? parseInt(match[4] || '0') : 0;
        const minute = fields.includes('minute') ? parseInt(match[5] || '0') : 0;
        return new Date(year, month, day, hour, minute);
      }
    }
    
    return new Date();
  },
  
  // 解析人员信息
  parseReporter: (value: string): { name: string; username: string } => {
    const patterns = [
      /(\S+?)\s*[(（](\S+?)[)）]/,  // 姓名(username)
      /(\S+?)\s+(\S+)/,              // 姓名 username
      /(\S+?)(\S+)/,                 // 姓名username
    ];
    
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) {
        return { name: match[1], username: match[2] };
      }
    }
    
    return { name: value, username: value };
  },
  
  // 解析影响范围
  parseImpactScope: (value: string): string => {
    const map: Record<string, string> = {
      '个人': 'personal',
      '部门': 'department',
      '公司': 'company',
      '外部': 'external',
    };
    return map[value] || 'unknown';
  },
  
  // 解析布尔值
  parseBoolean: (value: string): boolean => {
    return value !== undefined && value !== null && value !== '';
  },
  
  // 解析数组（从匹配结果）
  parseArray: (value: string): string[] => {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  },
};

/**
 * 插件化解析器
 */
export class FlexibleParser {
  private registry: TypeRegistry;
  private customParsers: Map<string, CustomParser> = new Map();
  
  constructor(registry: TypeRegistry = defaultRegistry) {
    this.registry = registry;
  }
  
  /**
   * 注册自定义解析器
   */
  registerCustomParser(type: string, parser: CustomParser): void {
    this.customParsers.set(type, parser);
  }
  
  /**
   * 解析消息
   */
  parse(message: FlexibleMessage): FlexibleMessage {
    const content = message.content;
    
    // 1. 检测消息类型
    const { type, confidence } = this.detectType(content);
    message.messageType = type;
    message.messageCategory = this.registry.get(type)?.category || 'other';
    
    // 2. 获取类型定义
    const typeDef = this.registry.get(type);
    
    // 3. 解析数据
    if (typeDef) {
      // 优先使用自定义解析器
      const customParser = this.customParsers.get(type);
      if (customParser) {
        message.parsedData = customParser.parse(content, typeDef);
      } else {
        message.parsedData = this.parseWithDefinition(content, typeDef);
      }
    }
    
    // 4. 填充元数据
    message.metadata = {
      hasImage: this.hasImage(content),
      hasAttachment: this.hasAttachment(content),
      hasLink: this.hasLink(content),
      mentionedUsers: this.extractMentions(content),
      isSystemMessage: this.isSystemMessage(content),
      isForwarded: this.isForwarded(content),
      isReply: !!message.replyTo,
      parseConfidence: confidence,
      parserVersion: '2.0.0',
      parserName: customParser ? 'custom' : 'default',
    };
    
    // 5. 保留原始信息
    message.raw = {
      content,
      attachments: this.extractAttachments(content),
      mentions: this.extractMentions(content),
    };
    
    return message;
  }
  
  /**
   * 检测消息类型
   */
  private detectType(content: string): { type: string; confidence: number } {
    const types = this.registry.getAll();
    let bestMatch = { type: 'general', confidence: 0 };
    
    for (const typeDef of types) {
      let score = 0;
      
      // 正则匹配
      for (const pattern of typeDef.detection.patterns) {
        if (new RegExp(pattern, 'i').test(content)) {
          score += 0.4;
        }
      }
      
      // 关键词匹配
      for (const keyword of typeDef.detection.keywords) {
        if (content.includes(keyword)) {
          score += 0.3;
        }
      }
      
      // 归一化分数
      score = Math.min(score, 1);
      
      if (score > bestMatch.confidence && score >= typeDef.detection.score) {
        bestMatch = { type: typeDef.type, confidence: score };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * 根据类型定义解析
   */
  private parseWithDefinition(
    content: string,
    typeDef: MessageTypeDefinition
  ): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const field of typeDef.fields) {
      const value = this.extractField(content, field);
      if (value !== undefined) {
        result[field.name] = value;
      } else if (field.required && field.default !== undefined) {
        result[field.name] = field.default;
      }
    }
    
    return result;
  }
  
  /**
   * 提取字段值
   */
  private extractField(content: string, field: FieldDefinition): any {
    if (!field.extraction) return undefined;
    
    // 尝试所有匹配模式
    for (const pattern of field.extraction.patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = Array.from(content.matchAll(regex));
      
      if (matches.length > 0) {
        const values = matches.map(m => m[1] || m[0]).filter(Boolean);
        
        if (values.length === 0) continue;
        
        // 根据字段类型处理
        let result: any;
        
        if (field.type === 'array') {
          result = values;
        } else if (field.type === 'date') {
          const rawValue = values[0];
          result = field.extraction.transform
            ? transforms[field.extraction.transform]?.(rawValue)
            : transforms.parseChineseDate(rawValue);
        } else if (field.type === 'object' && field.extraction.transform) {
          result = transforms[field.extraction.transform]?.(values[0]);
        } else if (field.type === 'boolean') {
          result = true; // 匹配到即true
        } else if (field.type === 'enum') {
          result = values[0];
          // 映射为标准值
          if (field.name === 'impactScope') {
            result = transforms.parseImpactScope(result);
          }
        } else {
          result = values[0];
        }
        
        return result;
      }
    }
    
    return undefined;
  }
  
  // ==================== 辅助方法 ====================
  
  private hasImage(content: string): boolean {
    return /\[图片\]|!\[.*?\]\(.*?\)/i.test(content);
  }
  
  private hasAttachment(content: string): boolean {
    return /\[文件\]|attachment/i.test(content);
  }
  
  private hasLink(content: string): boolean {
    return /https?:\/\/\S+/i.test(content);
  }
  
  private extractMentions(content: string): string[] {
    const matches = content.matchAll(/@(\S+)/g);
    return Array.from(new Set(Array.from(matches).map(m => m[1])));
  }
  
  private extractAttachments(content: string): any[] {
    const attachments: any[] = [];
    
    // 图片
    const imageMatches = content.matchAll(/\[图片\]/g);
    for (const _ of imageMatches) {
      attachments.push({ type: 'image' });
    }
    
    // 文件
    const fileMatches = content.matchAll(/\[文件\]\s*(.+?)(?:\n|$)/g);
    for (const match of fileMatches) {
      attachments.push({ type: 'file', name: match[1] });
    }
    
    return attachments;
  }
  
  private isSystemMessage(content: string): boolean {
    return /^-\s*\S+[:：]/.test(content) ||
           content.includes('系统名称：') ||
           content.includes('工单号：');
  }
  
  private isForwarded(content: string): boolean {
    return content.includes('转发') || content.includes('Forwarded');
  }
}

/**
 * 自定义解析器接口
 */
export interface CustomParser {
  parse(content: string, typeDef: MessageTypeDefinition): Record<string, any>;
}

/**
 * 批量解析
 */
export function parseBatch(
  messages: FlexibleMessage[],
  parser: FlexibleParser = new FlexibleParser()
): FlexibleMessage[] {
  return messages.map(m => parser.parse(m));
}

/**
 * 从JSON加载类型并解析
 */
export function parseWithCustomTypes(
  messages: FlexibleMessage[],
  typeDefinitionsJson: string
): FlexibleMessage[] {
  const registry = new TypeRegistry();
  registry.loadFromJSON(typeDefinitionsJson);
  
  const parser = new FlexibleParser(registry);
  return parseBatch(messages, parser);
}
