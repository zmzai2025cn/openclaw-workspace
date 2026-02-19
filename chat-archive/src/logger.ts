/**
 * 结构化日志
 */

import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  console: boolean;
  file?: string;
  maxSizeMB: number;
  maxFiles: number;
}

export const defaultLoggerConfig: LoggerConfig = {
  level: 'info',
  console: true,
  maxSizeMB: 100,
  maxFiles: 5,
};

export class Logger {
  private config: LoggerConfig;
  private stream: fs.WriteStream | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultLoggerConfig, ...config };
    
    if (this.config.file) {
      this.initFileStream();
    }
  }

  private initFileStream(): void {
    if (!this.config.file) return;
    
    const dir = path.dirname(this.config.file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.stream = fs.createWriteStream(this.config.file, { flags: 'a' });
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    // 级别过滤
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (levels.indexOf(level) < levels.indexOf(this.config.level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error?.stack || error?.message,
    };

    const line = JSON.stringify(entry);

    // 控制台输出
    if (this.config.console) {
      const color = this.getColor(level);
      console.log(`${color}[${entry.timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`);
      if (context) console.log('  Context:', context);
      if (error) console.error('  Error:', error);
    }

    // 文件输出
    if (this.stream) {
      this.stream.write(line + '\n');
      this.checkRotation();
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  private getColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    return colors[level] || '';
  }

  private checkRotation(): void {
    if (!this.config.file || !this.stream) return;
    
    try {
      const stats = fs.statSync(this.config.file);
      const sizeMB = stats.size / (1024 * 1024);
      
      if (sizeMB > this.config.maxSizeMB) {
        this.rotate();
      }
    } catch {
      // 忽略错误
    }
  }

  private rotate(): void {
    if (!this.config.file) return;
    
    this.stream?.end();
    
    // 删除最旧的备份
    const oldestBackup = `${this.config.file}.${this.config.maxFiles}`;
    if (fs.existsSync(oldestBackup)) {
      fs.unlinkSync(oldestBackup);
    }
    
    // 重命名现有备份
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${this.config.file}.${i}`;
      const newPath = `${this.config.file}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    }
    
    // 重命名当前文件
    if (fs.existsSync(this.config.file)) {
      fs.renameSync(this.config.file, `${this.config.file}.1`);
    }
    
    // 重新初始化
    this.initFileStream();
  }

  close(): void {
    this.stream?.end();
  }
}

// 全局日志实例
let globalLogger: Logger | null = null;

export function initLogger(config?: Partial<LoggerConfig>): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}
