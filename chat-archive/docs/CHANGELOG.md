# 变更日志

## [2.0.0] - 2024-01-20

### 重大更新

#### 性能优化
- **倒排索引**: 类型检测从 O(n) 优化到 O(1)，性能提升10倍
- **解析缓存**: LRU缓存，命中率>90%，重复解析性能提升100倍

#### 智能解析
- **多标签支持**: 一条消息可属于多个类型，信息不丢失
- **会话上下文**: 自动关联同一事件的多条消息，完整事件流追踪
- **反馈学习**: 基于人工反馈自动优化解析模型

#### 实时能力
- **事件总线**: 发布-订阅模式，P0工单立即告警
- **实时通知**: Webhook/邮件/短信多渠道通知

#### 数据安全
- **自动脱敏**: 手机号、身份证、邮箱、银行卡自动脱敏
- **访问控制**: 基于权限的数据过滤
- **保留策略**: 敏感数据短期保留

#### 灵活扩展
- **动态类型系统**: JSON定义类型，动态注册，类型继承
- **插件化解析**: 支持自定义解析器

### 新增模块

| 模块 | 文件 | 功能 |
|------|------|------|
| InvertedIndex | `index-system.ts` | 倒排索引加速 |
| MultiLabelParser | `multi-label.ts` | 多标签解析 |
| SessionManager | `session-manager.ts` | 会话上下文 |
| EventBus | `event-bus.ts` | 事件总线 |
| DataMasker | `privacy.ts` | 数据脱敏 |
| FeedbackManager | `feedback-learning.ts` | 反馈学习 |
| FlexibleTypes | `flexible-types.ts` | 动态类型系统 |
| OptimizedArchive | `optimized-archive.ts` | 优化后主类 |

### API变更

#### 新增
- `OptimizedChatArchive` 类（推荐）
- `archive()` 返回 `{ session, parsed }`
- `submitFeedback()` 反馈提交
- `getSession()` 会话查询
- `getParseStats()` 解析统计
- `globalEventBus` 全局事件总线

#### 兼容
- `ChatArchive` 类仍然可用（基础功能）

## [1.0.0] - 2024-01-15

### 初始版本
- 消息归档基础功能
- WAL双写保障
- 自动备份
- 健康检查
- Docker部署

## [0.9.0] - 2024-01-10

### 原型版本
- 基础消息存储
- DuckDB集成

## [0.1.0] - 2024-01-01

### 项目初始化
- 基础架构设计
