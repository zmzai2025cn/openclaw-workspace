#!/usr/bin/env node
/**
 * SilkTalk Test Runner
 * 规范化的测试执行框架
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// 测试结果存储
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

// 颜色输出
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(level, message) {
  const color = C[level] || C.blue;
  console.log(`${color}[${level.toUpperCase()}]${C.reset} ${message}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`${C.cyan}${title}${C.reset}`);
  console.log('='.repeat(60));
}

// 测试用例定义
class TestCase {
  constructor(id, name, level, priority, fn) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.priority = priority;
    this.fn = fn;
    this.status = 'pending';
    this.error = null;
    this.duration = 0;
  }

  async run() {
    const start = Date.now();
    results.total++;
    
    try {
      await this.fn();
      this.status = 'passed';
      results.passed++;
    } catch (err) {
      this.status = 'failed';
      this.error = err.message;
      results.failed++;
    }
    
    this.duration = Date.now() - start;
    results.details.push(this);
    
    // 输出结果
    const icon = this.status === 'passed' ? '✅' : '❌';
    const color = this.status === 'passed' ? C.green : C.red;
    console.log(`${color}${icon} ${this.id}: ${this.name} (${this.duration}ms)${C.reset}`);
    
    if (this.error) {
      console.log(`   ${C.red}Error: ${this.error}${C.reset}`);
    }
  }
}

// 断言函数
const assert = {
  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },
  
  true(value, message) {
    if (value !== true) {
      throw new Error(message || `Expected true, got ${value}`);
    }
  },
  
  false(value, message) {
    if (value !== false) {
      throw new Error(message || `Expected false, got ${value}`);
    }
  },
  
  throws(fn, message) {
    let threw = false;
    try {
      fn();
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw');
    }
  },
  
  async resolves(promise, message) {
    try {
      await promise;
    } catch (err) {
      throw new Error(message || `Expected promise to resolve, got: ${err.message}`);
    }
  },
  
  async rejects(promise, message) {
    try {
      await promise;
      throw new Error(message || 'Expected promise to reject');
    } catch {
      // Expected
    }
  }
};

// ==================== L1 环境验证 ====================
section('L1 环境验证 (Environment Validation)');

const envTests = [
  new TestCase('ST-ENV-001', 'Node.js版本检查', 'L1', 'P0', async () => {
    const result = execSync('node --version', { encoding: 'utf8' });
    const version = result.trim().replace('v', '');
    const major = parseInt(version.split('.')[0]);
    assert.true(major >= 18, `Node.js版本过低: ${version}`);
    log('info', `Node.js版本: ${version}`);
  }),
  
  new TestCase('ST-ENV-002', 'npm可用性检查', 'L1', 'P0', async () => {
    const result = execSync('npm --version', { encoding: 'utf8' });
    assert.true(result.trim().length > 0, 'npm未安装');
    log('info', `npm版本: ${result.trim()}`);
  }),
  
  new TestCase('ST-ENV-003', 'OpenClaw可用性检查', 'L1', 'P0', async () => {
    try {
      const result = execSync('openclaw --version', { encoding: 'utf8' });
      assert.true(result.includes('2026'), `OpenClaw版本异常: ${result}`);
      log('info', `OpenClaw版本: ${result.trim()}`);
    } catch {
      throw new Error('OpenClaw未安装或不可用');
    }
  }),
  
  new TestCase('ST-ENV-004', '项目目录检查', 'L1', 'P0', async () => {
    const packageJson = join(PROJECT_ROOT, 'package.json');
    assert.true(existsSync(packageJson), 'package.json不存在');
    
    const srcDir = join(PROJECT_ROOT, 'src');
    assert.true(existsSync(srcDir), 'src目录不存在');
  })
];

// ==================== L2 静态分析 ====================
section('L2 静态分析 (Static Analysis)');

const staticTests = [
  new TestCase('ST-STA-001', 'ESLint检查', 'L2', 'P0', async () => {
    try {
      execSync('npx eslint src/', { 
        cwd: PROJECT_ROOT,
        stdio: 'pipe'
      });
    } catch (err) {
      if (err.stdout) {
        throw new Error(`ESLint错误:\n${err.stdout.toString()}`);
      }
      throw err;
    }
  }),
  
  new TestCase('ST-STA-002', '语法检查', 'L2', 'P0', async () => {
    const files = [
      'src/index.js',
      'src/protocol/message.js',
      'src/network/node.js',
      'src/router/router.js',
      'src/agent-bridge/bridge.js',
      'src/cli/cli.js'
    ];
    
    for (const file of files) {
      const fullPath = join(PROJECT_ROOT, file);
      if (existsSync(fullPath)) {
        try {
          execSync(`node --check ${fullPath}`, { cwd: PROJECT_ROOT });
        } catch (err) {
          throw new Error(`${file} 语法错误: ${err.message}`);
        }
      }
    }
  })
];

// ==================== L3 单元测试 ====================
section('L3 单元测试 (Unit Tests)');

const unitTests = [
  new TestCase('ST-MSG-001', '消息创建', 'L3', 'P0', async () => {
    const { createMessage, MessageType } = await import('../src/protocol/message.js');
    const msg = createMessage(MessageType.PING, 'A', 'B', { test: true });
    
    assert.equal(msg.type, 'ping', '类型错误');
    assert.equal(msg.from, 'A', '发送方错误');
    assert.equal(msg.to, 'B', '接收方错误');
    assert.true(typeof msg.id === 'string', 'ID应为字符串');
    assert.true(typeof msg.timestamp === 'number', '时间戳应为数字');
  }),
  
  new TestCase('ST-MSG-002', '消息编码解码', 'L3', 'P0', async () => {
    const { createMessage, encode, decode, MessageType } = await import('../src/protocol/message.js');
    const original = createMessage(MessageType.TASK, 'sender', 'receiver', { cmd: 'test' });
    
    const encoded = encode(original);
    const decoded = decode(encoded);
    
    assert.equal(decoded.type, original.type, '解码后类型不一致');
    assert.equal(decoded.from, original.from, '解码后发送方不一致');
    assert.equal(decoded.to, original.to, '解码后接收方不一致');
    assert.equal(decoded.payload.cmd, original.payload.cmd, '解码后payload不一致');
  }),
  
  new TestCase('ST-MSG-003', '无效消息解码', 'L3', 'P1', async () => {
    const { decode } = await import('../src/protocol/message.js');
    const result = decode(Buffer.from('invalid json'));
    assert.equal(result, null, '无效消息应返回null');
  }),
  
  new TestCase('ST-BRD-001', 'OpenClaw桥接可用性', 'L3', 'P0', async () => {
    const { OpenClawBridge } = await import('../src/agent-bridge/bridge.js');
    const bridge = new OpenClawBridge();
    const available = await bridge.isAvailable();
    assert.true(available, 'OpenClaw不可用');
  })
];

// ==================== L4 集成测试 ====================
section('L4 集成测试 (Integration Tests)');

let testNodeA = null;
let testNodeB = null;

const integrationTests = [
  new TestCase('ST-NET-001', '节点启动', 'L4', 'P0', async () => {
    const { SilkNode } = await import('../src/network/node.js');
    testNodeA = new SilkNode({ name: 'testA', port: 10001 });
    
    const peerId = await testNodeA.start();
    assert.true(peerId.startsWith('12D3'), 'PeerId格式错误');
    assert.true(testNodeA.getPeers().length >= 0, '获取peers失败');
  }),
  
  new TestCase('ST-NET-002', '节点停止', 'L4', 'P0', async () => {
    if (testNodeA) {
      await testNodeA.stop();
      testNodeA = null;
    }
  })
];

// ==================== 测试执行 ====================
async function runTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         SilkTalk Test Suite Execution                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  const allTests = [...envTests, ...staticTests, ...unitTests, ...integrationTests];
  
  // 按优先级排序
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  allTests.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  const startTime = Date.now();
  
  for (const test of allTests) {
    await test.run();
    
    // P0失败时中断
    if (test.priority === 'P0' && test.status === 'failed') {
      log('error', `P0测试 ${test.id} 失败，测试中断`);
      break;
    }
  }
  
  const duration = Date.now() - startTime;
  
  // 生成报告
  section('测试报告 (Test Report)');
  
  console.log(`\n总耗时: ${duration}ms`);
  console.log(`总用例: ${results.total}`);
  console.log(`${C.green}通过: ${results.passed}${C.reset}`);
  console.log(`${C.red}失败: ${results.failed}${C.reset}`);
  console.log(`${C.yellow}跳过: ${results.skipped}${C.reset}`);
  
  const passRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(2) : 0;
  console.log(`\n通过率: ${passRate}%`);
  
  // 结果判定
  console.log('\n' + '='.repeat(60));
  if (results.failed === 0 && results.passed > 0) {
    console.log(`${C.green}✅ 所有测试通过${C.reset}`);
    return 0;
  } else if (results.failed > 0) {
    console.log(`${C.red}❌ 存在失败的测试${C.reset}`);
    return 1;
  } else {
    console.log(`${C.yellow}⚠️ 未执行测试${C.reset}`);
    return 2;
  }
}

// 运行测试
runTests().then(code => {
  process.exit(code);
}).catch(err => {
  log('error', `测试执行异常: ${err.message}`);
  console.error(err);
  process.exit(1);
});
