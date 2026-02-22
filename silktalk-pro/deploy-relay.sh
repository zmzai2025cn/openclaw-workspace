#!/bin/bash
#==============================================================================
# SilkTalk Relay - 一键部署测试脚本（带中继功能）
#==============================================================================

set -e

echo "=========================================="
echo "  SilkTalk Relay - 一键部署"
echo "  节点: alibot"
echo "=========================================="

TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# 创建 package.json
cat > package.json << 'EOF'
{
  "name": "silktalk-relay",
  "version": "1.0.0",
  "type": "commonjs",
  "dependencies": {
    "libp2p": "0.37.3",
    "@libp2p/tcp": "3.1.5",
    "@libp2p/websockets": "4.0.0",
    "@libp2p/mdns": "3.0.1",
    "@libp2p/bootstrap": "3.0.1",
    "@libp2p/kad-dht": "5.0.3",
    "@libp2p/circuit-relay-v2": "1.0.0",
    "@libp2p/autonat": "1.0.0",
    "@libp2p/identify": "3.0.1",
    "@libp2p/ping": "3.0.1",
    "@libp2p/noise": "8.0.2",
    "@libp2p/mplex": "7.0.1",
    "@libp2p/logger": "2.0.0",
    "@multiformats/multiaddr": "11.0.0",
    "multiformats": "10.0.0"
  }
}
EOF

# 创建 relay-node.js
cat > relay-node.js << 'EOF'
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

const PUBLIC_RELAYS = [];

async function main() {
  console.log('========================================');
  console.log('  SilkTalk Relay Node');
  console.log('========================================');
  console.log('');

  const node = await Libp2p.create({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/10001', '/ip4/0.0.0.0/tcp/10002/ws']
    },
    transports: [new TCP(), new WebSockets()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
    peerDiscovery: [new MDNS(), new Bootstrap({ list: PUBLIC_RELAYS })],
    dht: new KadDHT({ clientMode: false }),
    relay: { enabled: true, advertise: true },
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
  console.log('Waiting for connections...');
  console.log('Press Ctrl+C to stop');

  process.stdin.resume();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
EOF

echo ""
echo "[1/3] 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

echo ""
echo "[2/3] 安装依赖..."
npm install --silent 2>&1 | tail -5
echo "✅ 依赖安装完成"

echo ""
echo "[3/3] 启动中继节点..."
echo "=========================================="
node relay-node.js
