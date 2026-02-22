#!/usr/bin/env node
/**
 * CLI for SilkTalk Pro with libp2p integration
 * 
 * FIXES:
 * - Added error handling in signal handlers
 * - Added input validation for port numbers
 * - Fixed async error handling in shutdown
 * - FIXED M8: Added comprehensive Promise rejection handling
 * - FIXED L10: Added atomic signal handling with proper cleanup
 */

import { Command } from 'commander';
import { SilkNode } from '../core/node.js';
import { ConfigManager } from '../core/config.js';
import { Logger, setGlobalLogger } from '../core/logger.js';
import { OpenClawBridge } from '../bridge/openclaw.js';
import type { SilkNodeConfig } from '../core/types.js';

const program = new Command();

// Valid port range
const MIN_PORT = 1;
const MAX_PORT = 65535;

function validatePort(port: string): number {
  const num = parseInt(port, 10);
  if (isNaN(num) || num < MIN_PORT || num > MAX_PORT) {
    throw new Error(`Port must be a number between ${MIN_PORT} and ${MAX_PORT}`);
  }
  return num;
}

function validateTimeout(timeout: string): number {
  const num = parseInt(timeout, 10);
  if (isNaN(num) || num < 0) {
    throw new Error('Timeout must be a positive number');
  }
  return num;
}

program
  .name('silktalk')
  .description('SilkTalk Pro - Enterprise P2P Communication System')
  .version('1.0.0')
  .option('-c, --config <path>', 'path to config file')
  .option('-v, --verbose', 'enable verbose logging');

// Start command
program
  .command('start')
  .description('Start the P2P node')
  .option('-p, --port <port>', 'TCP listen port', '0')
  .option('-w, --ws-port <port>', 'WebSocket listen port')
  .option('--ws', 'enable WebSocket transport')
  .option('--wss', 'enable secure WebSocket')
  .option('--mdns', 'enable mDNS discovery', true)
  .option('--dht', 'enable DHT', true)
  .option('--relay', 'enable relay client', true)
  .option('--relay-hop', 'enable relay hop (serve as relay)')
  .option('--bootstrap <addrs...>', 'bootstrap nodes')
  .option('--upnp', 'enable UPnP NAT traversal', true)
  .option('--autonat', 'enable AutoNAT', true)
  .option('--max-connections <n>', 'max connections', '300')
  .option('--log-level <level>', 'log level', 'info')
  .option('--bridge', 'enable OpenClaw bridge')
  .action(async (options) => {
    // FIXED M8: Wrap entire action in try-catch with proper error handling
    try {
      // Validate port numbers
      const port = validatePort(options.port);
      const wsPort = options.wsPort ? validatePort(options.wsPort) : undefined;
      const maxConnections = parseInt(options.maxConnections, 10);
      
      if (isNaN(maxConnections) || maxConnections < 1) {
        throw new Error('max-connections must be a positive number');
      }

      // Set up logging
      const logger = new Logger({
        level: options.logLevel,
        pretty: true
      });
      setGlobalLogger(logger);

      // Build config from options
      const config: Partial<SilkNodeConfig> = {
        listenAddresses: [`/ip4/0.0.0.0/tcp/${port}`],
        transports: {
          tcp: true,
          websocket: options.ws || wsPort ? true : false
        },
        discovery: {
          mdns: options.mdns,
          dht: options.dht,
          bootstrap: options.bootstrap || []
        },
        nat: {
          upnp: options.upnp,
          autonat: options.autonat,
          dcutr: true
        },
        relay: {
          enabled: options.relay,
          hop: {
            enabled: options.relayHop || false,
            active: options.relayHop || false
          },
          autoRelay: {
            enabled: true,
            maxListeners: 2
          }
        },
        connection: {
          maxConnections
        },
        logging: {
          level: options.logLevel,
          pretty: true
        }
      };

      // Add WebSocket address if specified
      if (wsPort) {
        config.listenAddresses?.push(`/ip4/0.0.0.0/tcp/${wsPort}/ws`);
      }

      // Create and start node
      const node = new SilkNode(config);

      // Set up OpenClaw bridge if enabled
      let bridge: OpenClawBridge | null = null;
      if (options.bridge) {
        bridge = new OpenClawBridge(node, logger, {
          enabled: true,
          allowRemoteCommands: true
        });
      }

      // FIXED L10: Atomic signal handling
      let isShuttingDown = false;
      let shutdownPromise: Promise<void> | null = null;
      
      const shutdown = async (signal: string) => {
        // Atomic check
        if (isShuttingDown) {
          logger.info('Shutdown already in progress...');
          return;
        }
        isShuttingDown = true;
        
        logger.info(`Received ${signal}, shutting down...`);
        
        // Create shutdown promise if not exists
        if (!shutdownPromise) {
          shutdownPromise = (async () => {
            try {
              if (bridge) {
                await bridge.stop();
              }
            } catch (error) {
              logger.error(`Error stopping bridge: ${(error as Error).message}`);
            }
            
            try {
              await node.stop();
            } catch (error) {
              logger.error(`Error stopping node: ${(error as Error).message}`);
            }
          })();
        }
        
        try {
          await shutdownPromise;
        } catch (error) {
          logger.error(`Error during shutdown: ${(error as Error).message}`);
        } finally {
          process.exit(0);
        }
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      // FIXED M8: Comprehensive error handling
      process.on('uncaughtException', (error) => {
        logger.error(`Uncaught exception: ${error.message}`);
        logger.error(error.stack || 'No stack trace');
        shutdown('uncaughtException').catch((err) => {
          logger.error(`Error during shutdown after uncaught exception: ${(err as Error).message}`);
          process.exit(1);
        });
      });

      process.on('unhandledRejection', (reason, promise) => {
        logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
        // Don't exit immediately, give time for logging
        setTimeout(() => {
          shutdown('unhandledRejection').catch((err) => {
            logger.error(`Error during shutdown after unhandled rejection: ${(err as Error).message}`);
            process.exit(1);
          });
        }, 100);
      });

      // Set up event handlers
      node.on('peer:connect', (peerId) => {
        logger.info(`Peer connected: ${peerId}`);
      });

      node.on('peer:disconnect', (peerId) => {
        logger.info(`Peer disconnected: ${peerId}`);
      });

      node.on('message:received', (message, peerId) => {
        logger.info(`Message from ${peerId}: ${JSON.stringify(message.payload)}`);
      });

      await node.start();

      // Start bridge if enabled
      if (bridge) {
        await bridge.start();
      }

      // Print node info
      console.log('\n🚀 SilkTalk Pro Node Started\n');
      console.log(`Peer ID: ${node.peerId.toString()}`);
      console.log('Listen addresses:');
      for (const addr of node.getMultiaddrs()) {
        console.log(`  ${addr.toString()}`);
      }
      
      // Show network info
      const networkInfo = await node.getNetworkInfo();
      console.log(`\nNAT Type: ${networkInfo.natType}`);
      console.log(`Connections: ${node.getPeers().length}`);
      
      if (options.bridge) {
        console.log('\nOpenClaw Bridge: enabled');
      }
      
      console.log('\nPress Ctrl+C to stop\n');

      // Keep running
      await new Promise(() => {});
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show node status')
  .option('--json', 'output as JSON')
  .action(async (options) => {
    try {
      // This would typically connect to a running node
      // For now, just show a message
      if (options.json) {
        console.log(JSON.stringify({ status: 'not implemented' }, null, 2));
      } else {
        console.log('Status command requires a running node');
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Connect command
program
  .command('connect <multiaddr>')
  .description('Connect to a peer')
  .action(async (multiaddr) => {
    try {
      const logger = new Logger({ pretty: true });
      setGlobalLogger(logger);

      const node = new SilkNode();
      await node.start();

      console.log(`Connecting to ${multiaddr}...`);
      await node.dial(multiaddr);
      console.log('Connected!');

      await node.stop();
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Peers command
program
  .command('peers')
  .description('List connected peers')
  .option('--json', 'output as JSON')
  .action(async (options) => {
    try {
      const logger = new Logger({ pretty: true });
      setGlobalLogger(logger);

      const node = new SilkNode();
      await node.start();

      const peers = node.getPeers();

      if (options.json) {
        console.log(JSON.stringify({ peers }, null, 2));
      } else {
        console.log(`Connected peers (${peers.length}):`);
        for (const peer of peers) {
          console.log(`  ${peer}`);
        }
      }

      await node.stop();
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Send command
program
  .command('send <peer> <message>')
  .description('Send a message to a peer')
  .option('--wait-ack', 'wait for acknowledgment')
  .option('--timeout <ms>', 'timeout in milliseconds', '30000')
  .action(async (peer, message, options) => {
    try {
      const timeout = validateTimeout(options.timeout);
      
      const logger = new Logger({ pretty: true });
      setGlobalLogger(logger);

      const node = new SilkNode();
      await node.start();

      // Import MessageType
      const { MessageType } = await import('../core/types.js');

      await node.sendMessage(peer, {
        header: {
          version: 1,
          type: MessageType.TEXT,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          sender: node.peerId.toString()
        },
        payload: {
          content: message,
          encoding: 'utf-8'
        }
      });

      console.log('Message sent!');

      if (options.waitAck) {
        console.log('Waiting for acknowledgment...');
        // Set up timeout
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Acknowledgment timeout')), timeout);
        });
        
        // Acknowledgment logic would go here
        // For now, just wait for timeout
        try {
          await timeoutPromise;
        } catch (error) {
          console.log('No acknowledgment received');
        }
      }

      await node.stop();
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Listen command
program
  .command('listen')
  .description('Listen for incoming messages')
  .option('--format <format>', 'output format (json, pretty)', 'pretty')
  .action(async (options) => {
    try {
      const logger = new Logger({ pretty: true });
      setGlobalLogger(logger);

      const node = new SilkNode();
      await node.start();

      console.log(`Listening for messages as ${node.peerId.toString()}...\n`);

      node.onMessage((message, peerId) => {
        if (options.format === 'json') {
          console.log(JSON.stringify({
            from: peerId,
            message,
            receivedAt: Date.now()
          }));
        } else {
          console.log(`[${new Date().toISOString()}] ${peerId}:`);
          console.log(JSON.stringify(message.payload, null, 2));
          console.log();
        }
      });

      // FIXED L10: Atomic signal handling
      let isShuttingDown = false;
      
      const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        
        console.log('\nShutting down...');
        try {
          await node.stop();
        } catch (error) {
          logger.error(`Error stopping node: ${(error as Error).message}`);
        }
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep running
      await new Promise(() => {});
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// DHT commands
program
  .command('dht')
  .description('DHT operations')
  .addCommand(
    new Command('get <key>')
      .description('Get a value from the DHT')
      .action(async (key) => {
        try {
          const logger = new Logger({ pretty: true });
          setGlobalLogger(logger);

          const node = new SilkNode();
          await node.start();

          const value = await node.dhtGet(key);
          
          if (value) {
            console.log('Value:', new TextDecoder().decode(value));
          } else {
            console.log('Key not found');
          }

          await node.stop();
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('put <key> <value>')
      .description('Put a value in the DHT')
      .action(async (key, value) => {
        try {
          const logger = new Logger({ pretty: true });
          setGlobalLogger(logger);

          const node = new SilkNode();
          await node.start();

          await node.dhtPut(key, new TextEncoder().encode(value));
          console.log('Value stored');

          await node.stop();
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  );

// Config command
program
  .command('config')
  .description('Manage configuration')
  .addCommand(
    new Command('init')
      .description('Initialize default configuration')
      .action(async () => {
        try {
          const configManager = new ConfigManager();
          await configManager.init();
          console.log(`Configuration initialized at ${configManager.getConfigPath()}`);
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('get <key>')
      .description('Get configuration value')
      .action(async (key) => {
        try {
          const configManager = new ConfigManager();
          await configManager.load();
          const value = configManager.getValue(key);
          console.log(value !== undefined ? JSON.stringify(value) : 'undefined');
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('set <key> <value>')
      .description('Set configuration value')
      .action(async (key, value) => {
        try {
          const configManager = new ConfigManager();
          await configManager.load();
          
          // Try to parse as JSON
          let parsedValue: unknown;
          try {
            parsedValue = JSON.parse(value);
          } catch {
            parsedValue = value;
          }
          
          configManager.setValue(key, parsedValue);
          await configManager.save();
          console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('list')
      .description('List all configuration')
      .action(async () => {
        try {
          const configManager = new ConfigManager();
          await configManager.load();
          console.log(JSON.stringify(configManager.get(), null, 2));
        } catch (error) {
          console.error('Error:', (error as Error).message);
          process.exit(1);
        }
      })
  );

// FIXED M8: Global error handlers for the CLI process
process.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Process exited with code ${code}`);
  }
});

// Parse arguments
program.parse();
