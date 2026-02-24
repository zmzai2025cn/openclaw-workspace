/**
 * 认证中间件
 * API Key验证
 */

import { Logger } from './logger';

export interface AuthContext {
  apiKey: string;
  timestamp: number;
}

export class AuthMiddleware {
  private validKey: string;
  private logger: Logger;

  constructor(apiKey: string, logger: Logger) {
    this.validKey = apiKey;
    this.logger = logger;
  }

  /**
   * 验证API Key
   */
  validate(authHeader?: string): AuthContext {
    if (!authHeader) {
      this.logger.warn('Missing authorization header');
      throw new Error('Unauthorized');
    }

    // 支持 "Bearer xxx" 或 "xxx" 格式
    const key = authHeader.replace(/^Bearer\s+/i, '');

    if (key !== this.validKey) {
      this.logger.warn('Invalid API key');
      throw new Error('Unauthorized');
    }

    return {
      apiKey: key,
      timestamp: Date.now(),
    };
  }
}