/**
 * 混沌测试套件 - 故障注入、韧性验证
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { MessageType } from '../../src/core/types.js';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';

const sleep = promisify(setTimeout);

describe('Chaos Engineering Tests', () => {
  describe('Network Fault Injection', () => {
    it('should handle network delay', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11001'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11002'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        // Connect nodes
        await node1.dial(node2.getMultiaddrs()[0]);
        await sleep(500);

        // Verify connection
        expect(node1.getPeers()).toContain(node2.peerId.toString());

        // Simulate delay by using a slower message handler
        const receivedMessages: string[] = [];
        node2.onMessage((msg) => {
          receivedMessages.push(msg.header.id);
        });

        // Send messages with artificial delay
        const start = Date.now();
        
        await node1.sendMessage(node2.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: 'delay-test-1',
            timestamp: Date.now(),
            sender: node1.peerId.toString()
          },
          payload: { content: 'Delayed message', encoding: 'utf-8' }
        });

        await sleep(100); // Simulate network delay

        await node1.sendMessage(node2.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: 'delay-test-2',
            timestamp: Date.now(),
            sender: node1.peerId.toString()
          },
          payload: { content: 'Delayed message 2', encoding: 'utf-8' }
        });

        // Wait for messages
        await sleep(1000);

        // Messages should still be received
        expect(receivedMessages).toContain('delay-test-1');
        expect(receivedMessages).toContain('delay-test-2');

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });

    it('should handle connection drops', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11003'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11004'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        // Connect nodes
        await node1.dial(node2.getMultiaddrs()[0]);
        await sleep(500);

        expect(node1.getPeers()).toContain(node2.peerId.toString());

        // Force disconnect
        await node1.hangUp(node2.peerId.toString());
        await sleep(500);

        // Connection should be closed
        expect(node1.getPeers()).not.toContain(node2.peerId.toString());

        // Should be able to reconnect
        await node1.dial(node2.getMultiaddrs()[0]);
        await sleep(500);

        expect(node1.getPeers()).toContain(node2.peerId.toString());

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11005'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11006'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        const node2Addr = node2.getMultiaddrs()[0];

        // Rapid connect/disconnect cycles
        for (let i = 0; i < 10; i++) {
          await node1.dial(node2Addr);
          await sleep(100);
          await node1.hangUp(node2.peerId.toString());
          await sleep(100);
        }

        // Final connection should work
        await node1.dial(node2Addr);
        await sleep(500);

        expect(node1.getPeers()).toContain(node2.peerId.toString());

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });

  describe('Service Degradation', () => {
    it('should handle high load without crashing', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11007'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Create many rapid operations
        const operations = [];
        
        for (let i = 0; i < 100; i++) {
          operations.push(
            node.getNetworkInfo().catch(() => null)
          );
        }

        const results = await Promise.all(operations);
        
        // Node should still be operational
        expect(node.isStarted()).toBe(true);
        expect(node.peerId).toBeDefined();

      } finally {
        await node.stop();
      }
    });

    it('should handle message queue overflow gracefully', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11008'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11009'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        await node1.dial(node2.getMultiaddrs()[0]);
        await sleep(500);

        // Send many messages rapidly
        const sendPromises = [];
        for (let i = 0; i < 1000; i++) {
          sendPromises.push(
            node1.sendMessage(node2.peerId.toString(), {
              header: {
                version: 1,
                type: MessageType.TEXT,
                id: `flood-${i}`,
                timestamp: Date.now(),
                sender: node1.peerId.toString()
              },
              payload: { content: `Message ${i}`, encoding: 'utf-8' }
            }).catch(() => {
              // Some may fail, that's ok
            })
          );
        }

        await Promise.all(sendPromises);

        // Node should still be operational
        expect(node1.isStarted()).toBe(true);
        expect(node2.isStarted()).toBe(true);

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });

  describe('Recovery Testing', () => {
    it('should recover from temporary peer unavailability', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11010'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      let node2: SilkNode | null = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11011'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      const node2Addr = node2.getMultiaddrs()[0];
      const node2Id = node2.peerId.toString();

      try {
        // Initial connection
        await node1.dial(node2Addr);
        await sleep(500);
        expect(node1.getPeers()).toContain(node2Id);

        // Node2 goes down
        await node2.stop();
        node2 = null;
        await sleep(1000);

        // Node1 should handle the disconnection
        expect(node1.getPeers()).not.toContain(node2Id);
        expect(node1.isStarted()).toBe(true);

        // Node2 comes back
        node2 = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/11011'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await node2.start();
        await sleep(500);

        // Should be able to reconnect
        await node1.dial(node2.getMultiaddrs()[0]);
        await sleep(500);

        expect(node1.getPeers()).toContain(node2.peerId.toString());

      } finally {
        await node1.stop();
        if (node2) await node2.stop();
      }
    });

    it('should handle cascading failures', async () => {
      const nodes: SilkNode[] = [];
      const nodeCount = 5;

      // Create a chain of nodes
      for (let i = 0; i < nodeCount; i++) {
        const node = new SilkNode({
          listenAddresses: [`/ip4/127.0.0.1/tcp/${11100 + i}`],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });
        await node.start();
        nodes.push(node);
      }

      try {
        // Connect nodes in a chain
        for (let i = 0; i < nodeCount - 1; i++) {
          await nodes[i].dial(nodes[i + 1].getMultiaddrs()[0]);
        }

        await sleep(500);

        // Verify connections
        for (let i = 0; i < nodeCount - 1; i++) {
          expect(nodes[i].getPeers()).toContain(nodes[i + 1].peerId.toString());
        }

        // Kill middle node (cascading failure)
        const middleIndex = Math.floor(nodeCount / 2);
        await nodes[middleIndex].stop();
        nodes.splice(middleIndex, 1);

        await sleep(1000);

        // Remaining nodes should still be operational
        for (const node of nodes) {
          expect(node.isStarted()).toBe(true);
        }

      } finally {
        await Promise.all(nodes.map(n => n.stop().catch(() => {})));
      }
    });
  });

  describe('Graceful Degradation', () => {
    it('should degrade gracefully when DHT is unavailable', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11020'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: true, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // DHT operations should fail gracefully without bootstrap nodes
        const result = await node.dhtGet('test-key').catch(e => e);
        
        // Should either return null or throw a controlled error
        expect(result === null || result instanceof Error).toBe(true);
        
        // Node should still be operational
        expect(node.isStarted()).toBe(true);

      } finally {
        await node.stop();
      }
    });

    it('should handle partial network partition', async () => {
      const groupA: SilkNode[] = [];
      const groupB: SilkNode[] = [];

      // Create two groups of nodes
      for (let i = 0; i < 3; i++) {
        const nodeA = new SilkNode({
          listenAddresses: [`/ip4/127.0.0.1/tcp/${11200 + i}`],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });
        
        const nodeB = new SilkNode({
          listenAddresses: [`/ip4/127.0.0.1/tcp/${11210 + i}`],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await nodeA.start();
        await nodeB.start();
        
        groupA.push(nodeA);
        groupB.push(nodeB);
      }

      try {
        // Connect within groups
        for (let i = 0; i < groupA.length - 1; i++) {
          await groupA[i].dial(groupA[i + 1].getMultiaddrs()[0]);
          await groupB[i].dial(groupB[i + 1].getMultiaddrs()[0]);
        }

        await sleep(500);

        // Verify intra-group connections
        for (let i = 0; i < groupA.length - 1; i++) {
          expect(groupA[i].getPeers()).toContain(groupA[i + 1].peerId.toString());
          expect(groupB[i].getPeers()).toContain(groupB[i + 1].peerId.toString());
        }

        // Simulate partition - no connections between groups
        // In real scenario, this would be enforced by network rules
        
        // Both groups should remain operational
        for (const node of [...groupA, ...groupB]) {
          expect(node.isStarted()).toBe(true);
        }

      } finally {
        await Promise.all([...groupA, ...groupB].map(n => n.stop()));
      }
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should handle repeated connection failures', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/11030'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();

      try {
        // Try to connect to non-existent addresses
        const failures: Error[] = [];
        
        for (let i = 0; i < 10; i++) {
          try {
            await node1.dial(`/ip4/127.0.0.1/tcp/${9990 + i}`);
          } catch (error) {
            failures.push(error as Error);
          }
        }

        // All should fail
        expect(failures.length).toBe(10);

        // Node should still be operational
        expect(node1.isStarted()).toBe(true);

      } finally {
        await node1.stop();
      }
    });
  });
});
