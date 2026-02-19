/**
 * DuckDB 数据库管理
 */

import * as duckdb from 'duckdb';
import { ChatMessage } from './types';

export class ArchiveDB {
  private db: duckdb.Database;
  private conn: duckdb.Connection;

  constructor(dbPath: string) {
    this.db = new duckdb.Database(dbPath);
    this.conn = this.db.connect();
  }

  /**
   * 初始化表结构
   */
  async init(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR PRIMARY KEY,
        timestamp TIMESTAMP,
        channel VARCHAR,
        chat_id VARCHAR,
        chat_name VARCHAR,
        user_id VARCHAR,
        user_name VARCHAR,
        content TEXT,
        is_mentioned BOOLEAN,
        reply_to VARCHAR,
        metadata JSON
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_user_id ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_channel ON messages(channel);
    `;
    
    return new Promise((resolve, reject) => {
      this.conn.exec(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 批量插入消息
   */
  async insertBatch(messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const placeholders = messages.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = messages.flatMap(m => [
      m.id,
      m.timestamp,
      m.channel,
      m.chatId,
      m.chatName || null,
      m.userId,
      m.userName,
      m.content,
      m.isMentioned,
      m.replyTo || null,
      JSON.stringify(m.metadata || {}),
    ]);

    const sql = `INSERT OR REPLACE INTO messages VALUES ${placeholders}`;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 查询消息（时间范围）
   */
  async queryByTimeRange(
    start: Date,
    end: Date,
    chatId?: string
  ): Promise<ChatMessage[]> {
    let sql = `
      SELECT * FROM messages 
      WHERE timestamp >= ? AND timestamp <= ?
    `;
    const params: (Date | string)[] = [start, end];

    if (chatId) {
      sql += ' AND chat_id = ?';
      params.push(chatId);
    }
    sql += ' ORDER BY timestamp DESC';

    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(this.rowToMessage));
      });
    });
  }

  /**
   * 搜索消息内容
   */
  async searchContent(keyword: string, limit: number = 100): Promise<ChatMessage[]> {
    const sql = `
      SELECT * FROM messages 
      WHERE content ILIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.conn.all(sql, [`%${keyword}%`, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(this.rowToMessage));
      });
    });
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalMessages: number;
    totalChats: number;
    totalUsers: number;
    earliestMessage: Date | null;
    latestMessage: Date | null;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT chat_id) as total_chats,
        COUNT(DISTINCT user_id) as total_users,
        MIN(timestamp) as earliest,
        MAX(timestamp) as latest
      FROM messages
    `;

    return new Promise((resolve, reject) => {
      this.conn.all(sql, (err: any, rows: any[]) => {
        if (err) reject(err);
        else {
          const row = rows[0];
          resolve({
            totalMessages: row.total_messages,
            totalChats: row.total_chats,
            totalUsers: row.total_users,
            earliestMessage: row.earliest,
            latestMessage: row.latest,
          });
        }
      });
    });
  }

  private rowToMessage(row: any): ChatMessage {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      channel: row.channel,
      chatId: row.chat_id,
      chatName: row.chat_name,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      isMentioned: row.is_mentioned,
      replyTo: row.reply_to,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  /**
   * 删除旧数据
   */
  async deleteOldData(cutoffDate: Date): Promise<number> {
    const sql = `DELETE FROM messages WHERE timestamp < ?`;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [cutoffDate], function(this: any, err: any) {
        if (err) reject(err);
        else resolve(this.changes || 0);
      });
    });
  }

  close(): void {
    this.conn.close();
    this.db.close();
  }
}
