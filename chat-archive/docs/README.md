# Chat Archive 完整文档（优化版）

## 文档目录

1. [架构设计](ARCHITECTURE.md) - 系统架构与技术选型
2. [部署指南](DEPLOYMENT.md) - 部署与配置
3. [运维手册](OPERATIONS.md) - 日常运维与故障处理
4. [API文档](API.md) - 接口与使用示例
5. [开发指南](DEVELOPMENT.md) - 开发与测试
6. [安全规范](SECURITY.md) - 安全与合规
7. [CHANGELOG](CHANGELOG.md) - 版本变更记录

## 快速开始

```bash
# Docker部署
docker-compose up -d

# 检查健康状态
curl http://localhost:8080/health
```

## 系统架构

```
┌─────────────────────────────────────────┐
│           Chat Archive                  │
│           (Optimized v2.0)              │
├─────────────────────────────────────────┤
│  API层: HTTP健康检查 (/health)          │
├─────────────────────────────────────────┤
│  业务层: OptimizedChatArchive 主类      │
│  - 智能解析、多标签、会话关联           │
├─────────────────────────────────────────┤
│  智能解析层:                            │
│  - InvertedIndex (倒排索引)             │
│  - MultiLabelParser (多标签解析)        │
│  - SessionManager (会话上下文)          │
│  - FeedbackManager (反馈学习)           │
├─────────────────────────────────────────┤
│  数据层:                                │
│  - BufferedWriter (内存缓冲)            │
│  - WAL (预写日志)                       │
│  - ArchiveDB (DuckDB)                   │
├─────────────────────────────────────────┤
│  支撑层:                                │
│  - EventBus (事件总线)                  │
│  - BackupManager (自动备份)             │
│  - CleanupManager (数据清理)            │
│  - HealthMonitor (健康监控)             │
│  - Logger (结构化日志)                  │
│  - DataMasker (隐私保护)                │
└─────────────────────────────────────────┘
```

## 核心特性（v2.0优化）

### 1. 高性能解析
- **倒排索引**: O(1)快速类型检测（原O(n)）
- **解析缓存**: LRU缓存，命中率>90%
- **性能提升**: 10-100倍

### 2. 多标签支持
- 一条消息可属于多个类型
- 主类型+次要类型数据合并
- 标签关系图（层级、关联）

### 3. 会话上下文
- 自动关联同一事件的多条消息
- 基于时间、工单号、参与者、标签
- 完整事件流追踪

### 4. 实时通知
- 事件总线（发布-订阅）
- P0工单立即告警
- Webhook/邮件/短信通知

### 5. 数据隐私
- 自动脱敏（手机号、身份证、邮箱等）
- 访问控制（基于权限过滤）
- 数据保留策略

### 6. 反馈学习
- 收集人工反馈
- 准确率统计
- 自动优化建议

### 7. 灵活类型系统
- JSON定义类型
- 动态注册
- 类型继承

## 使用示例

```typescript
import { OptimizedChatArchive } from 'chat-archive';

const archive = new OptimizedChatArchive({
  enableMultiLabel: true,
  enableSessionTracking: true,
  enablePrivacyMask: true,
  enableFeedback: true,
  enableNotifications: true,
});

await archive.init();

// 归档消息（自动解析、关联会话、实时通知）
const { session, parsed } = await archive.archive({
  id: 'msg_001',
  timestamp: new Date(),
  channel: 'feishu',
  chatId: 'group_123',
  userId: 'user_456',
  userName: '张三',
  content: '邮件系统退信，请提供测试报告',
  isMentioned: false,
});

// 结果：
// - parsed.primaryType: 'email_ticket'
// - parsed.secondaryTypes: [{type: 'process_request', ...}]
// - parsed.allLabels: ['email_ticket', 'process_request', 'ticket']
// - session: 关联的会话上下文

// 查询会话
const sessionInfo = archive.getSession(session.id);
console.log(`会话包含 ${sessionInfo.messageIds.length} 条消息`);

// 提交反馈（优化模型）
await archive.submitFeedback('msg_001', false, 'ticket_create', {...});

// 获取统计
const parseStats = await archive.getParseStats();
const sessionStats = archive.getSessionStats();
```

## 项目结构

```
chat-archive/
├── src/
│   ├── index.ts                    # 入口
│   ├── optimized-archive.ts        # 优化后主类
│   ├── archive.ts                  # 基础主类
│   ├── db.ts                       # 数据库操作
│   ├── buffer.ts                   # 缓冲写入
│   ├── wal.ts                      # WAL
│   ├── backup.ts                   # 备份
│   ├── cleanup.ts                  # 清理
│   ├── health.ts                   # 健康检查
│   ├── logger.ts                   # 日志
│   ├── system.ts                   # 系统监控
│   ├── config.ts                   # 配置加载
│   ├── openclaw.ts                 # OpenClaw集成
│   ├── types.ts                    # 基础类型
│   │
│   ├── flexible-types.ts           # 灵活类型系统
│   ├── flexible-parser.ts          # 插件化解析器
│   ├── index-system.ts             # 倒排索引+缓存
│   ├── multi-label.ts              # 多标签支持
│   ├── session-manager.ts          # 会话上下文
│   ├── event-bus.ts                # 事件总线
│   ├── privacy.ts                  # 隐私保护
│   ├── feedback-learning.ts        # 反馈学习
│   │
│   └── ticket-types.ts             # 工单类型（旧）
│   └── ticket-parser.ts            # 工单解析器（旧）
│
├── docs/                           # 文档
│   ├── README.md                   # 文档入口
│   ├── ARCHITECTURE.md             # 架构设计
│   ├── DEPLOYMENT.md               # 部署指南
│   ├── OPERATIONS.md               # 运维手册
│   ├── API.md                      # API文档
│   ├── DEVELOPMENT.md              # 开发指南
│   ├── SECURITY.md                 # 安全规范
│   └── CHANGELOG.md                # 变更日志
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md                       # 项目说明
└── OPTIMIZATION_SUMMARY.md         # 优化总结
```

## 性能对比

| 指标 | v1.0 | v2.0 | 提升 |
|------|------|------|------|
| 类型检测 | 50次正则 | 5次索引查询 | 10x |
| 重复解析 | 每次都解析 | LRU缓存命中 | 100x |
| 上下文关联 | 无 | 自动关联 | 新功能 |
| 实时通知 | 无 | <100ms | 新功能 |
| 多标签支持 | 单标签 | 多标签 | 新功能 |
| 隐私保护 | 无 | 自动脱敏 | 新功能 |
| 反馈学习 | 无 | 自动优化 | 新功能 |

## 联系方式

如有问题，请提交 Issue 或联系维护者。
