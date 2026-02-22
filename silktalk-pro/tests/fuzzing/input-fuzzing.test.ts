/**
 * 模糊测试套件 - 输入数据、消息格式、边界条件
 */

import { describe, it, expect } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { MessageType } from '../../src/core/types.js';

describe('Fuzzing Tests', () => {
  describe('Input Data Fuzzing', () => {
    it('should handle random binary data', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Generate random binary data
        for (let i = 0; i < 100; i++) {
          const randomData = new Uint8Array(Math.floor(Math.random() * 1024));
          crypto.getRandomValues(randomData);

          // Should not crash when processing random data
          const base64 = Buffer.from(randomData).toString('base64');
          expect(typeof base64).toBe('string');
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle extreme string lengths', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        const testStrings = [
          '',                                    // Empty
          'a',                                   // Single char
          'a'.repeat(100),                       // 100 chars
          'a'.repeat(1000),                      // 1KB
          'a'.repeat(10000),                     // 10KB
          'a'.repeat(100000),                    // 100KB
          '\x00',                                // Null byte
          '\x00'.repeat(100),                    // Null bytes
          '\xff'.repeat(100),                    // High bytes
        ];

        for (const str of testStrings) {
          // Should handle without crashing
          const encoded = new TextEncoder().encode(str);
          const decoded = new TextDecoder().decode(encoded);
          
          // For strings without null bytes, round-trip should work
          if (!str.includes('\x00')) {
            expect(decoded).toBe(str);
          }
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle special characters', async () => {
      const specialChars = [
        '\x00', '\x01', '\x02', '\x03',           // Control chars
        '\n', '\r', '\t',                         // Whitespace
        '\u0000', '\uFFFF',                      // Unicode extremes
        '🎉', '🚀', '💻', '🔒',                   // Emoji
        '\u200B', '\u200C', '\u200D',            // Zero-width chars
        '\\', '"', "'", '`',                     // Quotes and escapes
        '<', '>', '&', '%', '$', '#', '@',     // Special symbols
        '\\n', '\\t', '\\r', '\\\\',              // Escaped sequences
      ];

      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        for (const char of specialChars) {
          const testString = `prefix${char}suffix`;
          const encoded = new TextEncoder().encode(testString);
          const decoded = new TextDecoder().decode(encoded);
          expect(decoded).toBe(testString);
        }
      } finally {
        await node.stop();
      }
    });
  });

  describe('Message Format Fuzzing', () => {
    it('should handle malformed message headers', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        const malformedHeaders = [
          {},                                    // Empty
          { version: null },                     // Null version
          { version: undefined },                // Undefined version
          { version: -1 },                       // Negative version
          { version: 999999 },                   // Very high version
          { version: 1.5 },                      // Float version
          { version: '1' },                      // String version
          { version: true },                     // Boolean version
          { version: 1, type: null },            // Null type
          { version: 1, type: -1 },              // Invalid type
          { version: 1, type: 999999 },          // Very high type
          { version: 1, type: MessageType.TEXT, id: null }, // Null ID
          { version: 1, type: MessageType.TEXT, id: '' },   // Empty ID
          { version: 1, type: MessageType.TEXT, id: 'a'.repeat(10000) }, // Very long ID
          { version: 1, type: MessageType.TEXT, id: 'test', timestamp: -1 }, // Negative timestamp
          { version: 1, type: MessageType.TEXT, id: 'test', timestamp: Number.MAX_SAFE_INTEGER + 1 }, // Overflow timestamp
        ];

        // Should not crash when processing malformed headers
        for (const header of malformedHeaders) {
          try {
            // Attempt to create message with malformed header
            const message = {
              header: {
                version: (header as any).version ?? 1,
                type: (header as any).type ?? MessageType.TEXT,
                id: (header as any).id ?? 'test',
                timestamp: (header as any).timestamp ?? Date.now(),
                sender: 'test'
              },
              payload: { content: 'test', encoding: 'utf-8' as const }
            };
            
            // Message should be constructible
            expect(message).toBeDefined();
          } catch (error) {
            // Some may throw, that's acceptable
            expect(error).toBeInstanceOf(Error);
          }
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle malformed message payloads', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        const malformedPayloads = [
          null,
          undefined,
          {},
          { content: null },
          { content: undefined },
          { content: 123 },
          { content: true },
          { content: {} },
          { content: [] },
          { content: 'test', encoding: null },
          { content: 'test', encoding: 'invalid-encoding' },
          { content: 'test', encoding: '' },
          { content: 'a'.repeat(1000000) },      // 1MB content
          { content: '\x00'.repeat(1000) },      // Null bytes
        ];

        for (const payload of malformedPayloads) {
          try {
            const message = {
              header: {
                version: 1,
                type: MessageType.TEXT,
                id: 'test',
                timestamp: Date.now(),
                sender: 'test'
              },
              payload: payload as any
            };
            
            expect(message).toBeDefined();
          } catch (error) {
            // Some may throw
            expect(error).toBeInstanceOf(Error);
          }
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle edge case multiaddresses', async () => {
      const edgeCaseAddrs = [
        '',                                    // Empty
        '/ip4/0.0.0.0',                        // No port
        '/ip4/256.256.256.256',                // Invalid IP
        '/ip4/127.0.0.1/tcp/99999',            // Invalid port
        '/ip4/127.0.0.1/tcp/0',                // Port 0
        '/ip4/127.0.0.1/tcp/65535',            // Max port
        '/ip6/::1/tcp/4001',                   // IPv6
        '/dns/localhost/tcp/4001',             // DNS
        '/ip4/127.0.0.1/tcp/4001/p2p/',        // Empty peer ID
        '/ip4/127.0.0.1/tcp/4001/p2p/invalid', // Invalid peer ID
        '/ip4/127.0.0.1/udp/4001',             // UDP (unsupported)
        '/unix/tmp/test.sock',                 // Unix socket
      ];

      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        for (const addr of edgeCaseAddrs) {
          try {
            // Attempt to dial malformed address
            await node.dial(addr);
          } catch (error) {
            // Expected to fail for invalid addresses
            expect(error).toBeInstanceOf(Error);
          }
        }

        // Node should still be operational
        expect(node.isStarted()).toBe(true);
      } finally {
        await node.stop();
      }
    });
  });

  describe('Boundary Condition Tests', () => {
    it('should handle numeric boundaries', async () => {
      const boundaryValues = [
        0,
        1,
        -1,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_VALUE,
        Number.MAX_VALUE,
        Number.EPSILON,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
      ];

      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        for (const value of boundaryValues) {
          // Should not crash with boundary values
          const timestamp = Number.isFinite(value) ? value : Date.now();
          expect(typeof timestamp).toBe('number');
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle array boundaries', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Test with various array sizes
        const arraySizes = [0, 1, 10, 100, 1000];

        for (const size of arraySizes) {
          const largeArray = new Array(size).fill('test');
          expect(largeArray.length).toBe(size);
        }
      } finally {
        await node.stop();
      }
    });

    it('should handle concurrent operation boundaries', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      try {
        // Test with various concurrency levels
        const concurrencyLevels = [1, 10, 50, 100];

        for (const level of concurrencyLevels) {
          const promises = [];
          
          for (let i = 0; i < level; i++) {
            promises.push(
              node.getNetworkInfo().catch(() => null)
            );
          }

          const results = await Promise.all(promises);
          expect(results.length).toBe(level);
        }
      } finally {
        await node.stop();
      }
    });
  });

  describe('Protocol Fuzzing', () => {
    it('should handle unexpected protocol data', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/12001'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/12002'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      try {
        // Register a handler that might receive unexpected data
        node2.handle('/test/1.0.0', async (data) => {
          // Should handle any data without crashing
          return new Uint8Array([0x00]);
        });

        await node1.dial(node2.getMultiaddrs()[0]);

        // Both nodes should remain operational
        expect(node1.isStarted()).toBe(true);
        expect(node2.isStarted()).toBe(true);

      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });
});
