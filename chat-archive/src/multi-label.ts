/**
 * 多标签支持
 * 一条消息可属于多个类型
 */

import { MessageTypeDefinition } from './flexible-types';

/**
 * 多标签解析结果
 */
export interface MultiLabelResult {
  primaryType: string;           // 主类型
  primaryConfidence: number;     // 主类型置信度
  
  secondaryTypes: Array<{
    type: string;
    confidence: number;
    fields: Record<string, any>;
  }>;
  
  allLabels: string[];           // 所有标签
  mergedData: Record<string, any>; // 合并后的数据
}

/**
 * 多标签解析器
 */
export class MultiLabelParser {
  private typeDefinitions: Map<string, MessageTypeDefinition> = new Map();
  private threshold: number;
  
  constructor(threshold: number = 0.3) {
    this.threshold = threshold;
  }
  
  /**
   * 注册类型定义
   */
  registerType(typeDef: MessageTypeDefinition): void {
    this.typeDefinitions.set(typeDef.type, typeDef);
  }
  
  /**
   * 解析多标签
   */
  parse(content: string, scores: Map<string, number>): MultiLabelResult {
    // 1. 排序所有类型
    const sortedTypes = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // 2. 选择主类型（最高分）
    const [primaryType, primaryConfidence] = sortedTypes[0] || ['general', 0];
    
    // 3. 选择次要类型（超过阈值且不互斥）
    const secondaryTypes: MultiLabelResult['secondaryTypes'] = [];
    
    for (const [type, confidence] of sortedTypes.slice(1)) {
      if (confidence < this.threshold) break;
      if (this.isMutuallyExclusive(primaryType, type)) continue;
      
      const typeDef = this.typeDefinitions.get(type);
      if (typeDef) {
        const fields = this.extractFields(content, typeDef);
        secondaryTypes.push({ type, confidence, fields });
      }
    }
    
    // 4. 合并数据
    const mergedData = this.mergeData(
      primaryType,
      sortedTypes[0]?.[1] || 0,
      secondaryTypes
    );
    
    return {
      primaryType,
      primaryConfidence,
      secondaryTypes,
      allLabels: [primaryType, ...secondaryTypes.map(t => t.type)],
      mergedData,
    };
  }
  
  /**
   * 检查类型是否互斥
   */
  private isMutuallyExclusive(type1: string, type2: string): boolean {
    // 定义互斥规则
    const mutuallyExclusiveGroups = [
      ['ticket_create', 'ticket_merge', 'ticket_close'],
      ['status_normal', 'status_abnormal'],
    ];
    
    for (const group of mutuallyExclusiveGroups) {
      if (group.includes(type1) && group.includes(type2)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 提取字段
   */
  private extractFields(
    content: string,
    typeDef: MessageTypeDefinition
  ): Record<string, any> {
    const fields: Record<string, any> = {};
    
    for (const field of typeDef.fields) {
      if (!field.extraction) continue;
      
      for (const pattern of field.extraction.patterns) {
        const regex = new RegExp(pattern, 'i');
        const match = content.match(regex);
        
        if (match) {
          fields[field.name] = match[1] || match[0];
          break;
        }
      }
    }
    
    return fields;
  }
  
  /**
   * 合并多个类型的数据
   */
  private mergeData(
    primaryType: string,
    primaryConfidence: number,
    secondaryTypes: MultiLabelResult['secondaryTypes']
  ): Record<string, any> {
    const merged: Record<string, any> = {
      _primaryType: primaryType,
      _primaryConfidence: primaryConfidence,
      _allTypes: [primaryType, ...secondaryTypes.map(t => t.type)],
    };
    
    // 合并字段，主类型优先
    for (const { type, fields } of secondaryTypes) {
      for (const [key, value] of Object.entries(fields)) {
        if (!(key in merged)) {
          merged[key] = value;
          merged[`_${key}_source`] = type; // 记录来源
        }
      }
    }
    
    return merged;
  }
}

/**
 * 标签关系图
 * 定义标签之间的层级和关联关系
 */
export class LabelRelationGraph {
  private parentChild: Map<string, string[]> = new Map();
  private related: Map<string, string[]> = new Map();
  
  /**
   * 添加父子关系
   */
  addParentChild(parent: string, child: string): void {
    if (!this.parentChild.has(parent)) {
      this.parentChild.set(parent, []);
    }
    this.parentChild.get(parent)!.push(child);
  }
  
  /**
   * 添加关联关系
   */
  addRelated(type1: string, type2: string): void {
    if (!this.related.has(type1)) {
      this.related.set(type1, []);
    }
    this.related.get(type1)!.push(type2);
  }
  
  /**
   * 获取子类型
   */
  getChildren(parent: string): string[] {
    return this.parentChild.get(parent) || [];
  }
  
  /**
   * 获取关联类型
   */
  getRelated(type: string): string[] {
    return this.related.get(type) || [];
  }
  
  /**
   * 检查是否是子类型
   */
  isChildOf(child: string, parent: string): boolean {
    const children = this.parentChild.get(parent) || [];
    return children.includes(child);
  }
}

// 默认关系图
export const defaultLabelGraph = new LabelRelationGraph();

// 定义层级关系
defaultLabelGraph.addParentChild('ticket', 'email_ticket');
defaultLabelGraph.addParentChild('ticket', 'server_ticket');
defaultLabelGraph.addParentChild('ticket', 'network_ticket');

// 定义关联关系
defaultLabelGraph.addRelated('ticket_create', 'process_request');
defaultLabelGraph.addRelated('ticket_create', 'analysis_note');
defaultLabelGraph.addRelated('status_report', 'env_info');
