# Network Strategy

## Overview

SilkTalk Pro implements a comprehensive network strategy to ensure connectivity in any environment. This document details the transport protocols, NAT traversal techniques, and connection management.

## Transport Protocols

### 1. TCP (Primary Transport)

**Protocol ID**: `/tcp`

Direct TCP connections for optimal performance.

**Use Cases**:
- LAN communication
- Public IP to public IP
- NAT with port forwarding

**Configuration**:
```typescript
{
  listen: ['/ip4/0.0.0.0/tcp/0'],
  announce: [] // Auto-detected
}
```

### 2. WebSocket (Firewall-Friendly)

**Protocol IDs**: `/ws`, `/wss`

WebSocket transport for restrictive networks.

**Use Cases**:
- Corporate firewalls
- Proxy environments
- Browser-based clients

**Configuration**:
```typescript
{
  listen: [
    '/ip4/0.0.0.0/tcp/8080/ws',
    '/ip4/0.0.0.0/tcp/8443/wss'
  ]
}
```

**Advantages**:
- Works through most HTTP proxies
- Looks like regular web traffic
- Can use standard ports (80, 443)

### 3. Circuit Relay (Fallback)

**Protocol ID**: `/p2p-circuit`

Relay connections through intermediary peers.

**Use Cases**:
- Symmetric NAT
- Strict firewall rules
- Temporary connectivity

**Types**:
- **Hop**: Single relay hop
- **Stop**: Direct relay (reservation)

## NAT Traversal

### NAT Types

```
┌─────────────────────────────────────────────────────────────┐
│                      NAT Types                               │
├─────────────────────────────────────────────────────────────┤
│  Full Cone      │ Any external host can send to mapped addr  │
│  Restricted     │ Only contacted hosts can send              │
│  Port Restricted│ Only contacted host:port can send          │
│  Symmetric      │ Each destination gets different mapping    │
└─────────────────────────────────────────────────────────────┘
```

### Traversal Techniques

#### 1. UPnP/NAT-PMP

Automatic port mapping via router protocols.

**Process**:
1. Discover router via SSDP
2. Request port mapping
3. Advertise external address

**Success Rate**: ~40% of home routers

#### 2. STUN (Session Traversal Utilities for NAT)

Discover public endpoint without relay.

**Process**:
1. Send binding request to STUN server
2. Receive public IP:port
3. Advertise to peers

**Limitations**:
- Fails on symmetric NAT
- Requires external STUN server

#### 3. TURN (Traversal Using Relays around NAT)

Relay traffic through TURN server when direct connection fails.

**Use Cases**:
- Symmetric NAT
- UDP-blocked networks

**Trade-offs**:
- Higher latency
- Bandwidth costs
- Requires TURN server

#### 4. AutoNAT

Automatic detection of NAT type and reachability.

**Process**:
1. Request dial-back from known peers
2. Determine if publicly reachable
3. Select appropriate strategy

**Benefits**:
- No manual configuration
- Adapts to network changes
- Informs relay decisions

#### 5. DCUtR (Direct Connection Upgrade through Relay)

Upgrade relay connection to direct connection.

**Process**:
1. Establish relay connection
2. Attempt hole punching
3. Migrate to direct if successful

**Benefits**:
- Start communicating immediately
- Optimize to direct when possible

### NAT Traversal Matrix

| NAT Type | UPnP | STUN | TURN | Relay | DCUtR |
|----------|------|------|------|-------|-------|
| Full Cone | ✓ | ✓ | - | - | - |
| Restricted | ✓ | ✓ | - | - | ✓ |
| Port Restricted | ✓ | ✓ | - | ✓ | ✓ |
| Symmetric | ✓ | ✗ | ✓ | ✓ | ✗ |

## Connection Manager

### Connection Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Init   │───→│ Attempt │───→│  Open   │───→│  Close  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                    │              │
                    ↓              ↓
               ┌─────────┐   ┌─────────┐
               │  Fail   │   │  Error  │
               └─────────┘   └─────────┘
                    │              │
                    └──────┬───────┘
                           ↓
                    ┌─────────────┐
                    │   Retry     │
                    │ (exponential│
                    │   backoff)  │
                    └─────────────┘
```

### Connection Priorities

Connections are prioritized by quality:

1. **Direct TCP** - Lowest latency, highest throughput
2. **WebSocket** - Firewall-friendly, moderate overhead
3. **Relay** - Guaranteed connectivity, higher latency

### Connection Limits

```typescript
interface ConnectionLimits {
  maxConnections: number;        // Total connection limit
  maxConnectionsPerPeer: number; // Per-peer limit
  minConnections: number;        // Maintain minimum
  maxIncomingPending: number;    // Pending incoming limit
}
```

Default limits:
- Max connections: 300
- Per peer: 5
- Min connections: 10

### Path Selection

When multiple paths exist to a peer, select based on:

1. **Latency** (RTT measurement)
2. **Stability** (success rate)
3. **Bandwidth** (throughput estimation)
4. **Cost** (relay = higher cost)

## Discovery Mechanisms

### 1. mDNS (Local Network)

**Protocol**: Multicast DNS

Discover peers on local network without infrastructure.

**Process**:
1. Broadcast service announcement
2. Listen for peer announcements
3. Connect to discovered peers

**Scope**: Local subnet only

### 2. DHT (Global)

**Protocol**: Kademlia DHT

Global peer discovery without bootstrap.

**Process**:
1. Join DHT network
2. Publish provider records
3. Query for peers

**Benefits**:
- No central servers
- Scalable to millions of peers
- Resilient to node churn

### 3. Bootstrap (Optional)

Pre-configured bootstrap nodes for faster initial connection.

**Use Cases**:
- First-time startup
- After extended offline period
- DHT bootstrap acceleration

## Network Resilience

### Reconnection Strategy

```typescript
interface ReconnectConfig {
  initialDelay: number;      // 1000ms
  maxDelay: number;          // 30000ms
  backoffMultiplier: number; // 2
  maxRetries: number;        // 10
}
```

### Health Monitoring

Continuous monitoring of:
- Connection latency
- Packet loss
- Throughput
- Error rates

### Failover

Automatic failover to alternative transports:

1. TCP fails → Try WebSocket
2. Direct fails → Try relay
3. Primary relay fails → Try backup relay

## Security

### Transport Security

All transports use encryption:
- **Noise Protocol**: Modern, lightweight
- **TLS 1.3**: Standard, widely supported

### Firewall Traversal

Techniques for restrictive firewalls:

1. **Port 80/443**: Use standard web ports
2. **Domain Fronting**: Hide behind CDN (if needed)
3. **WebSocket**: Looks like HTTP upgrade

### Rate Limiting

Protection against DoS:
- Connection rate limiting per IP
- Bandwidth limiting per peer
- Protocol-level message throttling

## Configuration

### Default Network Config

```typescript
const defaultNetworkConfig = {
  transports: ['tcp', 'ws', 'wss'],
  nat: {
    enabled: true,
    upnp: true,
    autonat: true,
    dcutr: true
  },
  relay: {
    enabled: true,
    hop: {
      enabled: false,  // Don't relay for others by default
      active: false
    },
    autoRelay: {
      enabled: true,
      maxListeners: 2
    }
  },
  discovery: {
    mdns: true,
    dht: true,
    bootstrap: []
  }
};
```

## Monitoring

### Metrics

- `connections_total`: Total connections
- `connections_by_transport`: Breakdown by transport
- `nat_type`: Detected NAT type
- `relay_connections`: Active relay connections
- `dht_peers`: DHT routing table size
- `discovery_events`: Discovery success/failure

### Diagnostics

```bash
# Network diagnostics
npm start -- --diagnose

# Output includes:
# - Detected NAT type
# - Public addresses
# - Transport status
# - DHT health
```
