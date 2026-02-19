"use strict";
/**
 * DuckDB 数据库管理
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveDB = void 0;
const duckdb = __importStar(require("duckdb"));
class ArchiveDB {
    db;
    conn;
    constructor(dbPath) {
        this.db = new duckdb.Database(dbPath);
        this.conn = this.db.connect();
    }
    /**
     * 初始化表结构
     */
    async init() {
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
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * 批量插入消息
     */
    async insertBatch(messages) {
        if (messages.length === 0)
            return;
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
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * 查询消息（时间范围）
     */
    async queryByTimeRange(start, end, chatId) {
        let sql = `
      SELECT * FROM messages 
      WHERE timestamp >= ? AND timestamp <= ?
    `;
        const params = [start, end];
        if (chatId) {
            sql += ' AND chat_id = ?';
            params.push(chatId);
        }
        sql += ' ORDER BY timestamp DESC';
        return new Promise((resolve, reject) => {
            this.conn.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.rowToMessage));
            });
        });
    }
    /**
     * 搜索消息内容
     */
    async searchContent(keyword, limit = 100) {
        const sql = `
      SELECT * FROM messages 
      WHERE content ILIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
        return new Promise((resolve, reject) => {
            this.conn.all(sql, [`%${keyword}%`, limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(this.rowToMessage));
            });
        });
    }
    /**
     * 获取统计信息
     */
    async getStats() {
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
            this.conn.all(sql, (err, rows) => {
                if (err)
                    reject(err);
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
    rowToMessage(row) {
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
    async deleteOldData(cutoffDate) {
        const sql = `DELETE FROM messages WHERE timestamp < ?`;
        return new Promise((resolve, reject) => {
            this.conn.run(sql, [cutoffDate], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(this.changes || 0);
            });
        });
    }
    close() {
        this.conn.close();
        this.db.close();
    }
}
exports.ArchiveDB = ArchiveDB;
