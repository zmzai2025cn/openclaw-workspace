/**
 * WAL (Write-Ahead Log) - 数据零丢失保障
 */

import * as fs from 'fs';
import * as path from 'path';
import { ChatMessage } from './types';

export class WAL {
  private walPath: string;
  private stream: fs.WriteStream | null = null;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    this.walPath = path.join(dir, 'wal.jsonl');
  }

  /**
   * 初始化WAL
   */
  init(): void {
    const dir = path.dirname(this.walPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(this.walPath, { flags: 'a' });
  }

  /**
   * 追加消息到WAL
   */
  append(message: ChatMessage): Promise<void> {
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
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 批量追加
   */
  async appendBatch(messages: ChatMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.append(msg);
    }
  }

  /**
   * 读取未提交的WAL记录
   */
  async readUncommitted(): Promise<ChatMessage[]> {
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
  clear(): void {
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
  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}
