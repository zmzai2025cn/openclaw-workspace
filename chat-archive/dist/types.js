"use strict";
/**
 * 消息类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.defaultConfig = {
    dbPath: './data/chat_archive.db',
    bufferSize: 100,
    flushIntervalMs: 300000, // 5分钟
};
