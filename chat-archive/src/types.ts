/**
 * 消息类型定义
 */

export interface ChatMessage {
  id: string;
  timestamp: Date;
  channel: 'feishu' | 'telegram' | 'discord' | 'email' | string;
  chatId: string;
  chatName?: string;
  userId: string;
  userName: string;
  content: string;
  isMentioned: boolean;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface ArchiveConfig {
  dbPath: string;
  bufferSize: number;
  flushIntervalMs: number;
}

export const defaultConfig: ArchiveConfig = {
  dbPath: './data/chat_archive.db',
  bufferSize: 100,
  flushIntervalMs: 300000, // 5分钟
};
