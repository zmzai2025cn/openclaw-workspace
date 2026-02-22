/**
 * E2E tests for node communication
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { MessageType } from '../../src/core/types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

describe('Node Communication E2E', () => {
  let node1: SilkNode;
  let node2: SilkNode;
  let tempPath1: string;
  let tempPath2: string;

  beforeAll(async () => {
    // Generate unique temp paths for each node
    tempPath1 = join(tmpdir(), `silktalk-e2e-${randomBytes(8).toString('hex')}`);
    tempPath2 = join(tmpdir(), `silktalk-e2e-${randomBytes(8).toString('hex')}`);
    
    // Create two nodes with different ports
    node1 = new SilkNode({
      listenAddresses: ['/ip4/127.0.0.1/tcp/10001'],
      transports: { tcp: true, websocket: false },
      discovery: { mdns: false, dht: false, bootstrap: [] },
      relay: { enabled: false }
    });

    node2 = new SilkNode({
      listenAddresses: ['/ip4/127.0.0.1/tcp/10002'],
      transports: { tcp: true, websocket: false },
      discovery: { mdns: false, dht: false, bootstrap: [] },
      relay: { enabled: false }
    });

    // Override identity key paths to avoid conflicts
    (node1 as unknown as { identityManager: { keyPath: string } }).identityManager.keyPath = `${tempPath1}-identity.key`;
    (node2 as unknown as { identityManager: { keyPath: string } }).identityManager.keyPath = `${tempPath2}-identity.key`;

    await node1.start();
    await node2.start();

    // Wait for nodes to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await node1.stop();
    await node2.stop();
  });

  it('should have different peer IDs', () => {
    expect(node1.peerId.toString()).not.toBe(node2.peerId.toString());
  });

  it('should connect two nodes', async () => {
    const node2Addr = node2.getMultiaddrs()[0];
    expect(node2Addr).toBeDefined();

    // Node 1 dials Node 2
    await node1.dial(node2Addr);

    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check that node1 sees node2 as connected
    const node1Peers = node1.getPeers();
    expect(node1Peers).toContain(node2.peerId.toString());
  });

  it('should exchange messages between connected nodes', async () => {
    const receivedMessages: Array<{ message: unknown; peerId: string }> = [];

    // Set up message handler on node2
    node2.onMessage((message, peerId) => {
      receivedMessages.push({ message, peerId });
    });

    // Send message from node1 to node2
    const testMessage = {
      header: {
        version: 1,
        type: MessageType.TEXT,
        id: `test-${Date.now()}`,
        timestamp: Date.now(),
        sender: node1.peerId.toString()
      },
      payload: {
        content: 'Hello from Node 1!',
        encoding: 'utf-8' as const
      }
    };

    await node1.sendMessage(node2.peerId.toString(), testMessage);

    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify message was received
    expect(receivedMessages.length).toBeGreaterThan(0);
    expect(receivedMessages[0].peerId).toBe(node1.peerId.toString());
  });

  it('should handle disconnection', async () => {
    // Disconnect node1 from node2
    await node1.hangUp(node2.peerId.toString());

    // Wait for disconnection
    await new Promise(resolve => setTimeout(resolve, 500));

    // Node1 should no longer see node2 as connected
    const node1Peers = node1.getPeers();
    expect(node1Peers).not.toContain(node2.peerId.toString());
  });
});
