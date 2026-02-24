/**
 * 备份管理
 * 定期备份 + 保留策略
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface BackupConfig {
  dbPath: string;
  backupDir: string;
  intervalHours: number;
  retentionDays: number;
}

export class BackupManager {
  private config: BackupConfig;
  private logger: Logger;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: BackupConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // 确保备份目录存在
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }
  }

  /**
   * 启动定期备份
   */
  start(): void {
    // 立即执行一次
    this.backup().catch(err => this.logger.error('Initial backup failed', err));
    
    // 定期执行
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.backup().catch(err => this.logger.error('Scheduled backup failed', err));
    }, intervalMs);
    
    this.logger.info(`Backup scheduled every ${this.config.intervalHours} hours`);
  }

  /**
   * 执行备份
   */
  async backup(): Promise<string | null> {
    // 检查数据库文件是否存在
    if (!fs.existsSync(this.config.dbPath)) {
      this.logger.info(`Database file not found, skipping backup: ${this.config.dbPath}`);
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.config.backupDir, `kimiclaw-${timestamp}.db`);
    
    try {
      // 复制数据库文件
      fs.copyFileSync(this.config.dbPath, backupFile);
      
      this.logger.info(`Backup created: ${backupFile}`);
      
      // 清理旧备份
      this.cleanupOldBackups();
      
      return backupFile;
    } catch (err) {
      this.logger.error('Backup failed', err as Error);
      // 不抛出错误，让服务继续运行
      return null;
    }
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(): void {
    try {
      const files = fs.readdirSync(this.config.backupDir);
      const now = Date.now();
      const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        const filePath = path.join(this.config.backupDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge) {
          fs.unlinkSync(filePath);
          this.logger.info(`Deleted old backup: ${file}`);
        }
      }
    } catch (err) {
      this.logger.error('Cleanup failed', err as Error);
    }
  }

  /**
   * 停止备份
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 获取备份列表
   */
  listBackups(): { file: string; size: number; date: Date }[] {
    try {
      const files = fs.readdirSync(this.config.backupDir);
      
      return files
        .map(file => {
          const filePath = path.join(this.config.backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            file,
            size: stats.size,
            date: stats.mtime,
          };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (err) {
      this.logger.error('List backups failed', err as Error);
      return [];
    }
  }

  /**
   * 恢复备份
   */
  async restore(backupFile: string): Promise<void> {
    const backupPath = path.join(this.config.backupDir, backupFile);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupFile}`);
    }
    
    // 备份当前数据库
    const currentBackup = `${this.config.dbPath}.backup-${Date.now()}`;
    if (fs.existsSync(this.config.dbPath)) {
      fs.copyFileSync(this.config.dbPath, currentBackup);
    }
    
    // 恢复
    fs.copyFileSync(backupPath, this.config.dbPath);
    
    this.logger.info(`Restored from backup: ${backupFile}`);
  }
}