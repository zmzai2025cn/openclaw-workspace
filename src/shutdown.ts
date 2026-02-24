/**
 * 优雅关闭处理
 * SIGTERM/SIGINT信号处理，确保数据不丢
 */

import { Logger } from './logger';

export type ShutdownHandler = () => Promise<void>;

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private logger: Logger;
  private isShuttingDown = false;

  constructor(logger: Logger) {
    this.logger = logger;
    this.setupSignalHandlers();
  }

  /**
   * 注册关闭处理器
   */
  onShutdown(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers(): void {
    // SIGTERM: Kubernetes发送
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, starting graceful shutdown...');
      this.shutdown();
    });

    // SIGINT: Ctrl+C
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, starting graceful shutdown...');
      this.shutdown();
    });

    // 未捕获异常
    process.on('uncaughtException', (err) => {
      this.logger.error('Uncaught exception', err);
      this.shutdown(1);
    });

    // 未处理Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', reason as Error);
      this.shutdown(1);
    });
  }

  /**
   * 执行关闭
   */
  private async shutdown(exitCode: number = 0): Promise<never> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress...');
      return process.exit(exitCode);
    }

    this.isShuttingDown = true;

    // 设置超时（30秒）
    const timeout = setTimeout(() => {
      this.logger.error('Shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000);

    try {
      // 按顺序执行关闭处理器
      for (const handler of this.handlers) {
        try {
          await handler();
        } catch (err) {
          this.logger.error('Shutdown handler failed', err as Error);
        }
      }

      this.logger.info('Graceful shutdown completed');
      clearTimeout(timeout);
      process.exit(exitCode);
    } catch (err) {
      this.logger.error('Shutdown failed', err as Error);
      clearTimeout(timeout);
      process.exit(1);
    }
  }
}