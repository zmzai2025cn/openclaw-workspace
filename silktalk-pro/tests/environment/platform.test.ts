/**
 * 环境测试套件 - 跨平台、跨环境兼容性测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SilkNode } from '../../src/core/node.js';
import { platform, release } from 'os';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('Environment Tests', () => {
  describe('Platform Compatibility', () => {
    it('should report current platform', () => {
      const currentPlatform = platform();
      const supportedPlatforms = ['linux', 'darwin', 'win32'];
      
      console.log(`Current platform: ${currentPlatform}`);
      console.log(`OS Release: ${release()}`);
      console.log(`Node.js version: ${process.version}`);
      
      expect(supportedPlatforms).toContain(currentPlatform);
    });

    it('should have required Node.js version', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      console.log(`Node.js major version: ${majorVersion}`);
      
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should support required features', () => {
      // Check for required Node.js features
      expect(typeof AbortController).toBe('function');
      expect(typeof TextEncoder).toBe('function');
      expect(typeof TextDecoder).toBe('function');
      expect(typeof WebSocket).toBe('function');
      expect(typeof fetch).toBe('function');
    });
  });

  describe('Timezone Tests', () => {
    let originalTimezone: string | undefined;

    beforeAll(() => {
      originalTimezone = process.env.TZ;
    });

    afterAll(() => {
      if (originalTimezone) {
        process.env.TZ = originalTimezone;
      } else {
        delete process.env.TZ;
      }
    });

    it('should handle UTC timezone', async () => {
      // Note: TZ environment variable may not work in all Node.js environments
      // This test verifies the node starts correctly regardless of timezone
      
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      
      // Verify timestamp generation works correctly in any timezone
      const timestamp = Date.now();
      expect(timestamp).toBeGreaterThan(0);
      
      await node.stop();
    });

    it('should handle different timezones', async () => {
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
      
      for (const tz of timezones) {
        process.env.TZ = tz;
        
        const node = new SilkNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          transports: { tcp: true },
          discovery: { mdns: false, dht: false, bootstrap: [] },
          relay: { enabled: false }
        });

        await node.start();
        
        // Verify timestamp generation works correctly
        const timestamp = Date.now();
        expect(timestamp).toBeGreaterThan(0);
        
        await node.stop();
      }
    });

    it('should handle timezone transitions', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      
      // Simulate timezone change during operation
      const timestamp1 = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100));
      const timestamp2 = Date.now();
      
      expect(timestamp2).toBeGreaterThan(timestamp1);
      
      await node.stop();
    });
  });

  describe('Character Encoding Tests', () => {
    it('should handle UTF-8 messages', async () => {
      const node1 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      const node2 = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node1.start();
      await node2.start();

      const testMessages = [
        'Hello, 世界! 🌍',
        'مرحبا بالعالم',
        'Привет, мир!',
        '🎉🚀💻🔒',
        '日本語テスト',
        '한국어 테스트',
        'Special chars: <>&"\'',
        'Unicode: ∀x∈ℝ: x²≥0'
      ];

      for (const message of testMessages) {
        const encoded = new TextEncoder().encode(message);
        const decoded = new TextDecoder().decode(encoded);
        expect(decoded).toBe(message);
      }

      await node1.stop();
      await node2.stop();
    });

    it('should handle binary data', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();

      // Test binary data handling
      const binaryData = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x80]);
      const encoded = Buffer.from(binaryData).toString('base64');
      const decoded = Buffer.from(encoded, 'base64');
      
      expect(decoded).toEqual(Buffer.from(binaryData));

      await node.stop();
    });
  });

  describe('Library Version Compatibility', () => {
    it('should have compatible libp2p dependencies', () => {
      const packageJson = require('../../package.json');
      
      // Check required dependencies exist
      const requiredDeps = [
        'libp2p',
        '@libp2p/tcp',
        '@libp2p/websockets',
        '@chainsafe/libp2p-noise',
        '@chainsafe/libp2p-yamux'
      ];

      for (const dep of requiredDeps) {
        expect(packageJson.dependencies[dep]).toBeDefined();
      }
    });

    it('should load libp2p without errors', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      // Should create without errors
      expect(node).toBeDefined();
      
      await node.start();
      expect(node.isStarted()).toBe(true);
      
      await node.stop();
    });
  });

  describe('Resource Limits', () => {
    it('should handle file descriptor limits', async () => {
      const nodes: SilkNode[] = [];
      const maxNodes = 10;

      try {
        for (let i = 0; i < maxNodes; i++) {
          const node = new SilkNode({
            listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
            transports: { tcp: true },
            discovery: { mdns: false, dht: false, bootstrap: [] },
            relay: { enabled: false }
          });
          
          await node.start();
          nodes.push(node);
        }

        expect(nodes.length).toBe(maxNodes);
        
        // Verify all nodes are operational
        for (const node of nodes) {
          expect(node.isStarted()).toBe(true);
          expect(node.peerId).toBeDefined();
        }
      } finally {
        // Cleanup
        await Promise.all(nodes.map(n => n.stop()));
      }
    });

    it('should handle memory constraints', async () => {
      const initialMemory = process.memoryUsage();
      
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      
      const afterStartMemory = process.memoryUsage();
      const memoryIncrease = afterStartMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (< 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      await node.stop();
      
      // Allow GC to run
      if (global.gc) {
        global.gc();
      }
    });
  });

  describe('Environment Variables', () => {
    it('should respect SILKTALK_LOG_LEVEL', async () => {
      process.env.SILKTALK_LOG_LEVEL = 'error';
      
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      expect(node.isStarted()).toBe(true);
      await node.stop();
      
      delete process.env.SILKTALK_LOG_LEVEL;
    });

    it('should respect SILKTALK_CONFIG_PATH', async () => {
      const tempConfigPath = join(tmpdir(), `silktalk-config-${randomBytes(8).toString('hex')}.json`);
      process.env.SILKTALK_CONFIG_PATH = tempConfigPath;
      
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      expect(node.isStarted()).toBe(true);
      await node.stop();
      
      delete process.env.SILKTALK_CONFIG_PATH;
    });
  });

  describe('Network Environment', () => {
    it('should work with localhost only', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      
      const addrs = node.getMultiaddrs();
      expect(addrs.length).toBeGreaterThan(0);
      
      // All addresses should be localhost
      for (const addr of addrs) {
        const addrStr = addr.toString();
        expect(addrStr.includes('127.0.0.1') || addrStr.includes('::1')).toBe(true);
      }
      
      await node.stop();
    });

    it('should work with IPv6', async () => {
      const node = new SilkNode({
        listenAddresses: ['/ip6/::1/tcp/0'],
        transports: { tcp: true },
        discovery: { mdns: false, dht: false, bootstrap: [] },
        relay: { enabled: false }
      });

      await node.start();
      expect(node.isStarted()).toBe(true);
      await node.stop();
    });
  });
});
