/**
 * DHT routing for SilkTalk Pro with libp2p integration
 * 
 * FIXES:
 * - Added automatic cleanup of expired records
 * - Reused TextEncoder instance for performance
 * - Added cleanup interval management
 * - FIXED L7: Verified cleanup interval is properly reset
 */

import type { Libp2p } from 'libp2p';
import type { Logger } from '../core/logger.js';

export interface DHTRecord {
  key: string;
  value: Uint8Array;
  timestamp: number;
  ttl: number;
}

export interface DHTQueryOptions {
  timeout?: number;
  maxResults?: number;
}

export interface DHTStats {
  routingTableSize: number;
  totalRecords: number;
  networkSizeEstimate: number;
}

export class DHTRouting {
  private logger: Logger;
  private localRecords: Map<string, DHTRecord> = new Map();
  private libp2p: Libp2p | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private textEncoder: InstanceType<typeof TextEncoder>;
  private textDecoder: InstanceType<typeof TextDecoder>;
  private running = false;
  private isRunning = false;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'DHTRouting' });
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('DHT routing already started');
      return;
    }
    
    this.logger.info('DHT routing started');
    this.running = true;
    
    // FIXED L7: Clear any existing interval first
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Start periodic cleanup of expired records
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error: Error) => {
        this.logger.error(`Error during cleanup: ${error.message}`);
      });
    }, 60000); // Run cleanup every minute
  }

  async stop(): Promise<void> {
    this.logger.info('DHT routing stopped');
    
    this.running = false;
    
    // FIXED L7: Properly clear and reset interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.localRecords.clear();
  }

  setLibp2p(libp2p: Libp2p): void {
    this.libp2p = libp2p;
  }

  /**
   * Store a value in the DHT
   */
  async put(key: string, value: Uint8Array, ttl = 24 * 60 * 60 * 1000): Promise<void> {
    // Validate inputs
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid key: must be a non-empty string');
    }
    
    if (!value || !(value instanceof Uint8Array)) {
      throw new Error('Invalid value: must be a Uint8Array');
    }
    
    if (ttl <= 0) {
      throw new Error('Invalid TTL: must be positive');
    }

    const record: DHTRecord = {
      key,
      value,
      timestamp: Date.now(),
      ttl
    };

    this.localRecords.set(key, record);
    this.logger.debug(`Stored record with key: ${key}`);

    // If libp2p is available and DHT service is enabled, also store in network DHT
    if (this.libp2p) {
      try {
        const dht = (this.libp2p.services as Record<string, unknown>).dht as 
          { put: (key: Uint8Array, value: Uint8Array) => Promise<void> } | undefined;
        
        if (dht) {
          const keyBytes = this.textEncoder.encode(key);
          await dht.put(keyBytes, value);
          this.logger.debug(`Stored record in network DHT: ${key}`);
        }
      } catch (error) {
        this.logger.debug(`Failed to store in network DHT: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Retrieve a value from the DHT
   */
  async get(key: string): Promise<Uint8Array | null> {
    if (!key || typeof key !== 'string') {
      return null;
    }
    
    // First check local records with expiration check
    const localRecord = this.localRecords.get(key);
    
    if (localRecord) {
      // Check if record has expired
      if (Date.now() > localRecord.timestamp + localRecord.ttl) {
        this.localRecords.delete(key);
        this.logger.debug(`Expired record removed: ${key}`);
      } else {
        this.logger.debug(`Retrieved record from local store: ${key}`);
        return localRecord.value;
      }
    }

    // If libp2p is available and DHT service is enabled, try network DHT
    if (this.libp2p) {
      try {
        const dht = (this.libp2p.services as Record<string, unknown>).dht as 
          { get: (key: Uint8Array) => Promise<Uint8Array> } | undefined;
        
        if (dht) {
          const keyBytes = this.textEncoder.encode(key);
          const value = await dht.get(keyBytes);
          this.logger.debug(`Retrieved record from network DHT: ${key}`);
          return value;
        }
      } catch (error) {
        this.logger.debug(`Failed to retrieve from network DHT: ${(error as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Delete a value from the DHT
   */
  async delete(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    const existed = this.localRecords.has(key);
    this.localRecords.delete(key);
    
    if (existed) {
      this.logger.debug(`Deleted record with key: ${key}`);
    }
    
    return existed;
  }

  /**
   * Check if a key exists in the DHT
   */
  async has(key: string): Promise<boolean> {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    const record = this.localRecords.get(key);
    
    if (!record) {
      return false;
    }

    // Check if record has expired
    if (Date.now() > record.timestamp + record.ttl) {
      this.localRecords.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys in the DHT
   */
  async keys(): Promise<string[]> {
    const keys: string[] = [];
    const now = Date.now();

    for (const [key, record] of this.localRecords) {
      if (now <= record.timestamp + record.ttl) {
        keys.push(key);
      } else {
        this.localRecords.delete(key);
      }
    }

    return keys;
  }

  /**
   * Clean up expired records
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.localRecords) {
      if (now > record.timestamp + record.ttl) {
        this.localRecords.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired records`);
    }

    return cleaned;
  }

  /**
   * Get DHT statistics
   */
  getStats(): DHTStats {
    let routingTableSize = 0;
    let networkSizeEstimate = 0;

    if (this.libp2p) {
      try {
        const dht = (this.libp2p.services as Record<string, unknown>).dht as 
          { routingTable?: { size: number }; networkSize?: number } | undefined;
        
        if (dht) {
          routingTableSize = dht.routingTable?.size ?? 0;
          networkSizeEstimate = dht.networkSize ?? 0;
        }
      } catch {
        // DHT service not available
      }
    }

    return {
      routingTableSize,
      totalRecords: this.localRecords.size,
      networkSizeEstimate
    };
  }
  
  /**
   * Check if DHT routing is running
   */
  getIsRunning(): boolean {
    return this.running;
  }
  
  /**
   * Get local record count
   */
  getLocalRecordCount(): number {
    return this.localRecords.size;
  }

  /**
   * Create a content hash for provider records
   */
  static createContentHash(content: string | Uint8Array): string {
    // Simple hash for demonstration
    // In production, use proper CID creation
    if (typeof content === 'string') {
      return Buffer.from(content).toString('base64');
    }
    return Buffer.from(content).toString('base64');
  }
}
