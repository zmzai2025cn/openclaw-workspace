# WiseClaw Core v2.1 文件规范

## 文件清单

| 文件 | 用途 | 更新方式 | 格式 |
|-----|------|---------|------|
| WORKING.md | 当前会话状态 | 系统自动 | Markdown |
| MEMORY.md | 长期记忆 | 用户确认后 | Markdown |
| CONFIG.md | 用户配置 | 手动编辑 | YAML |

---

## WORKING.md

### 用途
存储当前会话的临时状态，自动管理，会话结束可清理。

### 格式

```markdown
# WORKING
> 工作记忆 - 当前会话状态 (自动管理，可安全删除)

## Session
- id: sess_20260219_052400
- started: 2026-02-19 05:24:00
- lastUpdate: 2026-02-19 05:30:00
- messageCount: 3
- tokenUsage: 1250

## Current Goal
- primary: "完成WiseClaw Core v2.1设计"
- status: active

## Context
- topic: "Agent架构设计"
- recentFacts:
  - "用户选择现实路线"
  - "验收标准已调整"

## Chain State [可选]
- chainId: chain_abc123
- currentStep: 2
- totalSteps: 5
- status: waiting_confirmation
- lastCheckpoint: "完成架构总览"
```

### 字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| session.id | string | 会话唯一标识 |
| session.started | datetime | 会话开始时间 |
| session.lastUpdate | datetime | 最后更新时间 |
| session.messageCount | number | 消息计数 |
| session.tokenUsage | number | Token使用量 |
| currentGoal.primary | string | 当前主要目标 |
| currentGoal.status | string | 目标状态 |
| context.topic | string | 当前话题 |
| context.recentFacts | array | 最近提取的事实 |
| chainState | object | 长链路状态（如果有） |

---

## MEMORY.md

### 用途
存储用户确认的长期记忆，手动管理，跨会话持久。

### 格式

```markdown
# MEMORY
> 长期记忆 - 用户确认的重要信息

## Facts
- [2026-02-19] 项目名称: WiseClaw Core
- [2026-02-19] 技术栈: TypeScript, Node.js
- [2026-02-19] 设计原则: 极简、用户控制
- [2026-02-18] 用户偏好: 简洁回复

## Preferences
- [2026-02-19] 沟通风格: 简洁、直接
- [2026-02-19] 技术深度: 详细当被问及时
- [2026-02-19] 回复时间: 异步可接受
- [2026-02-18] Checkpoint: 默认关闭

## Todos
- [ ] 完成架构文档
- [ ] 实现核心模块
- [x] 确定验收标准

## Patterns [可选]
- [2026-02-19] 用户倾向于深夜进行深度技术讨论
  - confidence: medium
  - evidence: 3次观察
```

### 字段说明

| 字段 | 类型 | 说明 |
|-----|------|------|
| Facts | array | 确认的事实 |
| Preferences | array | 用户偏好 |
| Todos | array | 待办事项 |
| Patterns | array | 观察到的模式（带置信度） |

### 条目格式

```
- [YYYY-MM-DD] 内容描述
- [YYYY-MM-DD] 内容描述 [标签]
```

---

## CONFIG.md

### 用途
用户配置和路由规则，手动编辑，启动时加载。

### 格式

```yaml
# WiseClaw Core Configuration
# 用户可编辑的配置文件

## Preferences
preferences:
  communicationStyle: concise  # concise | detailed | adaptive
  technicalDepth: detailed_when_asked  # brief | standard | detailed
  responseTime: async_ok  # immediate | async_ok
  
## Routing
routing:
  # 显式深度指令 (最高优先级)
  forceDeep:
    - "详细"
    - "深入"
    - "完整"
    - "全面"
    - "彻底"
    - "详细说"
    - "深入讲"
    - "展开说"
    
  forceLight:
    - "简单"
    - "简要"
    - "快速"
    - "一句话"
    - "简单说"
    - "tl;dr"
    - "太长不看"
    
  # 社交礼节
  social:
    - "好的"
    - "ok"
    - "okay"
    - "👍"
    - "👌"
    - "收到"
    - "明白"
    - "了解"
    - "谢谢"
    - "感谢"
    
  # 深度关键词
  deepKeywords:
    - "设计"
    - "架构"
    - "重构"
    - "优化"
    - "分析"
    - "规划"
    - "策略"
    - "方案"
    - "实现"
    - "开发"
    - "排查"
    - "debug"
    - "故障"
    - "问题"
    - "原因"
    
  # 轻量关键词
  lightKeywords:
    - "你好"
    - "在吗"
    - "忙吗"
    - "再见"
    - "拜拜"

## Memory
memory:
  detectionEnabled: true
  promptThreshold: 2  # 检测到N个候选时提示
  autoSave: false  # 是否自动保存（不提示）
  
## Chain
checkpoint:
  enabled: false  # 默认关闭
  interval: 3  # 每N步一个checkpoint
  maxSteps: 10  # 超过N步强制checkpoint
  
## System
system:
  logLevel: info  # debug | info | warn | error
  maxHistory: 10  # 保留最近N条消息
  cleanupOnExit: true  # 退出时清理WORKING.md
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| preferences.communicationStyle | string | concise | 沟通风格 |
| preferences.technicalDepth | string | detailed_when_asked | 技术深度 |
| preferences.responseTime | string | async_ok | 响应时间期望 |
| routing.forceDeep | array | [...] | 强制深度指令 |
| routing.forceLight | array | [...] | 强制轻量指令 |
| routing.social | array | [...] | 社交礼节关键词 |
| routing.deepKeywords | array | [...] | 深度关键词 |
| routing.lightKeywords | array | [...] | 轻量关键词 |
| memory.detectionEnabled | boolean | true | 启用记忆检测 |
| memory.promptThreshold | number | 2 | 提示阈值 |
| memory.autoSave | boolean | false | 自动保存 |
| checkpoint.enabled | boolean | false | 启用checkpoint |
| checkpoint.interval | number | 3 | checkpoint间隔 |
| checkpoint.maxSteps | number | 10 | 最大步数 |
| system.logLevel | string | info | 日志级别 |
| system.maxHistory | number | 10 | 最大历史消息数 |
| system.cleanupOnExit | boolean | true | 退出清理 |

---

## 文件交互流程

```
会话开始
    │
    ▼
读取 CONFIG.md ──→ 加载用户配置
    │
    ▼
创建/读取 WORKING.md ──→ 恢复或创建会话状态
    │
    ▼
读取 MEMORY.md ──→ 加载长期记忆
    │
    ▼
交互循环:
    - 更新 WORKING.md (自动)
    - 提示更新 MEMORY.md (用户确认)
    │
    ▼
会话结束
    - 保存 WORKING.md
    - 可选: 清理 WORKING.md
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|-----|------|------|
| 2.1 | 2026-02-19 | 初始版本 |
