/**
 * Connection manager for SilkTalk Pro with libp2p integration
 * 
 * FIXES:
 * - Fixed timer leak in monitorConnection with proper cleanup tracking
 * - Added atomic connection limit checks with queue-based approach
 * - Added proper cleanup of all resources in closeAllConnections
 * - Fixed division by zero in getStats
 * - FIXED M3: Fixed connection queue race condition with proper async handling
 * - FIXED M4: Added atomic timer cleanup to prevent leaks
 * - FIXED L12: Added BigInt support for byte counters to prevent overflow
 */

import EventEmitter from 'events';
import type { Connection } from '@libp2p/interface';
import type { Logger } from '../core/logger.js';

interface ConnectionStats {
  peerId: string;
  connection: Connection;
  establishedAt: Date;
  lastActivity: Date;
  bytesSent: bigint;
  bytesReceived: bigint;
  latency: number;
  checkInterval?: NodeJS.Timeout;
  isClosing: boolean;
}

interface ConnectionManagerConfig {
  maxConnections: number;
  minConnections: number;
  maxConnectionsPerPeer: number;
  connectionTimeout: number;
  idleTimeout: number;
}

interface QueuedConnection {
  peerId: string;
  connection: Connection;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class ConnectionManager extends EventEmitter {
  private logger: Logger;
  private connections: Map<string, ConnectionStats[]> = new Map();
  private config: ConnectionManagerConfig;
  private activeTimers: Set<NodeJS.Timeout> = new Set();
  private connectionQueue: QueuedConnection[] = [];
  private isProcessingQueue = false;
  private isShuttingDown = false;

  constructor(logger: Logger, config?: Partial<ConnectionManagerConfig>) {
    super();
    this.logger = logger.child({ component: 'ConnectionManager' });
    this.config = {
      maxConnections: 300,
      minConnections: 10,
      maxConnectionsPerPeer: 5,
      connectionTimeout: 30000,
      idleTimeout: 60000,
      ...config
    };
  }

  /**
   * Add a connection with atomic limit checking
   * FIXED M3: Proper async queue handling with Promise-based API
   */
  async addConnection(peerId: string, connection: Connection): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('ConnectionManager is shutting down');
    }
    
    return new Promise((resolve, reject) => {
      this.connectionQueue.push({
        peerId,
        connection,
        resolve,
        reject
      });
      
      // Trigger queue processing
      this.processQueue().catch((error) => {
        this.logger.error(`Error processing connection queue: ${(error as Error).message}`);
      });
    });
  }

  private async processQueue(): Promise<void> {
    // FIXED M3: Proper atomic check with async handling
    if (this.isProcessingQueue || this.connectionQueue.length === 0 || this.isShuttingDown) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.connectionQueue.length > 0 && !this.isShuttingDown) {
        const task = this.connectionQueue.shift();
        if (!task) continue;
        
        try {
          this.processAddConnection(task.peerId, task.connection);
          task.resolve();
        } catch (error) {
          this.logger.error(`Error adding connection: ${(error as Error).message}`);
          task.reject(error as Error);
        }
        
        // Yield to event loop to prevent blocking
        await new Promise(resolve => setImmediate(resolve));
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Check if more items were added during processing
      if (this.connectionQueue.length > 0 && !this.isShuttingDown) {
        this.processQueue().catch((error) => {
          this.logger.error(`Error in follow-up queue processing: ${(error as Error).message}`);
        });
      }
    }
  }

  private processAddConnection(peerId: string, connection: Connection): void {
    const existing = this.connections.get(peerId) || [];
    
    // Check per-peer limit
    if (existing.length >= this.config.maxConnectionsPerPeer) {
      this.logger.warn(`Max connections reached for peer ${peerId}, closing oldest`);
      this.closeOldestConnection(peerId);
    }

    // Check global limit
    const totalConnections = this.getConnectionCount();
    if (totalConnections >= this.config.maxConnections) {
      this.logger.warn(`Global max connections reached (${this.config.maxConnections}), pruning oldest`);
      this.closeOldestConnections(1);
    }

    const stats: ConnectionStats = {
      peerId,
      connection,
      establishedAt: new Date(),
      lastActivity: new Date(),
      bytesSent: BigInt(0),
      bytesReceived: BigInt(0),
      latency: 0,
      isClosing: false
    };

    existing.push(stats);
    this.connections.set(peerId, existing);

    this.logger.debug(`Added connection to ${peerId}, total: ${existing.length}`);
    this.emit('connection:added', peerId, connection);

    // Set up connection monitoring
    this.monitorConnection(stats);
  }

  removeConnection(peerId: string, connectionId: string): void {
    const existing = this.connections.get(peerId);
    if (!existing) return;

    // Find and clean up the connection's timer
    const stats = existing.find(c => c.connection.id === connectionId);
    if (stats) {
      this.cleanupConnectionStats(stats);
    }

    const filtered = existing.filter(c => c.connection.id !== connectionId);
    
    if (filtered.length === 0) {
      this.connections.delete(peerId);
    } else {
      this.connections.set(peerId, filtered);
    }

    this.logger.debug(`Removed connection from ${peerId}`);
    this.emit('connection:removed', peerId, connectionId);
  }

  /**
   * FIXED M4: Atomic cleanup of connection stats
   */
  private cleanupConnectionStats(stats: ConnectionStats): void {
    if (stats.isClosing) {
      return; // Already being cleaned up
    }
    
    stats.isClosing = true;
    
    if (stats.checkInterval) {
      clearInterval(stats.checkInterval);
      this.activeTimers.delete(stats.checkInterval);
      stats.checkInterval = undefined;
    }
  }

  getConnection(peerId: string): Connection | null {
    const connections = this.connections.get(peerId);
    if (!connections || connections.length === 0) {
      return null;
    }

    // Return the best connection (lowest latency, most recent activity)
    const sorted = connections
      .filter(c => !c.isClosing)
      .sort((a, b) => {
        // Prefer lower latency
        if (a.latency !== b.latency) {
          return a.latency - b.latency;
        }
        // Then prefer more recent activity
        return b.lastActivity.getTime() - a.lastActivity.getTime();
      });
    return sorted[0]?.connection ?? null;
  }

  getConnections(peerId?: string): Connection[] {
    if (peerId) {
      const connections = this.connections.get(peerId);
      return connections?.filter(c => !c.isClosing).map(c => c.connection) || [];
    }

    const all: Connection[] = [];
    for (const stats of this.connections.values()) {
      all.push(...stats.filter(c => !c.isClosing).map(c => c.connection));
    }
    return all;
  }

  getAllPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  isConnected(peerId: string): boolean {
    const connections = this.connections.get(peerId);
    return connections !== undefined && connections.some(c => !c.isClosing);
  }

  getConnectionCount(): number {
    let count = 0;
    for (const connections of this.connections.values()) {
      count += connections.filter(c => !c.isClosing).length;
    }
    return count;
  }

  getPeerCount(): number {
    let count = 0;
    for (const [peerId, connections] of this.connections) {
      if (connections.some(c => !c.isClosing)) {
        count++;
      }
    }
    return count;
  }

  updateActivity(peerId: string, connectionId: string, bytesSent = 0, bytesReceived = 0): void {
    const connections = this.connections.get(peerId);
    if (!connections) return;

    const stats = connections.find(c => c.connection.id === connectionId && !c.isClosing);
    if (stats) {
      stats.lastActivity = new Date();
      // FIXED L12: Use BigInt for byte counters
      stats.bytesSent += BigInt(bytesSent);
      stats.bytesReceived += BigInt(bytesReceived);
    }
  }

  updateLatency(peerId: string, connectionId: string, latency: number): void {
    const connections = this.connections.get(peerId);
    if (!connections) return;

    const stats = connections.find(c => c.connection.id === connectionId && !c.isClosing);
    if (stats) {
      stats.latency = latency;
    }
  }

  closeConnection(peerId: string, connectionId?: string): void {
    const connections = this.connections.get(peerId);
    if (!connections) return;

    if (connectionId) {
      const stats = connections.find(c => c.connection.id === connectionId);
      if (stats) {
        this.cleanupConnectionStats(stats);
        
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
        this.removeConnection(peerId, connectionId);
      }
    } else {
      // Close all connections to this peer
      for (const stats of connections) {
        this.cleanupConnectionStats(stats);
        
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
      }
      this.connections.delete(peerId);
    }
  }

  closeAllConnections(): void {
    this.isShuttingDown = true;
    
    // Clear all tracked timers first
    for (const timer of this.activeTimers) {
      clearInterval(timer);
    }
    this.activeTimers.clear();

    // Close all connections
    for (const [, connections] of this.connections) {
      for (const stats of connections) {
        stats.isClosing = true;
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
      }
    }
    this.connections.clear();
    this.connectionQueue = [];
    this.isProcessingQueue = false;
    // Note: We keep isShuttingDown = true to prevent new connections
  }

  pruneConnections(): void {
    const now = Date.now();
    
    for (const [peerId, connections] of this.connections) {
      const toClose: ConnectionStats[] = [];
      const toKeep: ConnectionStats[] = [];

      for (const stats of connections) {
        if (stats.isClosing) {
          continue;
        }
        
        const idleTime = now - stats.lastActivity.getTime();
        
        if (idleTime > this.config.idleTimeout) {
          toClose.push(stats);
        } else {
          toKeep.push(stats);
        }
      }

      // Close idle connections
      for (const stats of toClose) {
        this.logger.debug(`Closing idle connection to ${peerId}`);
        this.cleanupConnectionStats(stats);
        
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
      }

      if (toKeep.length === 0) {
        this.connections.delete(peerId);
      } else {
        this.connections.set(peerId, toKeep);
      }
    }

    // If we have too many connections, close oldest ones
    const totalConnections = this.getConnectionCount();
    if (totalConnections > this.config.maxConnections) {
      this.closeOldestConnections(totalConnections - this.config.maxConnections);
    }
  }

  getStats(): {
    totalConnections: number;
    uniquePeers: number;
    averageLatency: number;
    totalBytesSent: bigint;
    totalBytesReceived: bigint;
  } {
    let totalLatency = 0;
    let latencyCount = 0;
    let totalBytesSent = BigInt(0);
    let totalBytesReceived = BigInt(0);

    for (const connections of this.connections.values()) {
      for (const stats of connections) {
        if (stats.isClosing) continue;
        
        if (stats.latency > 0) {
          totalLatency += stats.latency;
          latencyCount++;
        }
        // FIXED L12: Accumulate BigInt
        totalBytesSent += stats.bytesSent;
        totalBytesReceived += stats.bytesReceived;
      }
    }

    return {
      totalConnections: this.getConnectionCount(),
      uniquePeers: this.getPeerCount(),
      averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
      totalBytesSent,
      totalBytesReceived
    };
  }

  private closeOldestConnection(peerId: string): void {
    const connections = this.connections.get(peerId);
    if (!connections || connections.length === 0) return;

    // Sort by establishment time (oldest first), excluding closing connections
    const sorted = connections
      .filter(c => !c.isClosing)
      .sort((a, b) => a.establishedAt.getTime() - b.establishedAt.getTime());

    const oldest = sorted[0];
    if (oldest) {
      this.cleanupConnectionStats(oldest);
      
      oldest.connection.close().catch((error: Error) => {
        this.logger.error(`Error closing connection: ${error.message}`);
      });
      this.removeConnection(peerId, oldest.connection.id);
    }
  }

  private closeOldestConnections(count: number): void {
    const allConnections: ConnectionStats[] = [];
    
    for (const connections of this.connections.values()) {
      allConnections.push(...connections.filter(c => !c.isClosing));
    }

    // Sort by establishment time (oldest first)
    const sorted = allConnections.sort(
      (a, b) => a.establishedAt.getTime() - b.establishedAt.getTime()
    );

    // Close oldest connections
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      const stats = sorted[i];
      if (stats) {
        this.logger.debug(`Closing oldest connection to ${stats.peerId}`);
        
        this.cleanupConnectionStats(stats);
        
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
        this.removeConnection(stats.peerId, stats.connection.id);
      }
    }
  }

  private monitorConnection(stats: ConnectionStats): void {
    // Monitor connection health
    const checkInterval = setInterval(() => {
      // Skip if already closing
      if (stats.isClosing) {
        clearInterval(checkInterval);
        this.activeTimers.delete(checkInterval);
        return;
      }
      
      const idleTime = Date.now() - stats.lastActivity.getTime();
      
      if (idleTime > this.config.idleTimeout) {
        this.logger.debug(`Connection to ${stats.peerId} idle, closing`);
        this.cleanupConnectionStats(stats);
        
        stats.connection.close().catch((error: Error) => {
          this.logger.error(`Error closing connection: ${error.message}`);
        });
        this.removeConnection(stats.peerId, stats.connection.id);
      }
    }, 10000);

    // Track the timer for cleanup
    stats.checkInterval = checkInterval;
    this.activeTimers.add(checkInterval);
  }
}
