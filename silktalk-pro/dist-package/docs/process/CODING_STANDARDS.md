# 代码规范说明
## Coding Standards

**文档编号**: STP-STD-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro 开发团队  
**审核人**: 待签字  

---

## 1. 引言

### 1.1 目的
本文档定义 SilkTalk Pro 项目的代码规范，确保代码质量、一致性和可维护性。

### 1.2 适用范围
适用于所有 TypeScript/JavaScript 源代码文件。

### 1.3 参考资料
- Google TypeScript Style Guide
- Airbnb JavaScript Style Guide
- ISO/IEC 12207:2017

---

## 2. 命名规范

### 2.1 文件命名
- **源文件**: 使用小写字母，单词间用连字符分隔
  - ✅ `connection-manager.ts`
  - ❌ `ConnectionManager.ts`, `connection_manager.ts`

- **测试文件**: 使用 `.test.ts` 后缀
  - ✅ `node.test.ts`
  - ❌ `node.spec.ts`, `test-node.ts`

- **类型定义文件**: 使用 `.d.ts` 后缀 (仅外部类型)

### 2.2 目录命名
- 使用小写字母
- 单词间用连字符分隔
- ✅ `src/network/`
- ❌ `src/Network/`, `src/network_manager/`

### 2.3 类命名
- 使用 PascalCase
- 名词或名词短语
- ✅ `class ConnectionManager`
- ❌ `class connectionManager`, `class connection_manager`

### 2.4 接口命名
- 使用 PascalCase
- 不使用 `I` 前缀
- ✅ `interface ConnectionConfig`
- ❌ `interface IConnectionConfig`

### 2.5 类型别名命名
- 使用 PascalCase
- ✅ `type ConnectionMap = Map<string, Connection>`

### 2.6 枚举命名
- 使用 PascalCase
- 成员使用 PascalCase 或 UPPER_SNAKE_CASE
```typescript
// ✅ 正确
enum MessageType {
  HELLO = 0,
  TEXT = 1,
  DATA = 2
}

// ✅ 也正确
enum ConnectionState {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Connecting = 'connecting'
}
```

### 2.7 变量命名
- 使用 camelCase
- 有意义的名称
- ✅ `const maxConnections = 300;`
- ❌ `const mc = 300;`, `const max_connections = 300;`

### 2.8 常量命名
- 使用 UPPER_SNAKE_CASE
- ✅ `const DEFAULT_PORT = 4001;`
- ❌ `const defaultPort = 4001;`

### 2.9 函数命名
- 使用 camelCase
- 动词或动词短语
- ✅ `function connectToPeer()`
- ❌ `function ConnectToPeer()`, `function connect_to_peer()`

### 2.10 私有成员命名
- 使用下划线前缀
- ✅ `private _connectionPool: Map<string, Connection>;`
- ❌ `private connectionPool: Map<string, Connection>;`

### 2.11 布尔变量命名
- 使用 `is`, `has`, `can`, `should` 前缀
- ✅ `isConnected`, `hasPermission`, `canRetry`
- ❌ `connected`, `permission`, `retry`

---

## 3. 注释规范

### 3.1 文件头注释
每个源文件必须包含文件头注释：
```typescript
/**
 * 简短描述文件功能
 * 
 * 详细描述（如果需要）
 * 
 * @module 模块名
 * @author 作者名
 * @copyright 版权信息
 */
```

### 3.2 JSDoc/TSDoc 注释
所有公共 API 必须使用 JSDoc/TSDoc 注释：
```typescript
/**
 * 建立到对等点的连接
 * 
 * @param multiaddr - 目标地址
 * @param options - 连接选项
 * @returns 连接对象
 * @throws {ConnectionError} 连接失败时抛出
 * 
 * @example
 * ```typescript
 * const conn = await node.dial('/ip4/192.168.1.1/tcp/4001/p2p/12D3...');
 * ```
 */
async dial(
  multiaddr: string | Multiaddr,
  options?: DialOptions
): Promise<Connection> {
  // 实现
}
```

### 3.3 类注释
```typescript
/**
 * 管理 P2P 节点连接池
 * 
 * 负责维护活跃连接、清理空闲连接和负载均衡
 */
export class ConnectionManager extends EventEmitter {
  // ...
}
```

### 3.4 接口注释
```typescript
/**
 * 节点配置选项
 */
export interface SilkNodeConfig {
  /** 监听地址列表 */
  listenAddresses?: string[];
  
  /** 最大连接数 */
  maxConnections?: number;
}
```

### 3.5 枚举注释
```typescript
/**
 * 消息类型枚举
 */
export enum MessageType {
  /** 握手消息 */
  HELLO = 0,
  
  /** 文本消息 */
  TEXT = 1,
  
  /** 数据消息 */
  DATA = 2
}
```

### 3.6 行内注释
- 解释 "为什么" 而不是 "是什么"
- ✅ `// 使用指数退避避免 thundering herd`
- ❌ `// 设置延迟为 1000ms`

### 3.7 TODO 注释
```typescript
// TODO(作者): 描述需要完成的工作
// FIXME(作者): 描述需要修复的问题
// HACK(作者): 描述临时解决方案
```

---

## 4. 代码结构规范

### 4.1 导入顺序
1. 内置模块
2. 第三方模块
3. 项目内部模块
4. 类型导入

```typescript
// 1. 内置模块
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';

// 2. 第三方模块
import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';

// 3. 项目内部模块
import { Logger } from '../core/logger.js';
import { ConnectionManager } from '../network/connection-manager.js';

// 4. 类型导入
import type { SilkNodeConfig } from './types.js';
import type { PeerId } from '@libp2p/interface';
```

### 4.2 类成员顺序
1. 静态属性
2. 实例属性
3. 构造函数
4. 公共方法
5. 私有方法
6. 静态方法

```typescript
export class Example {
  // 1. 静态属性
  static readonly DEFAULT_TIMEOUT = 30000;
  
  // 2. 实例属性
  private _config: Config;
  private _logger: Logger;
  
  // 3. 构造函数
  constructor(config: Config) {
    this._config = config;
    this._logger = new Logger();
  }
  
  // 4. 公共方法
  public async start(): Promise<void> {
    // ...
  }
  
  // 5. 私有方法
  private _initialize(): void {
    // ...
  }
  
  // 6. 静态方法
  static createDefault(): Example {
    return new Example(DEFAULT_CONFIG);
  }
}
```

### 4.3 导出规范
- 每个文件一个主要导出
- 使用命名导出
- 类型单独导出

```typescript
// ✅ 正确
export class SilkNode { }
export type { SilkNodeConfig };
export { MessageType };

// ❌ 避免默认导出
export default class SilkNode { }
```

### 4.4 错误处理
- 使用自定义错误类
- 提供有意义的错误消息
- 记录错误上下文

```typescript
// ✅ 正确
try {
  await connection.send(data);
} catch (error) {
  this._logger.error('Failed to send message', {
    peerId: connection.remotePeer.toString(),
    error: error.message
  });
  throw new ConnectionError(`Send failed: ${error.message}`);
}

// ❌ 避免
try {
  await connection.send(data);
} catch (e) {
  throw e;
}
```

---

## 5. TypeScript 规范

### 5.1 类型注解
- 始终使用显式类型注解
- 避免使用 `any`
- 使用 `unknown` 代替 `any` 当类型不确定时

```typescript
// ✅ 正确
function processData(data: unknown): Result {
  if (isValidData(data)) {
    return transform(data);
  }
  throw new Error('Invalid data');
}

// ❌ 避免
function processData(data: any): any {
  return data;
}
```

### 5.2 接口 vs 类型别名
- 使用 `interface` 定义对象形状
- 使用 `type` 定义联合类型、元组等

```typescript
// ✅ 接口用于对象
interface User {
  id: string;
  name: string;
}

// ✅ 类型别名用于联合类型
type Status = 'pending' | 'active' | 'inactive';

// ✅ 类型别名用于复杂类型
type EventHandler = (event: Event) => void;
```

### 5.3 可选属性
- 使用 `?` 标记可选属性
- 避免使用 `| undefined` 除非必要

```typescript
// ✅ 正确
interface Config {
  host?: string;
  port: number;
}

// ❌ 避免
interface Config {
  host: string | undefined;
  port: number;
}
```

### 5.4 只读属性
- 使用 `readonly` 标记不可变属性

```typescript
interface Config {
  readonly id: string;
  readonly createdAt: Date;
  name: string;  // 可变
}
```

### 5.5 泛型命名
- 使用有意义的泛型参数名
- 单字母仅用于简单场景

```typescript
// ✅ 正确
interface Repository<TEntity> {
  findById(id: string): Promise<TEntity | null>;
}

// ✅ 简单场景也可以
function identity<T>(value: T): T {
  return value;
}
```

### 5.6 类型断言
- 避免类型断言，使用类型守卫
- 必要时使用 `as` 而非 `<>`

```typescript
// ✅ 类型守卫
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

if (isString(value)) {
  // value 被推断为 string
}

// ✅ 类型断言（必要时）
const element = document.getElementById('app') as HTMLElement;

// ❌ 避免
const element = <HTMLElement>document.getElementById('app');
```

---

## 6. 安全编码规范

### 6.1 输入验证
- 验证所有外部输入
- 使用 Zod 进行运行时验证

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  header: z.object({
    version: z.number().int().positive(),
    type: z.nativeEnum(MessageType),
    id: z.string().min(1),
    timestamp: z.number().int()
  }),
  payload: z.record(z.unknown())
});

function processMessage(data: unknown): Message {
  return MessageSchema.parse(data);
}
```

### 6.2 敏感数据处理
- 不在日志中记录敏感信息
- 使用环境变量存储密钥
- 内存中不长期保存明文密钥

```typescript
// ✅ 正确
this._logger.info('Connection established', {
  peerId: peerId.toString()
  // 不记录密钥
});

// ❌ 避免
this._logger.info('Connection established', {
  peerId: peerId.toString(),
  privateKey: key.toString('hex')  // 危险！
});
```

### 6.3 资源清理
- 使用 `try-finally` 或 `using` 确保资源释放

```typescript
// ✅ 正确
async function withConnection<T>(
  addr: string,
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  const conn = await dial(addr);
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}
```

---

## 7. 测试规范

### 7.1 测试文件位置
```
tests/
├── unit/
│   └── core/
│       └── node.test.ts
├── integration/
│   └── network.test.ts
└── e2e/
    └── messaging.test.ts
```

### 7.2 测试命名
```typescript
// 描述性测试名
describe('SilkNode', () => {
  describe('start', () => {
    it('should initialize libp2p node', async () => {
      // ...
    });
    
    it('should throw when already started', async () => {
      // ...
    });
  });
});
```

### 7.3 测试结构 (AAA)
```typescript
it('should send message to peer', async () => {
  // Arrange (准备)
  const node = await createTestNode();
  const peerId = '12D3KooW...';
  const message = createTestMessage();
  
  // Act (执行)
  await node.sendMessage(peerId, message);
  
  // Assert (断言)
  expect(mockTransport.send).toHaveBeenCalledWith(
    expect.objectContaining({
      header: expect.objectContaining({ type: MessageType.TEXT })
    })
  );
});
```

---

## 8. 性能规范

### 8.1 异步操作
- 优先使用 `async/await`
- 避免回调地狱
- 使用 `Promise.all` 并行执行

```typescript
// ✅ 正确
async function initialize(): Promise<void> {
  await Promise.all([
    this._connectionManager.start(),
    this._peerDiscovery.start(),
    this._dhtRouting.start()
  ]);
}

// ❌ 避免
function initialize(): Promise<void> {
  return this._connectionManager.start()
    .then(() => this._peerDiscovery.start())
    .then(() => this._dhtRouting.start());
}
```

### 8.2 内存管理
- 及时清理事件监听器
- 避免内存泄漏

```typescript
// ✅ 正确
class Component {
  private _abortController = new AbortController();
  
  start(): void {
    window.addEventListener('resize', this._handleResize, {
      signal: this._abortController.signal
    });
  }
  
  stop(): void {
    this._abortController.abort();
  }
}
```

---

## 9. 附录

### 9.1 ESLint 配置
```javascript
// eslint.config.js
export default [
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase']
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE']
        }
      ]
    }
  }
];
```

### 9.2 Prettier 配置
```json
{
  "semi": true,
  "trailingComma": "none",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 9.3 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk Team | 初始版本 |

### 9.4 批准签字

**技术负责人**: _________________ 日期: _______

**项目经理**: _________________ 日期: _______

---

**文档结束**
