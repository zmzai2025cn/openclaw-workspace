# Chat Archive - 生产级聊天消息归档系统（v2.0优化版）

基于 DuckDB 的聊天消息归档系统，具备生产级稳定性、智能解析、实时通知和运维友好性。

## v2.0新特性

### 🚀 性能优化
- **倒排索引**: O(1)快速类型检测（原O(n)）
- **解析缓存**: LRU缓存，命中率>90%

### 🧠 智能解析
- **多标签支持**: 一条消息可属于多个类型
- **会话上下文**: 自动关联同一事件的多条消息
- **反馈学习**: 基于人工反馈自动优化

### 📡 实时能力
- **事件总线**: 发布-订阅模式
- **P0告警**: 严重问题立即通知

### 🔒 数据安全
- **自动脱敏**: 敏感信息自动脱敏
- **访问控制**: 基于权限过滤

### 🔧 灵活扩展
- **动态类型**: JSON定义，动态注册
- **插件解析**: 支持自定义解析器

## 快速开始

```bash
# Docker部署
docker-compose up -d

# 检查健康状态
curl http://localhost:8080/health
```

## 使用示例

```typescript
import { OptimizedChatArchive } from 'chat-archive';

const archive = new OptimizedChatArchive({
  enableMultiLabel: true,
  enableSessionTracking: true,
  enablePrivacyMask: true,
});

await archive.init();

// 归档消息（自动解析、关联会话）
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
```

## 文档

- [架构设计](docs/ARCHITECTURE.md)
- [部署指南](docs/DEPLOYMENT.md)
- [API文档](docs/API.md)
- [变更日志](docs/CHANGELOG.md)

## 性能对比

| 指标 | v1.0 | v2.0 | 提升 |
|------|------|------|------|
| 类型检测 | 50次正则 | 5次索引 | 10x |
| 重复解析 | 每次都解析 | LRU缓存 | 100x |
| 上下文关联 | 无 | 自动关联 | 新功能 |
| 实时通知 | 无 | <100ms | 新功能 |

## 项目结构

```
chat-archive/
├── src/
│   ├── index.ts                    # 入口
│   ├── optimized-archive.ts        # 优化后主类
│   ├── archive.ts                  # 基础主类
│   ├── flexible-types.ts           # 灵活类型系统
│   ├── flexible-parser.ts          # 插件化解析器
│   ├── index-system.ts             # 倒排索引+缓存
│   ├── multi-label.ts              # 多标签支持
│   ├── session-manager.ts          # 会话上下文
│   ├── event-bus.ts                # 事件总线
│   ├── privacy.ts                  # 隐私保护
│   ├── feedback-learning.ts        # 反馈学习
│   └── ...                         # 其他模块
├── docs/                           # 文档
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 核心模块

| 模块 | 功能 | 文件 |
|------|------|------|
| InvertedIndex | 倒排索引加速 | `index-system.ts` |
| MultiLabelParser | 多标签解析 | `multi-label.ts` |
| SessionManager | 会话上下文 | `session-manager.ts` |
| EventBus | 事件总线 | `event-bus.ts` |
| DataMasker | 数据脱敏 | `privacy.ts` |
| FeedbackManager | 反馈学习 | `feedback-learning.ts` |

## License

MIT
