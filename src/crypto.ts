/**
 * 字段级加密
 * 敏感数据加密存储
 */

import * as crypto from 'crypto';

export interface EncryptionConfig {
  key: string;  // 32字节密钥
  algorithm?: string;
}

export class FieldEncryption {
  private key: Buffer;
  private algorithm: string;

  constructor(config: EncryptionConfig) {
    this.key = Buffer.from(config.key, 'hex');
    if (this.key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }
    this.algorithm = config.algorithm || 'aes-256-gcm';
  }

  /**
   * 加密字段
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 格式: iv:encrypted
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密字段
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 批量加密对象字段
   */
  encryptFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field]);
      }
    }
    return result;
  }

  /**
   * 批量解密对象字段
   */
  decryptFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const result = { ...obj };
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.decrypt(result[field]);
      }
    }
    return result;
  }
}