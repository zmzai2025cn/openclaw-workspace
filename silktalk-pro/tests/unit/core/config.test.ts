/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager, DEFAULT_CONFIG } from '../../../src/core/config.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'silktalk-test-'));
    const configPath = join(tempDir, 'config.json');
    configManager = new ConfigManager(configPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should have default config', () => {
    const config = configManager.get();
    expect(config).toBeDefined();
    expect(config.listenAddresses).toBeDefined();
  });

  it('should set and get values', () => {
    configManager.setValue('logging.level', 'debug');
    expect(configManager.getValue('logging.level')).toBe('debug');
  });

  it('should save and load config', async () => {
    configManager.setValue('logging.level', 'debug');
    await configManager.save();
    
    const newManager = new ConfigManager(configManager.getConfigPath());
    await newManager.load();
    
    expect(newManager.getValue('logging.level')).toBe('debug');
  });

  it('should merge config', () => {
    configManager.set({
      logging: {
        level: 'error',
        pretty: true
      }
    });
    
    const config = configManager.get();
    expect(config.logging?.level).toBe('error');
    expect(config.logging?.pretty).toBe(true);
  });
});
