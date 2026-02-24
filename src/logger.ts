/**
 * 结构化日志
 * 分级 + 文件 + JSON格式
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: string;
}

export class Logger {
  private level: LogLevel;
  private logFile: string;
  private consoleOutput: boolean;

  constructor(level: LogLevel = 'info', logFile: string = './logs/app.log', consoleOutput: boolean = true) {
    this.level = level;
    this.logFile = logFile;
    this.consoleOutput = consoleOutput;
    
    // 确保日志目录存在
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error?.stack || error?.message,
    };

    // 写入文件
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFile, line);

    // 控制台输出
    if (this.consoleOutput) {
      const color = this.getColor(level);
      console.log(color, `[${entry.timestamp}] ${level.toUpperCase()}: ${message}`);
      if (error) console.error(error);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  private getColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    return colors[level] || '\x1b[0m';
  }
}

// 全局日志实例
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

export function initLogger(level: LogLevel, logFile: string): void {
  globalLogger = new Logger(level, logFile);
}