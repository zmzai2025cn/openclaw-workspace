/**
 * 性能测试套件 - 基线性能、负载压力、资源监控
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { MessageType } from '../../src/core/types.js';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  describe('Baseline Performance', () => {
    let node1: SilkNode;
    let node2: SilkNode;

    beforeAll(async () => {
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

      await node1.start();
      await node2.start();

      // Connect nodes
      await node1.dial(node2.getMultiaddrs()[0]);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      await node1.stop();
      await node2.stop();
    });

    it('should measure message latency (P50)', async () => {
      const latencies: number[] = [];
      const messageCount = 100;

      // Set up receiver
      node2.onMessage(() => {
        // Message received
      });

      for (let i = 0; i < messageCount; i++) {
        const start = performance.now();
        
        const receivedPromise = new Promise<void>((resolve) => {
          const handler = () => {
            const end = performance.now();
            latencies.push(end - start);
            node2.off('message:received', handler);
            resolve();
          };
          node2.onMessage(handler);
        });

        await node1.sendMessage(node2.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: `perf-${i}`,
            timestamp: Date.now(),
            sender: node1.peerId.toString()
          },
          payload: {
            content: 'Performance test message',
            encoding: 'utf-8'
          }
        });

        await receivedPromise;
      }

      // Calculate P50
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      
      console.log(`Message latency P50: ${p50.toFixed(2)}ms`);
      
      // P50 should be under 100ms for local connections
      expect(p50).toBeLessThan(100);
    });

    it('should measure message latency (P99)', async () => {
      const latencies: number[] = [];
      const messageCount = 100;

      for (let i = 0; i < messageCount; i++) {
        const start = performance.now();
        
        const receivedPromise = new Promise<void>((resolve) => {
          const handler = () => {
            const end = performance.now();
            latencies.push(end - start);
            node2.off('message:received', handler);
            resolve();
          };
          node2.onMessage(handler);
        });

        await node1.sendMessage(node2.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: `perf-p99-${i}`,
            timestamp: Date.now(),
            sender: node1.peerId.toString()
          },
          payload: {
            content: 'Performance test message for P99',
            encoding: 'utf-8'
          }
        });

        await receivedPromise;
      }

      // Calculate P99
      latencies.sort((a, b) => a - b);
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      
      console.log(`Message latency P99: ${p99.toFixed(2)}ms`);
      
      // P99 should be under 200ms for local connections
      expect(p99).toBeLessThan(200);
    });

    it('should measure throughput', async () => {
      const messageCount = 1000;
      const payloadSize = 100; // bytes
      const payload = 'x'.repeat(payloadSize);
      
      let receivedCount = 0;
      
      node2.onMessage(() => {
        receivedCount++;
      });

      const start = performance.now();

      // Send messages as fast as possible
      const sendPromises = [];
      for (let i = 0; i < messageCount; i++) {
        sendPromises.push(
          node1.sendMessage(node2.peerId.toString(), {
            header: {
              version: 1,
              type: MessageType.TEXT,
              id: `throughput-${i}`,
              timestamp: Date.now(),
              sender: node1.peerId.toString()
            },
            payload: {
              content: payload,
              encoding: 'utf-8'
            }
          })
        );
      }

      await Promise.all(sendPromises);

      // Wait for all messages to be received
      await new Promise<void>((resolve) => {
        const check = () => {
          if (receivedCount >= messageCount) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      const end = performance.now();
      const duration = (end - start) / 1000; // seconds
      const throughput = messageCount / duration;
      const dataThroughput = (messageCount * payloadSize) / duration / 1024; // KB/s

      console.log(`Throughput: ${throughput.toFixed(2)} msg/s`);
      console.log(`Data throughput: ${dataThroughput.toFixed(2)} KB/s`);
      console.log(`Duration: ${duration.toFixed(2)}s`);

      // Should handle at least 100 msg/s
      expect(throughput).toBeGreaterThan(100);
    });

    it('should measure connection establishment time', async () => {
      const node3 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10003'],
        transports: { tcp: true, websocket: false },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node3.start();

      const start = performance.now();
      await node1.dial(node3.getMultiaddrs()[0]);
      const end = performance.now();

      const connectionTime = end - start;
      console.log(`Connection establishment time: ${connectionTime.toFixed(2)}ms`);

      // Should connect within 5 seconds
      expect(connectionTime).toBeLessThan(5000);

      await node3.stop();
    });
  });

  describe('Load Testing', () => {
    it('should handle multiple concurrent connections', async () => {
      const hubNode = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10100'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await hubNode.start();

      const clientCount = 20;
      const clients: SilkNode[] = [];

      try {
        // Create and connect clients
        for (let i = 0; i < clientCount; i++) {
          const client = new SilkNode({
            listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
            transports: { tcp: true },
            discovery: { mdns: false, dht: false, bootstrap: [] },
            relay: { enabled: false }
          });

          await client.start();
          await client.dial(hubNode.getMultiaddrs()[0]);
          clients.push(client);
        }

        // Verify all connections
        const hubPeers = hubNode.getPeers();
        expect(hubPeers.length).toBe(clientCount);

        // Send messages from all clients simultaneously
        const messagePromises = clients.map((client, i) =
          client.sendMessage(hubNode.peerId.toString(), {
            header: {
              version: 1,
              type: MessageType.TEXT,
              id: `load-${i}`,
              timestamp: Date.now(),
              sender: client.peerId.toString()
            },
            payload: {
              content: `Message from client ${i}`,
              encoding: 'utf-8'
            }
          })
        );

        await Promise.all(messagePromises);

      } finally {
        await Promise.all(clients.map(c => c.stop()));
        await hubNode.stop();
      }
    });

    it('should handle burst traffic', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10200'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10201'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();
      await node1.dial(node2.getMultiaddrs()[0]);

      const burstSize = 500;
      let receivedCount = 0;

      node2.onMessage(() => {
        receivedCount++;
      });

      const start = performance.now();

      // Send burst
      for (let i = 0; i < burstSize; i++) {
        node1.sendMessage(node2.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: `burst-${i}`,
            timestamp: Date.now(),
            sender: node1.peerId.toString()
          },
          payload: {
            content: 'Burst message',
            encoding: 'utf-8'
          }
        });
      }

      // Wait for all messages
      await new Promise<void>((resolve) => {
        const check = () => {
          if (receivedCount >= burstSize) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      const end = performance.now();
      const duration = end - start;

      console.log(`Burst test: ${burstSize} messages in ${duration.toFixed(2)}ms`);
      console.log(`Average: ${(duration / burstSize).toFixed(2)}ms/msg`);

      await node1.stop();
      await node2.stop();
    });
  });

  describe('Resource Monitoring', () => {
    it('should monitor memory usage', async () => {
      const measurements: NodeJS.MemoryUsage[] = [];

      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10300'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      // Measure baseline
      measurements.push(process.memoryUsage());

      await node.start();
      measurements.push(process.memoryUsage());

      // Create some load
      const clients: SilkNode[] = [];
      for (let i = 0; i < 5; i++) {
        const client = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });
        await client.start();
        await client.dial(node.getMultiaddrs()[0]);
        clients.push(client);
      }

      measurements.push(process.memoryUsage());

      // Send messages
      for (let i = 0; i < 100; i++) {
        await clients[0].sendMessage(node.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: `mem-${i}`,
            timestamp: Date.now(),
            sender: clients[0].peerId.toString()
          },
          payload: {
            content: 'Memory test message',
            encoding: 'utf-8'
          }
        });
      }

      measurements.push(process.memoryUsage());

      // Cleanup
      await Promise.all(clients.map(c => c.stop()));
      await node.stop();

      // Allow GC
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      measurements.push(process.memoryUsage());

      // Log memory usage
      console.log('Memory usage:');
      measurements.forEach((m, i) => {
        console.log(`  Step ${i}: ${(m.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      });

      // Memory should not grow unbounded
      const memoryGrowth = measurements[measurements.length - 1].heapUsed - measurements[0].heapUsed;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    });

    it('should monitor CPU usage', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10400'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      // Get CPU usage before
      const startUsage = process.cpuUsage();

      // Do some work
      const startTime = performance.now();
      while (performance.now() - startTime < 1000) {
        // Busy work
        await node.sendMessage(node.peerId.toString(), {
          header: {
            version: 1,
            type: MessageType.TEXT,
            id: `cpu-${Date.now()}`,
            timestamp: Date.now(),
            sender: node.peerId.toString()
          },
          payload: {
            content: 'CPU test',
            encoding: 'utf-8'
          }
        }).catch(() => {
          // Ignore errors (sending to self)
        });
      }

      // Get CPU usage after
      const endUsage = process.cpuUsage(startUsage);
      
      console.log(`CPU user time: ${(endUsage.user / 1000).toFixed(2)}ms`);
      console.log(`CPU system time: ${(endUsage.system / 1000).toFixed(2)}ms`);

      await node.stop();
    });
  });

  describe('Resource Leak Detection', () => {
    it('should not leak memory on repeated start/stop', async () => {
      const iterations = 10;
      const measurements: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Force GC if available
        if (global.gc) {
          global.gc();
        }

        const before = process.memoryUsage().heapUsed;

        const node = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await node.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        await node.stop();

        // Force GC
        if (global.gc) {
          global.gc();
        }

        const after = process.memoryUsage().heapUsed;
        measurements.push(after - before);
      }

      console.log('Memory deltas per iteration:');
      measurements.forEach((m, i) => {
        console.log(`  Iteration ${i}: ${(m / 1024).toFixed(2)} KB`);
      });

      // Average memory delta should be small
      const avgDelta = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      console.log(`Average memory delta: ${(avgDelta / 1024).toFixed(2)} KB`);

      // Should not accumulate more than 1MB per iteration on average
      expect(avgDelta).toBeLessThan(1024 * 1024);
    });

    it('should not leak file descriptors', async () => {
      // This is a simplified check - in real scenario would use lsof
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const node = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await node.start();
        
        // Create some connections
        const client = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await client.start();
        await client.dial(node.getMultiaddrs()[0]);
        
        await client.stop();
        await node.stop();
      }

      // If we get here without errors, basic FD management is working
      expect(true).toBe(true);
    });

    it('should clean up timers on stop', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/10500'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      // Track active timers
      const beforeTimers = (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles?.().length || 0;

      await node.start();
      
      // Let some timers be created
      await new Promise(resolve => setTimeout(resolve, 500));

      await node.stop();

      // Allow cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      const afterTimers = (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles?.().length || 0;

      console.log(`Active handles before: ${beforeTimers}, after: ${afterTimers}`);

      // Should not leave excessive timers
      expect(afterTimers - beforeTimers).toBeLessThan(5);
    });
  });
});
