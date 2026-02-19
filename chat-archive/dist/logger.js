"use strict";
/**
 * 结构化日志
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
exports.Logger = exports.defaultLoggerConfig = void 0;
exports.initLogger = initLogger;
exports.getLogger = getLogger;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.defaultLoggerConfig = {
    level: 'info',
    console: true,
    maxSizeMB: 100,
    maxFiles: 5,
};
class Logger {
    config;
    stream = null;
    constructor(config = {}) {
        this.config = { ...exports.defaultLoggerConfig, ...config };
        if (this.config.file) {
            this.initFileStream();
        }
    }
    initFileStream() {
        if (!this.config.file)
            return;
        const dir = path.dirname(this.config.file);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.stream = fs.createWriteStream(this.config.file, { flags: 'a' });
    }
    log(level, message, context, error) {
        // 级别过滤
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.indexOf(level) < levels.indexOf(this.config.level))
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            error: error?.stack || error?.message,
        };
        const line = JSON.stringify(entry);
        // 控制台输出
        if (this.config.console) {
            const color = this.getColor(level);
            console.log(`${color}[${entry.timestamp}] ${level.toUpperCase()}: ${message}\x1b[0m`);
            if (context)
                console.log('  Context:', context);
            if (error)
                console.error('  Error:', error);
        }
        // 文件输出
        if (this.stream) {
            this.stream.write(line + '\n');
            this.checkRotation();
        }
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context, error) {
        this.log('warn', message, context, error);
    }
    error(message, error, context) {
        this.log('error', message, context, error);
    }
    getColor(level) {
        const colors = {
            debug: '\x1b[36m', // cyan
            info: '\x1b[32m', // green
            warn: '\x1b[33m', // yellow
            error: '\x1b[31m', // red
        };
        return colors[level] || '';
    }
    checkRotation() {
        if (!this.config.file || !this.stream)
            return;
        try {
            const stats = fs.statSync(this.config.file);
            const sizeMB = stats.size / (1024 * 1024);
            if (sizeMB > this.config.maxSizeMB) {
                this.rotate();
            }
        }
        catch {
            // 忽略错误
        }
    }
    rotate() {
        if (!this.config.file)
            return;
        this.stream?.end();
        // 删除最旧的备份
        const oldestBackup = `${this.config.file}.${this.config.maxFiles}`;
        if (fs.existsSync(oldestBackup)) {
            fs.unlinkSync(oldestBackup);
        }
        // 重命名现有备份
        for (let i = this.config.maxFiles - 1; i >= 1; i--) {
            const oldPath = `${this.config.file}.${i}`;
            const newPath = `${this.config.file}.${i + 1}`;
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
            }
        }
        // 重命名当前文件
        if (fs.existsSync(this.config.file)) {
            fs.renameSync(this.config.file, `${this.config.file}.1`);
        }
        // 重新初始化
        this.initFileStream();
    }
    close() {
        this.stream?.end();
    }
}
exports.Logger = Logger;
// 全局日志实例
let globalLogger = null;
function initLogger(config) {
    globalLogger = new Logger(config);
    return globalLogger;
}
function getLogger() {
    if (!globalLogger) {
        globalLogger = new Logger();
    }
    return globalLogger;
}
