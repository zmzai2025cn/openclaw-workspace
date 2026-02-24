/**
 * 健康检查
 * HTTP端点供K8s探针使用
 */

import * as http from 'http';
import { Logger } from './logger';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    database: boolean;
    buffer: boolean;
    diskSpace: boolean;
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    bufferedEvents: number;
  };
}

export class HealthServer {
  private server: http.Server | null = null;
  private port: number;
  private logger: Logger;
  private getStatus: () => Partial<HealthStatus>;

  constructor(port: number, logger: Logger, getStatus: () => Partial<HealthStatus>) {
    this.port = port;
    this.logger = logger;
    this.getStatus = getStatus;
  }

  /**
   * 启动健康检查服务
   */
  start(): void {
    this.server = http.createServer((req, res) => {
      if (req.url === '/health') {
        this.handleHealth(req, res);
      } else if (req.url === '/ready') {
        this.handleReady(req, res);
      } else if (req.url === '/metrics') {
        this.handleMetrics(req, res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.server.listen(this.port, () => {
      this.logger.info(`Health server started on port ${this.port}`);
    });
  }

  /**
   * 健康检查（存活探针）
   */
  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = this.getStatus();
    const healthy = status.checks?.database && status.checks?.buffer;

    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: status.checks,
    }));
  }

  /**
   * 就绪检查（就绪探针）
   */
  private handleReady(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = this.getStatus();
    const ready = status.checks?.database && 
                  status.checks?.buffer && 
                  status.checks?.diskSpace;

    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: ready ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * 指标端点
   */
  private handleMetrics(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = this.getStatus();

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`
# HELP kimiclaw_uptime_seconds Service uptime
# TYPE kimiclaw_uptime_seconds gauge
kimiclaw_uptime_seconds ${status.metrics?.uptime || 0}

# HELP kimiclaw_memory_usage_bytes Memory usage
# TYPE kimiclaw_memory_usage_bytes gauge
kimiclaw_memory_usage_bytes ${status.metrics?.memoryUsage || 0}

# HELP kimiclaw_buffered_events Buffered events count
# TYPE kimiclaw_buffered_events gauge
kimiclaw_buffered_events ${status.metrics?.bufferedEvents || 0}
    `.trim());
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.logger.info('Health server stopped');
    }
  }
}