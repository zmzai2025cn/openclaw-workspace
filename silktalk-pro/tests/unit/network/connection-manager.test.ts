/**
 * Unit tests for ConnectionManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../../../src/network/connection-manager.js';
import { Logger } from '../../../src/core/logger.js';

// Mock connection
const createMockConnection = (id: string, peerId: string) => ({
  id,
  remotePeer: { toString: () => peerId },
  remoteAddr: { toString: () => `/ip4/127.0.0.1/tcp/4001/p2p/${peerId}` },
  stat: {
    status: 'OPEN' as const,
    timeline: { open: Date.now(), upgraded: Date.now() },
    direction: 'outbound' as const,
    encryption: 'noise'
  },
  streams: [],
  newStream: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined)
});

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'error' });
    manager = new ConnectionManager(logger, {
      maxConnections: 10,
      maxConnectionsPerPeer: 2
    });
  });

  it('should add a connection', async () => {
    const conn = createMockConnection('conn-1', 'peer-1');
    await manager.addConnection('peer-1', conn as unknown as import('@libp2p/interface').Connection);
    
    expect(manager.isConnected('peer-1')).toBe(true);
    expect(manager.getConnectionCount()).toBe(1);
  });

  it('should remove a connection', async () => {
    const conn = createMockConnection('conn-1', 'peer-1');
    await manager.addConnection('peer-1', conn as unknown as import('@libp2p/interface').Connection);
    
    manager.removeConnection('peer-1', 'conn-1');
    
    expect(manager.isConnected('peer-1')).toBe(false);
    expect(manager.getConnectionCount()).toBe(0);
  });

  it('should respect max connections per peer', async () => {
    const conn1 = createMockConnection('conn-1', 'peer-1');
    const conn2 = createMockConnection('conn-2', 'peer-1');
    const conn3 = createMockConnection('conn-3', 'peer-1');
    
    await manager.addConnection('peer-1', conn1 as unknown as import('@libp2p/interface').Connection);
    await manager.addConnection('peer-1', conn2 as unknown as import('@libp2p/interface').Connection);
    await manager.addConnection('peer-1', conn3 as unknown as import('@libp2p/interface').Connection);
    
    // Should only have 2 connections (maxConnectionsPerPeer)
    // Note: The oldest connection is closed when limit is exceeded
    expect(manager.getConnectionCount()).toBe(2);
  });

  it('should get all peer IDs', async () => {
    const conn1 = createMockConnection('conn-1', 'peer-1');
    const conn2 = createMockConnection('conn-2', 'peer-2');
    
    await manager.addConnection('peer-1', conn1 as unknown as import('@libp2p/interface').Connection);
    await manager.addConnection('peer-2', conn2 as unknown as import('@libp2p/interface').Connection);
    
    const peerIds = manager.getAllPeerIds();
    expect(peerIds).toContain('peer-1');
    expect(peerIds).toContain('peer-2');
  });

  it('should return connection stats', async () => {
    const conn = createMockConnection('conn-1', 'peer-1');
    await manager.addConnection('peer-1', conn as unknown as import('@libp2p/interface').Connection);
    
    const stats = manager.getStats();
    expect(stats.totalConnections).toBe(1);
    expect(stats.uniquePeers).toBe(1);
  });
  
  it('should reject new connections when shutting down', async () => {
    const conn = createMockConnection('conn-1', 'peer-1');
    
    // Close all connections puts manager in shutdown state
    manager.closeAllConnections();
    
    // Reset the shutting down flag for this test since we want to test the behavior
    // The closeAllConnections keeps the manager in shutdown state
    // So new connections should be rejected
    await expect(manager.addConnection('peer-1', conn as unknown as import('@libp2p/interface').Connection))
      .rejects.toThrow('ConnectionManager is shutting down');
  });
  
  it('should track bytes sent and received as BigInt', async () => {
    const conn = createMockConnection('conn-1', 'peer-1');
    await manager.addConnection('peer-1', conn as unknown as import('@libp2p/interface').Connection);
    
    manager.updateActivity('peer-1', 'conn-1', 100, 200);
    
    const stats = manager.getStats();
    expect(stats.totalBytesSent).toBe(BigInt(100));
    expect(stats.totalBytesReceived).toBe(BigInt(200));
  });
});
