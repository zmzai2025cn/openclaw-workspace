/**
 * 配置管理
 * 环境变量 + 配置文件 + 验证
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Config {
  // 服务配置
  port: number;
  host: string;
  
  // 数据库配置
  dbPath: string;
  dbBackupPath: string;
  
  // 缓冲配置
  bufferMaxSize: number;
  bufferFlushIntervalMs: number;
  
  // 日志配置
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFile: string;
  
  // 认证配置
  apiKey: string;
  
  // 备份配置
  backupIntervalHours: number;
  backupRetentionDays: number;
}

const DEFAULT_CONFIG: Config = {
  port: 3000,
  host: '0.0.0.0',
  dbPath: './data/kimiclaw.db',
  dbBackupPath: './backup/',
  bufferMaxSize: 1000,
  bufferFlushIntervalMs: 5000,
  logLevel: 'info',
  logFile: './logs/kimiclaw.log',
  apiKey: '',
  backupIntervalHours: 24,
  backupRetentionDays: 7,
};

/**
 * 加载配置
 */
export function loadConfig(): Config {
  const config: Partial<Config> = {};
  
  // 从环境变量加载
  if (process.env.KIMICLAW_PORT) config.port = parseInt(process.env.KIMICLAW_PORT, 10);
  if (process.env.KIMICLAW_HOST) config.host = process.env.KIMICLAW_HOST;
  if (process.env.KIMICLAW_DB_PATH) config.dbPath = process.env.KIMICLAW_DB_PATH;
  if (process.env.KIMICLAW_LOG_LEVEL) config.logLevel = process.env.KIMICLAW_LOG_LEVEL as any;
  if (process.env.KIMICLAW_API_KEY) config.apiKey = process.env.KIMICLAW_API_KEY;
  if (process.env.KIMICLAW_BACKUP_INTERVAL) config.backupIntervalHours = parseInt(process.env.KIMICLAW_BACKUP_INTERVAL, 10);
  
  // 从配置文件加载（覆盖环境变量）
  const configFile = process.env.KIMICLAW_CONFIG || './config.json';
  if (fs.existsSync(configFile)) {
    const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    Object.assign(config, fileConfig);
  }
  
  // 合并默认值
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // 验证
  validateConfig(finalConfig);
  
  return finalConfig;
}

/**
 * 验证配置
 */
function validateConfig(config: Config): void {
  const errors: string[] = [];
  
  if (!config.apiKey) {
    errors.push('KIMICLAW_API_KEY is required');
  }
  
  if (config.port < 1 || config.port > 65535) {
    errors.push('Invalid port number');
  }
  
  if (config.bufferMaxSize < 1) {
    errors.push('bufferMaxSize must be > 0');
  }
  
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * 确保目录存在
 */
export function ensureDirectories(config: Config): void {
  const dirs = [
    path.dirname(config.dbPath),
    config.dbBackupPath,
    path.dirname(config.logFile),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}