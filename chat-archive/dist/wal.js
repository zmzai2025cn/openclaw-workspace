"use strict";
/**
 * WAL (Write-Ahead Log) - 数据零丢失保障
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
exports.WAL = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WAL {
    walPath;
    stream = null;
    constructor(dbPath) {
        const dir = path.dirname(dbPath);
        this.walPath = path.join(dir, 'wal.jsonl');
    }
    /**
     * 初始化WAL
     */
    init() {
        const dir = path.dirname(this.walPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.stream = fs.createWriteStream(this.walPath, { flags: 'a' });
    }
    /**
     * 追加消息到WAL
     */
    append(message) {
        return new Promise((resolve, reject) => {
            if (!this.stream) {
                reject(new Error('WAL not initialized'));
                return;
            }
            const line = JSON.stringify({
                ...message,
                timestamp: message.timestamp.toISOString(),
                _wal_time: Date.now(),
            }) + '\n';
            this.stream.write(line, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * 批量追加
     */
    async appendBatch(messages) {
        for (const msg of messages) {
            await this.append(msg);
        }
    }
    /**
     * 读取未提交的WAL记录
     */
    async readUncommitted() {
        if (!fs.existsSync(this.walPath)) {
            return [];
        }
        const content = fs.readFileSync(this.walPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.map(line => {
            const data = JSON.parse(line);
            return {
                ...data,
                timestamp: new Date(data.timestamp),
            };
        });
    }
    /**
     * 清空WAL（成功写入DB后调用）
     */
    clear() {
        if (this.stream) {
            this.stream.end();
        }
        if (fs.existsSync(this.walPath)) {
            fs.unlinkSync(this.walPath);
        }
        this.init();
    }
    /**
     * 关闭WAL
     */
    close() {
        if (this.stream) {
            this.stream.end();
            this.stream = null;
        }
    }
}
exports.WAL = WAL;
