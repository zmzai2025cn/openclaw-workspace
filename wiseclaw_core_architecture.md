# WiseClaw Core Architecture
## 极简认知增强型Agent操作系统

**版本**: 2.0  
**设计原则**: 承认局限 × 用户控制 × 简单规则 × 渐进演进  
**核心隐喻**: Agent as Reliable Assistant, not Cognitive System

---

## 目录

1. [设计哲学](#一设计哲学)
2. [架构总览](#二架构总览)
3. [核心系统](#三核心系统)
4. [文件规范](#四文件规范)
5. [协议设计](#五协议设计)
6. [长链路工作](#六长链路工作)
7. [演进路径](#七演进路径)
8. [验收标准](#八验收标准)

---

## 一、设计哲学

### 1.1 核心认知

```
┌─────────────────────────────────────────────────────────────────┐
│                        我们承认的事实                            │
├─────────────────────────────────────────────────────────────────┤
│  1. LLM无法可靠自评估置信度                                      │
│  2. LLM无法准确进行复杂模式抽象                                  │
│  3. 自动系统比手动系统更难调试                                   │
│  4. 用户更想要可控性而非智能性                                   │
│  5. 简单规则覆盖80%场景，复杂系统覆盖85%但成本高100倍             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 设计决策

| 决策 | 选择 | 理由 |
|-----|------|------|
| 注意力分配 | 简单规则 | 可预测、可调试、用户可理解 |
| 深度选择 | 用户显式 + 简单推断 | 消除误判，用户控制 |
| 记忆管理 | 手动确认 + 自动检索 | 质量保证，用户负责内容 |
| 长链路 | Checkpoint + 显式确认 | 接受会断，设计恢复 |
| 置信度 | 三元简单分类 | LLM能力范围内 |
| 状态存储 | 3个核心文件 | 最小有效复杂度 |

### 1.3 非目标

- ❌ 自动学习用户偏好
- ❌ 自动抽象记忆模式
- ❌ 完美的长链路维持
- ❌ 复杂的认知建模
- ❌ 预测用户行为

---

## 二、架构总览

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ Feishu  │ │Telegram │ │ Discord │ │   CLI   │ │ WebChat │                │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘                │
└───────┼───────────┼───────────┼───────────┼───────────┼─────────────────────┘
        │           │           │           │           │
        └───────────┴───────────┴─────┬─────┴───────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           OpenClaw Gateway (Unchanged)                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         WiseClaw Core Kernel                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      路由层 (Router)                                  │    │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │    │
│  │   │  输入分类     │───→│  深度决策     │───→│  任务分发     │          │    │
│  │   │  Classifier  │    │  Depth       │    │  Dispatch    │          │    │
│  │   └──────────────┘    └──────────────┘    └──────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────┐     │
│  │                      执行层 (Executor)                                │     │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │     │
│  │   │  上下文组装   │───→│  LLM调用      │───→│  输出处理     │          │     │
│  │   │  Context     │    │  Generation  │    │  Post-process│          │     │
│  │   └──────────────┘    └──────────────┘    └──────────────┘          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────┐     │
│  │                      记忆层 (Memory)                                  │     │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │     │
│  │   │  工作记忆     │───→│  记忆检索     │───→│  记忆更新     │          │     │
│  │   │  Working     │    │  Retrieval   │    │  Update      │          │     │
│  │   └──────────────┘    └──────────────┘    └──────────────┘          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         状态存储 (3 Files)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│   │   WORKING.md     │  │   MEMORY.md      │  │   CONFIG.md      │         │
│   │   (工作记忆)      │  │   (长期记忆)      │  │   (用户配置)      │         │
│   │                  │  │                  │  │                  │         │
│   │ • 当前会话状态    │  │ • 确认的事实      │  │ • 偏好设置        │         │
│   │ • 临时上下文      │  │ • 待办事项        │  │ • 路由规则        │         │
│   │ • 自动清理        │  │ • 手动管理        │  │ • 深度关键词      │         │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心流程

```
用户输入
    │
    ▼
┌─────────────┐
│ 1. 输入分类  │──→ 社交礼节? ──→ 快速确认 ──→ 结束
│ Classifier  │──→ 显式深度? ──→ 使用指定深度
└─────────────┘──→ 关键词匹配? ──→ 推断深度
    │
    ▼
┌─────────────┐
│ 2. 深度决策  │──→ light:   <100 tokens, 直接回复
│   Depth     │──→ standard: 正常处理
└─────────────┘──→ deep:    多步推理 + checkpoint
    │
    ▼
┌─────────────┐
│ 3. 上下文组装 │──→ 读取WORKING.md (当前状态)
│   Context   │──→ 检索MEMORY.md (相关记忆)
└─────────────┘──→ 读取CONFIG.md (用户偏好)
    │
    ▼
┌─────────────┐
│ 4. LLM调用   │──→ 生成回复
│ Generation  │──→ 评估置信度 (high/medium/low)
└─────────────┘──→ 必要时添加置信度标注
    │
    ▼
┌─────────────┐
│ 5. 输出处理  │──→ 更新WORKING.md
│ Post-process│──→ 如果是重要事实，提示更新MEMORY.md
└─────────────┘──→ 如果是checkpoint，等待确认
    │
    ▼
  结束
```

---

## 三、核心系统

### 3.1 路由层 (Router)

#### 3.1.1 输入分类器

**设计原则：** 简单规则，可配置，可预测

```typescript
interface InputClassification {
  type: 'social' | 'command' | 'query' | 'task' | 'meta';
  confidence: 'high' | 'medium' | 'low';
  suggestedDepth: 'light' | 'standard' | 'deep';
}

function classifyInput(input: string, config: Config): InputClassification {
  const text = input.toLowerCase().trim();
  
  // 1. 社交礼节检测
  if (matchesAny(text, config.patterns.social)) {
    return {
      type: 'social',
      confidence: 'high',
      suggestedDepth: 'light'
    };
  }
  
  // 2. 显式深度指令
  if (matchesAny(text, config.patterns.brief)) {
    return {
      type: 'command',
      confidence: 'high',
      suggestedDepth: 'light'
    };
  }
  
  if (matchesAny(text, config.patterns.detailed)) {
    return {
      type: 'command',
      confidence: 'high',
      suggestedDepth: 'deep'
    };
  }
  
  // 3. 深度关键词匹配
  if (matchesAny(text, config.patterns.deepKeywords)) {
    return {
      type: 'task',
      confidence: 'medium',
      suggestedDepth: 'deep'
    };
  }
  
  // 4. 默认
  return {
    type: 'query',
    confidence: 'high',
    suggestedDepth: 'standard'
  };
}

// 简单字符串匹配
function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p.toLowerCase()));
}
```

#### 3.1.2 默认配置

```yaml
# CONFIG.md 中的路由配置
routing:
  patterns:
    # 社交礼节 - 快速确认
    social:
      - "好的"
      - "ok"
      - "👍"
      - "收到"
      - "明白"
      - "谢谢"
    
    # 显式简洁指令
    brief:
      - "简单"
      - "快速"
      - "一句话"
      - "简要"
      - "tl;dr"
    
    # 显式详细指令
    detailed:
      - "详细"
      - "深入"
      - "完整"
      - "全面"
      - "彻底"
    
    # 深度关键词 - 建议深度处理
    deepKeywords:
      - "设计"
      - "架构"
      - "重构"
      - "优化"
      - "分析"
      - "规划"
      - "策略"
      - "方案"
      - "debug"
      - "排查"
      - "故障"
```

#### 3.1.3 深度决策

```typescript
interface DepthDecision {
  level: 'light' | 'standard' | 'deep';
  reason: string;
  maxTokens: number;
  useTools: boolean;
  checkpoints: boolean;
}

function decideDepth(
  classification: InputClassification,
  context: Context
): DepthDecision {
  const level = classification.suggestedDepth;
  
  switch (level) {
    case 'light':
      return {
        level: 'light',
        reason: '社交礼节或显式简洁请求',
        maxTokens: 150,
        useTools: false,
        checkpoints: false
      };
      
    case 'standard':
      return {
        level: 'standard',
        reason: '常规查询或任务',
        maxTokens: 800,
        useTools: true,
        checkpoints: false
      };
      
    case 'deep':
      return {
        level: 'deep',
        reason: '复杂任务或显式详细请求',
        maxTokens: 2000,
        useTools: true,
        checkpoints: true  // 启用checkpoint机制
      };
  }
}
```

### 3.2 执行层 (Executor)

#### 3.2.1 上下文组装

```typescript
interface AssembledContext {
  // 系统提示
  systemPrompt: string;
  
  // 当前工作记忆
  workingMemory: WorkingState;
  
  // 相关长期记忆
  relevantMemories: Memory[];
  
  // 用户偏好
  preferences: UserPreferences;
  
  // 当前任务信息
  task: {
    depth: DepthDecision;
    history: Message[];
  };
}

function assembleContext(
  input: string,
  depth: DepthDecision,
  config: Config
): AssembledContext {
  return {
    systemPrompt: buildSystemPrompt(config),
    workingMemory: parseWorkingMd(load('WORKING.md')),
    relevantMemories: retrieveRelevantMemories(input, load('MEMORY.md')),
    preferences: parseConfigMd(load('CONFIG.md')).preferences,
    task: {
      depth,
      history: getSessionHistory()
    }
  };
}
```

#### 3.2.2 系统提示模板

```markdown
# WiseClaw Core System Prompt

## 你的角色
你是一个可靠的AI助手，帮助用户完成各种任务。

## 当前状态
- 会话ID: {{workingMemory.sessionId}}
- 当前目标: {{workingMemory.currentGoal}}
- 处理深度: {{task.depth.level}}

## 用户偏好
- 沟通风格: {{preferences.communicationStyle}}
- 技术深度: {{preferences.technicalDepth}}

## 相关背景
{{#each relevantMemories}}
- {{this.category}}: {{this.content}}
{{/each}}

## 当前任务
{{#if task.depth.checkpoints}}
注意：这是一个深度任务，请在关键步骤后暂停，等待用户确认再继续。
{{/if}}

## 输出要求
{{#if (eq task.depth.level "light")}}
- 简洁回复，不超过2句话
- 不需要解释
{{/if}}

{{#if (eq task.depth.level "deep")}}
- 结构化输出
- 关键决策点标注[CHECKPOINT]
{{/if}}

## 置信度标注
如果你不确定，请明确说明：
- "（这是基于现有信息的最佳判断）"
- "（对此不太确定，建议验证）"
```

#### 3.2.3 置信度评估

```typescript
type Confidence = 'high' | 'medium' | 'low';

interface ConfidenceAssessment {
  level: Confidence;
  reason: string;
  shouldAnnotate: boolean;
}

function assessConfidence(
  input: string,
  output: string,
  context: AssembledContext
): ConfidenceAssessment {
  // 简单启发式规则
  const indicators = {
    high: [
      '明确的事实',
      '用户确认过的信息',
      '简单的工具调用结果'
    ],
    medium: [
      '需要推断但未确认',
      '多个可能选项',
      '一般性建议'
    ],
    low: [
      '信息不完整',
      '超出知识范围',
      '需要猜测用户意图'
    ]
  };
  
  // 基于规则评估
  const level = evaluateIndicators(input, output, indicators);
  
  return {
    level,
    reason: getReason(level),
    shouldAnnotate: level !== 'high'
  };
}

function annotateOutput(output: string, confidence: Confidence): string {
  const prefix = {
    high: '',
    medium: '（基于现有信息的最佳判断）\n\n',
    low: '（对此不太确定，建议验证）\n\n'
  };
  
  return prefix[confidence] + output;
}
```

### 3.3 记忆层 (Memory)

#### 3.3.1 工作记忆管理

```typescript
interface WorkingState {
  sessionId: string;
  startedAt: Date;
  lastUpdate: Date;
  
  // 当前目标栈
  goalStack: Goal[];
  
  // 临时上下文
  context: {
    currentTopic?: string;
    pendingQuestions?: string[];
    recentFacts?: string[];
  };
  
  // 会话统计
  stats: {
    messageCount: number;
    tokenUsage: number;
  };
}

class WorkingMemoryManager {
  // 自动更新
  update(input: string, output: string): void {
    const state = this.load();
    
    state.lastUpdate = new Date();
    state.stats.messageCount++;
    
    // 提取当前话题
    state.context.currentTopic = extractTopic(input, output);
    
    // 检测目标变化
    const newGoal = detectGoalChange(input);
    if (newGoal) {
      state.goalStack.push(newGoal);
      // 限制栈深度
      if (state.goalStack.length > 3) {
        state.goalStack.shift();
      }
    }
    
    this.save(state);
  }
  
  // 会话结束自动清理
  cleanup(): void {
    // 归档重要信息到MEMORY.md（提示用户）
    const state = this.load();
    const importantFacts = extractImportantFacts(state);
    
    if (importantFacts.length > 0) {
      promptUserToArchive(importantFacts);
    }
    
    // 重置工作记忆
    this.save(createEmptyState());
  }
}
```

#### 3.3.2 长期记忆检索

```typescript
interface Memory {
  id: string;
  category: 'fact' | 'preference' | 'todo' | 'pattern';
  content: string;
  createdAt: Date;
  relevanceScore?: number;
}

function retrieveRelevantMemories(
  query: string,
  memoryMd: string,
  maxResults: number = 5
): Memory[] {
  const memories = parseMemoryMd(memoryMd);
  
  // 简单关键词匹配 + 类别优先级
  const scored = memories.map(m => ({
    memory: m,
    score: calculateRelevance(query, m)
  }));
  
  // 按分数排序，取前N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.memory);
}

function calculateRelevance(query: string, memory: Memory): number {
  let score = 0;
  
  // 关键词匹配
  const queryWords = query.toLowerCase().split(/\s+/);
  const memoryWords = memory.content.toLowerCase();
  const matches = queryWords.filter(w => memoryWords.includes(w)).length;
  score += matches * 10;
  
  // 类别优先级
  const categoryPriority = {
    'preference': 5,  // 用户偏好最重要
    'fact': 3,        // 确认的事实
    'todo': 2,        // 待办事项
    'pattern': 1      // 观察到的模式
  };
  score += categoryPriority[memory.category] || 0;
  
  // 时间衰减（越新的越相关）
  const daysOld = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  score *= Math.exp(-daysOld / 30);  // 30天半衰期
  
  return score;
}
```

#### 3.3.3 记忆更新提示

```typescript
function promptMemoryUpdate(
  input: string,
  output: string,
  context: Context
): MemoryUpdateSuggestion | null {
  // 检测可能值得记忆的内容
  const candidates = detectMemoryCandidates(input, output);
  
  if (candidates.length === 0) return null;
  
  // 生成建议
  return {
    message: `检测到可能值得记录的信息：`,
    candidates: candidates.map(c => ({
      content: c.content,
      suggestedCategory: c.category,
      reason: c.reason
    })),
    action: '用户确认后写入MEMORY.md'
  };
}

// 检测规则
const memoryDetectionRules = [
  {
    pattern: /我的名字是(\w+)/,
    category: 'fact',
    reason: '用户身份信息'
  },
  {
    pattern: /我喜欢(.+)/,
    category: 'preference',
    reason: '用户偏好'
  },
  {
    pattern: /记住(.+)/,
    category: 'fact',
    reason: '用户明确要求记忆'
  }
];
```

---

## 四、文件规范

### 4.1 文件清单

| 文件 | 用途 | 更新频率 | 管理方式 |
|-----|------|---------|---------|
| WORKING.md | 当前会话状态 | 每轮自动 | 系统自动 |
| MEMORY.md | 长期记忆 | 用户确认后 | 用户主导 |
| CONFIG.md | 用户偏好配置 | 偶尔手动 | 用户主导 |

### 4.2 WORKING.md 规范

```markdown
# WORKING
> 工作记忆 - 当前会话状态（自动管理）

## Session
- id: sess_20260219_051500
- started: 2026-02-19 05:15:00
- lastUpdate: 2026-02-19 05:30:00
- messageCount: 5

## Current Goal
- primary: "完成WiseClaw Core架构设计"
- stack:
  1. 详细设计文档
  2. 文件规范定义

## Context
- topic: "Agent架构设计"
- pendingQuestions: []
- recentFacts:
  - "用户偏好简洁设计"

## Stats
- tokenUsage: 3500
- avgResponseTime: 2.3s
```

### 4.3 MEMORY.md 规范

```markdown
# MEMORY
> 长期记忆 - 用户确认的重要信息（手动管理）

## Facts
- [2026-02-19] 项目名称: WiseClaw Core
- [2026-02-19] 技术栈: TypeScript, Node.js
- [2026-02-19] 设计原则: 极简、用户控制

## Preferences
- [2026-02-19] 沟通风格: 简洁、直接
- [2026-02-19] 技术深度: 详细当被问及时
- [2026-02-19] 回复时间: 异步可接受

## Todos
- [ ] 完成架构文档
- [ ] 实现核心模块
- [ ] 编写测试用例

## Patterns
- [2026-02-19] 用户倾向于深夜进行深度技术讨论
  - confidence: medium
  - evidence: 2次观察
```

### 4.4 CONFIG.md 规范

```markdown
# CONFIG
> 用户配置 - 偏好设置和路由规则

## Preferences
communicationStyle: concise
technicalDepth: detailed_when_asked
responseTime: async_ok

## Routing
patterns:
  social:
    - "好的"
    - "ok"
    - "👍"
    - "收到"
  
  brief:
    - "简单"
    - "快速"
    - "一句话"
  
  detailed:
    - "详细"
    - "深入"
    - "完整"
  
  deepKeywords:
    - "设计"
    - "架构"
    - "重构"
    - "优化"

## Memory
detectionEnabled: true
archivePromptThreshold: 3  # 检测到3个候选时提示

## Checkpoints
defaultCheckpoints: true
checkpointInterval: 3  # 每3步一个检查点
```

---

## 五、协议设计

### 5.1 内部组件协议

```typescript
// 组件间消息
interface CoreMessage {
  header: {
    id: string;
    timestamp: Date;
    source: 'router' | 'executor' | 'memory';
    target: 'router' | 'executor' | 'memory';
  };
  
  type: 
    | 'CLASSIFY_INPUT'      // 路由层 → 分类请求
    | 'CLASSIFICATION_RESULT' // 路由层 → 分类结果
    | 'EXECUTE_TASK'        // 路由层 → 执行任务
    | 'EXECUTION_RESULT'    // 执行层 → 执行结果
    | 'RETRIEVE_MEMORY'     // 执行层 → 记忆检索
    | 'MEMORY_RESULT'       // 记忆层 → 检索结果
    | 'UPDATE_WORKING'      // 执行层 → 更新工作记忆
    | 'PROMPT_ARCHIVE';     // 记忆层 → 提示归档
  
  payload: unknown;
}
```

### 5.2 LLM交互协议

```typescript
// 结构化请求
interface LLMRequest {
  model: string;
  
  messages: [
    {
      role: 'system';
      content: string;  // 组装后的system prompt
    },
    {
      role: 'user';
      content: string;  // 用户输入
    }
  ];
  
  parameters: {
    max_tokens: number;  // 由深度决策决定
    temperature: number; // 由任务类型决定
  };
  
  // 元信息
  metadata: {
    depth: 'light' | 'standard' | 'deep';
    useTools: boolean;
    checkpointMarkers: boolean;
  };
}

// 结构化响应处理
interface LLMResponse {
  content: string;
  
  // 检测checkpoint标记
  checkpoints: Checkpoint[];
  
  // 检测置信度信号
  confidenceSignals: {
    hasUncertainty: boolean;
    hasAssumption: boolean;
    hasQuestion: boolean;
  };
  
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

### 5.3 用户交互协议

```typescript
// Checkpoint交互
interface Checkpoint {
  id: string;
  stepNumber: number;
  description: string;
  currentOutput: string;
  
  // 用户选项
  options: [
    { label: '继续', action: 'continue' },
    { label: '修改', action: 'revise', prompt: '请说明修改建议' },
    { label: '回滚', action: 'rollback', toStep: number }
  ];
}

// 记忆更新提示
interface MemoryPrompt {
  type: 'MEMORY_SUGGESTION';
  message: string;
  candidates: MemoryCandidate[];
  
  // 用户响应
  onConfirm: (selected: MemoryCandidate[]) => void;
  onDismiss: () => void;
}
```

---

## 六、长链路工作

### 6.1 核心设计：接受会断，设计恢复

```
不是: 隐式维持长链路（会断）
而是: 显式checkpoint + 快速恢复
```

### 6.2 Checkpoint机制

```typescript
interface CheckpointSystem {
  // 当前执行状态
  currentState: {
    chainId: string;
    stepNumber: number;
    totalSteps: number;
    completedSteps: CompletedStep[];
  };
  
  // 创建checkpoint
  createCheckpoint(output: string): Checkpoint {
    return {
      id: generateId(),
      stepNumber: this.currentState.stepNumber,
      description: extractKeyDecision(output),
      currentOutput: output,
      timestamp: new Date()
    };
  }
  
  // 等待用户确认
  async waitForConfirmation(checkpoint: Checkpoint): Promise<UserDecision> {
    // 发送checkpoint给用户
    // 等待响应
    // 返回决策
  }
  
  // 回滚到指定checkpoint
  rollback(toStep: number): void {
    // 恢复到checkpoint状态
    this.currentState.stepNumber = toStep;
    this.currentState.completedSteps = 
      this.currentState.completedSteps.slice(0, toStep);
  }
}
```

### 6.3 长链路执行流程

```
开始长链路任务
    │
    ▼
Step 1: 执行
    │
    ▼
[CHECKPOINT 1] ──→ 用户确认? ──→ 否 ──→ 回滚/修改
    │                │
    │                是
    ▼                ▼
Step 2: 执行
    │
    ▼
[CHECKPOINT 2] ──→ 用户确认?
    │
    ▼
...
    │
    ▼
完成
```

### 6.4 状态持久化

```typescript
// 长链路状态保存到WORKING.md
interface ChainState {
  type: 'long_chain';
  chainId: string;
  checkpoints: Checkpoint[];
  currentStep: number;
  status: 'active' | 'waiting_confirmation' | 'completed' | 'aborted';
}

// Gateway重启后恢复
function recoverChainState(): ChainState | null {
  const working = load('WORKING.md');
  if (working.chainState?.status === 'waiting_confirmation') {
    return working.chainState;
  }
  return null;
}
```

### 6.5 错误恢复策略

```typescript
interface ErrorRecovery {
  // 错误类型
  type: 'understanding' | 'execution' | 'consistency';
  
  // 恢复选项
  strategies: {
    understanding: [
      { label: '澄清', action: 'ask_clarification' },
      { label: '假设继续', action: 'proceed_with_assumption' }
    ],
    execution: [
      { label: '重试', action: 'retry' },
      { label: '跳过', action: 'skip' },
      { label: '回滚', action: 'rollback' }
    ],
    consistency: [
      { label: '检查之前步骤', action: 'review_checkpoints' },
      { label: '重新开始', action: 'restart' }
    ]
  };
}
```

---

## 七、演进路径

### 7.1 阶段规划

```
Phase 1: Core (Week 1)
├── 简单路由（3级深度）
├── 工作记忆自动管理
├── 基础置信度评估
└── 目标: 可运行的基础系统

Phase 2: Memory (Week 2)
├── 长期记忆检索
├── 记忆更新提示
├── 用户确认流程
└── 目标: 跨会话一致性

Phase 3: Chains (Week 3)
├── Checkpoint机制
├── 长链路恢复
├── 错误处理
└── 目标: 可靠的复杂任务

Phase 4: Polish (Week 4)
├── 配置界面
├── 性能优化
├── 测试完善
└── 目标: 生产就绪
```

### 7.2 关键里程碑

| 里程碑 | 验收标准 | 时间 |
|-------|---------|------|
| M1: 基础路由 | 90%消息正确分类，token节省>30% | Week 1 |
| M2: 记忆系统 | 记忆检索准确率>80%，用户满意度>4/5 | Week 2 |
| M3: 长链路 | 5步以上任务成功率>80% | Week 3 |
| M4: 生产就绪 | 稳定运行7天，无重大故障 | Week 4 |

### 7.3 风险缓解

| 风险 | 缓解策略 |
|-----|---------|
| 路由误判 | 提供显式覆盖指令（"详细说"） |
| 记忆膨胀 | 定期提示用户清理，提供归档工具 |
| 链路中断 | 设计恢复机制，不是防止中断 |
| 用户困惑 | 透明展示当前状态，提供简单模式 |
| 性能问题 | 限制检索数量，使用缓存 |

---

## 八、验收标准

### 8.1 功能验收

| 功能 | 验收标准 | 测试方法 |
|-----|---------|---------|
| 路由分类 | 90%准确率 | 100条样本测试 |
| 深度选择 | 用户满意度>4/5 | 用户调研 |
| 记忆检索 | 80%相关记忆被召回 | 召回率测试 |
| 置信度 | 校准准确率>70% | 对比测试 |
| Checkpoint | 80%长任务成功完成 | 长任务测试 |

### 8.2 性能验收

| 指标 | 目标 | 测量方法 |
|-----|------|---------|
| 响应时间 | <3s (standard), <10s (deep) | 平均响应时间 |
| Token效率 | 比基线节省>30% | Token计数对比 |
| 错误率 | <5% | 错误日志分析 |
| 用户干预率 | <20% | 用户行为统计 |

### 8.3 可维护性验收

| 指标 | 目标 |
|-----|------|
| 代码行数 | <3000行 |
| 文件数量 | 3个核心文件 |
| 配置复杂度 | <50个可配置项 |
| 调试难度 | 单步可跟踪 |

---

## 九、总结

### 9.1 核心设计原则

1. **承认LLM局限**：不做超出能力的事
2. **用户控制关键决策**：深度、记忆内容
3. **简单规则优于复杂模型**：可预测、可调试
4. **接受会断，设计恢复**：长链路checkpoint机制
5. **最小有效复杂度**：3个文件，3000行代码

### 9.2 与第一版的区别

| 方面 | WiseClaw (v1) | WiseClaw Core (v2) |
|-----|---------------|-------------------|
| 注意力 | 6维熵值评估 | 简单规则匹配 |
| 深度 | 自动L1-L6 | 用户显式+3级 |
| 记忆 | 三层自动抽象 | 两层手动确认 |
| 长链路 | 隐式维持 | 显式checkpoint |
| 置信度 | 多维度评估 | 三元简单分类 |
| 文件 | 8个 | 3个 |
| 代码 | ~10000行 | ~3000行 |
| 调试 | 极难 | 简单 |

### 9.3 最终目标

**不是"认知上完美的Agent"，**
**而是"用户可理解、可控制、可预测的可靠助手"。**

---

*架构设计完成*
*版本: 2.0*
*日期: 2026-02-19*
