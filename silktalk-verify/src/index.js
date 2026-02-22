/**
 * SilkTalk Verification - Entry Point
 */

import { SilkNode } from './network/node.js';
import { TaskRouter } from './router/router.js';
import { OpenClawBridge } from './agent-bridge/bridge.js';
import { SilkCLI } from './cli/cli.js';
import { MessageType, createMessage } from './protocol/message.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { name: 'anonymous', port: 0, bootstrapPeers: [], daemon: false };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name': case '-n': options.name = args[++i]; break;
      case '--port': case '-p': options.port = parseInt(args[++i], 10); break;
      case '--bootstrap': case '-b': options.bootstrapPeers.push(args[++i]); break;
      case '--daemon': case '-d': options.daemon = true; break;
      case '--help': case '-h': showHelp(); process.exit(0);
    }
  }
  return options;
}

function showHelp() {
  console.log(`
SilkTalk Verification Node

Usage: node src/index.js [options]

Options:
  --name, -n <name>        Node name (default: anonymous)
  --port, -p <port>        Listen port (default: random)
  --bootstrap, -b <addr>   Bootstrap peer address (can repeat)
  --help, -h               Show this help

Examples:
  # Start first node
  node src/index.js --name nodeA --port 10001

  # Start second node, connecting to first
  node src/index.js --name nodeB --port 10002 --bootstrap /ip4/127.0.0.1/tcp/10001/p2p/PEER_ID_A
`);
}

// Main function
async function main() {
  const options = parseArgs();

  console.log(`🚀 Starting SilkTalk node: ${options.name}`);
  console.log(`   Port: ${options.port || 'random'}`);
  console.log(`   Bootstrap: ${options.bootstrapPeers.length > 0 ? options.bootstrapPeers.join(', ') : 'none'}`);
  console.log();

  // Create and start P2P node
  const node = new SilkNode({
    name: options.name,
    port: options.port,
    bootstrapPeers: options.bootstrapPeers
  });

  // Create OpenClaw bridge
  const bridge = new OpenClawBridge();

  // Check OpenClaw availability
  console.log('Checking OpenClaw availability...');
  const isAvailable = await bridge.isAvailable();
  if (isAvailable) {
    console.log('✅ OpenClaw available');
  } else {
    console.log('⚠️  OpenClaw not available - local execution disabled');
  }

  // Create task router
  const router = new TaskRouter({
    node,
    localExecutor: isAvailable ? bridge : null
  });

  // Set up message handlers
  node.on(MessageType.PING, async (msg, conn) => {
    console.log(`📨 Received ping from ${conn.peerId}`);

    // Reply with pong
    const pongMsg = createMessage(
      MessageType.PONG,
      node.getPeerId(),
      conn.peerId,
      { receivedAt: msg.timestamp, repliedAt: Date.now() }
    );

    try {
      await node.send(conn.peerId, pongMsg);
      console.log(`📤 Sent pong to ${conn.peerId}`);
    } catch (err) {
      console.error(`Failed to send pong: ${err.message}`);
    }
  });

  node.on(MessageType.PONG, (msg, conn) => {
    const latency = Date.now() - msg.payload.receivedAt;
    console.log(`📨 Received pong from ${conn.peerId}, latency: ${latency}ms`);
  });

  node.on(MessageType.TASK, async (msg, _conn) => {
    await router.handleIncomingTask(msg);
  });

  node.on(MessageType.RESULT, (msg, _conn) => {
    router.handleIncomingResult(msg);
  });

  // Start the node
  try {
    const peerId = await node.start();
    console.log(`\n✅ Node started successfully`);
    console.log(`   PeerId: ${peerId}`);
    console.log();

    // Start interactive CLI or daemon mode
    if (options.daemon) {
      console.log('Running in daemon mode (press Ctrl+C to stop)');
      // Keep process alive
      setInterval(() => {}, 1000);
    } else {
      const cli = new SilkCLI({
        node,
        router,
        onClose: async () => {
          console.log('\nShutting down...');
          await node.stop();
          process.exit(0);
        }
      });
      cli.start();
    }

  } catch (err) {
    console.error(`❌ Failed to start node: ${err.message}`);
    console.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await node.stop();
    process.exit(0);
  });
}

// Run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
