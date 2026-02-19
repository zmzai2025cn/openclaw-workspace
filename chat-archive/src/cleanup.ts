/**
 * 数据清理策略
 */

import * as fs from 'fs';
import * as path from 'path';
import { ArchiveDB } from './db';

export interface CleanupConfig {
  enabled: boolean;
  retentionDays: number;        // 保留天数
  maxDbSizeMB: number;          // 最大数据库大小
  archiveOldData: boolean;      // 是否归档旧数据
  archiveDir?: string;          // 归档目录
}

export const defaultCleanupConfig: CleanupConfig = {
  enabled: true,
  retentionDays: 90,
  maxDbSizeMB: 1024, // 1GB
  archiveOldData: false,
};

export class CleanupManager {
  private db: ArchiveDB;
  private config: CleanupConfig;
  private timer: NodeJS.Timeout | null = null;

  constructor(db: ArchiveDB, config: Partial<CleanupConfig> = {}) {
    this.db = db;
    this.config = { ...defaultCleanupConfig, ...config };
  }

  /**
   * 启动自动清理
   */
  start(): void {
    if (!this.config.enabled) return;
    
    // 每天执行一次清理
    this.timer = setInterval(() => {
      this.performCleanup().catch(console.error);
    }, 24 * 60 * 60 * 1000);
    
    console.log(`[Cleanup] Auto cleanup started, retention: ${this.config.retentionDays} days`);
  }

  /**
   * 执行清理
   */
  async performCleanup(): Promise<{ deleted: number; archived: number }> {
    const result = { deleted: 0, archived: 0 };
    
    if (!this.config.enabled) return result;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      // 如果需要归档，先导出旧数据
      if (this.config.archiveOldData && this.config.archiveDir) {
        result.archived = await this.archiveOldData(cutoffDate);
      }

      // 删除过期数据
      result.deleted = await this.deleteOldData(cutoffDate);
      
      console.log(`[Cleanup] Deleted: ${result.deleted}, Archived: ${result.archived}`);
    } catch (err) {
      console.error('[Cleanup] Failed:', err);
    }

    return result;
  }

  /**
   * 归档旧数据
   */
  private async archiveOldData(cutoffDate: Date): Promise<number> {
    if (!this.config.archiveDir) return 0;
    
    // 确保归档目录存在
    if (!fs.existsSync(this.config.archiveDir)) {
      fs.mkdirSync(this.config.archiveDir, { recursive: true });
    }

    // 查询旧数据
    const oldMessages = await this.db.queryByTimeRange(
      new Date('1970-01-01'),
      cutoffDate
    );

    if (oldMessages.length === 0) return 0;

    // 按月份分组归档
    const grouped = this.groupByMonth(oldMessages);
    
    for (const [month, messages] of Object.entries(grouped)) {
      const archivePath = path.join(this.config.archiveDir, `archive_${month}.jsonl`);
      const lines = messages.map(m => JSON.stringify({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })).join('\n') + '\n';
      
      fs.appendFileSync(archivePath, lines);
    }

    return oldMessages.length;
  }

  /**
   * 删除旧数据
   */
  private async deleteOldData(cutoffDate: Date): Promise<number> {
    return this.db.deleteOldData(cutoffDate);
  }

  /**
   * 按月份分组
   */
  private groupByMonth(messages: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const msg of messages) {
      const month = msg.timestamp.toISOString().slice(0, 7); // YYYY-MM
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(msg);
    }
    
    return grouped;
  }

  /**
   * 检查数据库大小
   */
  checkDbSize(dbPath: string): { sizeMB: number; exceeds: boolean } {
    if (!fs.existsSync(dbPath)) {
      return { sizeMB: 0, exceeds: false };
    }
    
    const stats = fs.statSync(dbPath);
    const sizeMB = stats.size / (1024 * 1024);
    
    return {
      sizeMB,
      exceeds: sizeMB > this.config.maxDbSizeMB,
    };
  }

  /**
   * 停止自动清理
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
