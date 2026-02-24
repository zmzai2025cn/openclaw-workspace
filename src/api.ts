/**
 * API 隔离层
 * Kimiclaw 通过 API 访问，不直接操作数据库
 */

import { EventQuery, QueryOptions } from './query';
import { BufferedWriter, Event } from './buffer';

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

  constructor(dbPath: string) {
    this.writer = new BufferedWriter({ dbPath });
    this.query = new EventQuery(dbPath);
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

  async close(): Promise<void> {
    await this.writer.close();
  }
}