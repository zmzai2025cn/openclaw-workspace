"use strict";
/**
 * 自动备份管理
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
exports.BackupManager = exports.defaultBackupConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.defaultBackupConfig = {
    enabled: true,
    backupDir: './data/backups',
    fullBackupIntervalHours: 24,
    retainCount: 7,
};
class BackupManager {
    config;
    dbPath;
    timer = null;
    constructor(dbPath, config = {}) {
        this.dbPath = dbPath;
        this.config = { ...exports.defaultBackupConfig, ...config };
    }
    /**
     * 启动自动备份
     */
    start() {
        if (!this.config.enabled)
            return;
        this.ensureBackupDir();
        // 立即执行一次备份
        this.performBackup().catch(console.error);
        // 定时备份
        const intervalMs = this.config.fullBackupIntervalHours * 60 * 60 * 1000;
        this.timer = setInterval(() => {
            this.performBackup().catch(console.error);
        }, intervalMs);
        console.log(`[Backup] Auto backup started, interval: ${this.config.fullBackupIntervalHours}h`);
    }
    /**
     * 执行备份
     */
    async performBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup_${timestamp}.db`;
        const backupPath = path.join(this.config.backupDir, backupName);
        return new Promise((resolve, reject) => {
            fs.copyFile(this.dbPath, backupPath, (err) => {
                if (err) {
                    console.error('[Backup] Failed:', err);
                    reject(err);
                }
                else {
                    console.log(`[Backup] Created: ${backupPath}`);
                    this.cleanupOldBackups();
                    resolve(backupPath);
                }
            });
        });
    }
    /**
     * 清理旧备份
     */
    cleanupOldBackups() {
        if (!fs.existsSync(this.config.backupDir))
            return;
        const files = fs.readdirSync(this.config.backupDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .map(f => ({
            name: f,
            path: path.join(this.config.backupDir, f),
            time: fs.statSync(path.join(this.config.backupDir, f)).mtime.getTime(),
        }))
            .sort((a, b) => b.time - a.time);
        // 删除超出保留数量的旧备份
        for (const file of files.slice(this.config.retainCount)) {
            fs.unlinkSync(file.path);
            console.log(`[Backup] Cleaned up: ${file.name}`);
        }
    }
    /**
     * 列出所有备份
     */
    listBackups() {
        if (!fs.existsSync(this.config.backupDir))
            return [];
        return fs.readdirSync(this.config.backupDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .map(f => {
            const p = path.join(this.config.backupDir, f);
            const stat = fs.statSync(p);
            return {
                name: f,
                path: p,
                size: stat.size,
                time: stat.mtime,
            };
        })
            .sort((a, b) => b.time.getTime() - a.time.getTime());
    }
    /**
     * 从备份恢复
     */
    async restore(backupName) {
        const backupPath = path.join(this.config.backupDir, backupName);
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup not found: ${backupName}`);
        }
        // 先备份当前数据
        if (fs.existsSync(this.dbPath)) {
            const emergencyBackup = `${this.dbPath}.emergency.${Date.now()}`;
            fs.copyFileSync(this.dbPath, emergencyBackup);
        }
        fs.copyFileSync(backupPath, this.dbPath);
        console.log(`[Backup] Restored from: ${backupName}`);
    }
    /**
     * 停止自动备份
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    ensureBackupDir() {
        if (!fs.existsSync(this.config.backupDir)) {
            fs.mkdirSync(this.config.backupDir, { recursive: true });
        }
    }
}
exports.BackupManager = BackupManager;
