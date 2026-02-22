#!/usr/bin/env node
/**
 * SilkTalk Integration Test
 * 自动化集成测试
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(level, message) {
  const color = COLORS[level] || COLORS.blue;
  console.log(`${color}[${level.toUpperCase()}]${COLORS.reset} ${message}`);
}

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0 };
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    log('info', `Running ${this.tests.length} tests...\n`);
    
    for (const { name, fn } of this.tests) {
      process.stdout.write(`  ${name}... `);
      try {
        await fn();
        console.log(`${COLORS.green}✓ PASS${COLORS.reset}`);
        this.results.passed++;
      } catch (err) {
        console.log(`${COLORS.red}✗ FAIL${COLORS.reset}`);
        console.log(`    Error: ${err.message}`);
        this.results.failed++;
      }
    }
    
    console.log('');
    log('info', `Results: ${this.results.passed} passed, ${this.results.failed} failed`);
    
    return this.results.failed === 0;
  }
}

// Start a test node
async function startNode(name, port, bootstrap = null) {
  const args = ['src/index.js', '--name', name, '--port', String(port)];
  if (bootstrap) {
    args.push('--bootstrap', bootstrap);
  }
  
  const node = spawn('node', args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let peerId = null;
  let ready = false;
  
  // Wait for node to start
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Node startup timeout'));
    }, 30000);
    
    node.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Extract peerId
      const peerIdMatch = output.match(/PeerId: (Qm[\w]+)/);
      if (peerIdMatch) {
        peerId = peerIdMatch[1];
      }
      
      // Check if ready
      if (output.includes('silktalk>')) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });
    
    node.stderr.on('data', (data) => {
      // Log errors but don't fail
      console.error(`[${name}] ${data.toString()}`);
    });
    
    node.on('error', reject);
    node.on('exit', (code) => {
      if (code !== 0 && !ready) {
        reject(new Error(`Node exited with code ${code}`));
      }
    });
  });
  
  return { process: node, peerId, port };
}

// Send command to node
async function sendCommand(node, command) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, 10000);
    
    const onData = (data) => {
      output += data.toString();
      
      // Check for prompt (command completed)
      if (output.includes('silktalk>')) {
        clearTimeout(timeout);
        node.process.stdout.off('data', onData);
        resolve(output);
      }
    };
    
    node.process.stdout.on('data', onData);
    node.process.stdin.write(command + '\n');
  });
}

// Stop a node
async function stopNode(node) {
  node.process.stdin.write('quit\n');
  
  await new Promise((resolve) => {
    node.process.on('exit', resolve);
    setTimeout(5000).then(() => {
      node.process.kill('SIGTERM');
      return setTimeout(2000);
    }).then(() => {
      node.process.kill('SIGKILL');
      resolve();
    });
  });
}

// Main test suite
async function runTests() {
  const runner = new TestRunner();
  let nodeA = null;
  let nodeB = null;
  
  // Setup: Start nodes
  runner.test('Setup: Start Node A', async () => {
    nodeA = await startNode('nodeA', 10001);
    if (!nodeA.peerId) throw new Error('Failed to get peerId');
    log('info', `  Node A started: ${nodeA.peerId}`);
  });
  
  runner.test('Setup: Start Node B', async () => {
    const bootstrap = `/ip4/127.0.0.1/tcp/10001/p2p/${nodeA.peerId}`;
    nodeB = await startNode('nodeB', 10002, bootstrap);
    if (!nodeB.peerId) throw new Error('Failed to get peerId');
    log('info', `  Node B started: ${nodeB.peerId}`);
  });
  
  // Wait for connection
  runner.test('Connection: Nodes discover each other', async () => {
    await setTimeout(2000); // Wait for discovery
    const output = await sendCommand(nodeB, 'peers');
    if (!output.includes(nodeA.peerId)) {
      throw new Error('Node B did not find Node A');
    }
  });
  
  runner.test('Ping: Node B can ping Node A', async () => {
    const output = await sendCommand(nodeB, `ping ${nodeA.peerId}`);
    if (!output.includes('Ping sent')) {
      throw new Error('Ping command failed');
    }
    // Wait for pong
    await setTimeout(1000);
  });
  
  runner.test('Local Execution: Node B executes locally', async () => {
    const output = await sendCommand(nodeB, 'exec --message "Hello"');
    if (!output.includes('success')) {
      throw new Error('Local execution failed');
    }
  });
  
  runner.test('Remote Execution: Node B delegates to Node A', async () => {
    const output = await sendCommand(nodeB, `delegate ${nodeA.peerId} --message "Remote test"`);
    if (!output.includes('success')) {
      throw new Error('Remote execution failed');
    }
  });
  
  runner.test('Status: Check node status', async () => {
    const output = await sendCommand(nodeB, 'status');
    if (!output.includes('Peers: 1')) {
      throw new Error('Status check failed');
    }
  });
  
  // Teardown
  runner.test('Teardown: Stop nodes', async () => {
    if (nodeB) await stopNode(nodeB);
    if (nodeA) await stopNode(nodeA);
    log('info', '  Nodes stopped');
  });
  
  // Run all tests
  const success = await runner.run();
  
  // Summary
  console.log('');
  console.log('='.repeat(50));
  if (success) {
    log('success', '✅ All tests passed!');
  } else {
    log('error', '❌ Some tests failed');
  }
  console.log('='.repeat(50));
  
  process.exit(success ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  log('error', `Test suite failed: ${err.message}`);
  process.exit(1);
});
