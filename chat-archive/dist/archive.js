"use strict";
/**
 * 消息归档主类（生产级完整版）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatArchive = void 0;
const types_1 = require("./types");
const db_1 = require("./db");
const buffer_1 = require("./buffer");
const wal_1 = require("./wal");
const backup_1 = require("./backup");
const health_1 = require("./health");
const cleanup_1 = require("./cleanup");
const logger_1 = require("./logger");
const system_1 = require("./system");
class ChatArchive {
    db;
    wal;
    writer;
    backup;
    cleanup;
    health;
    logger;
    config;
    constructor(config = {}) {
        this.config = { ...types_1.defaultConfig, ...config.archive };
        // 初始化日志
        this.logger = (0, logger_1.initLogger)({
            file: config.logFile || './logs/archive.log',
        });
        this.db = new db_1.ArchiveDB(this.config.dbPath);
        this.wal = new wal_1.WAL(this.config.dbPath);
        this.writer = new buffer_1.BufferedWriter(this.db, this.wal, this.config);
        this.backup = new backup_1.BackupManager(this.config.dbPath, config.backup || {});
        this.cleanup = new cleanup_1.CleanupManager(this.db, config.cleanup || {});
        this.health = new health_1.HealthMonitor(config.healthPort || 8080);
    }
    /**
     * 初始化（含WAL恢复、磁盘检查）
     */
    async init() {
        this.logger.info('Initializing ChatArchive...');
        // 检查磁盘空间
        if (!(0, system_1.checkDiskSpace)(this.config.dbPath, 95)) {
            this.logger.error('Disk space critical', undefined, {
                usage: (0, system_1.getDiskUsage)(this.config.dbPath),
            });
            throw new Error('Disk space critical');
        }
        // 初始化WAL
        this.wal.init();
        // 初始化数据库
        await this.db.init();
        // 恢复未提交的WAL数据
        await this.recoverFromWAL();
        // 启动自动备份
        this.backup.start();
        // 启动自动清理
        this.cleanup.start();
        // 启动健康检查
        this.health.start(() => {
            const diskUsage = (0, system_1.getDiskUsage)(this.config.dbPath);
            const memUsage = (0, system_1.getMemoryUsage)();
            return {
                database: true,
                wal: true,
                buffer: {
                    status: this.writer.getStatus().buffered < this.config.bufferSize,
                    buffered: this.writer.getStatus().buffered,
                },
                disk: {
                    status: diskUsage.usagePercent < 90,
                    usage: diskUsage.usagePercent,
                },
                memory: {
                    status: memUsage.usagePercent < 85,
                    usage: memUsage.usagePercent,
                },
            };
        }, () => ({
            messagesBuffered: this.writer.getStatus().buffered,
            diskUsage: (0, system_1.getDiskUsage)(this.config.dbPath).usagePercent,
            memoryUsage: (0, system_1.getMemoryUsage)().usagePercent,
        }));
        // 优雅关闭处理
        this.setupGracefulShutdown();
        this.logger.info('ChatArchive initialized successfully');
    }
    /**
     * 归档单条消息（带异常隔离）
     */
    async archive(message) {
        try {
            this.health.recordMessage();
            await this.writer.add(message);
            this.logger.debug('Message archived', { messageId: message.id });
        }
        catch (err) {
            this.logger.error('Failed to archive message', err, {
                messageId: message.id,
            });
            // 不抛出错误，避免影响主流程
        }
    }
    /**
     * 归档多条消息（带异常隔离）
     */
    async archiveBatch(messages) {
        const failed = [];
        for (const msg of messages) {
            try {
                this.health.recordMessage();
                await this.writer.add(msg);
            }
            catch (err) {
                failed.push(msg);
                this.logger.error('Failed to archive message in batch', err, {
                    messageId: msg.id,
                });
            }
        }
        if (failed.length > 0) {
            this.logger.warn('Batch archive partial failure', {
                total: messages.length,
                failed: failed.length,
            });
        }
    }
    /**
     * 查询消息（时间范围）
     */
    async queryByTimeRange(start, end, chatId) {
        const startTime = Date.now();
        try {
            const result = await this.db.queryByTimeRange(start, end, chatId);
            this.health.recordQuery(Date.now() - startTime);
            return result;
        }
        catch (err) {
            this.logger.error('Query failed', err, { start, end, chatId });
            throw err;
        }
    }
    /**
     * 搜索消息内容
     */
    async search(keyword, limit) {
        const startTime = Date.now();
        try {
            const result = await this.db.searchContent(keyword, limit);
            this.health.recordQuery(Date.now() - startTime);
            return result;
        }
        catch (err) {
            this.logger.error('Search failed', err, { keyword });
            throw err;
        }
    }
    /**
     * 获取统计信息
     */
    async getStats() {
        return this.db.getStats();
    }
    /**
     * 获取状态
     */
    getStatus() {
        const diskUsage = (0, system_1.getDiskUsage)(this.config.dbPath);
        return {
            ...this.writer.getStatus(),
            dbPath: this.config.dbPath,
            dbSizeMB: Math.round(diskUsage.used / 1024 / 1024),
            diskUsagePercent: diskUsage.usagePercent,
            backups: this.backup.listBackups().length,
        };
    }
    /**
     * 手动触发备份
     */
    async backupNow() {
        const path = await this.backup.performBackup();
        this.health.recordBackup();
        this.logger.info('Manual backup completed', { path });
        return path;
    }
    /**
     * 手动触发清理
     */
    async cleanupNow() {
        const result = await this.cleanup.performCleanup();
        this.logger.info('Manual cleanup completed', result);
        return result;
    }
    /**
     * 列出备份
     */
    listBackups() {
        return this.backup.listBackups();
    }
    /**
     * 从备份恢复
     */
    async restore(backupName) {
        this.logger.info('Restoring from backup', { backupName });
        await this.backup.restore(backupName);
        this.logger.info('Restore completed');
    }
    /**
     * 关闭归档器
     */
    async close() {
        this.logger.info('Closing ChatArchive gracefully...');
        // 停止健康检查
        this.health.stop();
        // 停止自动备份
        this.backup.stop();
        // 停止自动清理
        this.cleanup.stop();
        // 强制刷新缓冲区
        await this.writer.close();
        // 关闭WAL
        this.wal.close();
        // 关闭数据库
        this.db.close();
        // 关闭日志
        this.logger.close();
        console.log('[Archive] Closed');
    }
    /**
     * 从WAL恢复未提交数据
     */
    async recoverFromWAL() {
        const uncommitted = await this.wal.readUncommitted();
        if (uncommitted.length > 0) {
            this.logger.info(`Recovering ${uncommitted.length} messages from WAL`);
            await this.db.insertBatch(uncommitted);
            this.wal.clear();
            this.logger.info('WAL recovery completed');
        }
    }
    /**
     * 设置优雅关闭
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            this.logger.info(`Received ${signal}, shutting down gracefully...`);
            await this.close();
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            this.logger.error('Uncaught exception', err);
            shutdown('uncaughtException');
        });
    }
}
exports.ChatArchive = ChatArchive;
