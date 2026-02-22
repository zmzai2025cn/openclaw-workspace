#!/usr/bin/env node
/**
 * Quick test script for SilkTalk Pro
 * Tests basic node functionality
 */

import { SilkNode } from './dist/core/node.js';
import { MessageType } from './dist/core/types.js';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🧪 SilkTalk Pro Quick Test\n');

  try {
    // Test 1: Create and start a node
    console.log('Test 1: Creating and starting node...');
    const node = new SilkNode({
      listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
      transports: { tcp: true, websocket: false },
      discovery: { mdns: false, dht: false, bootstrap: [] },
      relay: { enabled: false }
    });

    await node.start();
    console.log(`✅ Node started with Peer ID: ${node.peerId.toString()}`);
    console.log(`   Listen addresses: ${node.getMultiaddrs().map(a => a.toString()).join(', ')}`);

    // Test 2: Get network info
    console.log('\nTest 2: Getting network info...');
    const networkInfo = await node.getNetworkInfo();
    console.log(`✅ NAT Type: ${networkInfo.natType}`);
    console.log(`   Transports: ${networkInfo.transports.join(', ')}`);

    // Test 3: Check peers (should be empty)
    console.log('\nTest 3: Checking peers...');
    const peers = node.getPeers();
    console.log(`✅ Connected peers: ${peers.length}`);

    // Test 4: Stop node
    console.log('\nTest 4: Stopping node...');
    await node.stop();
    console.log('✅ Node stopped successfully');

    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
