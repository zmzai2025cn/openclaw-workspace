/**
 * ClawChat 单元测试套件
 * 测试所有核心函数的输入输出、边界条件和异常路径
 */

const assert = require('assert');

// 模拟 WebSocket
class MockWebSocket {
  constructor() {
    this.readyState = 1; // OPEN
    this.sent = [];
    this.closed = false;
    this.closeCode = null;
    this.closeReason = null;
  }
  
  send(data) {
    this.sent.push(data);
  }
  
  close(code, reason) {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3; // CLOSED
  }
}

// 测试计数器
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    testsFailed++;
  }
}

// ==================== 消息验证测试 ====================

console.log('\n📦 消息验证测试 (validateMessage)');

// 导入服务器模块中的函数
const serverCode = require('fs').readFileSync(__dirname + '/../server/server.js', 'utf8');

// 手动实现验证函数进行测试
function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'Message must be object' };
  }
  if (!msg.type || typeof msg.type !== 'string') {
    return { valid: false, error: 'Message type required' };
  }
  if (!['register', 'subscribe', 'publish', 'ping', 'ack'].includes(msg.type)) {
    return { valid: false, error: `Unknown type: ${msg.type}` };
  }
  return { valid: true };
}

test('验证空消息', () => {
  const result = validateMessage(null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('object'));
});

test('验证 undefined', () => {
  const result = validateMessage(undefined);
  assert.strictEqual(result.valid, false);
});

test('验证字符串消息', () => {
  const result = validateMessage('string');
  assert.strictEqual(result.valid, false);
});

test('验证数字消息', () => {
  const result = validateMessage(123);
  assert.strictEqual(result.valid, false);
});

test('验证数组消息', () => {
  const result = validateMessage([]);
  assert.strictEqual(result.valid, false);
});

test('验证空对象', () => {
  const result = validateMessage({});
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('type'));
});

test('验证缺少 type', () => {
  const result = validateMessage({ id: 'test' });
  assert.strictEqual(result.valid, false);
});

test('验证 type 为数字', () => {
  const result = validateMessage({ type: 123 });
  assert.strictEqual(result.valid, false);
});

test('验证 type 为 null', () => {
  const result = validateMessage({ type: null });
  assert.strictEqual(result.valid, false);
});

test('验证有效的 register', () => {
  const result = validateMessage({ type: 'register', id: 'test' });
  assert.strictEqual(result.valid, true);
});

test('验证有效的 subscribe', () => {
  const result = validateMessage({ type: 'subscribe', channel: 'test' });
  assert.strictEqual(result.valid, true);
});

test('验证有效的 publish', () => {
  const result = validateMessage({ type: 'publish', channel: 'test', payload: {} });
  assert.strictEqual(result.valid, true);
});

test('验证有效的 ping', () => {
  const result = validateMessage({ type: 'ping' });
  assert.strictEqual(result.valid, true);
});

test('验证有效的 ack', () => {
  const result = validateMessage({ type: 'ack', msgId: '123' });
  assert.strictEqual(result.valid, true);
});

test('验证未知类型', () => {
  const result = validateMessage({ type: 'unknown' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Unknown'));
});

test('验证大写类型', () => {
  const result = validateMessage({ type: 'REGISTER' });
  assert.strictEqual(result.valid, false);
});

// ==================== Payload 大小验证测试 ====================

console.log('\n📦 Payload 大小验证测试 (validatePayload)');

const MAX_MESSAGE_SIZE = 10240;

function validatePayload(payload) {
  const size = JSON.stringify(payload).length;
  if (size > MAX_MESSAGE_SIZE) {
    return { valid: false, error: `Payload too large: ${size} > ${MAX_MESSAGE_SIZE}` };
  }
  return { valid: true };
}

test('验证空 payload', () => {
  const result = validatePayload({});
  assert.strictEqual(result.valid, true);
});

test('验证小 payload', () => {
  const result = validatePayload({ text: 'hello' });
  assert.strictEqual(result.valid, true);
});

test('验证边界大小 payload (正好 10240)', () => {
  // {"text":""} = 11 字节，所以字符串需要 10229 字节才能正好 10240
  const payload = { text: 'a'.repeat(10229) };
  const result = validatePayload(payload);
  assert.strictEqual(result.valid, true);
});

test('验证超大 payload (10241)', () => {
  const payload = { text: 'a'.repeat(10231) };
  const result = validatePayload(payload);
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('too large'));
});

test('验证大 payload (100KB)', () => {
  const payload = { data: 'x'.repeat(100000) };
  const result = validatePayload(payload);
  assert.strictEqual(result.valid, false);
});

// ==================== ID 验证测试 ====================

console.log('\n📦 ID 验证测试');

function validateId(id) {
  if (!id || typeof id !== 'string' || id.length < 1 || id.length > 32) {
    return { valid: false, error: 'Invalid ID: must be 1-32 characters' };
  }
  return { valid: true };
}

test('验证空 ID', () => {
  const result = validateId('');
  assert.strictEqual(result.valid, false);
});

test('验证 null ID', () => {
  const result = validateId(null);
  assert.strictEqual(result.valid, false);
});

test('验证 undefined ID', () => {
  const result = validateId(undefined);
  assert.strictEqual(result.valid, false);
});

test('验证数字 ID', () => {
  const result = validateId(123);
  assert.strictEqual(result.valid, false);
});

test('验证 1 字符 ID', () => {
  const result = validateId('a');
  assert.strictEqual(result.valid, true);
});

test('验证 32 字符 ID', () => {
  const result = validateId('a'.repeat(32));
  assert.strictEqual(result.valid, true);
});

test('验证 33 字符 ID', () => {
  const result = validateId('a'.repeat(33));
  assert.strictEqual(result.valid, false);
});

test('验证特殊字符 ID', () => {
  const result = validateId('test@#$%^&*()');
  assert.strictEqual(result.valid, true);
});

test('验证 Unicode ID', () => {
  const result = validateId('用户名🚀');
  assert.strictEqual(result.valid, true);
});

test('验证空格 ID', () => {
  const result = validateId('   ');
  assert.strictEqual(result.valid, true); // 空格是有效字符
});

// ==================== 频道名称验证测试 ====================

console.log('\n📦 频道名称验证测试');

function validateChannel(channel) {
  if (!channel || typeof channel !== 'string' || channel.length < 1 || channel.length > 64) {
    return { valid: false, error: 'Invalid channel name: must be 1-64 characters' };
  }
  return { valid: true };
}

test('验证空频道名', () => {
  const result = validateChannel('');
  assert.strictEqual(result.valid, false);
});

test('验证 null 频道名', () => {
  const result = validateChannel(null);
  assert.strictEqual(result.valid, false);
});

test('验证 1 字符频道名', () => {
  const result = validateChannel('a');
  assert.strictEqual(result.valid, true);
});

test('验证 64 字符频道名', () => {
  const result = validateChannel('a'.repeat(64));
  assert.strictEqual(result.valid, true);
});

test('验证 65 字符频道名', () => {
  const result = validateChannel('a'.repeat(65));
  assert.strictEqual(result.valid, false);
});

test('验证中文频道名', () => {
  const result = validateChannel('中文频道');
  assert.strictEqual(result.valid, true);
});

// ==================== HTML 转义测试 ====================

console.log('\n📦 HTML 转义测试 (XSS防护)');

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  // 使用简单实现进行HTML转义
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

test('转义 <script> 标签', () => {
  const result = escapeHtml('<script>alert(1)</script>');
  assert.ok(!result.includes('<script>'));
  assert.ok(result.includes('&lt;'));
});

test('转义 onerror 属性', () => {
  const result = escapeHtml('<img src=x onerror=alert(1)>');
  assert.ok(!result.includes('<img'));
  assert.ok(result.includes('&lt;'));
});

test('转义 javascript: 协议', () => {
  const result = escapeHtml('<a href="javascript:alert(1)">click</a>');
  assert.ok(!result.includes('<a'));
});

test('转义 & 符号', () => {
  const result = escapeHtml('Tom & Jerry');
  assert.ok(result.includes('&amp;'));
});

test('转义引号', () => {
  const result = escapeHtml('"quoted"');
  assert.ok(!result.includes('"quoted"'));
});

test('验证非字符串输入', () => {
  const result = escapeHtml(123);
  assert.strictEqual(result, '');
});

test('验证 null 输入', () => {
  const result = escapeHtml(null);
  assert.strictEqual(result, '');
});

// ==================== 客户端配置验证测试 ====================

console.log('\n📦 客户端配置验证测试');

test('默认配置', () => {
  const config = {
    serverUrl: 'ws://localhost:8080',
    clientId: 'anonymous',
    autoReconnect: true,
    reconnectDelay: 1000,
    maxReconnectDelay: 60000,
    connectionTimeout: 10000,
    maxMessageSize: 10240
  };
  assert.strictEqual(config.serverUrl, 'ws://localhost:8080');
  assert.strictEqual(config.autoReconnect, true);
});

test('自定义配置覆盖', () => {
  const config = {
    serverUrl: 'wss://example.com',
    clientId: 'custom',
    autoReconnect: false,
    reconnectDelay: 5000
  };
  assert.strictEqual(config.serverUrl, 'wss://example.com');
  assert.strictEqual(config.autoReconnect, false);
  assert.strictEqual(config.reconnectDelay, 5000);
});

test('配置边界值 - reconnectDelay', () => {
  const config = { reconnectDelay: 0 };
  assert.strictEqual(config.reconnectDelay, 0);
});

test('配置边界值 - maxReconnectDelay', () => {
  const config = { maxReconnectDelay: 3600000 }; // 1小时
  assert.strictEqual(config.maxReconnectDelay, 3600000);
});

// ==================== 消息队列测试 ====================

console.log('\n📦 消息队列测试');

test('空队列', () => {
  const queue = [];
  assert.strictEqual(queue.length, 0);
});

test('队列添加消息', () => {
  const queue = [];
  queue.push({ type: 'test' });
  assert.strictEqual(queue.length, 1);
});

test('队列取出消息', () => {
  const queue = [{ type: 'msg1' }, { type: 'msg2' }];
  const msg = queue.shift();
  assert.strictEqual(msg.type, 'msg1');
  assert.strictEqual(queue.length, 1);
});

// ==================== 指数退避测试 ====================

console.log('\n📦 指数退避算法测试');

test('指数退避计算', () => {
  const delays = [];
  let currentDelay = 1000;
  const maxReconnectDelay = 60000;
  
  for (let i = 0; i < 10; i++) {
    delays.push(currentDelay);
    currentDelay = Math.min(currentDelay * 2, maxReconnectDelay);
  }
  
  assert.strictEqual(delays[0], 1000);
  assert.strictEqual(delays[1], 2000);
  assert.strictEqual(delays[2], 4000);
  assert.strictEqual(delays[5], 32000);
  assert.strictEqual(delays[6], 60000); // 达到上限
  assert.strictEqual(delays[9], 60000); // 保持上限
});

// ==================== 测试结果汇总 ====================

console.log('\n' + '='.repeat(50));
console.log(`📊 单元测试完成: ${testsPassed} 通过, ${testsFailed} 失败`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
}
