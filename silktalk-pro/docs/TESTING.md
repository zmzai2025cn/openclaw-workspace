# Testing Strategy

## Overview

SilkTalk Pro maintains comprehensive test coverage across multiple levels to ensure reliability in diverse network environments.

## Test Levels

```
┌─────────────────────────────────────────┐
│           E2E Tests                      │
│    (Real network, real nodes)           │
├─────────────────────────────────────────┤
│        Integration Tests                 │
│  (Multiple components, mocked network)  │
├─────────────────────────────────────────┤
│          Unit Tests                      │
│     (Individual components)             │
└─────────────────────────────────────────┘
```

## Unit Tests

### Coverage Requirements

- **Minimum**: 80% line coverage
- **Target**: 90% line coverage
- **Critical paths**: 100% coverage

### Test Structure

```
tests/unit/
├── core/
│   ├── node.test.ts
│   ├── identity.test.ts
│   └── config.test.ts
├── network/
│   ├── transport-manager.test.ts
│   ├── connection-manager.test.ts
│   └── nat-traversal.test.ts
├── protocol/
│   ├── message.test.ts
│   ├── serialization.test.ts
│   └── handler.test.ts
├── routing/
│   ├── dht.test.ts
│   └── discovery.test.ts
└── bridge/
    └── openclaw.test.ts
```

### Example Unit Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageSerializer } from '../../../src/protocol/serializer.js';
import { MessageType } from '../../../src/protocol/types.js';

describe('MessageSerializer', () => {
  let serializer: MessageSerializer;

  beforeEach(() => {
    serializer = new MessageSerializer();
  });

  it('should serialize and deserialize text message', () => {
    const message = {
      header: {
        version: 1,
        type: MessageType.TEXT,
        id: 'test-id',
        timestamp: Date.now(),
        sender: 'QmSender'
      },
      payload: {
        content: 'Hello, World!'
      }
    };

    const serialized = serializer.serialize(message);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.header.type).toBe(MessageType.TEXT);
    expect(deserialized.payload.content).toBe('Hello, World!');
  });

  it('should throw on invalid message format', () => {
    const invalidData = new Uint8Array([0xff, 0xff]);
    
    expect(() => serializer.deserialize(invalidData))
      .toThrow('Invalid message format');
  });

  it('should handle binary data payload', () => {
    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
    const message = {
      header: {
        version: 1,
        type: MessageType.DATA,
        id: 'data-id',
        timestamp: Date.now(),
        sender: 'QmSender'
      },
      payload: {
        mimeType: 'application/octet-stream',
        size: binaryData.length,
        data: binaryData
      }
    };

    const serialized = serializer.serialize(message);
    const deserialized = serializer.deserialize(serialized);

    expect(deserialized.payload.data).toEqual(binaryData);
  });
});
```

## Integration Tests

### Test Scenarios

1. **Multi-Transport Communication**
   - TCP to TCP
   - TCP to WebSocket
   - WebSocket to WebSocket
   - Relay fallback

2. **NAT Traversal**
   - Full cone NAT
   - Restricted NAT
   - Symmetric NAT (relay)

3. **Discovery**
   - mDNS discovery
   - DHT peer discovery
   - Bootstrap connection

4. **Protocol Handshake**
   - Successful handshake
   - Version mismatch
   - Timeout handling

### Test Environment

```typescript
// tests/integration/setup.ts
import { createTestNetwork } from './helpers/network.js';

export async function setupTestNetwork(options: {
  nodeCount: number;
  natTypes?: NatType[];
}): Promise<TestNetwork> {
  return createTestNetwork({
    ...options,
    latency: 10,      // 10ms simulated latency
    packetLoss: 0.01  // 1% packet loss
  });
}

export async function cleanupTestNetwork(network: TestNetwork): Promise<void> {
  await network.stopAll();
}
```

### Example Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestNetwork, cleanupTestNetwork } from './setup.js';
import { MessageType } from '../../src/protocol/types.js';

describe('Multi-Node Communication', () => {
  let network: TestNetwork;

  beforeAll(async () => {
    network = await setupTestNetwork({ nodeCount: 3 });
  });

  afterAll(async () => {
    await cleanupTestNetwork(network);
  });

  it('should relay messages through intermediate node', async () => {
    const [nodeA, nodeB, nodeC] = network.nodes;

    // Node A cannot directly reach Node C
    await network.blockDirectConnection(nodeA, nodeC);

    // But Node B can reach both
    await network.ensureConnection(nodeA, nodeB);
    await network.ensureConnection(nodeB, nodeC);

    // Send message from A to C via B
    const received = await new Promise((resolve) => {
      nodeC.onMessage((msg) => resolve(msg));
      nodeA.sendMessage(nodeC.peerId, {
        type: MessageType.TEXT,
        payload: { content: 'Relayed message' }
      });
    });

    expect(received.payload.content).toBe('Relayed message');
  });

  it('should discover peers via DHT', async () => {
    const [nodeA, nodeB] = network.nodes;

    // Only connect A to B via bootstrap
    await nodeA.dial(nodeB.getMultiaddrs()[0]);

    // Wait for DHT sync
    await network.waitForDHTSync();

    // A should be able to find B's providers
    const providers = await nodeA.findProviders(testCID);
    expect(providers.map(p => p.toString())).toContain(nodeB.peerId.toString());
  });
});
```

## E2E Tests

### Test Environment

Real network conditions with actual libp2p nodes.

```typescript
// tests/e2e/network-scenarios.ts
export const networkScenarios = {
  lan: {
    description: 'Local Area Network',
    setup: async () => {
      // Nodes on same subnet
      return createRealNodes({
        count: 2,
        network: '192.168.1.0/24'
      });
    }
  },
  
  natFullCone: {
    description: 'Full Cone NAT',
    setup: async () => {
      return createNodesBehindNAT({
        natType: 'full-cone',
        publicIP: '203.0.113.1'
      });
    }
  },
  
  natSymmetric: {
    description: 'Symmetric NAT (requires relay)',
    setup: async () => {
      const relay = await createRelayNode();
      const nodes = await createNodesBehindNAT({
        natType: 'symmetric',
        relay: relay.multiaddr
      });
      return { relay, nodes };
    }
  },
  
  firewallRestricted: {
    description: 'Firewall (WebSocket only)',
    setup: async () => {
      return createNodesWithFirewall({
        allowedPorts: [80, 443],
        transports: ['websocket']
      });
    }
  }
};
```

### Example E2E Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { networkScenarios } from './network-scenarios.js';

describe('E2E: NAT Traversal', () => {
  describe('Full Cone NAT', () => {
    let nodes: TestNodes;

    beforeAll(async () => {
      nodes = await networkScenarios.natFullCone.setup();
    }, 60000);

    afterAll(async () => {
      await nodes.cleanup();
    }, 30000);

    it('should establish direct connection through NAT', async () => {
      const [nodeA, nodeB] = nodes;

      await nodeA.dial(nodeB.publicMultiaddr);

      expect(nodeA.isConnected(nodeB.peerId)).toBe(true);
      expect(nodeB.isConnected(nodeA.peerId)).toBe(true);
    }, 30000);

    it('should exchange messages', async () => {
      const [nodeA, nodeB] = nodes;

      const messagePromise = new Promise((resolve) => {
        nodeB.onMessage(resolve);
      });

      await nodeA.sendMessage(nodeB.peerId, {
        type: MessageType.TEXT,
        payload: { content: 'Hello through NAT!' }
      });

      const received = await messagePromise;
      expect(received.payload.content).toBe('Hello through NAT!');
    }, 30000);
  });

  describe('Symmetric NAT with Relay', () => {
    let env: { relay: Node; nodes: Node[] };

    beforeAll(async () => {
      env = await networkScenarios.natSymmetric.setup();
    }, 120000);

    afterAll(async () => {
      await env.nodes.cleanup();
      await env.relay.stop();
    }, 30000);

    it('should connect via relay when direct fails', async () => {
      const [nodeA, nodeB] = env.nodes;

      // Attempt connection (will use relay)
      await nodeA.dial(nodeB.publicMultiaddr);

      // Verify relay connection
      const connA = nodeA.getConnection(nodeB.peerId);
      expect(connA.remoteAddr.toString()).toContain('p2p-circuit');
    }, 60000);
  });
});
```

## Performance Tests

### Latency Benchmarks

```typescript
// tests/performance/latency.test.ts
import { describe, it, expect } from 'vitest';
import { measureLatency } from './helpers/metrics.js';

describe('Latency Benchmarks', () => {
  it('should have low latency for direct connections', async () => {
    const latency = await measureLatency({
      connectionType: 'direct',
      samples: 100
    });

    expect(latency.p50).toBeLessThan(10);   // 50th percentile < 10ms
    expect(latency.p99).toBeLessThan(50);   // 99th percentile < 50ms
  });

  it('should have acceptable latency for relay connections', async () => {
    const latency = await measureLatency({
      connectionType: 'relay',
      samples: 100
    });

    expect(latency.p50).toBeLessThan(100);  // 50th percentile < 100ms
    expect(latency.p99).toBeLessThan(500);  // 99th percentile < 500ms
  });
});
```

### Throughput Tests

```typescript
describe('Throughput Benchmarks', () => {
  it('should handle high message throughput', async () => {
    const throughput = await measureThroughput({
      messageSize: 1024,      // 1KB messages
      duration: 10000,        // 10 seconds
      connections: 10
    });

    expect(throughput.messagesPerSecond).toBeGreaterThan(1000);
    expect(throughput.bytesPerSecond).toBeGreaterThan(1024 * 1024); // 1MB/s
  });
});
```

## Test Utilities

### Mock Network

```typescript
// tests/helpers/mock-network.ts
export class MockNetwork {
  private nodes: Map<string, MockNode> = new Map();
  private latencyMap: Map<string, number> = new Map();
  private blockedConnections: Set<string> = new Set();

  addNode(node: MockNode): void {
    this.nodes.set(node.peerId.toString(), node);
  }

  setLatency(peerA: string, peerB: string, latencyMs: number): void {
    this.latencyMap.set(`${peerA}:${peerB}`, latencyMs);
  }

  blockConnection(peerA: string, peerB: string): void {
    this.blockedConnections.add(`${peerA}:${peerB}`);
    this.blockedConnections.add(`${peerB}:${peerA}`);
  }

  canConnect(peerA: string, peerB: string): boolean {
    return !this.blockedConnections.has(`${peerA}:${peerB}`);
  }

  getLatency(peerA: string, peerB: string): number {
    return this.latencyMap.get(`${peerA}:${peerB}`) ?? 0;
  }
}
```

### Test Fixtures

```typescript
// tests/helpers/fixtures.ts
export const testFixtures = {
  messages: {
    hello: {
      header: {
        version: 1,
        type: MessageType.HELLO,
        id: 'test-hello',
        timestamp: 1700000000000,
        sender: 'QmTestSender'
      },
      payload: {
        clientVersion: '1.0.0',
        capabilities: ['text', 'data'],
        nonce: 'random-nonce-123'
      }
    },
    
    text: {
      header: {
        version: 1,
        type: MessageType.TEXT,
        id: 'test-text',
        timestamp: 1700000000000,
        sender: 'QmTestSender'
      },
      payload: {
        content: 'Test message content'
      }
    }
  },

  peerIds: {
    alice: 'QmAlice...',
    bob: 'QmBob...',
    charlie: 'QmCharlie...'
  },

  multiaddrs: {
    tcp: '/ip4/127.0.0.1/tcp/4001',
    ws: '/ip4/127.0.0.1/tcp/8080/ws',
    relay: '/ip4/127.0.0.1/tcp/4001/p2p/QmRelay/p2p-circuit'
  }
};
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:e2e
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test level
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/protocol/message.test.ts

# Run with watch mode
npm test -- --watch

# Run with UI
npm test -- --ui
```
