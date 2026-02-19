/**
 * OpenClaw 集成适配器
 */

import { ChatArchive } from './archive';
import { ChatMessage } from './types';

/**
 * 将OpenClaw消息格式转换为归档格式
 */
export function convertFromOpenClaw(
  channel: string,
  messageData: {
    id: string;
    timestamp: number;
    chatId: string;
    chatName?: string;
    userId: string;
    userName: string;
    content: string;
    isMentioned: boolean;
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }
): ChatMessage {
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
export function createOpenClawHandler(archive: ChatArchive) {
  return async function handleMessage(
    channel: string,
    messageData: Parameters<typeof convertFromOpenClaw>[1]
  ): Promise<void> {
    const message = convertFromOpenClaw(channel, messageData);
    await archive.archive(message);
  };
}

export { ChatArchive };
export * from './types';
