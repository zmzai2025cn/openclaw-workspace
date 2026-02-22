/**
 * Unit tests for SilkNode core
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SilkNode } from '../../../src/core/node.js';
import { MessageType } from '../../../src/core/types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('SilkNode', () => {
  let node: SilkNode;
  let tempKeyPath: string;

  beforeEach(() => {
    // Generate unique temp path for each test
    tempKeyPath = join(tmpdir(), `silktalk-test-${randomBytes(8).toString('hex')}`);
    
    node = new SilkNode({
      listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
      transports: {
        tcp: true,
        websocket: false
      },
      discovery: {
        mdns: false,
        dht: false,
        bootstrap: []
      },
      relay: {
        enabled: false
      }
    });
    
    // Override the identity manager key path
    (node as unknown as { identityManager: { keyPath: string } }).identityManager.keyPath = `${tempKeyPath}-identity.key`;
  });

  afterEach(async () => {
    if (node.isStarted()) {
      await node.stop();
    }
  });

  it('should create a node with default config', () => {
    expect(node).toBeDefined();
    expect(node.isStarted()).toBe(false);
  });

  it('should start and stop successfully', async () => {
    await node.start();
    expect(node.isStarted()).toBe(true);
    
    await node.stop();
    expect(node.isStarted()).toBe(false);
  });

  it('should have a valid peer ID after starting', async () => {
    await node.start();
    const peerId = node.peerId;
    expect(peerId).toBeDefined();
    expect(peerId.toString()).toBeTruthy();
    expect(peerId.toString().length).toBeGreaterThan(10);
  });

  it('should have listen addresses after starting', async () => {
    await node.start();
    const addrs = node.getMultiaddrs();
    expect(addrs.length).toBeGreaterThan(0);
  });

  it('should emit ready event when started', async () => {
    const readyPromise = new Promise<void>((resolve) => {
      node.once('ready', () => resolve());
    });
    
    await node.start();
    await readyPromise;
  });

  it('should emit stop event when stopped', async () => {
    await node.start();
    
    const stopPromise = new Promise<void>((resolve) => {
      node.once('stop', () => resolve());
    });
    
    await node.stop();
    await stopPromise;
  });

  it('should return empty peers list when no connections', async () => {
    await node.start();
    const peers = node.getPeers();
    expect(peers).toEqual([]);
  });

  it('should return network info', async () => {
    await node.start();
    const networkInfo = await node.getNetworkInfo();
    expect(networkInfo).toBeDefined();
    expect(networkInfo.natType).toBeDefined();
    expect(networkInfo.transports).toBeDefined();
  });
  
  it('should prevent concurrent start calls', async () => {
    const start1 = node.start();
    const start2 = node.start(); // Should be ignored
    
    await start1;
    await start2;
    
    expect(node.isStarted()).toBe(true);
  });
  
  it('should prevent concurrent stop calls', async () => {
    await node.start();
    
    const stop1 = node.stop();
    const stop2 = node.stop(); // Should be ignored
    
    await stop1;
    await stop2;
    
    expect(node.isStarted()).toBe(false);
  });
});
