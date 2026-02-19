/**
 * 配置加载
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { ArchiveConfig, defaultConfig } from './types';
import { BackupConfig, defaultBackupConfig } from './backup';
import { CleanupConfig, defaultCleanupConfig } from './cleanup';
import { LoggerConfig, defaultLoggerConfig } from './logger';

export interface AppConfig {
  archive: ArchiveConfig;
  backup: BackupConfig;
  cleanup: CleanupConfig;
  logger: LoggerConfig;
  healthPort: number;
}

export function loadConfig(envPath?: string): AppConfig {
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  const env = process.env;

  return {
    archive: {
      dbPath: env.DB_PATH || defaultConfig.dbPath,
      bufferSize: parseInt(env.BUFFER_SIZE || String(defaultConfig.bufferSize), 10),
      flushIntervalMs: parseInt(env.FLUSH_INTERVAL_MS || String(defaultConfig.flushIntervalMs), 10),
    },
    backup: {
      enabled: env.BACKUP_ENABLED === 'true',
      backupDir: env.BACKUP_DIR || defaultBackupConfig.backupDir,
      fullBackupIntervalHours: parseInt(env.BACKUP_INTERVAL_HOURS || String(defaultBackupConfig.fullBackupIntervalHours), 10),
      retainCount: parseInt(env.BACKUP_RETAIN_COUNT || String(defaultBackupConfig.retainCount), 10),
    },
    cleanup: {
      enabled: env.CLEANUP_ENABLED === 'true',
      retentionDays: parseInt(env.RETENTION_DAYS || String(defaultCleanupConfig.retentionDays), 10),
      maxDbSizeMB: parseInt(env.MAX_DB_SIZE_MB || String(defaultCleanupConfig.maxDbSizeMB), 10),
      archiveOldData: env.ARCHIVE_OLD_DATA === 'true',
      archiveDir: env.ARCHIVE_DIR,
    },
    logger: {
      level: (env.LOG_LEVEL as any) || defaultLoggerConfig.level,
      console: env.LOG_CONSOLE !== 'false',
      file: env.LOG_FILE,
      maxSizeMB: parseInt(env.LOG_MAX_SIZE_MB || String(defaultLoggerConfig.maxSizeMB), 10),
      maxFiles: parseInt(env.LOG_MAX_FILES || String(defaultLoggerConfig.maxFiles), 10),
    },
    healthPort: parseInt(env.HEALTH_PORT || '8080', 10),
  };
}
