/**
 * API 启动健広服务
 * Kimiclaw 通过 API 访问，不直接操作数据库
 */

import * as http from 'http';
import { EventQuery, QueryOptions } from './query';
import { BufferedWriter, Event } from './buffer';
import { Logger } from './logger';

export interface KimiclawAPI {
  // 写入接口
  recordEvent(event: Event): Promise<void>;
  
  // 查询接口
  queryEvents(options: QueryOptions): Promise<any[]>;
  getUserActivity(actor: string, hours?: number): Promise<any[]>;
  getTargetHistory(target: string): Promise<any[]>;
  getActiveActors(hours?: number): Promise<string[]>;
  
  // 统计接口
  countEvents(options?: QueryOptions): Promise<number>;
}

export class KimiclawAPIServer implements KimiclawAPI {
  private writer: BufferedWriter;
  private query: EventQuery;
  private server: http.Server | null = null;
  private logger: Logger | null = null;
  private getHealthStatus: (() => { status: string }) | null = null;

  constructor(dbPath: string) {
    this.writer = new BufferedWriter({ dbPath });
    this.query = new EventQuery(dbPath);
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  setHealthStatusProvider(provider: () => { status: string }): void {
    this.getHealthStatus = provider;
  }

  async recordEvent(event: Event): Promise<void> {
    return this.writer.write(event);
  }

  async queryEvents(options: QueryOptions): Promise<any[]> {
    return this.query.query(options);
  }

  async getUserActivity(actor: string, hours?: number): Promise<any[]> {
    return this.query.getUserActivity(actor, hours);
  }

  async getTargetHistory(target: string): Promise<any[]> {
    return this.query.getTargetHistory(target);
  }

  async getActiveActors(hours?: number): Promise<string[]> {
    return this.query.getActiveActors(hours);
  }

  async countEvents(options?: QueryOptions): Promise<number> {
    return this.query.countEvents(options);
  }

  /**
   * 启动 HTTP API 服务
   */
  start(port: number, host: string): void {
    this.server = http.createServer((req, res) => {
      // 健康检查端点
      if (req.url === '/health') {
        this.handleHealth(req, res);
        return;
      }

      // 其他 API 路由
      this.handleAPI(req, res);
    });

    this.server.listen(port, host, () => {
      if (this.logger) {
        this.logger.info(`API server started on ${host}:${port}`);
      }
    });
  }

  /**
   * 处理健康检查请求
   */
  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = this.getHealthStatus ? this.getHealthStatus() : { status: 'ok' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  /**
   * 处理 API 请求（TODO: 实现具体路由）
   */
  private handleAPI(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not implemented' }));
  }

  async close(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    await this.writer.close();
  }
}