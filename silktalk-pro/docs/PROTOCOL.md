# Protocol Specification

## Overview

SilkTalk Pro uses a layered protocol stack built on libp2p. This document specifies the message formats, serialization methods, and protocol handlers.

## Protocol Stack

```
┌─────────────────────────────────────────┐
│        Application Protocols            │
│    (/silktalk/1.0.0/messages, etc.)    │
├─────────────────────────────────────────┤
│        libp2p Core Protocols            │
│  (/ipfs/id/1.0.0, /ipfs/ping/1.0.0)    │
├─────────────────────────────────────────┤
│        Security Protocols               │
│      (/noise, /tls/1.0.0)              │
├─────────────────────────────────────────┤
│        Multiplexing                     │
│      (/yamux/1.0.0, /mplex/6.7.0)      │
├─────────────────────────────────────────┤
│        Transport Protocols              │
│    (/tcp, /ws, /wss, /p2p-circuit)     │
└─────────────────────────────────────────┘
```

## Core Protocols

### 1. Identify Protocol (`/ipfs/id/1.0.0`)

Standard libp2p identify for peer information exchange.

**Purpose**: Exchange peer IDs, supported protocols, and listen addresses.

**Message Flow**:
1. Node A opens stream to Node B
2. Node B sends Identify message
3. Node A updates peer store

### 2. Ping Protocol (`/ipfs/ping/1.0.0`)

Standard libp2p ping for latency measurement and liveness checking.

**Purpose**: Measure round-trip time and detect dead connections.

**Message Format**:
- Request: 32 random bytes
- Response: Echo of 32 bytes

## SilkTalk Application Protocol

### Protocol ID

```
/silktalk/1.0.0/messages
```

### Message Format

All messages use length-prefixed framing with CBOR serialization.

```
┌─────────────────┬─────────────────────────────────────┐
│   Length (varint)   │   CBOR-encoded Message        │
│    (1-5 bytes)      │   (variable length)           │
└─────────────────┴─────────────────────────────────────┘
```

### Message Types

```typescript
enum MessageType {
  HELLO = 0,        // Initial handshake
  TEXT = 1,         // Text message
  DATA = 2,         // Binary data
  COMMAND = 3,      // Control command
  ACK = 4,          // Acknowledgment
  ERROR = 5         // Error response
}
```

### Message Structure

```typescript
interface SilkMessage {
  // Message header
  header: {
    version: number;        // Protocol version (1)
    type: MessageType;      // Message type
    id: string;             // Unique message ID (UUID)
    timestamp: number;      // Unix timestamp (ms)
    sender: string;         // Sender peer ID
    recipient?: string;     // Recipient peer ID (optional for broadcast)
  };
  
  // Message payload (type-specific)
  payload: HelloPayload | TextPayload | DataPayload | CommandPayload | AckPayload | ErrorPayload;
  
  // Optional metadata
  metadata?: Record<string, unknown>;
}
```

### Payload Types

#### Hello Payload

```typescript
interface HelloPayload {
  clientVersion: string;    // SilkTalk version
  capabilities: string[];   // Supported features
  nonce: string;           // Random nonce for challenge
}
```

#### Text Payload

```typescript
interface TextPayload {
  content: string;         // UTF-8 text content
  encoding: 'utf-8';       // Character encoding
}
```

#### Data Payload

```typescript
interface DataPayload {
  mimeType: string;        // MIME type of data
  size: number;           // Data size in bytes
  data: Uint8Array;       // Binary data (for small payloads)
  chunk?: {               // For chunked transfer
    index: number;
    total: number;
  };
}
```

#### Command Payload

```typescript
interface CommandPayload {
  command: string;         // Command name
  args: Record<string, unknown>;  // Command arguments
}
```

#### Ack Payload

```typescript
interface AckPayload {
  messageId: string;       // ID of acknowledged message
  status: 'received' | 'processed' | 'failed';
  details?: string;        // Optional status details
}
```

#### Error Payload

```typescript
interface ErrorPayload {
  code: number;           // Error code
  message: string;        // Error message
  retryable: boolean;     // Can client retry
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1000 | INVALID_MESSAGE | Malformed message |
| 1001 | UNSUPPORTED_VERSION | Protocol version not supported |
| 1002 | UNAUTHORIZED | Peer not authorized |
| 1003 | RATE_LIMITED | Too many messages |
| 1004 | TIMEOUT | Operation timed out |
| 1005 | INTERNAL_ERROR | Server internal error |

## Handshake Protocol

### Connection Establishment

```
Peer A                                    Peer B
   │                                         │
   │────── 1. Open Stream (/silktalk/1.0.0) ─→│
   │                                         │
   │←────────── 2. Send Hello Message ────────│
   │                                         │
   │─────────── 3. Send Hello Response ─────→│
   │                                         │
   │←────────── 4. Send Ack ─────────────────│
   │                                         │
   │◄────────── Connection Established ─────►│
```

### Hello Exchange

1. **Initiator** sends `Hello` message with:
   - Client version
   - Supported capabilities
   - Random nonce

2. **Responder** replies with:
   - Client version
   - Supported capabilities (intersection)
   - Signed nonce (authentication)

3. **Initiator** sends ACK confirming handshake completion

## Stream Multiplexing

Multiple logical streams can coexist on a single connection:

```
┌─────────────────────────────────────────┐
│           Physical Connection           │
│         (TCP/WebSocket/Relay)          │
├─────────────────────────────────────────┤
│  Stream 1  │  Stream 2  │  Stream 3    │
│ (/silktalk)│  (/ipfs/id)│  (/ipfs/ping)│
└─────────────────────────────────────────┘
```

## Serialization

### CBOR Encoding

Messages are encoded using CBOR (Concise Binary Object Representation):

- Compact binary format
- Fast parsing
- Schema evolution friendly
- Native support for binary data

### Length Prefixing

All messages are length-prefixed using unsigned varints:

```typescript
// Encoding
const encoded = encodeCBOR(message);
const prefixed = concat(encodeVarint(encoded.length), encoded);

// Decoding
const [length, offset] = decodeVarint(buffer);
const message = decodeCBOR(buffer.slice(offset, offset + length));
```

## Protocol Registration

```typescript
// Register protocol handler
node.handle('/silktalk/1.0.0/messages', async ({ stream, connection }) => {
  // Handle incoming stream
  await pipe(
    stream.source,
    lp.decode(),
    async function* (source) {
      for await (const data of source) {
        const message = decodeMessage(data.subarray());
        yield handleMessage(message);
      }
    },
    lp.encode(),
    stream.sink
  );
});
```

## Security Considerations

1. **Encryption**: All streams encrypted at transport layer (Noise)
2. **Authentication**: Peer IDs cryptographically verified
3. **Replay Protection**: Timestamps and nonces prevent replay
4. **DoS Protection**: Rate limiting on message processing
5. **Input Validation**: Strict validation of all message fields

## Versioning

Protocol versions follow semantic versioning:

- **Major**: Breaking changes (new protocol ID)
- **Minor**: Backward-compatible additions
- **Patch**: Bug fixes, no protocol changes

Multiple protocol versions can be supported simultaneously by registering handlers for each version.
