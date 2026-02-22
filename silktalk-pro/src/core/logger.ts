import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

/**
 * FIXED L3: Fixed child logger binding preservation
 */
export class Logger {
  private logger: PinoLogger;
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    const { level = 'info', pretty = false, name = 'silktalk' } = options;
    this.options = { level, pretty, name };

    const pinoOptions: pino.LoggerOptions = {
      name,
      level
    };

    if (pretty) {
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      };
    }

    this.logger = (pino as unknown as (options: pino.LoggerOptions) => PinoLogger)(pinoOptions);
  }

  trace(msg: string, ...args: unknown[]): void {
    this.logger.trace(msg, ...args);
  }

  debug(msg: string, ...args: unknown[]): void {
    this.logger.debug(msg, ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    this.logger.info(msg, ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    this.logger.warn(msg, ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    this.logger.error(msg, ...args);
  }

  fatal(msg: string, ...args: unknown[]): void {
    this.logger.fatal(msg, ...args);
  }

  /**
   * FIXED L3: Properly preserve parent logger bindings and options
   */
  child(bindings: Record<string, unknown>): Logger {
    // Create child logger with same options as parent
    const childLogger = new Logger({
      level: this.options.level,
      pretty: this.options.pretty,
      name: this.options.name
    });
    
    // Use pino's child method to properly inherit bindings
    childLogger.logger = this.logger.child(bindings);
    
    return childLogger;
  }
  
  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.logger.level as LogLevel;
  }
  
  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.logger.level = level;
    this.options.level = level;
  }
  
  /**
   * Check if a level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.logger.isLevelEnabled(level);
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Reset global logger (useful for testing)
 */
export function resetGlobalLogger(): void {
  globalLogger = null;
}
