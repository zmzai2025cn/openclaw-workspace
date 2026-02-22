# SilkTalk API 文档

**版本**: 0.1.0  
**模块**: Protocol, Network, Router, AgentBridge, CLI

---

## 1. Protocol 模块

### 1.1 常量

#### MessageType
消息类型枚举。

```javascript
export const MessageType = {
  PING: 'ping',
  PONG: 'pong', 
  TASK: 'task',
  RESULT: 'result',
  ERROR: 'error'
};
```

#### Priority
任务优先级枚举。

```javascript
export const Priority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3
};
```

### 1.2 函数

#### createMessage(type, from, to, payload)
创建通用消息。

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 消息类型 |
| from | string | 是 | 发送方 peerId |
| to | string | 是 | 接收方 peerId 或 'broadcast' |
| payload | object | 否 | 消息载荷，默认 {} |

**返回:** `SilkMessage` 对象

**示例:**
```javascript
import { createMessage, MessageType } from './protocol/message.js';

const msg = createMessage(
  MessageType.PING,
  'QmSender...',
  'QmTarget...',
  { ts: Date.now() }
);
```

---

#### createTask(from, to, command, timeout, priority)
创建任务消息。

**参数:**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| from | string | 是 | - | 发送方 peerId |
| to | string | 是 | - | 接收方 peerId |
| command | string | 是 | - | 要执行的命令 |
| timeout | number | 否 | 30000 | 超时时间（毫秒） |
| priority | number | 否 | 2 | 优先级 (1-3) |

**返回:** `SilkMessage` 对象，type 为 'task'

**示例:**
```javascript
import { createTask, Priority } from './protocol/message.js';

const task = createTask(
  'QmSender...',
  'QmExecutor...',
  '--message "Hello"',
  60000,
  Priority.HIGH
);
```

---

#### createResult(from, to, taskId, success, output, exitCode, duration)
创建结果消息。

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| from | string | 是 | 执行方 peerId |
| to | string | 是 | 调用方 peerId |
| taskId | string | 是 | 原任务 ID |
| success | boolean | 是 | 是否成功 |
| output | string | 是 | 命令输出 |
| exitCode | number | 是 | 退出码 |
| duration | number | 是 | 执行时长（毫秒） |

**返回:** `SilkMessage` 对象，type 为 'result'

---

#### encode(msg)
编码消息为 Buffer。

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| msg | object | 是 | 消息对象 |

**返回:** `Buffer`

---

#### decode(data)
解码 Buffer 为消息。

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| data | Buffer | 是 | 原始数据 |

**返回:** `SilkMessage | null` - 成功返回消息，失败返回 null

---

#### validateMessage(msg)
验证消息格式。

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| msg | unknown | 是 | 待验证对象 |

**返回:** `boolean` - 是否有效

**验证规则:**
- 必须是对象
- 必须有有效的 type
- id, from, to 必须是字符串
- timestamp 必须是数字

---

## 2. Network 模块

### 2.1 SilkNode 类

P2P 网络节点封装。

#### 构造函数

```javascript
const node = new SilkNode(options);
```

**选项:**
| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | string | 'anonymous' | 节点名称 |
| port | number | 0 | 监听端口（0=随机） |
| bootstrapPeers | string[] | [] | 引导节点地址列表 |

---

#### start()
启动节点。

```javascript
const peerId = await node.start();
```

**返回:** `Promise<string>` - 本节点 peerId

**抛出:**
- 网络错误
- 端口占用错误

---

#### stop()
停止节点。

```javascript
await node.stop();
```

**返回:** `Promise<void>`

---

#### send(peerId, message)
发送消息到指定节点。

```javascript
await node.send('QmTarget...', message);
```

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| peerId | string | 目标节点 peerId |
| message | object | 消息对象 |

**抛出:**
- 无效 peerId
- 连接失败
- 发送超时

---

#### broadcast(message)
广播消息到所有连接节点。

```javascript
await node.broadcast(message);
```

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| message | object | 消息对象 |

---

#### getPeers()
获取已连接节点列表。

```javascript
const peers = node.getPeers();
// 返回: ['QmPeer1...', 'QmPeer2...']
```

**返回:** `string[]` - peerId 数组

---

#### getPeerId()
获取本节点 peerId。

```javascript
const myId = node.getPeerId();
```

**返回:** `string`

---

#### on(type, handler)
注册消息处理器。

```javascript
node.on(MessageType.TASK, async (msg, conn) => {
  console.log('Received task:', msg.payload.command);
  // 处理任务...
});
```

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 消息类型 |
| handler | function | 处理函数 `(msg, { peerId, connection }) => Promise<void>` |

---

## 3. Router 模块

### 3.1 TaskRouter 类

任务路由管理。

#### 构造函数

```javascript
const router = new TaskRouter(options);
```

**选项:**
| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| node | SilkNode | 必填 | P2P 节点实例 |
| localExecutor | object | null | 本地执行器 |
| defaultTimeout | number | 30000 | 默认超时（毫秒） |

---

#### route(command, options)
路由任务。

```javascript
const result = await router.route('--message "Hello"', {
  target: 'remote',
  peerId: 'QmExecutor...',
  timeout: 60000
});
```

**参数:**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| command | string | 是 | - | 要执行的命令 |
| options.target | string | 否 | 'auto' | 目标: 'local', 'remote', 'auto' |
| options.peerId | string | 条件 | - | 远程目标（target='remote' 时必填） |
| options.timeout | number | 否 | 30000 | 超时时间 |
| options.priority | number | 否 | 2 | 优先级 |

**返回:** `Promise<object>`

**结果对象:**
```javascript
{
  success: boolean,    // 是否成功
  output: string,      // 命令输出
  exitCode: number,    // 退出码
  duration: number     // 执行时长（毫秒）
}
```

**抛出:**
- 无可用执行器
- 网络发送失败
- 任务超时

---

#### handleIncomingTask(taskMessage)
处理接收到的任务（内部使用）。

```javascript
node.on(MessageType.TASK, (msg) => router.handleIncomingTask(msg));
```

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| taskMessage | object | 任务消息 |

---

#### handleIncomingResult(resultMessage)
处理接收到的结果（内部使用）。

```javascript
node.on(MessageType.RESULT, (msg) => router.handleIncomingResult(msg));
```

**参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| resultMessage | object | 结果消息 |

---

## 4. AgentBridge 模块

### 4.1 OpenClawBridge 类

OpenClaw 执行桥接。

#### 构造函数

```javascript
const bridge = new OpenClawBridge(options);
```

**选项:**
| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| path | string | 'openclaw' | OpenClaw 可执行路径 |
| timeout | number | 60000 | 默认超时（毫秒） |

---

#### execute(command, timeout)
执行命令。

```javascript
const result = await bridge.execute('--message "Hello"', 30000);
```

**参数:**
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| command | string | 是 | - | 命令字符串 |
| timeout | number | 否 | 60000 | 超时时间 |

**返回:** `Promise<object>`

**结果对象:**
```javascript
{
  output: string,   // stdout 或 stderr
  exitCode: number, // 进程退出码
  success: boolean  // exitCode === 0
}
```

**抛出:**
- 空命令
- 进程启动失败
- 执行超时

---

#### isAvailable()
检查 OpenClaw 可用性。

```javascript
const available = await bridge.isAvailable();
```

**返回:** `Promise<boolean>`

---

## 5. CLI 模块

### 5.1 SilkCLI 类

交互式命令行界面。

#### 构造函数

```javascript
const cli = new SilkCLI(options);
```

**选项:**
| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| node | SilkNode | 是 | P2P 节点 |
| router | TaskRouter | 是 | 任务路由 |
| onClose | function | 否 | 关闭回调 |

---

#### start()
启动交互式 shell。

```javascript
cli.start();
// 进入交互模式，显示 silktalk> 提示符
```

---

## 6. 类型定义

### 6.1 SilkMessage

```typescript
interface SilkMessage {
  type: 'ping' | 'pong' | 'task' | 'result' | 'error';
  id: string;
  from: string;
  to: string;
  payload: object;
  timestamp: number;
}
```

### 6.2 TaskPayload

```typescript
interface TaskPayload {
  command: string;
  timeout: number;
  priority: 1 | 2 | 3;
}
```

### 6.3 ResultPayload

```typescript
interface ResultPayload {
  taskId: string;
  status: 'success' | 'failure';
  output: string;
  exitCode: number;
  duration: number;
}
```

---

## 7. 错误码

| 错误场景 | 错误信息 | 处理建议 |
|----------|----------|----------|
| 空命令 | `Empty command` | 检查输入 |
| 无效 peerId | `Invalid peerId: xxx` | 检查 peerId 格式 |
| 连接失败 | `Failed to connect` | 检查网络和防火墙 |
| 任务超时 | `Task timeout after Xms` | 增加超时时间 |
| 无执行器 | `No local executor configured` | 检查 OpenClaw 可用性 |
| 进程启动失败 | `Failed to spawn OpenClaw` | 检查 OpenClaw 安装 |

---

## 8. 使用示例

### 8.1 完整流程示例

```javascript
import { SilkNode } from './network/node.js';
import { TaskRouter } from './router/router.js';
import { OpenClawBridge } from './agent-bridge/bridge.js';
import { MessageType } from './protocol/message.js';

// 1. 创建节点
const node = new SilkNode({ name: 'nodeA', port: 10001 });

// 2. 创建桥接
const bridge = new OpenClawBridge();

// 3. 创建路由
const router = new TaskRouter({ node, localExecutor: bridge });

// 4. 注册处理器
node.on(MessageType.TASK, (msg) => router.handleIncomingTask(msg));
node.on(MessageType.RESULT, (msg) => router.handleIncomingResult(msg));

// 5. 启动
await node.start();

// 6. 委托任务
const result = await router.route('--message "Hello"', {
  target: 'remote',
  peerId: 'QmPeer...'
});

console.log(result);
```
