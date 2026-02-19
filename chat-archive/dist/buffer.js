"use strict";
/**
 * 缓冲写入器 - 批量写入DuckDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BufferedWriter = void 0;
class BufferedWriter {
    buffer = [];
    db;
    wal;
    config;
    flushTimer = null;
    isFlushing = false;
    constructor(db, wal, config) {
        this.db = db;
        this.wal = wal;
        this.config = config;
        this.startFlushTimer();
    }
    /**
     * 添加消息到缓冲区（带WAL双写）
     */
    async add(message) {
        // 先写WAL，确保数据不丢
        await this.wal.append(message);
        this.buffer.push(message);
        // 达到缓冲区大小，立即刷新
        if (this.buffer.length >= this.config.bufferSize) {
            await this.flush();
        }
    }
    /**
     * 批量添加消息（带WAL双写）
     */
    async addBatch(messages) {
        // 先写WAL
        await this.wal.appendBatch(messages);
        this.buffer.push(...messages);
        if (this.buffer.length >= this.config.bufferSize) {
            await this.flush();
        }
    }
    /**
     * 立即刷新缓冲区到数据库
     */
    async flush() {
        if (this.isFlushing || this.buffer.length === 0)
            return;
        this.isFlushing = true;
        const batch = this.buffer.splice(0, this.buffer.length);
        try {
            await this.db.insertBatch(batch);
            // 成功写入后清空WAL
            this.wal.clear();
            console.log(`[Archive] Flushed ${batch.length} messages to DB`);
        }
        catch (err) {
            console.error('[Archive] Flush failed:', err);
            // 失败时把消息放回缓冲区（WAL还在，数据不丢）
            this.buffer.unshift(...batch);
        }
        finally {
            this.isFlushing = false;
        }
    }
    /**
     * 获取缓冲区状态
     */
    getStatus() {
        return {
            buffered: this.buffer.length,
            isFlushing: this.isFlushing,
        };
    }
    /**
     * 关闭写入器（强制刷新）
     */
    async close() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush().catch(console.error);
        }, this.config.flushIntervalMs);
    }
}
exports.BufferedWriter = BufferedWriter;
