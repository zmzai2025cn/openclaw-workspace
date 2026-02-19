# API文档（优化版 v2.0）

## 1. 健康检查API

### GET /health

系统健康状态检查

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": true,
    "wal": true,
    "buffer": { "status": true, "buffered": 23 },
    "disk": { "status": true, "usage": 45 },
    "memory": { "status": true, "usage": 32 }
  },
  "uptime": 86400000
}
```

### GET /metrics

监控指标（包含优化指标）

**响应**:
```json
{
  "messagesTotal": 15234,
  "messagesBuffered": 23,
  "flushCount": 152,
  "flushErrors": 0,
  "backupCount": 7,
  "queryCount": 456,
  "queryLatency": [12, 15, 8, 20, 11],
  "diskUsage": 45,
  "memoryUsage": 32,
  "parseAccuracy": 0.92,
  "activeSessions": 5,
  "cacheHitRate": 0.87
}
```

## 2. OptimizedChatArchive API

### 构造函数

```typescript
const archive = new OptimizedChatArchive({
  // 基础配置
  archive: { dbPath: './data/chat.db', bufferSize: 100 },
  backup: { enabled: true, retainCount: 7 },
  cleanup: { enabled: true, retentionDays: 90 },
  
  // 优化功能开关
  enableMultiLabel: true,        // 多标签解析
  enableSessionTracking: true,   // 会话追踪
  enablePrivacyMask: true,       // 数据脱敏
  enableFeedback: true,          // 反馈学习
  enableNotifications: true,     // 实时通知
  
  // 性能配置
  cacheSize: 10000,
  sessionTimeout: 1800000,
  
  healthPort: 8080,
  logFile: './logs/archive.log',
});
```

### archive() - 智能归档

```typescript
const { session, parsed } = await archive.archive({
  id: 'msg_001',
  timestamp: new Date(),
  channel: 'feishu',
  chatId: 'group_123',
  userId: 'user_001',
  userName: '张三',
  content: '邮件系统退信，请提供测试报告',
  isMentioned: false,
});

// 返回：
// {
//   session: Session,           // 关联的会话
//   parsed: {
//     primaryType: 'email_ticket',
//     primaryConfidence: 0.85,
//     secondaryTypes: [
//       { type: 'process_request', confidence: 0.72, fields: {...} }
//     ],
//     allLabels: ['email_ticket', 'process_request', 'ticket'],
//     mergedData: { ... }
//   }
// }
```

**自动执行**：
1. 倒排索引快速类型检测（O(1)）
2. 多标签解析
3. 数据脱敏（如启用）
4. 会话关联
5. 实时事件通知
6. WAL+DB持久化

### submitFeedback() - 反馈优化

```typescript
// 标记正确
await archive.submitFeedback('msg_001', true);

// 提交修正
await archive.submitFeedback(
  'msg_001',                    // 消息ID
  false,                        // 原解析是否正确
  'ticket_create',              // 正确的类型
  { severity: 'P1' },           // 正确的字段
  'user_001'                    // 反馈用户
);
```

### 会话管理

```typescript
// 获取会话
const session = archive.getSession('session_xxx');
// 返回：{ id, topic, status, participants, messageIds, messages, ... }

// 获取消息所属的会话
const session = archive.getSessionByMessage('msg_001');

// 获取会话统计
const stats = archive.getSessionStats();
// 返回：{ totalSessions, activeSessions, resolvedSessions, avgMessagesPerSession }
```

### 统计查询

```typescript
// 解析统计
const parseStats = await archive.getParseStats();
// 返回：{ totalParsed, accuracy, typeDistribution }

// 数据库统计
const dbStats = await archive.getStats();
// 返回：{ totalMessages, totalChats, totalUsers, ... }
```

## 3. 事件订阅

```typescript
import { globalEventBus } from 'chat-archive';

// 订阅事件
const unsubscribe = globalEventBus.subscribe('ticket.created', (event) => {
  console.log('新工单:', event.payload);
});

// 取消订阅
unsubscribe();

// 订阅多个事件
globalEventBus.subscribeMany(
  ['ticket.created', 'alert.critical'],
  (event) => console.log('重要事件:', event.type)
);
```

### 事件类型

| 事件 | Payload |
|------|---------|
| `message.received` | `{ messageId, timestamp, userId }` |
| `message.parsed` | `{ messageId, type, confidence, parsedData }` |
| `session.created` | `{ sessionId, topic, ticketId }` |
| `session.resolved` | `{ sessionId, ticketId, duration }` |
| `ticket.created` | `{ ticketId, severity, systemName }` |
| `ticket.merged` | `{ sourceTicketId, targetTicketId }` |
| `alert.critical` | `{ level, message, context }` |

## 4. 类型定义

### FlexibleMessage

```typescript
interface FlexibleMessage {
  id: string;
  timestamp: Date;
  channel: string;
  chatId: string;
  userId: string;
  userName: string;
  content: string;
  isMentioned: boolean;
  replyTo?: string;
  
  // 动态类型
  messageType: string;
  messageCategory: string;
  
  // 解析数据
  parsedData?: Record<string, any>;
  
  // 元数据
  metadata: {
    hasImage: boolean;
    hasAttachment: boolean;
    hasLink: boolean;
    mentionedUsers: string[];
    isSystemMessage: boolean;
    isForwarded: boolean;
    isReply: boolean;
    parseConfidence: number;
    parserVersion: string;
    parserName: string;
  };
  
  // 原始信息
  raw: {
    content: string;
    attachments: Attachment[];
    mentions: string[];
  };
}
```

### Session

```typescript
interface Session {
  id: string;
  topic: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  startTime: Date;
  endTime?: Date;
  lastActivityTime: Date;
  participants: Set<string>;
  messageIds: string[];
  messages: FlexibleMessage[];
  ticketId?: string;
  systemName?: string;
  severity?: string;
  metadata: {
    messageCount: number;
    hasResolution: boolean;
    tags: string[];
  };
}
```

### MultiLabelResult

```typescript
interface MultiLabelResult {
  primaryType: string;
  primaryConfidence: number;
  secondaryTypes: Array<{
    type: string;
    confidence: number;
    fields: Record<string, any>;
  }>;
  allLabels: string[];
  mergedData: Record<string, any>;
}
```

## 5. 完整示例

```typescript
import { OptimizedChatArchive, globalEventBus } from 'chat-archive';

async function main() {
  // 1. 初始化
  const archive = new OptimizedChatArchive({
    enableMultiLabel: true,
    enableSessionTracking: true,
    enablePrivacyMask: true,
    enableFeedback: true,
    enableNotifications: true,
  });
  
  await archive.init();
  
  // 2. 订阅事件
  globalEventBus.subscribe('ticket.created', async (event) => {
    if (event.payload.severity === 'P0') {
      await sendUrgentAlert('P0工单:', event.payload);
    }
  });
  
  // 3. 归档消息
  const { session, parsed } = await archive.archive({
    id: 'msg_001',
    timestamp: new Date(),
    channel: 'feishu',
    chatId: 'group_123',
    userId: 'user_001',
    userName: '张三',
    content: '邮件系统退信，请提供测试报告',
    isMentioned: false,
  });
  
  console.log('主类型:', parsed.primaryType);
  console.log('所有标签:', parsed.allLabels);
  console.log('会话ID:', session.id);
  
  // 4. 提交反馈
  await archive.submitFeedback('msg_001', false, 'ticket_create', {
    severity: 'P1',
    systemName: '邮件系统'
  });
  
  // 5. 查询统计
  const parseStats = await archive.getParseStats();
  console.log('解析准确率:', parseStats.accuracy);
  
  // 6. 关闭
  await archive.close();
}

main();
```
