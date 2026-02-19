/**
 * 健康检查与监控指标
 */

import { createServer, Server } from 'http';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: boolean;
    wal: boolean;
    buffer: { status: boolean; buffered: number };
    disk: { status: boolean; usage: number };
  };
  uptime: number;
}

export interface Metrics {
  messagesTotal: number;
  messagesBuffered: number;
  flushCount: number;
  flushErrors: number;
  backupCount: number;
  queryCount: number;
  queryLatency: number[];
}

export class HealthMonitor {
  private server: Server | null = null;
  private port: number;
  private startTime: number;
  private metrics: Metrics;

  constructor(port: number = 8080) {
    this.port = port;
    this.startTime = Date.now();
    this.metrics = {
      messagesTotal: 0,
      messagesBuffered: 0,
      flushCount: 0,
      flushErrors: 0,
      backupCount: 0,
      queryCount: 0,
      queryLatency: [],
    };
  }

  /**
   * 启动健康检查服务
   */
  start(
    getStatus: () => Partial<HealthStatus['checks']>,
    getMetrics: () => Partial<Metrics>
  ): void {
    this.server = createServer((req, res) => {
      const url = req.url || '/';
      
      if (url === '/health') {
        const status = this.buildHealthStatus(getStatus());
        res.writeHead(status.status === 'healthy' ? 200 : 503, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify(status, null, 2));
      } else if (url === '/metrics') {
        const metrics = { ...this.metrics, ...getMetrics() };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metrics, null, 2));
      } else if (url === '/ready') {
        res.writeHead(200);
        res.end('OK');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      console.log(`[Health] Server started on port ${this.port}`);
    });
  }

  /**
   * 记录指标
   */
  recordMessage(): void {
    this.metrics.messagesTotal++;
  }

  recordFlush(success: boolean): void {
    this.metrics.flushCount++;
    if (!success) this.metrics.flushErrors++;
  }

  recordBackup(): void {
    this.metrics.backupCount++;
  }

  recordQuery(latencyMs: number): void {
    this.metrics.queryCount++;
    this.metrics.queryLatency.push(latencyMs);
    // 只保留最近100个
    if (this.metrics.queryLatency.length > 100) {
      this.metrics.queryLatency.shift();
    }
  }

  /**
   * 构建健康状态
   */
  private buildHealthStatus(
    checks: Partial<HealthStatus['checks']>
  ): HealthStatus {
    const allChecks = {
      database: true,
      wal: true,
      buffer: { status: true, buffered: 0 },
      disk: { status: true, usage: 0 },
      ...checks,
    };

    const isHealthy =
      allChecks.database &&
      allChecks.wal &&
      allChecks.buffer.status &&
      allChecks.disk.status;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: allChecks as HealthStatus['checks'],
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * 停止健康检查服务
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
