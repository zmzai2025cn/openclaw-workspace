"use strict";
/**
 * 数据清理策略
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
exports.CleanupManager = exports.defaultCleanupConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.defaultCleanupConfig = {
    enabled: true,
    retentionDays: 90,
    maxDbSizeMB: 1024, // 1GB
    archiveOldData: false,
};
class CleanupManager {
    db;
    config;
    timer = null;
    constructor(db, config = {}) {
        this.db = db;
        this.config = { ...exports.defaultCleanupConfig, ...config };
    }
    /**
     * 启动自动清理
     */
    start() {
        if (!this.config.enabled)
            return;
        // 每天执行一次清理
        this.timer = setInterval(() => {
            this.performCleanup().catch(console.error);
        }, 24 * 60 * 60 * 1000);
        console.log(`[Cleanup] Auto cleanup started, retention: ${this.config.retentionDays} days`);
    }
    /**
     * 执行清理
     */
    async performCleanup() {
        const result = { deleted: 0, archived: 0 };
        if (!this.config.enabled)
            return result;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        try {
            // 如果需要归档，先导出旧数据
            if (this.config.archiveOldData && this.config.archiveDir) {
                result.archived = await this.archiveOldData(cutoffDate);
            }
            // 删除过期数据
            result.deleted = await this.deleteOldData(cutoffDate);
            console.log(`[Cleanup] Deleted: ${result.deleted}, Archived: ${result.archived}`);
        }
        catch (err) {
            console.error('[Cleanup] Failed:', err);
        }
        return result;
    }
    /**
     * 归档旧数据
     */
    async archiveOldData(cutoffDate) {
        if (!this.config.archiveDir)
            return 0;
        // 确保归档目录存在
        if (!fs.existsSync(this.config.archiveDir)) {
            fs.mkdirSync(this.config.archiveDir, { recursive: true });
        }
        // 查询旧数据
        const oldMessages = await this.db.queryByTimeRange(new Date('1970-01-01'), cutoffDate);
        if (oldMessages.length === 0)
            return 0;
        // 按月份分组归档
        const grouped = this.groupByMonth(oldMessages);
        for (const [month, messages] of Object.entries(grouped)) {
            const archivePath = path.join(this.config.archiveDir, `archive_${month}.jsonl`);
            const lines = messages.map(m => JSON.stringify({
                ...m,
                timestamp: m.timestamp.toISOString(),
            })).join('\n') + '\n';
            fs.appendFileSync(archivePath, lines);
        }
        return oldMessages.length;
    }
    /**
     * 删除旧数据
     */
    async deleteOldData(cutoffDate) {
        return this.db.deleteOldData(cutoffDate);
    }
    /**
     * 按月份分组
     */
    groupByMonth(messages) {
        const grouped = {};
        for (const msg of messages) {
            const month = msg.timestamp.toISOString().slice(0, 7); // YYYY-MM
            if (!grouped[month])
                grouped[month] = [];
            grouped[month].push(msg);
        }
        return grouped;
    }
    /**
     * 检查数据库大小
     */
    checkDbSize(dbPath) {
        if (!fs.existsSync(dbPath)) {
            return { sizeMB: 0, exceeds: false };
        }
        const stats = fs.statSync(dbPath);
        const sizeMB = stats.size / (1024 * 1024);
        return {
            sizeMB,
            exceeds: sizeMB > this.config.maxDbSizeMB,
        };
    }
    /**
     * 停止自动清理
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}
exports.CleanupManager = CleanupManager;
