/**
 * 反馈学习与模型优化
 */

import { FlexibleMessage } from './flexible-types';
import { MessageTypeDefinition } from './flexible-types';

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  id: string;
  timestamp: Date;
  messageId: string;
  
  // 原始解析结果
  originalType: string;
  originalConfidence: number;
  originalFields: Record<string, any>;
  
  // 人工修正
  correctedType?: string;
  correctedFields?: Record<string, any>;
  isCorrect: boolean;  // 原始结果是否正确
  
  // 反馈来源
  source: 'user' | 'admin' | 'system';
  userId?: string;
  
  // 备注
  notes?: string;
}

/**
 * 反馈管理器
 */
export class FeedbackManager {
  private feedbacks: FeedbackRecord[] = [];
  private storage: FeedbackStorage;
  
  constructor(storage: FeedbackStorage = new MemoryFeedbackStorage()) {
    this.storage = storage;
  }
  
  /**
   * 提交反馈
   */
  async submitFeedback(feedback: Omit<FeedbackRecord, 'id' | 'timestamp'>): Promise<void> {
    const record: FeedbackRecord = {
      ...feedback,
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    await this.storage.save(record);
    this.feedbacks.push(record);
  }
  
  /**
   * 标记正确
   */
  async markCorrect(messageId: string, userId?: string): Promise<void> {
    // 查找原始解析结果
    const original = await this.getOriginalParse(messageId);
    if (!original) return;
    
    await this.submitFeedback({
      messageId,
      originalType: original.type,
      originalConfidence: original.confidence,
      originalFields: original.fields,
      isCorrect: true,
      source: userId ? 'user' : 'system',
      userId,
    });
  }
  
  /**
   * 提交修正
   */
  async submitCorrection(
    messageId: string,
    correctedType: string,
    correctedFields: Record<string, any>,
    userId?: string,
    notes?: string
  ): Promise<void> {
    const original = await this.getOriginalParse(messageId);
    if (!original) return;
    
    await this.submitFeedback({
      messageId,
      originalType: original.type,
      originalConfidence: original.confidence,
      originalFields: original.fields,
      correctedType,
      correctedFields,
      isCorrect: false,
      source: userId ? 'user' : 'admin',
      userId,
      notes,
    });
  }
  
  /**
   * 获取统计
   */
  async getStats(): Promise<{
    totalFeedback: number;
    accuracy: number;
    typeAccuracy: Record<string, number>;
    fieldAccuracy: Record<string, number>;
  }> {
    const feedbacks = await this.storage.getAll();
    
    const total = feedbacks.length;
    const correct = feedbacks.filter(f => f.isCorrect).length;
    
    // 按类型统计
    const typeStats: Record<string, { correct: number; total: number }> = {};
    for (const fb of feedbacks) {
      if (!typeStats[fb.originalType]) {
        typeStats[fb.originalType] = { correct: 0, total: 0 };
      }
      typeStats[fb.originalType].total++;
      if (fb.isCorrect) {
        typeStats[fb.originalType].correct++;
      }
    }
    
    const typeAccuracy: Record<string, number> = {};
    for (const [type, stats] of Object.entries(typeStats)) {
      typeAccuracy[type] = stats.total > 0 ? stats.correct / stats.total : 0;
    }
    
    return {
      totalFeedback: total,
      accuracy: total > 0 ? correct / total : 0,
      typeAccuracy,
      fieldAccuracy: {}, // TODO: 字段级统计
    };
  }
  
  /**
   * 获取改进建议
   */
  async getImprovementSuggestions(): Promise<{
    lowAccuracyTypes: string[];
    patternSuggestions: PatternSuggestion[];
  }> {
    const stats = await this.getStats();
    
    // 找出准确率低的类型
    const lowAccuracyTypes = Object.entries(stats.typeAccuracy)
      .filter(([_, acc]) => acc < 0.8)
      .map(([type, _]) => type);
    
    // 分析错误模式，生成建议
    const patternSuggestions = await this.analyzeErrorPatterns();
    
    return {
      lowAccuracyTypes,
      patternSuggestions,
    };
  }
  
  /**
   * 分析错误模式
   */
  private async analyzeErrorPatterns(): Promise<PatternSuggestion[]> {
    const feedbacks = await this.storage.getAll();
    const incorrectFeedbacks = feedbacks.filter(f => !f.isCorrect);
    
    const suggestions: PatternSuggestion[] = [];
    
    // 分析类型混淆
    const confusionMatrix: Record<string, Record<string, number>> = {};
    for (const fb of incorrectFeedbacks) {
      if (fb.correctedType) {
        const from = fb.originalType;
        const to = fb.correctedType;
        
        if (!confusionMatrix[from]) confusionMatrix[from] = {};
        confusionMatrix[from][to] = (confusionMatrix[from][to] || 0) + 1;
      }
    }
    
    // 生成建议
    for (const [fromType, targets] of Object.entries(confusionMatrix)) {
      for (const [toType, count] of Object.entries(targets)) {
        if (count >= 3) { // 出现3次以上
          suggestions.push({
            type: 'confusion',
            fromType,
            toType,
            count,
            suggestion: `类型"${fromType}"经常被误判为"${toType}"，建议调整识别规则`,
          });
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * 获取原始解析结果
   */
  private async getOriginalParse(messageId: string): Promise<{
    type: string;
    confidence: number;
    fields: Record<string, any>;
  } | null> {
    // 从消息存储中查询
    // TODO: 实现查询逻辑
    return null;
  }
}

/**
 * 模式建议
 */
interface PatternSuggestion {
  type: 'confusion' | 'missing_pattern' | 'field_error';
  fromType?: string;
  toType?: string;
  fieldName?: string;
  count: number;
  suggestion: string;
}

/**
 * 反馈存储接口
 */
export interface FeedbackStorage {
  save(record: FeedbackRecord): Promise<void>;
  getAll(): Promise<FeedbackRecord[]>;
  getByMessageId(messageId: string): Promise<FeedbackRecord | null>;
}

/**
 * 内存存储（开发用）
 */
export class MemoryFeedbackStorage implements FeedbackStorage {
  private records: FeedbackRecord[] = [];
  
  async save(record: FeedbackRecord): Promise<void> {
    this.records.push(record);
  }
  
  async getAll(): Promise<FeedbackRecord[]> {
    return [...this.records];
  }
  
  async getByMessageId(messageId: string): Promise<FeedbackRecord | null> {
    return this.records.find(r => r.messageId === messageId) || null;
  }
}

/**
 * 自动优化器
 * 基于反馈自动优化解析规则
 */
export class AutoOptimizer {
  private feedbackManager: FeedbackManager;
  
  constructor(feedbackManager: FeedbackManager) {
    this.feedbackManager = feedbackManager;
  }
  
  /**
   * 生成优化后的类型定义
   */
  async optimizeTypeDefinition(
    typeDef: MessageTypeDefinition
  ): Promise<MessageTypeDefinition> {
    const suggestions = await this.feedbackManager.getImprovementSuggestions();
    
    const optimized = { ...typeDef };
    
    // 针对该类型的建议
    const typeSuggestions = suggestions.patternSuggestions.filter(
      s => s.fromType === typeDef.type
    );
    
    for (const suggestion of typeSuggestions) {
      if (suggestion.type === 'confusion') {
        // 增强区分特征
        optimized.detection.keywords.push(
          ...this.generateDistinguishingKeywords(typeDef.type, suggestion.toType!)
        );
      }
    }
    
    return optimized;
  }
  
  /**
   * 生成区分关键词
   */
  private generateDistinguishingKeywords(type1: string, type2: string): string[] {
    // 基于历史数据找出能区分两个类型的关键词
    // TODO: 实现基于TF-IDF的关键词提取
    return [];
  }
}
