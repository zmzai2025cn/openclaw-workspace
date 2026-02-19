/**
 * 优化后的归档系统主类
 * 集成所有优化功能
 */

import { ChatMessage, ArchiveConfig, defaultConfig } from './types';
import { ArchiveDB } from './db';
import { BufferedWriter } from './buffer';
import { WAL } from './wal';
import { BackupManager, BackupConfig } from './backup';
import { HealthMonitor } from './health';
import { CleanupManager, CleanupConfig } from './cleanup';
import { Logger, initLogger } from './logger';
import { checkDiskSpace, getDiskUsage, getMemoryUsage } from './system';
import { loadConfig, AppConfig } from './config';

// 新增优化模块
import { FlexibleMessage, MessageTypeDefinition } from './flexible-types';
import { TypeRegistry, defaultRegistry } from './flexible-types';
import { FlexibleParser } from './flexible-parser';
import { InvertedIndex, ParseCache } from './index-system';
import { MultiLabelParser, MultiLabelResult } from './multi-label';
import { SessionManager, Session } from './session-manager';
import { EventBus, NotificationManager, MessageStreamProcessor, globalEventBus } from './event-bus';
import { DataMasker, AccessControl, RetentionPolicy } from './privacy';
import { FeedbackManager, AutoOptimizer } from './feedback-learning';

export interface OptimizedConfig {
  archive?: Partial<ArchiveConfig>;
  backup?: Partial<BackupConfig>;
  cleanup?: Partial<CleanupConfig>;
  healthPort?: number;
  logFile?: string;
  
  // 新增优化配置
  enableMultiLabel?: boolean;        // 启用多标签
  enableSessionTracking?: boolean;   // 启用会话追踪
  enablePrivacyMask?: boolean;       // 启用数据脱敏
  enableFeedback?: boolean;          // 启用反馈学习
  enableNotifications?: boolean;     // 启用通知
  
  // 性能配置
  cacheSize?: number;
  sessionTimeout?: number;
}

export class OptimizedChatArchive {
  // 基础组件
  private db: ArchiveDB;
  private wal: WAL;
  private writer: BufferedWriter;
  private backup: BackupManager;
  private cleanup: CleanupManager;
  private health: HealthMonitor;
  private logger: Logger;
  private config: ArchiveConfig;
  
  // 优化组件
  private typeRegistry: TypeRegistry;
  private invertedIndex: InvertedIndex;
  private parseCache: ParseCache;
  private flexibleParser: FlexibleParser;
  private multiLabelParser: MultiLabelParser;
  private sessionManager: SessionManager;
  private eventBus: EventBus;
  private notificationManager: NotificationManager;
  private streamProcessor: MessageStreamProcessor;
  private dataMasker: DataMasker;
  private accessControl: AccessControl;
  private retentionPolicy: RetentionPolicy;
  private feedbackManager: FeedbackManager;
  private autoOptimizer: AutoOptimizer;
  
  // 配置
  private optimizedConfig: OptimizedConfig;

  constructor(config: OptimizedConfig = {}) {
    this.optimizedConfig = config;
    this.config = { ...defaultConfig, ...config.archive };
    
    // 初始化日志
    this.logger = initLogger({
      file: config.logFile || './logs/archive.log',
    });
    
    // 基础组件
    this.db = new ArchiveDB(this.config.dbPath);
    this.wal = new WAL(this.config.dbPath);
    this.writer = new BufferedWriter(this.db, this.wal, this.config);
    this.backup = new BackupManager(this.config.dbPath, config.backup || {});
    this.cleanup = new CleanupManager(this.db, config.cleanup || {});
    this.health = new HealthMonitor(config.healthPort || 8080);
    
    // 优化组件
    this.typeRegistry = defaultRegistry;
    this.invertedIndex = new InvertedIndex();
    this.parseCache = new ParseCache(config.cacheSize || 10000);
    this.flexibleParser = new FlexibleParser(this.typeRegistry);
    this.multiLabelParser = new MultiLabelParser();
    this.sessionManager = new SessionManager(config.sessionTimeout || 30 * 60 * 1000);
    this.eventBus = globalEventBus;
    this.notificationManager = new NotificationManager(this.eventBus);
    this.streamProcessor = new MessageStreamProcessor(this.eventBus);
    this.dataMasker = new DataMasker();
    this.accessControl = new AccessControl();
    this.retentionPolicy = new RetentionPolicy();
    this.feedbackManager = new FeedbackManager();
    this.autoOptimizer = new AutoOptimizer(this.feedbackManager);
    
    // 注册所有类型到多标签解析器
    for (const typeDef of this.typeRegistry.getAll()) {
      this.multiLabelParser.registerType(typeDef);
    }
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    this.logger.info('Initializing OptimizedChatArchive...');
    
    // 构建倒排索引
    this.invertedIndex.buildIndex(this.typeRegistry.getAll());
    this.logger.info(`Built inverted index for ${this.typeRegistry.getAll().length} types`);
    
    // 基础初始化
    if (!checkDiskSpace(this.config.dbPath, 95)) {
      this.logger.error('Disk space critical');
      throw new Error('Disk space critical');
    }
    
    this.wal.init();
    await this.db.init();
    await this.recoverFromWAL();
    
    this.backup.start();
    this.cleanup.start();
    
    // 启动健康检查
    this.health.start(
      () => ({
        database: true,
        wal: true,
        buffer: {
          status: this.writer.getStatus().buffered < this.config.bufferSize,
          buffered: this.writer.getStatus().buffered,
        },
        disk: {
          status: getDiskUsage(this.config.dbPath).usagePercent < 90,
          usage: getDiskUsage(this.config.dbPath).usagePercent,
        },
        memory: {
          status: getMemoryUsage().usagePercent < 85,
          usage: getMemoryUsage().usagePercent,
        },
      }),
      () => ({
        messagesBuffered: this.writer.getStatus().buffered,
        diskUsage: getDiskUsage(this.config.dbPath).usagePercent,
        memoryUsage: getMemoryUsage().usagePercent,
      })
    );
    
    this.setupGracefulShutdown();
    this.logger.info('OptimizedChatArchive initialized');
  }

  /**
   * 归档消息（优化版）
   */
  async archive(message: FlexibleMessage): Promise<{
    session: Session;
    parsed: MultiLabelResult;
  }> {
    try {
      // 1. 检查缓存
      const cacheKey = `parse_${message.id}`;
      let parsedResult = this.parseCache.get(cacheKey);
      
      if (!parsedResult) {
        // 2. 使用倒排索引快速检测类型
        const scores = this.invertedIndex.query(message.content);
        
        // 3. 多标签解析
        parsedResult = this.multiLabelParser.parse(message.content, scores);
        
        // 4. 缓存结果
        this.parseCache.set(cacheKey, parsedResult);
      }
      
      // 5. 填充解析结果到消息
      message.messageType = parsedResult.primaryType;
      message.messageCategory = this.typeRegistry.get(parsedResult.primaryType)?.category || 'other';
      message.parsedData = parsedResult.mergedData;
      message.metadata = {
        hasImage: message.content.includes('[图片]'),
        hasAttachment: message.content.includes('[文件]'),
        hasLink: /https?:\/\//.test(message.content),
        mentionedUsers: this.extractMentions(message.content),
        isSystemMessage: /^-\s*\S+[:：]/.test(message.content),
        isForwarded: message.content.includes('转发'),
        isReply: !!message.replyTo,
        parseConfidence: parsedResult.primaryConfidence,
        parserVersion: '2.0.0',
        parserName: 'optimized',
      };
      
      // 6. 数据脱敏（如果启用）
      if (this.optimizedConfig.enablePrivacyMask) {
        message = this.dataMasker.maskMessage(message);
      }
      
      // 7. 关联会话
      const session = this.sessionManager.processMessage(message);
      
      // 8. 写入存储
      this.health.recordMessage();
      await this.writer.add(message as any);
      
      // 9. 实时流处理
      this.streamProcessor.process(message, session);
      
      return { session, parsed: parsedResult };
    } catch (err) {
      this.logger.error('Failed to archive message', err as Error);
      throw err;
    }
  }

  /**
   * 批量归档
   */
  async archiveBatch(messages: FlexibleMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.archive(msg);
    }
  }

  /**
   * 提交反馈
   */
  async submitFeedback(
    messageId: string,
    isCorrect: boolean,
    correctedType?: string,
    correctedFields?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    if (isCorrect) {
      await this.feedbackManager.markCorrect(messageId, userId);
    } else {
      await this.feedbackManager.submitCorrection(
        messageId,
        correctedType!,
        correctedFields!,
        userId
      );
    }
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * 获取消息所属的会话
   */
  getSessionByMessage(messageId: string): Session | undefined {
    return this.sessionManager.getSessionByMessage(messageId);
  }

  /**
   * 获取解析统计
   */
  async getParseStats(): Promise<{
    totalParsed: number;
    accuracy: number;
    typeDistribution: Record<string, number>;
  }> {
    const feedbackStats = await this.feedbackManager.getStats();
    
    return {
      totalParsed: feedbackStats.totalFeedback,
      accuracy: feedbackStats.accuracy,
      typeDistribution: {}, // TODO: 从数据库统计
    };
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    return this.sessionManager.getStats();
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    this.logger.info('Closing...');
    
    this.health.stop();
    this.backup.stop();
    this.cleanup.stop();
    await this.writer.close();
    this.wal.close();
    this.db.close();
    this.logger.close();
    
    console.log('[Archive] Closed');
  }

  // ==================== 私有方法 ====================

  private async recoverFromWAL(): Promise<void> {
    const uncommitted = await this.wal.readUncommitted();
    if (uncommitted.length > 0) {
      this.logger.info(`Recovering ${uncommitted.length} messages from WAL`);
      await this.db.insertBatch(uncommitted as any);
      this.wal.clear();
      this.logger.info('WAL recovery completed');
    }
  }

  private extractMentions(content: string): string[] {
    const matches = content.matchAll(/@(\S+)/g);
    return Array.from(new Set(Array.from(matches).map(m => m[1])));
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down...`);
      await this.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
