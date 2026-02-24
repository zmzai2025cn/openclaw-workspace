/**
 * 查询接口 - 供 Kimiclaw 使用
 */

import * as duckdb from 'duckdb';

export interface QueryOptions {
  startTime?: Date;
  endTime?: Date;
  source?: string;
  actor?: string;
  target?: string;
  type?: string;
  tags?: string[];
  limit?: number;
}

export class EventQuery {
  private db: duckdb.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new duckdb.Database(dbPath);
  }

  /**
   * 查询事件
   */
  async query(options: QueryOptions = {}): Promise<any[]> {
    const {
      startTime,
      endTime,
      source,
      actor,
      target,
      type,
      tags,
      limit = 100,
    } = options;

    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (startTime) {
      sql += ` AND timestamp >= ?`;
      params.push(startTime);
    }

    if (endTime) {
      sql += ` AND timestamp <= ?`;
      params.push(endTime);
    }

    if (source) {
      sql += ` AND source = ?`;
      params.push(source);
    }

    if (actor) {
      sql += ` AND actor = ?`;
      params.push(actor);
    }

    if (target) {
      sql += ` AND target = ?`;
      params.push(target);
    }

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, ...params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * 查询某人最近活动
   */
  async getUserActivity(actor: string, hours: number = 24): Promise<any[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.query({
      actor,
      startTime,
      limit: 1000,
    });
  }

  /**
   * 查询某目标的所有事件
   */
  async getTargetHistory(target: string): Promise<any[]> {
    return this.query({
      target,
      limit: 1000,
    });
  }

  /**
   * 统计某时段事件数
   */
  async countEvents(options: QueryOptions = {}): Promise<number> {
    const rows = await this.query({ ...options, limit: 10000 });
    return rows.length;
  }

  /**
   * 获取活跃人员列表
   */
  async getActiveActors(hours: number = 24): Promise<string[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const sql = `
      SELECT DISTINCT actor FROM events 
      WHERE timestamp >= ? AND actor IS NOT NULL
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, startTime, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.actor));
      });
    });
  }
}