/**
 * Configuration management for SilkTalk Pro
 * 
 * FIXES:
 * - Added validation for environment variable values
 * - Fixed deep merge for nested configuration objects
 * - Added type guards for log level validation
 * - FIXED L1: Added empty key validation in setValue
 * - FIXED L2: Added generic type support for getValue
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { SilkNodeConfig } from './types.js';

export const DEFAULT_CONFIG: SilkNodeConfig = {
  listenAddresses: ['/ip4/0.0.0.0/tcp/0'],
  announceAddresses: [],
  transports: {
    tcp: true,
    websocket: true
  },
  nat: {
    upnp: true,
    autonat: true,
    dcutr: true
  },
  relay: {
    enabled: true,
    hop: {
      enabled: false,
      active: false
    },
    autoRelay: {
      enabled: true,
      maxListeners: 2
    }
  },
  discovery: {
    mdns: true,
    dht: true,
    bootstrap: []
  },
  connection: {
    maxConnections: 300,
    minConnections: 10,
    maxConnectionsPerPeer: 5
  },
  logging: {
    level: 'info',
    pretty: false
  }
};

// Valid log levels
const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;
type ValidLogLevel = typeof VALID_LOG_LEVELS[number];

function isValidLogLevel(level: string): level is ValidLogLevel {
  return VALID_LOG_LEVELS.includes(level as ValidLogLevel);
}

export class ConfigManager {
  private configPath: string;
  private config: SilkNodeConfig;
  private isLoading = false;

  constructor(configPath?: string) {
    this.configPath = configPath ?? this.getDefaultConfigPath();
    this.config = { ...DEFAULT_CONFIG };
  }

  private getDefaultConfigPath(): string {
    return join(homedir(), '.silktalk', 'config.json');
  }

  async load(): Promise<SilkNodeConfig> {
    // Prevent concurrent loading
    if (this.isLoading) {
      throw new Error('Config loading already in progress');
    }
    
    this.isLoading = true;
    
    try {
      if (existsSync(this.configPath)) {
        try {
          const content = await readFile(this.configPath, 'utf-8');
          const loaded = JSON.parse(content) as SilkNodeConfig;
          this.config = this.mergeConfig(DEFAULT_CONFIG, loaded);
        } catch (error) {
          throw new Error(`Failed to load config from ${this.configPath}: ${(error as Error).message}`);
        }
      }
      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  async save(): Promise<void> {
    try {
      await mkdir(dirname(this.configPath), { recursive: true });
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${(error as Error).message}`);
    }
  }

  async init(): Promise<void> {
    if (!existsSync(this.configPath)) {
      await this.save();
    }
  }

  get(): SilkNodeConfig {
    return { ...this.config };
  }

  set(config: Partial<SilkNodeConfig>): void {
    this.config = this.mergeConfig(this.config, config);
  }

  /**
   * FIXED L1: Added empty key validation
   */
  setValue(key: string, value: unknown): void {
    // Validate key
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }
    
    if (key.trim() === '') {
      throw new Error('Key cannot be empty or whitespace only');
    }
    
    const keys = key.split('.');
    
    // Validate key parts
    for (const k of keys) {
      if (k === '') {
        throw new Error(`Invalid key: "${key}" contains empty segment`);
      }
    }
    
    let current: Record<string, unknown> = this.config as Record<string, unknown>;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]!;
      if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * FIXED L2: Added generic type support for type-safe retrieval
   */
  getValue<T = unknown>(key: string): T | undefined {
    // Validate key
    if (!key || typeof key !== 'string') {
      return undefined;
    }
    
    const keys = key.split('.');
    let current: unknown = this.config;
    
    for (const k of keys) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      const keyToUse = k;
      if (keyToUse === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[keyToUse];
    }
    
    return current as T | undefined;
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfig(base: SilkNodeConfig, override: Partial<SilkNodeConfig>): SilkNodeConfig {
    return this.deepMerge(base as Record<string, unknown>, override as Record<string, unknown>) as SilkNodeConfig;
  }

  /**
   * Recursively merge objects
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          sourceValue !== null &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue !== null &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge nested objects
          result[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          );
        } else {
          // Override with source value
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  getConfigPath(): string {
    return this.configPath;
  }
  
  /**
   * Check if a key exists in the config
   */
  hasValue(key: string): boolean {
    return this.getValue(key) !== undefined;
  }
  
  /**
   * Delete a value from the config
   */
  deleteValue(key: string): boolean {
    const keys = key.split('.');
    let current: Record<string, unknown> = this.config as Record<string, unknown>;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]!;
      if (!(k in current) || typeof current[k] !== 'object' || current[k] === null) {
        return false;
      }
      current = current[k] as Record<string, unknown>;
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey && lastKey in current) {
      delete current[lastKey];
      return true;
    }
    return false;
  }
}

export function loadConfigFromEnv(): Partial<SilkNodeConfig> {
  const config: Partial<SilkNodeConfig> = {};

  if (process.env.SILKTALK_LOG_LEVEL) {
    const level = process.env.SILKTALK_LOG_LEVEL;
    if (isValidLogLevel(level)) {
      config.logging = {
        ...config.logging,
        level
      };
    } else {
      console.warn(`Invalid SILKTALK_LOG_LEVEL: ${level}. Using default.`);
    }
  }

  if (process.env.SILKTALK_PRIVATE_KEY) {
    try {
      const hexString = process.env.SILKTALK_PRIVATE_KEY.replace('0x', '');
      // Validate hex string
      if (!/^[0-9a-fA-F]*$/.test(hexString)) {
        throw new Error('Invalid hex string');
      }
      config.privateKey = Buffer.from(hexString, 'hex');
    } catch (error) {
      console.warn(`Invalid SILKTALK_PRIVATE_KEY: ${(error as Error).message}`);
    }
  }
  
  // Load bootstrap nodes from env
  if (process.env.SILKTALK_BOOTSTRAP) {
    try {
      const bootstrapList = process.env.SILKTALK_BOOTSTRAP.split(',').map(s => s.trim()).filter(Boolean);
      if (bootstrapList.length > 0) {
        config.discovery = {
          ...config.discovery,
          bootstrap: bootstrapList
        };
      }
    } catch (error) {
      console.warn(`Invalid SILKTALK_BOOTSTRAP: ${(error as Error).message}`);
    }
  }
  
  // Load listen addresses from env
  if (process.env.SILKTALK_LISTEN) {
    try {
      const listenList = process.env.SILKTALK_LISTEN.split(',').map(s => s.trim()).filter(Boolean);
      if (listenList.length > 0) {
        config.listenAddresses = listenList;
      }
    } catch (error) {
      console.warn(`Invalid SILKTALK_LISTEN: ${(error as Error).message}`);
    }
  }

  return config;
}
