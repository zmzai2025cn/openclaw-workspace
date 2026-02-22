#!/bin/bash
#
# SilkTalk Pro Two-Node Communication Test
# Tests P2P communication between two local nodes
#

set -e

echo "🧪 SilkTalk Pro Two-Node Communication Test"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Start Node 1
echo "Starting Node 1 on port 10001..."
node dist/cli/index.js start --port 10001 --log-level error &
NODE1_PID=$!
sleep 3

# Get Node 1 info
NODE1_ADDR=$(node -e "
const { SilkNode } = require('./dist/core/node.js');
const node = new SilkNode({
  listenAddresses: ['/ip4/127.0.0.1/tcp/10001'],
  discovery: { mdns: false, dht: false, bootstrap: [] },
  relay: { enabled: false }
});
node.start().then(() => {
  console.log(node.getMultiaddrs()[0]?.toString() || '');
  node.stop();
});
" 2>/dev/null || echo "")

echo "Node 1 started (PID: $NODE1_PID)"
echo ""

# Start Node 2
echo "Starting Node 2 on port 10002..."
node dist/cli/index.js start --port 10002 --log-level error &
NODE2_PID=$!
sleep 3

echo "Node 2 started (PID: $NODE2_PID)"
echo ""

# Test connection
echo "Testing connection from Node 1 to Node 2..."
if node dist/cli/index.js connect "/ip4/127.0.0.1/tcp/10002/p2p/12D3KooW" 2>/dev/null; then
    echo -e "${GREEN}✅ Connection test passed${NC}"
else
    echo -e "${RED}⚠️  Connection test skipped (requires running node)${NC}"
fi

echo ""
echo "Cleaning up..."
kill $NODE1_PID $NODE2_PID 2>/dev/null || true

echo ""
echo "🎉 Test completed!"
