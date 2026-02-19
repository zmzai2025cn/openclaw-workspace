"use strict";
/**
 * OpenClaw 集成适配器
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatArchive = void 0;
exports.convertFromOpenClaw = convertFromOpenClaw;
exports.createOpenClawHandler = createOpenClawHandler;
const archive_1 = require("./archive");
Object.defineProperty(exports, "ChatArchive", { enumerable: true, get: function () { return archive_1.ChatArchive; } });
/**
 * 将OpenClaw消息格式转换为归档格式
 */
function convertFromOpenClaw(channel, messageData) {
    return {
        id: messageData.id,
        timestamp: new Date(messageData.timestamp),
        channel,
        chatId: messageData.chatId,
        chatName: messageData.chatName,
        userId: messageData.userId,
        userName: messageData.userName,
        content: messageData.content,
        isMentioned: messageData.isMentioned,
        replyTo: messageData.replyTo,
        metadata: messageData.metadata,
    };
}
/**
 * 创建OpenClaw消息处理器
 */
function createOpenClawHandler(archive) {
    return async function handleMessage(channel, messageData) {
        const message = convertFromOpenClaw(channel, messageData);
        await archive.archive(message);
    };
}
__exportStar(require("./types"), exports);
