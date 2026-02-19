/**
 * 自动备份管理
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BackupConfig {
  enabled: boolean;
  backupDir: string;
  fullBackupIntervalHours: number;
  retainCount: number;
}

export const defaultBackupConfig: BackupConfig = {
  enabled: true,
  backupDir: './data/backups',
  fullBackupIntervalHours: 24,
  retainCount: 7,
};

export class BackupManager {
  private config: BackupConfig;
  private dbPath: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(dbPath: string, config: Partial<BackupConfig> = {}) {
    this.dbPath = dbPath;
    this.config = { ...defaultBackupConfig, ...config };
  }

  /**
   * 启动自动备份
   */
  start(): void {
    if (!this.config.enabled) return;
    
    this.ensureBackupDir();
    
    // 立即执行一次备份
    this.performBackup().catch(console.error);
    
    // 定时备份
    const intervalMs = this.config.fullBackupIntervalHours * 60 * 60 * 1000;
    this.timer = setInterval(() => {
      this.performBackup().catch(console.error);
    }, intervalMs);
    
    console.log(`[Backup] Auto backup started, interval: ${this.config.fullBackupIntervalHours}h`);
  }

  /**
   * 执行备份
   */
  async performBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}.db`;
    const backupPath = path.join(this.config.backupDir, backupName);

    return new Promise((resolve, reject) => {
      fs.copyFile(this.dbPath, backupPath, (err) => {
        if (err) {
          console.error('[Backup] Failed:', err);
          reject(err);
        } else {
          console.log(`[Backup] Created: ${backupPath}`);
          this.cleanupOldBackups();
          resolve(backupPath);
        }
      });
    });
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(): void {
    if (!fs.existsSync(this.config.backupDir)) return;

    const files = fs.readdirSync(this.config.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(this.config.backupDir, f),
        time: fs.statSync(path.join(this.config.backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    // 删除超出保留数量的旧备份
    for (const file of files.slice(this.config.retainCount)) {
      fs.unlinkSync(file.path);
      console.log(`[Backup] Cleaned up: ${file.name}`);
    }
  }

  /**
   * 列出所有备份
   */
  listBackups(): Array<{ name: string; path: string; size: number; time: Date }> {
    if (!fs.existsSync(this.config.backupDir)) return [];

    return fs.readdirSync(this.config.backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => {
        const p = path.join(this.config.backupDir, f);
        const stat = fs.statSync(p);
        return {
          name: f,
          path: p,
          size: stat.size,
          time: stat.mtime,
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime());
  }

  /**
   * 从备份恢复
   */
  async restore(backupName: string): Promise<void> {
    const backupPath = path.join(this.config.backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // 先备份当前数据
    if (fs.existsSync(this.dbPath)) {
      const emergencyBackup = `${this.dbPath}.emergency.${Date.now()}`;
      fs.copyFileSync(this.dbPath, emergencyBackup);
    }

    fs.copyFileSync(backupPath, this.dbPath);
    console.log(`[Backup] Restored from: ${backupName}`);
  }

  /**
   * 停止自动备份
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.config.backupDir)) {
      fs.mkdirSync(this.config.backupDir, { recursive: true });
    }
  }
}
