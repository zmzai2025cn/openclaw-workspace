/**
 * Unit tests for DHT routing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DHTRouting } from '../../../src/routing/dht.js';
import { Logger } from '../../../src/core/logger.js';

describe('DHTRouting', () => {
  let dht: DHTRouting;

  beforeEach(() => {
    const logger = new Logger({ level: 'error' });
    dht = new DHTRouting(logger);
  });

  it('should store and retrieve a value', async () => {
    const key = 'test-key';
    const value = new TextEncoder().encode('test-value');
    
    await dht.put(key, value);
    const retrieved = await dht.get(key);
    
    expect(retrieved).toEqual(value);
  });

  it('should return null for non-existent key', async () => {
    const retrieved = await dht.get('non-existent-key');
    expect(retrieved).toBeNull();
  });

  it('should delete a value', async () => {
    const key = 'delete-key';
    const value = new TextEncoder().encode('delete-value');
    
    await dht.put(key, value);
    const deleted = await dht.delete(key);
    
    expect(deleted).toBe(true);
    
    const retrieved = await dht.get(key);
    expect(retrieved).toBeNull();
  });

  it('should check if key exists', async () => {
    const key = 'exists-key';
    const value = new TextEncoder().encode('exists-value');
    
    expect(await dht.has(key)).toBe(false);
    
    await dht.put(key, value);
    expect(await dht.has(key)).toBe(true);
  });

  it('should return all keys', async () => {
    await dht.put('key1', new TextEncoder().encode('value1'));
    await dht.put('key2', new TextEncoder().encode('value2'));
    
    const keys = await dht.keys();
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  it('should clean up expired records', async () => {
    const key = 'expired-key';
    const value = new TextEncoder().encode('expired-value');
    
    // Store with very short TTL
    await dht.put(key, value, 1);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const cleaned = await dht.cleanup();
    expect(cleaned).toBe(1);
    
    const retrieved = await dht.get(key);
    expect(retrieved).toBeNull();
  });

  it('should return stats', () => {
    const stats = dht.getStats();
    expect(stats).toHaveProperty('routingTableSize');
    expect(stats).toHaveProperty('totalRecords');
    expect(stats).toHaveProperty('networkSizeEstimate');
  });

  it('should create content hash', () => {
    const hash1 = DHTRouting.createContentHash('test content');
    const hash2 = DHTRouting.createContentHash('test content');
    
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
  });
});
