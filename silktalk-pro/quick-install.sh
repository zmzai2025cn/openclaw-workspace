#!/bin/bash
#==============================================================================
# SilkTalk Pro - 快速安装脚本（无sudo版本）
#==============================================================================

set -e

echo "=========================================="
echo "SilkTalk Pro - 快速安装"
echo "=========================================="

# 创建项目目录
mkdir -p silktalk-test
cd silktalk-test

# 创建 package.json
cat > package.json << 'EOF'
{
  "name": "silktalk-pro",
  "version": "1.0.0",
  "main": "index.js",
  "type": "commonjs",
  "dependencies": {
    "libp2p": "0.37.3",
    "@libp2p/tcp": "3.1.5",
    "@libp2p/mdns": "3.0.1",
    "@libp2p/bootstrap": "3.0.1",
    "@libp2p/noise": "8.0.2",
    "@libp2p/mplex": "7.0.1",
    "@libp2p/logger": "2.0.0"
  }
}
EOF

echo "[1/3] 安装依赖（使用兼容版本）..."
npm install --silent

echo "[2/3] 创建测试脚本..."
cat > index.js << 'EOF'
const Libp2p = require('libp2p');
const TCP = require('@libp2p/tcp');
const MDNS = require('@libp2p/mdns');
const Noise = require('@libp2p/noise');
const Mplex = require('@libp2p/mplex');

async function main() {
  console.log('Starting SilkTalk Pro node...');
  
  try {
    const node = await Libp2p.create({
      addresses: { listen: ['/ip4/0.0.0.0/tcp/10001'] },
      transports: [new TCP()],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      peerDiscovery: [new MDNS()]
    });

    await node.start();
    
    console.log('✅ Node started successfully!');
    console.log('PeerId:', node.peerId.toB58String());
    console.log('Addresses:');
    node.multiaddrs.forEach((ma) => {
      console.log('  ', ma.toString() + '/p2p/' + node.peerId.toB58String());
    });
    
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
EOF

echo "[3/3] 启动节点..."
echo "=========================================="
node index.js
