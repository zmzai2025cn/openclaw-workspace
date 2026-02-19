/**
 * 数据脱敏与隐私保护
 */

import { FlexibleMessage } from './flexible-types';

/**
 * 敏感数据类型
 */
export type SensitiveType = 
  | 'phone'           // 手机号
  | 'idcard'          // 身份证号
  | 'email'           // 邮箱
  | 'bankcard'        // 银行卡号
  | 'ip'              // IP地址
  | 'password'        // 密码
  | 'token'           // 令牌
  | 'name';           // 人名

/**
 * 脱敏规则
 */
export interface MaskRule {
  type: SensitiveType;
  pattern: RegExp;
  mask: (match: string) => string;
  description: string;
}

/**
 * 默认脱敏规则
 */
export const defaultMaskRules: MaskRule[] = [
  {
    type: 'phone',
    pattern: /(\d{3})\d{4}(\d{4})/g,
    mask: (match) => match.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
    description: '手机号脱敏',
  },
  {
    type: 'idcard',
    pattern: /(\d{6})\d{8}(\d{4})/g,
    mask: (match) => match.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2'),
    description: '身份证号脱敏',
  },
  {
    type: 'email',
    pattern: /(\w{2})\w+(@\w+)/g,
    mask: (match) => match.replace(/(\w{2})\w+(@\w+)/, '$1***$2'),
    description: '邮箱脱敏',
  },
  {
    type: 'bankcard',
    pattern: /(\d{4})\d{8,12}(\d{4})/g,
    mask: (match) => match.replace(/(\d{4})\d{8,12}(\d{4})/, '$1 **** **** $2'),
    description: '银行卡号脱敏',
  },
  {
    type: 'ip',
    pattern: /(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}/g,
    mask: (match) => match.replace(/(\d{1,3}\.\d{1,3}\.)\d{1,3}\.\d{1,3}/, '$1*.*'),
    description: 'IP地址脱敏（保留前两位）',
  },
];

/**
 * 数据脱敏器
 */
export class DataMasker {
  private rules: MaskRule[];
  
  constructor(rules: MaskRule[] = defaultMaskRules) {
    this.rules = rules;
  }
  
  /**
   * 脱敏文本
   */
  mask(text: string): string {
    let masked = text;
    
    for (const rule of this.rules) {
      masked = masked.replace(rule.pattern, rule.mask);
    }
    
    return masked;
  }
  
  /**
   * 脱敏消息
   */
  maskMessage(message: FlexibleMessage): FlexibleMessage {
    const masked = { ...message };
    
    // 脱敏内容
    masked.content = this.mask(message.content);
    
    // 脱敏解析数据中的敏感字段
    if (masked.parsedData) {
      masked.parsedData = this.maskObject(masked.parsedData);
    }
    
    return masked;
  }
  
  /**
   * 递归脱敏对象
   */
  private maskObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.mask(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const masked: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        // 对特定字段名进行脱敏
        if (this.isSensitiveField(key)) {
          masked[key] = typeof value === 'string' ? this.mask(value) : value;
        } else {
          masked[key] = this.maskObject(value);
        }
      }
      return masked;
    }
    
    return obj;
  }
  
  /**
   * 判断字段是否敏感
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'phone', 'mobile', 'tel',
      'idcard', 'idCard', 'identity',
      'email', 'mail',
      'password', 'pwd', 'passwd',
      'token', 'secret', 'key',
    ];
    
    return sensitiveFields.some(f => 
      fieldName.toLowerCase().includes(f)
    );
  }
  
  /**
   * 添加自定义规则
   */
  addRule(rule: MaskRule): void {
    this.rules.push(rule);
  }
}

/**
 * 访问控制
 */
export class AccessControl {
  private permissions: Map<string, string[]> = new Map();
  
  /**
   * 设置用户权限
   */
  setPermissions(userId: string, permissions: string[]): void {
    this.permissions.set(userId, permissions);
  }
  
  /**
   * 检查权限
   */
  canAccess(userId: string, resource: string, action: string): boolean {
    const userPerms = this.permissions.get(userId) || [];
    const requiredPerm = `${resource}:${action}`;
    
    return userPerms.includes(requiredPerm) || userPerms.includes('admin');
  }
  
  /**
   * 过滤消息（只返回有权限查看的）
   */
  filterMessages(userId: string, messages: FlexibleMessage[]): FlexibleMessage[] {
    // 检查用户是否有敏感数据权限
    const canViewSensitive = this.canAccess(userId, 'message', 'view_sensitive');
    
    if (canViewSensitive) {
      return messages;
    }
    
    // 脱敏后返回
    const masker = new DataMasker();
    return messages.map(m => masker.maskMessage(m));
  }
}

/**
 * 数据保留策略
 */
export class RetentionPolicy {
  private defaultRetentionDays: number;
  private sensitiveRetentionDays: number;
  
  constructor(
    defaultDays: number = 90,
    sensitiveDays: number = 30
  ) {
    this.defaultRetentionDays = defaultDays;
    this.sensitiveRetentionDays = sensitiveDays;
  }
  
  /**
   * 检查数据是否过期
   */
  isExpired(timestamp: Date, isSensitive: boolean = false): boolean {
    const retentionDays = isSensitive 
      ? this.sensitiveRetentionDays 
      : this.defaultRetentionDays;
    
    const expirationDate = new Date(timestamp);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);
    
    return new Date() > expirationDate;
  }
  
  /**
   * 获取数据保留期限
   */
  getRetentionDays(isSensitive: boolean): number {
    return isSensitive ? this.sensitiveRetentionDays : this.defaultRetentionDays;
  }
}
