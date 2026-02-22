const Libp2p = require('libp2p');
const TCP = require('@libp2p/tcp');
const WebSockets = require('@libp2p/websockets');
const MDNS = require('@libp2p/mdns');
const Bootstrap = require('@libp2p/bootstrap');
const KadDHT = require('@libp2p/kad-dht');
const CircuitRelay = require('@libp2p/circuit-relay-v2');
const AutoNAT = require('@libp2p/autonat');
const Identify = require('@libp2p/identify');
const Ping = require('@libp2p/ping');
const Noise = require('@libp2p/noise');
const Mplex = require('@libp2p/mplex');

// 公共中继节点列表
const PUBLIC_RELAYS = [
  '/dns4/libp2p-relay-1.dappnode.io/tcp/443/wss/p2p/12D3KooW...',
  '/dns4/libp2p-relay-2.dappnode.io/tcp/443/wss/p2p/12D3KooW...',
  // 实际使用时需要替换为真实的公共中继地址
];

async function main() {
  console.log('========================================');
  console.log('  SilkTalk Relay Node');
  console.log('========================================');
  console.log('');

  const node = await Libp2p.create({
    addresses: {
      listen: [
        '/ip4/0.0.0.0/tcp/10001',
        '/ip4/0.0.0.0/tcp/10002/ws'
      ]
    },
    transports: [
      new TCP(),
      new WebSockets()
    ],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
    peerDiscovery: [
      new MDNS(),
      new Bootstrap({
        list: PUBLIC_RELAYS
      })
    ],
    dht: new KadDHT({
      clientMode: false
    }),
    relay: {
      enabled: true,
      advertise: true
    },
    services: {
      identify: new Identify(),
      ping: new Ping(),
      autoNAT: new AutoNAT()
    }
  });

  await node.start();

  console.log('✅ Node started with relay support!');
  console.log('PeerId:', node.peerId.toB58String());
  console.log('');
  console.log('Listen addresses:');
  node.multiaddrs.forEach((ma) => {
    console.log('  ', ma.toString() + '/p2p/' + node.peerId.toB58String());
  });
  console.log('');
  console.log('Relay reservations:', node.relay?.reservations?.size || 0);
  console.log('');
  console.log('Waiting for connections...');
  console.log('Press Ctrl+C to stop');

  // 保持运行
  process.stdin.resume();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
