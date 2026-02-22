# SilkTalk Pro 中继服务器配置

## 公共 STUN 服务器

STUN (Session Traversal Utilities for NAT) 用于获取公网地址。

### Google STUN 服务器
```javascript
const stunServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];
```

### Cloudflare STUN
```javascript
{ urls: 'stun:stun.cloudflare.com:3478' }
```

### 国内 STUN 服务器
```javascript
const chinaStunServers = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.116.85.100.27:3478' }
];
```

## 公共 TURN 服务器

TURN (Traversal Using Relays around NAT) 用于中继流量，当P2P直接连接失败时使用。

### 免费 TURN 服务器 (有限制)

**Open Relay Project**
```javascript
{
  urls: 'turn:openrelay.metered.ca:80',
  username: 'openrelayproject',
  credential: 'openrelayproject'
}
```

**Metered.ca**
```javascript
{
  urls: 'turn:a.relay.metered.ca:443',
  username: '...', // 需要注册获取
  credential: '...'
}
```

### 配置示例

```javascript
// WebRTC ICE 配置
const iceConfig = {
  iceServers: [
    // STUN 服务器
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // TURN 服务器 (需要时启用)
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-password'
    },
    {
      urls: 'turns:your-turn-server.com:5349', // TLS
      username: 'your-username',
      credential: 'your-password'
    }
  ],
  iceCandidatePoolSize: 10
};

// libp2p WebRTC 配置
const webRtcConfig = {
  config: {
    iceServers: iceConfig.iceServers
  }
};
```

## 自建 TURN 服务器

### 使用 coturn

```bash
# 安装
sudo apt-get update
sudo apt-get install coturn

# 配置 /etc/turnserver.conf
listening-port=3478
listening-ip=YOUR_SERVER_IP
relay-ip=YOUR_SERVER_IP
external-ip=YOUR_PUBLIC_IP/YOUR_SERVER_IP
realm=your-domain.com
server-name=your-domain.com
fingerprint
lt-cred-mech
user=username:password

# 启动
sudo turnserver -c /etc/turnserver.conf
```

### Docker 部署

```yaml
version: '3'
services:
  coturn:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/tcp"
      - "3478:3478/udp"
      - "5349:5349/tcp"
      - "5349:5349/udp"
      - "10000-20000:10000-20000/udp"
    environment:
      - DETECT_EXTERNAL_IP=yes
      - DETECT_RELAY_IP=yes
    command: >
      -n --log-file=stdout
      --min-port=10000 --max-port=20000
      --user=username:password
      --realm=your-domain.com
```

## libp2p 中继配置

### 使用公共 libp2p 中继

```javascript
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';

const node = await createLibp2p({
  transports: [
    tcp(),
    webSockets(),
    circuitRelayTransport({
      discoverRelays: 1
    })
  ],
  // 公共引导节点通常包含中继
  bootstrapList: [
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
  ]
});
```

### 配置私有中继

```javascript
// 中继服务器
import { relay } from '@libp2p/circuit-relay-v2';

const relayNode = await createLibp2p({
  transports: [tcp(), webSockets()],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  services: {
    relay: relay({
      hopTimeout: 30000,
      reservations: {
        maxReservations: 100,
        reservationTtl: 60000
      }
    })
  }
});

console.log('Relay listening on:', relayNode.getMultiaddrs());
```

```javascript
// 客户端使用中继
const clientNode = await createLibp2p({
  transports: [
    tcp(),
    webSockets(),
    circuitRelayTransport({
      discoverRelays: 1
    })
  ],
  // 连接到已知中继
  bootstrapList: [
    '/ip4/RELAY_IP/tcp/4001/p2p/RELAY_PEER_ID'
  ]
});
```

## 推荐的 ICE 服务器组合

```javascript
const recommendedIceServers = {
  iceServers: [
    // 多个 STUN 提高成功率
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    
    // 如果P2P失败，使用TURN
    // 请替换为您自己的TURN服务器
    {
      urls: [
        'turn:your-turn-server.com:3478?transport=udp',
        'turn:your-turn-server.com:3478?transport=tcp',
        'turns:your-turn-server.com:5349'
      ],
      username: 'your-username',
      credential: 'your-password'
    }
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
  bundlePolicy: 'balanced',
  rtcpMuxPolicy: 'require'
};
```

## 测试工具

```bash
# 测试 STUN 服务器
node udp-test.js stun

# 测试 TURN 服务器
# 使用 trickle-ice 工具: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
```
