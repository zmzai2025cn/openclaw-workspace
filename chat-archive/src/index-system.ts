/**
 * 高性能索引系统
 * 使用倒排索引加速类型检测
 */

import { MessageTypeDefinition } from './flexible-types';

/**
 * 倒排索引项
 */
interface InvertedIndexEntry {
  type: string;
  score: number;
  patterns: string[];
}

/**
 * 倒排索引管理器
 */
export class InvertedIndex {
  private keywordIndex: Map<string, InvertedIndexEntry[]> = new Map();
  private patternIndex: Map<string, InvertedIndexEntry[]> = new Map();
  private allTypes: Set<string> = new Set();
  
  /**
   * 从类型定义构建索引
   */
  buildIndex(types: MessageTypeDefinition[]): void {
    this.keywordIndex.clear();
    this.patternIndex.clear();
    this.allTypes.clear();
    
    for (const typeDef of types) {
      this.allTypes.add(typeDef.type);
      
      // 索引关键词
      for (const keyword of typeDef.detection.keywords) {
        const entry: InvertedIndexEntry = {
          type: typeDef.type,
          score: 0.3,
          patterns: [],
        };
        
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, []);
        }
        this.keywordIndex.get(keyword)!.push(entry);
      }
      
      // 索引正则模式（提取关键特征）
      for (const pattern of typeDef.detection.patterns) {
        // 提取模式中的关键词特征
        const features = this.extractPatternFeatures(pattern);
        
        for (const feature of features) {
          const entry: InvertedIndexEntry = {
            type: typeDef.type,
            score: 0.4,
            patterns: [pattern],
          };
          
          if (!this.patternIndex.has(feature)) {
            this.patternIndex.set(feature, []);
          }
          this.patternIndex.get(feature)!.push(entry);
        }
      }
    }
  }
  
  /**
   * 快速查询候选类型
   */
  query(content: string): Map<string, number> {
    const scores = new Map<string, number>();
    
    // 1. 关键词匹配（O(1)）
    for (const [keyword, entries] of this.keywordIndex) {
      if (content.includes(keyword)) {
        for (const entry of entries) {
          scores.set(entry.type, (scores.get(entry.type) || 0) + entry.score);
        }
      }
    }
    
    // 2. 特征匹配（O(n)，n为特征数，通常<10）
    const contentFeatures = this.extractContentFeatures(content);
    for (const feature of contentFeatures) {
      const entries = this.patternIndex.get(feature);
      if (entries) {
        for (const entry of entries) {
          // 验证完整正则
          const fullMatch = entry.patterns.some(p => 
            new RegExp(p, 'i').test(content)
          );
          if (fullMatch) {
            scores.set(entry.type, (scores.get(entry.type) || 0) + entry.score);
          }
        }
      }
    }
    
    return scores;
  }
  
  /**
   * 提取模式特征
   * 从正则中提取可索引的关键词
   */
  private extractPatternFeatures(pattern: string): string[] {
    const features: string[] = [];
    
    // 提取字面量关键词
    const literals = pattern.match(/[\u4e00-\u9fa5a-zA-Z]+/g) || [];
    features.push(...literals.filter(w => w.length >= 2));
    
    // 提取特殊标记
    if (pattern.includes('\\d')) features.push('__NUMBER__');
    if (pattern.includes('\\w')) features.push('__WORD__');
    if (pattern.includes('@')) features.push('__EMAIL__');
    if (pattern.includes('HY-')) features.push('__TICKET__');
    
    return [...new Set(features)];
  }
  
  /**
   * 提取内容特征
   */
  private extractContentFeatures(content: string): string[] {
    const features: string[] = [];
    
    // 关键词
    const words = content.match(/[\u4e00-\u9fa5a-zA-Z]+/g) || [];
    features.push(...words.filter(w => w.length >= 2));
    
    // 特殊标记
    if (/\d/.test(content)) features.push('__NUMBER__');
    if (/\w+@\w+/.test(content)) features.push('__EMAIL__');
    if (/HY-\d{8}-\d+/.test(content)) features.push('__TICKET__');
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(content)) features.push('__IP__');
    
    return [...new Set(features)];
  }
  
  /**
   * 获取所有类型
   */
  getAllTypes(): string[] {
    return Array.from(this.allTypes);
  }
}

/**
 * 缓存管理器
 */
export class ParseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttl: number;
  
  constructor(maxSize: number = 10000, ttl: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }
  
  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // 检查过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  set(key: string, value: any): void {
    // LRU淘汰
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

interface CacheEntry {
  value: any;
  timestamp: number;
}
