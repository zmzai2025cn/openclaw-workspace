/**
 * 主入口 - 生产级服务
 * 整合所有P0+P1功能
 */

import { loadConfig, ensureDirectories, Config } from './config';
import { initLogger, getLogger } from './logger';
import { HealthServer } from './health';
import { GracefulShutdown } from './shutdown';
import { BackupManager } from './backup';
import { AlertManager } from './alert';
import { BufferedWriter } from './buffer';
import { EventQuery } from './query';
import { KimiclawAPIServer } from './api';

async function main() {
  // 1. 加载配置
  const config = loadConfig();
  
  // 2. 初始化日志
  initLogger(config.logLevel, config.logFile);
  const logger = getLogger();
  
  logger.info('Starting Kimiclaw DB Service...');
  
  // 3. 确保目录存在
  ensureDirectories(config);
  
  // 4. 初始化数据库
  const writer = new BufferedWriter({
    dbPath: config.dbPath,
    maxSize: config.bufferMaxSize,
    flushIntervalMs: config.bufferFlushIntervalMs,
  });
  
  const query = new EventQuery(config.dbPath);
  
  // 5. 初始化告警
  const alertManager = new AlertManager(logger);
  if (process.env.FEISHU_WEBHOOK) {
    alertManager.addChannel(AlertManager.createFeishuChannel(process.env.FEISHU_WEBHOOK));
  }
  
  // 6. 初始化备份
  const backupManager = new BackupManager({
    dbPath: config.dbPath,
    backupDir: config.dbBackupPath,
    intervalHours: config.backupIntervalHours,
    retentionDays: config.backupRetentionDays,
  }, logger);
  backupManager.start();
  
  // 8. 初始化API服务（在3000端口启动，包含健康检查）
  const apiServer = new KimiclawAPIServer(config.dbPath);
  apiServer.setLogger(logger);
  apiServer.setHealthStatusProvider(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
  apiServer.start(config.port, config.host);
  logger.info(`Main API server started on ${config.host}:${config.port}`);
  
  // 9. 初始化健康检查（可选，在3001端口）
  const healthServer = new HealthServer(config.port + 1, logger, () => ({
    checks: {
      database: true, // TODO: 实际检查
      buffer: writer.getStats().buffered < config.bufferMaxSize,
      diskSpace: true, // TODO: 实际检查
    },
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed,
      bufferedEvents: writer.getStats().buffered,
    },
  }));
  healthServer.start();
  
  // 9. 优雅关闭
  const shutdown = new GracefulShutdown(logger);
  shutdown.onShutdown(async () => {
    logger.info('Shutting down services...');
    healthServer.stop();
    backupManager.stop();
    await writer.close();
    await apiServer.close();
    logger.info('Shutdown complete');
  });
  
  logger.info('Kimiclaw DB Service started successfully');
  
  // 保持运行
  process.stdin.resume();
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export { loadConfig, initLogger, getLogger };
export { HealthServer } from './health';
export { GracefulShutdown } from './shutdown';
export { BackupManager } from './backup';
export { AlertManager } from './alert';
export { BufferedWriter } from './buffer';
export { EventQuery } from './query';
export { KimiclawAPIServer } from './api';

export const VERSION = '1.1.0-production';