# API Documentation

## Overview

SilkTalk Pro provides both programmatic and CLI interfaces for managing P2P nodes and communication.

## Programmatic API

### SilkNode Class

Main entry point for the P2P node.

```typescript
import { SilkNode } from 'silktalk-pro';

const node = new SilkNode({
  // Configuration options
});

await node.start();
```

### Configuration Interface

```typescript
interface SilkNodeConfig {
  // Identity
  privateKey?: Uint8Array;      // Pre-existing private key
  
  // Network
  listenAddresses?: string[];   // Multiaddrs to listen on
  announceAddresses?: string[]; // Multiaddrs to announce
  
  // Transports
  transports?: {
    tcp?: boolean | TcpConfig;
    websocket?: boolean | WsConfig;
    webrtc?: boolean | WebRTCConfig;
  };
  
  // NAT Traversal
  nat?: {
    upnp?: boolean;
    autonat?: boolean;
    dcutr?: boolean;
  };
  
  // Relay
  relay?: {
    enabled?: boolean;
    hop?: {
      enabled?: boolean;
      active?: boolean;
    };
    autoRelay?: {
      enabled?: boolean;
      maxListeners?: number;
    };
  };
  
  // Discovery
  discovery?: {
    mdns?: boolean;
    dht?: boolean | DHTConfig;
    bootstrap?: string[];  // Bootstrap multiaddrs
  };
  
  // Connection
  connection?: {
    maxConnections?: number;
    minConnections?: number;
    maxConnectionsPerPeer?: number;
  };
  
  // Logging
  logging?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
  };
}
```

### Node Lifecycle

```typescript
// Create and start node
const node = new SilkNode(config);
await node.start();

// Check status
console.log(node.isStarted());  // true
console.log(node.peerId);       // PeerId instance

// Stop node
await node.stop();
```

### Messaging API

#### Send Message

```typescript
// Send text message
await node.sendMessage(peerId, {
  type: MessageType.TEXT,
  payload: {
    content: 'Hello, World!'
  }
});

// Send with options
await node.sendMessage(peerId, message, {
  timeout: 30000,      // 30 second timeout
  requireAck: true,    // Wait for acknowledgment
  priority: 'high'     // Message priority
});
```

#### Receive Messages

```typescript
// Subscribe to messages
const unsubscribe = node.onMessage((message, peerId) => {
  console.log(`Received from ${peerId}:`, message);
});

// Later: unsubscribe
unsubscribe();
```

#### Message Handler

```typescript
// Register specific handler
node.handle('custom-protocol', async (data, peerId) => {
  // Process custom protocol
  return response;
});
```

### Peer Management

```typescript
// Get connected peers
const peers = node.getPeers();

// Get peer info
const peerInfo = await node.getPeerInfo(peerId);

// Connect to peer
await node.dial(multiaddr);

// Disconnect from peer
await node.hangUp(peerId);

// Check if connected
const isConnected = node.isConnected(peerId);
```

### Connection Events

```typescript
// Peer connected
node.on('peer:connect', (peerId) => {
  console.log(`Peer connected: ${peerId}`);
});

// Peer disconnected
node.on('peer:disconnect', (peerId) => {
  console.log(`Peer disconnected: ${peerId}`);
});

// New protocol handler registered
node.on('protocol:register', (protocol) => {
  console.log(`Protocol registered: ${protocol}`);
});
```

### Network Information

```typescript
// Get listen addresses
const addrs = node.getMultiaddrs();

// Get network info
const networkInfo = await node.getNetworkInfo();
// {
//   natType: 'full-cone',
//   publicAddresses: [...],
//   transports: [...],
//   relayReservations: [...]
// }
```

### DHT Operations

```typescript
// Put value to DHT
await node.dhtPut(key, value);

// Get value from DHT
const value = await node.dhtGet(key);

// Provide content
await node.provide(cid);

// Find providers
const providers = await node.findProviders(cid);

// Find peer
const peerInfo = await node.findPeer(peerId);
```

## CLI API

### Global Options

```bash
silktalk [options] [command]

Options:
  -V, --version                    output the version number
  -c, --config <path>             path to config file
  -v, --verbose                   enable verbose logging
  -h, --help                      display help for command
```

### Commands

#### Start Node

```bash
silktalk start [options]

Options:
  -p, --port <port>               TCP listen port (default: 0)
  -w, --ws-port <port>            WebSocket listen port
  --ws                            enable WebSocket transport
  --wss                           enable secure WebSocket
  --mdns                          enable mDNS discovery (default: true)
  --dht                           enable DHT (default: true)
  --relay                         enable relay client (default: true)
  --relay-hop                     enable relay hop (serve as relay)
  --bootstrap <addrs...>          bootstrap nodes
  --upnp                          enable UPnP NAT traversal
  --max-connections <n>           max connections (default: 300)
  --log-level <level>             log level (default: info)
```

**Examples**:

```bash
# Start with default settings
silktalk start

# Start with specific ports
silktalk start --port 4001 --ws-port 8080

# Start as relay server
silktalk start --port 4001 --relay-hop

# Start with bootstrap nodes
silktalk start --bootstrap /dns4/bootstrap.example.com/tcp/4001/p2p/Qm...
```

#### Status

```bash
silktalk status [options]

Options:
  --json                          output as JSON
```

**Output**:
```json
{
  "peerId": "Qm...",
  "started": true,
  "addresses": [...],
  "peers": {
    "total": 10,
    "connected": 5
  },
  "transports": [...],
  "nat": {
    "type": "full-cone",
    "reachable": true
  }
}
```

#### Connect

```bash
silktalk connect <multiaddr>

Arguments:
  multiaddr                       peer multiaddr to connect to
```

**Example**:
```bash
silktalk connect /ip4/192.168.1.100/tcp/4001/p2p/Qm...
```

#### Peers

```bash
silktalk peers [options]

Options:
  --json                          output as JSON
  --connected                     show only connected peers
```

#### Send

```bash
silktalk send <peer> <message>

Arguments:
  peer                            peer ID or alias
  message                         message to send

Options:
  --wait-ack                      wait for acknowledgment
  --timeout <ms>                  timeout in milliseconds
```

**Example**:
```bash
silktalk send Qm... "Hello, World!"
silktalk send Qm... "Urgent message" --wait-ack --timeout 5000
```

#### Listen

```bash
silktalk listen [options]

Options:
  --format <format>               output format (json, pretty)
  --filter <pattern>              filter messages by pattern
```

**Example**:
```bash
# Listen for all messages
silktalk listen

# Listen with JSON output
silktalk listen --format json
```

#### DHT

```bash
silktalk dht <subcommand>

Subcommands:
  get <key>                       get value from DHT
  put <key> <value>               put value to DHT
  find-peer <peerId>              find peer in DHT
  provide <cid>                   provide content
  find-providers <cid>            find providers for content
```

**Examples**:
```bash
silktalk dht put my-key "my-value"
silktalk dht get my-key
silktalk dht find-peer Qm...
```

#### Config

```bash
silktalk config <subcommand>

Subcommands:
  get <key>                       get config value
  set <key> <value>               set config value
  list                            list all config
  init                            initialize default config
```

**Examples**:
```bash
silktalk config init
silktalk config set log.level debug
silktalk config get log.level
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SILKTALK_LOG_LEVEL` | Log level | `info` |
| `SILKTALK_CONFIG_PATH` | Config file path | `~/.silktalk/config.json` |
| `SILKTALK_DATA_PATH` | Data directory | `~/.silktalk/data` |
| `SILKTALK_PRIVATE_KEY` | Private key (hex) | auto-generated |

## TypeScript Types

### Core Types

```typescript
// Message types
export enum MessageType {
  HELLO = 0,
  TEXT = 1,
  DATA = 2,
  COMMAND = 3,
  ACK = 4,
  ERROR = 5
}

// Message interface
export interface SilkMessage {
  header: MessageHeader;
  payload: MessagePayload;
  metadata?: Record<string, unknown>;
}

// Peer info
export interface PeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  metadata?: Record<string, unknown>;
}

// Connection info
export interface ConnectionInfo {
  peerId: string;
  direction: 'inbound' | 'outbound';
  transports: string[];
  latency: number;
  established: Date;
}

// Network info
export interface NetworkInfo {
  natType: 'full-cone' | 'restricted' | 'port-restricted' | 'symmetric' | 'unknown';
  publicAddresses: string[];
  privateAddresses: string[];
  transports: string[];
  relayReservations: string[];
}
```

### Event Types

```typescript
export interface NodeEvents {
  'peer:connect': (peerId: string) => void;
  'peer:disconnect': (peerId: string) => void;
  'message:received': (message: SilkMessage, peerId: string) => void;
  'message:sent': (messageId: string, peerId: string) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'stop': () => void;
}
```

## Error Handling

### Error Types

```typescript
class SilkTalkError extends Error {
  code: string;
  retryable: boolean;
}

class ConnectionError extends SilkTalkError {
  // Connection-related errors
}

class ProtocolError extends SilkTalkError {
  // Protocol-related errors
}

class ValidationError extends SilkTalkError {
  // Input validation errors
}
```

### Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `CONNECTION_FAILED` | Failed to connect to peer | Yes |
| `CONNECTION_TIMEOUT` | Connection timed out | Yes |
| `PROTOCOL_NOT_SUPPORTED` | Peer doesn't support protocol | No |
| `MESSAGE_TOO_LARGE` | Message exceeds size limit | No |
| `INVALID_MESSAGE` | Malformed message | No |
| `PEER_NOT_FOUND` | Peer not found in DHT | Yes |
| `DHT_TIMEOUT` | DHT operation timed out | Yes |

## Examples

### Basic Chat Application

```typescript
import { SilkNode, MessageType } from 'silktalk-pro';

async function main() {
  // Create node
  const node = new SilkNode({
    transports: { tcp: true, websocket: true },
    discovery: { mdns: true, dht: true }
  });
  
  // Start node
  await node.start();
  
  console.log('Node started:', node.peerId.toString());
  
  // Handle incoming messages
  node.onMessage((msg, peerId) => {
    if (msg.header.type === MessageType.TEXT) {
      console.log(`${peerId}: ${msg.payload.content}`);
    }
  });
  
  // Send message to peer
  const peerId = process.argv[2];
  const message = process.argv[3];
  
  if (peerId && message) {
    await node.sendMessage(peerId, {
      type: MessageType.TEXT,
      payload: { content: message }
    });
  }
}

main().catch(console.error);
```

### File Transfer

```typescript
// Send file
async function sendFile(node: SilkNode, peerId: string, filePath: string) {
  const data = await fs.readFile(filePath);
  
  await node.sendMessage(peerId, {
    type: MessageType.DATA,
    payload: {
      mimeType: 'application/octet-stream',
      size: data.length,
      data: data,
      filename: path.basename(filePath)
    }
  });
}

// Receive file
node.onMessage(async (msg, peerId) => {
  if (msg.header.type === MessageType.DATA) {
    const { filename, data } = msg.payload;
    await fs.writeFile(`./received/${filename}`, data);
    console.log(`Received file: ${filename}`);
  }
});
```
