/**
 * 消息归档主类（生产级完整版）
 */

import { ChatMessage, ArchiveConfig, defaultConfig } from './types';
import { ArchiveDB } from './db';
import { BufferedWriter } from './buffer';
import { WAL } from './wal';
import { BackupManager, BackupConfig } from './backup';
import { HealthMonitor } from './health';
import { CleanupManager, CleanupConfig } from './cleanup';
import { Logger, initLogger, getLogger } from './logger';
import { checkDiskSpace, getDiskUsage, getMemoryUsage } from './system';

export interface ProductionConfig {
  archive?: Partial<ArchiveConfig>;
  backup?: Partial<BackupConfig>;
  cleanup?: Partial<CleanupConfig>;
  healthPort?: number;
  logFile?: string;
}

export class ChatArchive {
  private db: ArchiveDB;
  private wal: WAL;
  private writer: BufferedWriter;
  private backup: BackupManager;
  private cleanup: CleanupManager;
  private health: HealthMonitor;
  private logger: Logger;
  private config: ArchiveConfig;

  constructor(config: ProductionConfig = {}) {
    this.config = { ...defaultConfig, ...config.archive };
    
    // 初始化日志
    this.logger = initLogger({
      file: config.logFile || './logs/archive.log',
    });
    
    this.db = new ArchiveDB(this.config.dbPath);
    this.wal = new WAL(this.config.dbPath);
    this.writer = new BufferedWriter(this.db, this.wal, this.config);
    this.backup = new BackupManager(this.config.dbPath, config.backup || {});
    this.cleanup = new CleanupManager(this.db, config.cleanup || {});
    this.health = new HealthMonitor(config.healthPort || 8080);
  }

  /**
   * 初始化（含WAL恢复、磁盘检查）
   */
  async init(): Promise<void> {
    this.logger.info('Initializing ChatArchive...');
    
    // 检查磁盘空间
    if (!checkDiskSpace(this.config.dbPath, 95)) {
      this.logger.error('Disk space critical', undefined, {
        usage: getDiskUsage(this.config.dbPath),
      });
      throw new Error('Disk space critical');
    }
    
    // 初始化WAL
    this.wal.init();
    
    // 初始化数据库
    await this.db.init();
    
    // 恢复未提交的WAL数据
    await this.recoverFromWAL();
    
    // 启动自动备份
    this.backup.start();
    
    // 启动自动清理
    this.cleanup.start();
    
    // 启动健康检查
    this.health.start(
      () => {
        const diskUsage = getDiskUsage(this.config.dbPath);
        const memUsage = getMemoryUsage();
        
        return {
          database: true,
          wal: true,
          buffer: {
            status: this.writer.getStatus().buffered < this.config.bufferSize,
            buffered: this.writer.getStatus().buffered,
          },
          disk: {
            status: diskUsage.usagePercent < 90,
            usage: diskUsage.usagePercent,
          },
          memory: {
            status: memUsage.usagePercent < 85,
            usage: memUsage.usagePercent,
          },
        };
      },
      () => ({
        messagesBuffered: this.writer.getStatus().buffered,
        diskUsage: getDiskUsage(this.config.dbPath).usagePercent,
        memoryUsage: getMemoryUsage().usagePercent,
      })
    );
    
    // 优雅关闭处理
    this.setupGracefulShutdown();
    
    this.logger.info('ChatArchive initialized successfully');
  }

  /**
   * 归档单条消息（带异常隔离）
   */
  async archive(message: ChatMessage): Promise<void> {
    try {
      this.health.recordMessage();
      await this.writer.add(message);
      this.logger.debug('Message archived', { messageId: message.id });
    } catch (err) {
      this.logger.error('Failed to archive message', err as Error, {
        messageId: message.id,
      });
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 归档多条消息（带异常隔离）
   */
  async archiveBatch(messages: ChatMessage[]): Promise<void> {
    const failed: ChatMessage[] = [];
    
    for (const msg of messages) {
      try {
        this.health.recordMessage();
        await this.writer.add(msg);
      } catch (err) {
        failed.push(msg);
        this.logger.error('Failed to archive message in batch', err as Error, {
          messageId: msg.id,
        });
      }
    }
    
    if (failed.length > 0) {
      this.logger.warn('Batch archive partial failure', {
        total: messages.length,
        failed: failed.length,
      });
    }
  }

  /**
   * 查询消息（时间范围）
   */
  async queryByTimeRange(
    start: Date,
    end: Date,
    chatId?: string
  ): Promise<ChatMessage[]> {
    const startTime = Date.now();
    try {
      const result = await this.db.queryByTimeRange(start, end, chatId);
      this.health.recordQuery(Date.now() - startTime);
      return result;
    } catch (err) {
      this.logger.error('Query failed', err as Error, { start, end, chatId });
      throw err;
    }
  }

  /**
   * 搜索消息内容
   */
  async search(keyword: string, limit?: number): Promise<ChatMessage[]> {
    const startTime = Date.now();
    try {
      const result = await this.db.searchContent(keyword, limit);
      this.health.recordQuery(Date.now() - startTime);
      return result;
    } catch (err) {
      this.logger.error('Search failed', err as Error, { keyword });
      throw err;
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    return this.db.getStats();
  }

  /**
   * 获取状态
   */
  getStatus() {
    const diskUsage = getDiskUsage(this.config.dbPath);
    return {
      ...this.writer.getStatus(),
      dbPath: this.config.dbPath,
      dbSizeMB: Math.round(diskUsage.used / 1024 / 1024),
      diskUsagePercent: diskUsage.usagePercent,
      backups: this.backup.listBackups().length,
    };
  }

  /**
   * 手动触发备份
   */
  async backupNow(): Promise<string> {
    const path = await this.backup.performBackup();
    this.health.recordBackup();
    this.logger.info('Manual backup completed', { path });
    return path;
  }

  /**
   * 手动触发清理
   */
  async cleanupNow(): Promise<{ deleted: number; archived: number }> {
    const result = await this.cleanup.performCleanup();
    this.logger.info('Manual cleanup completed', result);
    return result;
  }

  /**
   * 列出备份
   */
  listBackups() {
    return this.backup.listBackups();
  }

  /**
   * 从备份恢复
   */
  async restore(backupName: string): Promise<void> {
    this.logger.info('Restoring from backup', { backupName });
    await this.backup.restore(backupName);
    this.logger.info('Restore completed');
  }

  /**
   * 关闭归档器
   */
  async close(): Promise<void> {
    this.logger.info('Closing ChatArchive gracefully...');
    
    // 停止健康检查
    this.health.stop();
    
    // 停止自动备份
    this.backup.stop();
    
    // 停止自动清理
    this.cleanup.stop();
    
    // 强制刷新缓冲区
    await this.writer.close();
    
    // 关闭WAL
    this.wal.close();
    
    // 关闭数据库
    this.db.close();
    
    // 关闭日志
    this.logger.close();
    
    console.log('[Archive] Closed');
  }

  /**
   * 从WAL恢复未提交数据
   */
  private async recoverFromWAL(): Promise<void> {
    const uncommitted = await this.wal.readUncommitted();
    if (uncommitted.length > 0) {
      this.logger.info(`Recovering ${uncommitted.length} messages from WAL`);
      await this.db.insertBatch(uncommitted);
      this.wal.clear();
      this.logger.info('WAL recovery completed');
    }
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      this.logger.error('Uncaught exception', err);
      shutdown('uncaughtException');
    });
  }
}
