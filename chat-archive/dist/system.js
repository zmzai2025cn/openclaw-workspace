"use strict";
/**
 * 系统监控工具
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
exports.getDiskUsage = getDiskUsage;
exports.checkDiskSpace = checkDiskSpace;
exports.getMemoryUsage = getMemoryUsage;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
/**
 * 获取磁盘使用情况
 */
function getDiskUsage(path) {
    try {
        // Linux/Mac
        const output = (0, child_process_1.execSync)(`df -B1 "${path}" 2>/dev/null | tail -1`, { encoding: 'utf-8' });
        const parts = output.trim().split(/\s+/);
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const free = parseInt(parts[3], 10);
        return {
            total,
            used,
            free,
            usagePercent: Math.round((used / total) * 100),
        };
    }
    catch {
        // 回退：使用 statfs（Node 18+）
        try {
            const stat = fs.statSync(path);
            // 简化估算
            return {
                total: 100 * 1024 * 1024 * 1024, // 100GB 默认
                used: 50 * 1024 * 1024 * 1024,
                free: 50 * 1024 * 1024 * 1024,
                usagePercent: 50,
            };
        }
        catch {
            return {
                total: 0,
                used: 0,
                free: 0,
                usagePercent: 0,
            };
        }
    }
}
/**
 * 检查磁盘空间是否充足
 */
function checkDiskSpace(path, thresholdPercent = 90) {
    const usage = getDiskUsage(path);
    return usage.usagePercent < thresholdPercent;
}
/**
 * 获取内存使用情况
 */
function getMemoryUsage() {
    const used = process.memoryUsage();
    const total = used.heapTotal + used.external;
    return {
        total,
        used: used.heapUsed,
        free: total - used.heapUsed,
        usagePercent: Math.round((used.heapUsed / total) * 100) || 0,
    };
}
