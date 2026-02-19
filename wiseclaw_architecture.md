# WiseClaw Architecture
## 智慧Agent操作系统架构设计

**版本**: 1.0  
**设计原则**: 认知经济性 × 架构简洁性 × 可演进性  
**核心隐喻**: Agent as Cognitive System

---

## 目录

1. [架构总览](#一架构总览)
2. [认知内核层](#二认知内核层)
3. [注意力系统](#三注意力系统)
4. [记忆架构](#四记忆架构)
5. [执行引擎](#五执行引擎)
6. [元认知层](#六元认知层)
7. [文件规范](#七文件规范)
8. [协议设计](#八协议设计)
9. [演进路径](#九演进路径)

---

## 一、架构总览

### 1.1 设计哲学

```
┌─────────────────────────────────────────────────────────────────┐
│                        设计哲学                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. 认知优先: 架构服务于认知，不是认知服务于架构                    │
│  2. 分层抽象: 每层只暴露必要的复杂度                              │
│  3. 文件即状态: 所有状态持久化为人类可读的文本                      │
│  4. 渐进增强: 基础功能简单，高级功能可插拔                         │
│  5. 失败优雅: 任何组件失效，系统降级运行                           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户交互层 (Surface)                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│  │ Feishu  │ │Telegram │ │ Discord │ │   CLI   │ │ WebChat │                │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘                │
└───────┼───────────┼───────────┼───────────┼───────────┼─────────────────────┘
        │           │           │           │           │
        └───────────┴───────────┴─────┬─────┴───────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           OpenClaw Gateway (Unchanged)                       │
│                    WebSocket Control Plane + Session Management              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         WiseClaw Cognitive Kernel                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      注意力调度器 (Attention Scheduler)               │    │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │    │
│  │   │ 输入过滤  │→ │ 熵值评估  │→ │ 层级路由  │→ │ 资源分配  │           │    │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────┐     │
│  │                      认知处理引擎 (Cognitive Engine)                  │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │     │
│  │  │ 情境感知    │  │ 理解分级    │  │ 工作记忆    │  │ 推理执行   │ │     │
│  │  │ Context     │  │ Comprehend  │  │ WorkingMem  │  │ Reasoning  │ │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────┐     │
│  │                      元认知监控器 (Metacognitive Monitor)             │     │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │     │
│  │   │ 置信评估  │  │ 质量监控  │  │ 策略调整  │  │ 学习更新  │           │     │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         记忆存储层 (Memory Layer)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │ WORKING.md   │  │ EPISODIC.md  │  │ SEMANTIC.md  │  │ SCRATCH.md   │    │
│   │ (工作记忆)    │  │ (情景记忆)    │  │ (语义记忆)    │  │ (草稿纸)      │    │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │ CONTEXT.md   │  │ GOALS.md     │  │ MODEL.md     │  │ META.md      │    │
│   │ (情境状态)    │  │ (目标层级)    │  │ (用户模型)    │  │ (元认知日志)  │    │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 核心设计决策

| 决策 | 选择 | 理由 |
|-----|------|------|
| 状态存储 | 纯文本文件 | 人类可读、可审计、版本控制友好 |
| 并发模型 | 单线程 + 异步IO | 避免锁复杂度，符合Node.js生态 |
| 认知架构 | 模块化可替换 | 每个认知模块可独立演进、A/B测试 |
| 错误处理 | 降级模式 | 任何组件失败，系统继续运行 |
| 配置方式 | 约定优于配置 | 减少决策疲劳，快速启动 |

---

## 二、认知内核层

### 2.1 注意力调度器 (Attention Scheduler)

#### 2.1.1 核心概念

注意力是**稀缺资源**，必须基于**信息价值**进行分配。

```typescript
interface AttentionAllocation {
  // 注意力层级
  level: AttentionLevel;
  
  // 分配理由
  rationale: string;
  
  // 预期认知消耗 (估算token数)
  estimatedCost: number;
  
  // 预期价值 (0-1)
  expectedValue: number;
  
  // 截止时间 (如果有)
  deadline?: Date;
}

type AttentionLevel = 
  | 'ignore'      // 完全忽略
  | 'acknowledge' // 仅确认
  | 'cache'       // 缓存待处理
  | 'process'     // 标准处理
  | 'deep'        // 深度思考
  | 'meta';       // 元认知
```

#### 2.1.2 熵值评估算法

```typescript
function calculateEntropy(input: InputContext): EntropyScore {
  const factors = {
    // 信息新颖性: 与历史模式的偏离程度
    novelty: computeNovelty(input, userHistory),
    
    // 语义密度: 单位token的信息量
    semanticDensity: computeSemanticDensity(input.text),
    
    // 时间紧迫性: 基于关键词和时间上下文
    urgency: computeUrgency(input),
    
    // 用户参与度: 历史交互深度
    engagement: getUserEngagementLevel(userId),
    
    // 领域复杂度: 技术术语密度
    complexity: computeDomainComplexity(input.text),
    
    // 情绪权重: 情绪强度指标
    emotionalWeight: detectEmotionalIntensity(input)
  };
  
  // 加权熵值 (可学习的权重)
  const weights = loadFrom('CONTEXT.md').attentionWeights;
  
  return weightedSum(factors, weights);
}
```

#### 2.1.3 路由决策表

| 熵值范围 | 注意力层级 | 处理策略 | 典型场景 |
|---------|-----------|---------|---------|
| 0.0-0.1 | ignore | NO_REPLY | "好的", "👍", "收到" |
| 0.1-0.2 | acknowledge | emoji/极简确认 | "明白了", "稍后看" |
| 0.2-0.4 | cache | 存储INBOX，延迟回复 | "这是参考资料", "下周会议材料" |
| 0.4-0.6 | process | 标准LLM调用 | "查天气", "翻译这段话" |
| 0.6-0.8 | deep | 多步推理+工具调用 | "设计架构", "debug问题" |
| 0.8-1.0 | meta | 自我分析+策略更新 | "你为什么这样回复？" |

#### 2.1.4 动态调整机制

```typescript
// 基于反馈调整权重
function updateAttentionWeights(outcome: InteractionOutcome) {
  const current = load('CONTEXT.md').attentionWeights;
  
  // 如果用户纠正了注意力分配，调整权重
  if (outcome.userCorrection) {
    const delta = computeWeightDelta(outcome);
    const newWeights = applyDelta(current, delta, learningRate);
    
    // 限制权重范围，防止极端
    save('CONTEXT.md', clampWeights(newWeights, 0.1, 2.0));
  }
}
```

### 2.2 情境感知引擎 (Context Engine)

#### 2.2.1 情境维度

```typescript
interface ContextState {
  // 时间情境
  temporal: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 'weekday' | 'weekend';
    userTimezone: string;
    lastInteractionTime: Date;
    sessionDuration: number; // 当前会话持续时间
  };
  
  // 社交情境
  social: {
    relationshipDepth: number; // 0-1, 基于历史交互
    formalityLevel: 'casual' | 'neutral' | 'formal';
    channelType: 'dm' | 'group' | 'public';
    userMood: 'positive' | 'neutral' | 'negative' | 'unknown';
  };
  
  // 任务情境
  task: {
    currentGoal: Goal | null;
    taskType: 'explore' | 'execute' | 'debug' | 'create' | 'review';
    progress: number; // 0-1
    blockers: string[];
  };
  
  // 认知情境
  cognitive: {
    conversationDepth: number; // 当前对话轮数
    topicContinuity: number; // 话题一致性
    userKnowledgeLevel: 'novice' | 'intermediate' | 'expert';
    agentConfidence: number; // 当前置信度
  };
}
```

#### 2.2.2 情境推断

```typescript
function inferContext(input: Input, history: History): ContextState {
  // 多信号融合
  const signals = {
    // 从消息长度和速度推断紧急程度
    urgency: analyzeResponsePattern(input, history),
    
    // 从用词推断正式程度
    formality: analyzeFormality(input.text),
    
    // 从表情符号和标点推断情绪
    emotion: analyzeEmotion(input.text),
    
    // 从关键词推断任务类型
    taskType: classifyTask(input.text),
    
    // 从历史推断用户知识水平
    knowledge: estimateKnowledgeLevel(userId, topic)
  };
  
  return integrateSignals(signals);
}
```

#### 2.2.3 情境适应策略

```typescript
const contextAdaptations: Record<ContextKey, Adaptation> = {
  'night + urgent': {
    tone: 'concise',
    depth: 'essential_only',
    offerFollowUp: 'tomorrow'
  },
  
  'expert_user + technical_topic': {
    skipBasics: true,
    useJargon: true,
    provideAlternatives: true
  },
  
  'novice_user + complex_topic': {
    stepByStep: true,
    checkUnderstanding: true,
    provideResources: true
  },
  
  'frustrated_user': {
    acknowledgeEmotion: true,
    focusOnSolution: true,
    keepBrief: true
  }
};
```

---

## 三、注意力系统

### 3.1 理解分级引擎 (Comprehension Engine)

#### 3.1.1 理解层次模型

基于修订版Bloom分类法 + 认知负荷理论：

```typescript
enum ComprehensionLevel {
  L1_RECOGNIZE = 1,    // 识别: "这是什么？"
  L2_UNDERSTAND = 2,   // 理解: "这说了什么？"
  L3_APPLY = 3,        // 应用: "怎么用？"
  L4_ANALYZE = 4,      // 分析: "为什么这样？"
  L5_EVALUATE = 5,     // 评估: "这样好吗？"
  L6_CREATE = 6        // 创造: "还能怎样？"
}

interface ComprehensionReport {
  level: ComprehensionLevel;
  confidence: number; // 0-1
  
  // 理解的具体方面
  aspects: {
    intent: { understood: boolean; confidence: number };
    constraints: { understood: boolean; missing: string[] };
    context: { understood: boolean; gaps: string[] };
    implications: { understood: boolean; confidence: number };
  };
  
  // 知识缺口
  knowledgeGaps: string[];
  
  // 建议行动
  recommendation: 'proceed' | 'clarify' | 'decompose';
}
```

#### 3.1.2 动态深度选择

```typescript
function selectComprehensionDepth(
  task: Task,
  context: ContextState
): ComprehensionLevel {
  // 基于任务类型选择基础深度
  const baseDepth = taskTypeToDepth[task.type];
  
  // 基于用户知识水平调整
  const knowledgeAdjustment = {
    'novice': -1,      // 降低深度，更多解释
    'intermediate': 0, // 保持
    'expert': +1       // 增加深度，跳过基础
  }[context.cognitive.userKnowledgeLevel];
  
  // 基于时间压力调整
  const timeAdjustment = context.temporal.urgent ? -1 : 0;
  
  // 综合计算
  const targetDepth = clamp(
    baseDepth + knowledgeAdjustment + timeAdjustment,
    1, 6
  );
  
  return targetDepth;
}
```

#### 3.1.3 理解置信度评估

```typescript
function assessComprehensionConfidence(
  input: string,
  parsed: ParsedIntent
): number {
  const factors = {
    // 解析确定性
    parsingConfidence: parsed.confidence,
    
    // 实体识别完整度
    entityCompleteness: checkEntityResolution(parsed.entities),
    
    // 指代消解成功率
    referenceResolution: resolveReferences(input, context),
    
    // 歧义检测
    ambiguityScore: detectAmbiguity(input),
    
    // 领域匹配度
    domainMatch: matchDomainKnowledge(input, knowledgeBase)
  };
  
  // 综合置信度
  return combineConfidenceFactors(factors);
}

// 低置信度处理
if (confidence < 0.6) {
  return {
    response: generateClarificationRequest(parsed.uncertainties),
    action: 'await_clarification'
  };
}
```

### 3.2 工作记忆管理 (Working Memory)

#### 3.2.1 组块化模型

```typescript
interface WorkingMemory {
  // 容量限制: 4±1 个组块 (基于Cowan, 2001)
  capacity: number = 4;
  
  // 当前活跃组块
  chunks: Chunk[];
  
  // 组块类型
  chunkTypes: {
    GOAL: '当前任务目标';
    CONSTRAINT: '关键约束条件';
    STATE: '当前系统状态';
    HISTORY: '已尝试的方案';
    PENDING: '待处理事项';
    CONTEXT: '情境信息';
  };
}

interface Chunk {
  id: string;
  type: ChunkType;
  content: string;
  priority: number; // 0-1
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}
```

#### 3.2.2 组块管理策略

```typescript
class WorkingMemoryManager {
  // 添加组块，必要时外部化
  addChunk(chunk: Chunk): void {
    if (this.chunks.length >= this.capacity) {
      // 选择最不重要的组块外部化
      const evicted = this.selectForExternalization();
      this.externalize(evicted);
    }
    
    this.chunks.push(chunk);
    this.saveTo('WORKING.md');
  }
  
  // 基于优先级和访问模式选择外部化目标
  private selectForExternalization(): Chunk {
    return this.chunks
      .map(c => ({
        chunk: c,
        score: this.computeRetentionScore(c)
      }))
      .sort((a, b) => a.score - b.score)[0].chunk;
  }
  
  private computeRetentionScore(chunk: Chunk): number {
    const recency = Date.now() - chunk.lastAccessed.getTime();
    const frequency = chunk.accessCount;
    const priority = chunk.priority;
    
    // 综合评分: 高优先级、高频访问、最近使用的保留
    return priority * 0.4 + 
           Math.log(frequency + 1) * 0.3 + 
           Math.exp(-recency / 3600000) * 0.3;
  }
}
```

#### 3.2.3 外部化格式

```markdown
<!-- WORKING.md -->
# 工作记忆 (Working Memory)

## 活跃组块 (Active: 4/4)

### [G1] 当前目标
- 内容: 设计WiseClaw注意力系统
- 优先级: 0.95
- 创建: 2026-02-19 05:00

### [C1] 关键约束
- 内容: 必须保持架构简洁
- 优先级: 0.90
- 创建: 2026-02-19 05:05

### [S1] 系统状态
- 内容: 已完成架构总览，正在详细设计
- 优先级: 0.70
- 创建: 2026-02-19 05:15

### [H1] 历史尝试
- 内容: 已排除复杂认知图谱方案
- 优先级: 0.60
- 创建: 2026-02-19 05:10

## 外部化组块 (Externalized)

### [P1] 待处理 → 移至 EPISODIC.md
- 内容: 调研其他Agent架构
- 原因: 容量限制，优先级较低
- 外部化时间: 2026-02-19 05:20
```

---

## 四、记忆架构

### 4.1 三层记忆模型

```
┌─────────────────────────────────────────────────────────────┐
│                     记忆层次架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  工作记忆 (Working Memory)                           │    │
│  │  • 容量: 4±1 组块                                    │    │
│  │  • 持续时间: 秒级到分钟级                             │    │
│  │  • 存储: WORKING.md                                  │    │
│  │  • 内容: 当前任务、约束、状态                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓ 巩固                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  情景记忆 (Episodic Memory)                          │    │
│  │  • 容量: 有限，定期压缩                               │    │
│  │  • 持续时间: 小时到天数                               │    │
│  │  • 存储: EPISODIC.md                                 │    │
│  │  • 内容: 具体交互事件、对话历史                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓ 抽象                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  语义记忆 (Semantic Memory)                          │    │
│  │  • 容量: 相对无限                                     │    │
│  │  • 持续时间: 长期                                     │    │
│  │  • 存储: SEMANTIC.md                                 │    │
│  │  • 内容: 抽象知识、用户偏好、领域规则                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 记忆巩固机制

```typescript
interface MemoryConsolidation {
  // 从工作记忆到情景记忆
  workingToEpisodic(): void {
    const significantChunks = this.workingMemory.chunks
      .filter(c => c.priority > 0.7 || c.accessCount > 3);
    
    for (const chunk of significantChunks) {
      const episode = this.createEpisode(chunk);
      this.episodicMemory.store(episode);
    }
  }
  
  // 从情景记忆到语义记忆
  episodicToSemantic(): void {
    const patterns = this.episodicMemory.extractPatterns();
    
    for (const pattern of patterns) {
      if (pattern.frequency >= 3 && pattern.confidence > 0.8) {
        const semanticKnowledge = this.abstractPattern(pattern);
        this.semanticMemory.store(semanticKnowledge);
      }
    }
  }
}
```

### 4.3 记忆检索策略

```typescript
interface MemoryRetrieval {
  // 多线索检索
  retrieve(query: Query): RetrievedMemory[] {
    const strategies = [
      // 1. 精确匹配
      () => this.exactMatch(query),
      
      // 2. 语义相似度
      () => this.semanticSearch(query),
      
      // 3. 情境匹配
      () => this.contextualMatch(query, currentContext),
      
      // 4. 时序关联
      () => this.temporalAssociation(query, recentEvents)
    ];
    
    // 合并结果，去重，排序
    return this.mergeAndRank(strategies);
  }
  
  // 记忆激活扩散
  spreadActivation(seed: Memory): ActivatedMemory[] {
    const activated = new Set<Memory>();
    const queue = [{ memory: seed, strength: 1.0 }];
    
    while (queue.length > 0) {
      const { memory, strength } = queue.shift();
      
      if (strength < 0.3) continue; // 激活阈值
      
      activated.add(memory);
      
      // 扩散到关联记忆
      for (const assoc of memory.associations) {
        queue.push({
          memory: assoc.target,
          strength: strength * assoc.weight
        });
      }
    }
    
    return Array.from(activated);
  }
}
```

---

## 五、执行引擎

### 5.1 推理执行循环

```typescript
interface ReasoningEngine {
  // 主执行循环
  async execute(task: Task): Promise<Result> {
    // 1. 初始化工作记忆
    this.initializeWorkingMemory(task);
    
    // 2. 主循环
    while (!this.isComplete()) {
      // 2.1 感知当前状态
      const perception = this.perceive();
      
      // 2.2 评估进展
      const assessment = this.assessProgress();
      
      // 2.3 选择行动
      const action = this.selectAction(perception, assessment);
      
      // 2.4 执行行动
      const outcome = await this.executeAction(action);
      
      // 2.5 更新状态
      this.updateWorkingMemory(action, outcome);
      
      // 2.6 元认知检查
      if (this.shouldReflect()) {
        await this.reflect();
      }
    }
    
    // 3. 收尾
    return this.finalize();
  }
}
```

### 5.2 工具使用策略

```typescript
interface ToolStrategy {
  // 工具选择
  selectTool(intent: Intent): ToolSelection {
    const candidates = this.matchTools(intent);
    
    // 评估每个候选
    const scored = candidates.map(tool => ({
      tool,
      score: this.evaluateToolFit(tool, intent),
      cost: this.estimateToolCost(tool),
      risk: this.assessToolRisk(tool)
    }));
    
    // 综合考虑效果、成本、风险
    return this.optimizeSelection(scored);
  }
  
  // 工具链组合
  composeToolChain(subtasks: Subtask[]): ToolChain {
    // 分析依赖关系
    const dependencies = this.analyzeDependencies(subtasks);
    
    // 构建执行图
    const executionGraph = this.buildExecutionGraph(subtasks, dependencies);
    
    // 优化并行度
    return this.optimizeParallelism(executionGraph);
  }
}
```

### 5.3 错误恢复机制

```typescript
interface ErrorRecovery {
  // 分层错误处理
  handleError(error: Error, context: Context): RecoveryAction {
    // 1. 分类错误
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'TRANSIENT':
        // 临时错误: 重试
        return { action: 'retry', delay: exponentialBackoff() };
        
      case 'PERMISSION':
        // 权限错误: 请求用户授权
        return { action: 'request_permission', details: error.context };
        
      case 'UNDERSTANDING':
        // 理解错误: 请求澄清
        return { action: 'clarify', uncertainties: error.uncertainties };
        
      case 'CAPABILITY':
        // 能力限制: 诚实告知
        return { action: 'admit_limitation', alternatives: error.alternatives };
        
      case 'CRITICAL':
        // 严重错误: 安全降级
        return { action: 'safe_degrade', preserveState: true };
    }
  }
}
```

---

## 六、元认知层

### 6.1 置信度评估系统

```typescript
interface ConfidenceSystem {
  // 多维度置信度
  assessConfidence(output: Output): ConfidenceReport {
    return {
      overall: this.computeOverallConfidence(output),
      
      dimensions: {
        // 理解置信度
        comprehension: this.assessComprehensionConfidence(),
        
        // 推理置信度
        reasoning: this.assessReasoningConfidence(),
        
        // 知识置信度
        knowledge: this.assessKnowledgeConfidence(),
        
        // 执行置信度
        execution: this.assessExecutionConfidence()
      },
      
      // 不确定性来源
      uncertainties: this.identifyUncertainties(),
      
      // 验证建议
      verification: this.suggestVerificationMethods()
    };
  }
  
  // 置信度表达
  expressConfidence(report: ConfidenceReport): string {
    if (report.overall > 0.9) {
      return ''; // 高置信度，无需标注
    } else if (report.overall > 0.7) {
      return '（对此有相当把握）';
    } else if (report.overall > 0.5) {
      return '（这是基于现有信息的最佳判断，建议验证）';
    } else {
      return '（对此不太确定，需要更多信息）';
    }
  }
}
```

### 6.2 质量监控

```typescript
interface QualityMonitor {
  // 输出质量检查
  checkQuality(output: Output): QualityReport {
    const checks = {
      // 完整性检查
      completeness: this.checkCompleteness(output),
      
      // 相关性检查
      relevance: this.checkRelevance(output, userIntent),
      
      // 准确性检查
      accuracy: this.checkFactualAccuracy(output),
      
      // 清晰性检查
      clarity: this.checkClarity(output),
      
      // 适当性检查
      appropriateness: this.checkContextualAppropriateness(output)
    };
    
    return {
      passed: Object.values(checks).every(c => c.passed),
      checks,
      suggestions: this.generateImprovements(checks)
    };
  }
  
  // 用户反馈整合
  incorporateFeedback(feedback: UserFeedback): void {
    // 更新质量模型
    this.updateQualityModel(feedback);
    
    // 调整策略
    this.adjustStrategies(feedback);
    
    // 记录到学习日志
    this.logLearningEvent(feedback);
  }
}
```

### 6.3 策略调整

```typescript
interface StrategyAdaptation {
  // 基于性能数据调整策略
  adaptStrategies(performance: PerformanceData): void {
    // 分析成功和失败模式
    const patterns = this.analyzePerformance(performance);
    
    // 调整注意力权重
    if (patterns.attentionMispredictions > threshold) {
      this.adjustAttentionWeights(patterns.corrections);
    }
    
    // 调整理解深度策略
    if (patterns.depthMismatches > threshold) {
      this.adjustDepthStrategy(patterns.optimalDepths);
    }
    
    // 调整工具使用策略
    if (patterns.toolInefficiencies > threshold) {
      this.adjustToolStrategy(patterns.betterChoices);
    }
  }
  
  // A/B测试支持
  enableABTest(experiment: Experiment): void {
    // 随机分配策略变体
    const variant = this.assignVariant(experiment);
    
    // 记录分配
    this.logVariantAssignment(variant);
    
    // 收集对比数据
    this.collectComparisonData(experiment, variant);
  }
}
```

---

## 七、文件规范

### 7.1 文件清单

| 文件 | 用途 | 更新频率 | 人类可读 |
|-----|------|---------|---------|
| WORKING.md | 工作记忆 | 每轮对话 | 是 |
| EPISODIC.md | 情景记忆 | 每日 | 是 |
| SEMANTIC.md | 语义记忆 | 每周 | 是 |
| SCRATCH.md | 草稿纸 | 每轮对话 | 是 |
| CONTEXT.md | 情境状态 | 每轮对话 | 是 |
| GOALS.md | 目标层级 | 每周 | 是 |
| MODEL.md | 用户模型 | 每月 | 是 |
| META.md | 元认知日志 | 每周 | 是 |

### 7.2 WORKING.md 规范

```markdown
# WORKING
> 工作记忆 - 当前会话的活跃状态

## Session
- id: sess_20260219_050000
- started: 2026-02-19 05:00:00
- lastUpdate: 2026-02-19 05:30:00

## Chunks (4/4)

### [G1] Goal: 设计WiseClaw架构
- priority: 0.95
- created: 05:00
- accessed: 05:30 (5次)

### [C1] Constraint: 保持简洁
- priority: 0.90
- created: 05:05
- accessed: 05:25 (3次)

### [S1] State: 详细设计阶段
- priority: 0.70
- created: 05:15
- accessed: 05:30 (2次)

### [H1] History: 已排除复杂方案
- priority: 0.60
- created: 05:10
- accessed: 05:20 (1次)

## Externalized
- [P1] 待调研内容 → EPISODIC.md
```

### 7.3 EPISODIC.md 规范

```markdown
# EPISODIC
> 情景记忆 - 重要交互事件

## 2026-02-19

### 05:00 - 架构设计会话
- type: deep_conversation
- topic: WiseClaw架构设计
- duration: 30min
- outcome: 完成详细设计
- keyPoints:
  - 确定三层记忆模型
  - 设计注意力调度器
  - 定义文件规范
- emotionalTone: focused, collaborative
- userSatisfaction: high (inferred from engagement)

### 04:30 - 反思报告
- type: meta_conversation
- topic: 设计反思
- outcome: 简化设计方案
- keyPoints:
  - 识别高风险组件
  - 提出WiseClaw Lite
```

### 7.4 SEMANTIC.md 规范

```markdown
# SEMANTIC
> 语义记忆 - 抽象知识和模式

## User Preferences
- communicationStyle: concise, technical
- preferredDepth: detailed when asked
- responseTime: async_ok for non-urgent

## Domain Knowledge
- architecture_patterns:
  - microkernel: "preferred for extensibility"
  - layered: "good for separation of concerns"
  - event-driven: "use for loose coupling"

## Interaction Patterns
- deep_work_sessions:
  - trigger: "architecture discussion"
  - duration: "30-60min"
  - characteristics: "intense, focused, iterative"
```

### 7.5 CONTEXT.md 规范

```markdown
# CONTEXT
> 当前情境状态

## Temporal
- timeOfDay: early_morning (05:00)
- dayType: weekday
- sessionDuration: 30min
- lastBreak: null

## Social
- relationshipDepth: 0.8 (established)
- formality: low
- channel: dm
- mood: focused

## Task
- currentGoal: "WiseClaw架构设计"
- type: create
- progress: 0.7
- blockers: []

## Cognitive
- conversationDepth: 5 (deep)
- topicContinuity: high
- userKnowledge: expert
- agentConfidence: 0.85

## Attention Weights
- novelty: 1.2
- urgency: 0.8
- engagement: 1.0
- complexity: 1.1
```

---

## 八、协议设计

### 8.1 内部通信协议

```typescript
// 组件间消息格式
interface CognitiveMessage {
  // 消息头
  header: {
    id: string;
    timestamp: Date;
    source: ComponentId;
    target: ComponentId;
    priority: number;
  };
  
  // 消息体
  body: {
    type: MessageType;
    payload: unknown;
  };
  
  // 上下文
  context: {
    sessionId: string;
    attentionLevel: AttentionLevel;
    workingMemorySnapshot: Chunk[];
  };
}

// 消息类型
type MessageType =
  | 'PERCEPTION'      // 感知输入
  | 'ATTENTION_REQ'   // 注意力请求
  | 'MEMORY_QUERY'    // 记忆查询
  | 'REASONING_REQ'   // 推理请求
  | 'ACTION_EXEC'     // 行动执行
  | 'META_REFLECT'    // 元认知反思
  | 'ERROR_REPORT';   // 错误报告
```

### 8.2 LLM交互协议

```typescript
// 结构化提示模板
interface PromptTemplate {
  // 系统角色定义
  system: {
    role: string;
    capabilities: string[];
    constraints: string[];
  };
  
  // 上下文注入
  context: {
    workingMemory: string;
    relevantEpisodes: string[];
    semanticKnowledge: string[];
    currentGoal: string;
  };
  
  // 任务定义
  task: {
    description: string;
    input: string;
    expectedOutput: string;
    comprehensionLevel: ComprehensionLevel;
  };
  
  // 输出格式
  outputFormat: {
    type: 'json' | 'markdown' | 'text';
    schema?: JSONSchema;
    constraints: string[];
  };
}

// 示例提示结构
const examplePrompt: PromptTemplate = {
  system: {
    role: "WiseClaw认知内核",
    capabilities: ["注意力分配", "理解分级", "工作记忆管理"],
    constraints: ["保持简洁", "承认不确定性", "优先用户目标"]
  },
  context: {
    workingMemory: load('WORKING.md'),
    relevantEpisodes: retrieveRelevant('EPISODIC.md', query),
    semanticKnowledge: retrieveRelevant('SEMANTIC.md', query),
    currentGoal: extractCurrentGoal('GOALS.md')
  },
  task: {
    description: "评估用户输入并分配注意力层级",
    input: userInput,
    expectedOutput: "注意力层级 + 理由 + 预期成本",
    comprehensionLevel: 4
  },
  outputFormat: {
    type: 'json',
    schema: attentionSchema,
    constraints: ["必须包含置信度", "必须说明理由"]
  }
};
```

### 8.3 学习更新协议

```typescript
// 学习事件
interface LearningEvent {
  // 事件类型
  type: 'CORRECTION' | 'CONFIRMATION' | 'PATTERN' | 'FEEDBACK';
  
  // 事件内容
  content: {
    trigger: string;        // 触发学习的事件
    expected: string;       // 预期行为
    actual: string;         // 实际行为
    correction?: string;    // 用户纠正
  };
  
  // 影响分析
  impact: {
    component: ComponentId;
    parameter: string;
    delta: number;
    confidence: number;
  };
  
  // 更新策略
  update: {
    immediate: boolean;     // 是否立即更新
    reviewRequired: boolean; // 是否需要人工审核
    affectedFiles: string[]; // 需要更新的文件
  };
}

// 学习应用
function applyLearning(event: LearningEvent): void {
  // 1. 验证学习事件
  if (!validateLearningEvent(event)) {
    log('Invalid learning event', event);
    return;
  }
  
  // 2. 计算更新
  const update = computeUpdate(event);
  
  // 3. 应用更新
  if (event.update.immediate && !event.update.reviewRequired) {
    applyUpdate(update);
  } else {
    queueForReview(update);
  }
  
  // 4. 记录学习
  logLearningEvent(event);
}
```

---

## 九、演进路径

### 9.1 阶段规划

```
Phase 1: 基础认知 (Week 1-2)
├── 注意力路由 (5级)
├── 工作记忆管理 (4组块)
├── 基础文件规范
└── 目标: 节省50% token，响应更精准

Phase 2: 深度理解 (Week 3-4)
├── 理解分级 (L1-L6)
├── 置信度系统
├── 情境感知
└── 目标: 减少误解，主动澄清

Phase 3: 记忆增强 (Week 5-6)
├── 三层记忆模型
├── 记忆巩固机制
├── 智能检索
└── 目标: 长期一致性，个性化

Phase 4: 元认知 (Week 7-8)
├── 质量监控
├── 策略调整
├── 学习机制
└── 目标: 自我改进，A/B测试

Phase 5: 高级特性 (Month 3+)
├── 预测性编码
├── 多目标管理
├── 协作模式
└── 目标: 主动智能，深度协作
```

### 9.2 关键里程碑

| 里程碑 | 验收标准 | 时间 |
|-------|---------|------|
| M1: 注意力系统 | 80%的消息正确路由，token节省>30% | Week 2 |
| M2: 理解系统 | 误解率<10%，主动澄清率>50% | Week 4 |
| M3: 记忆系统 | 跨会话一致性>80%，检索准确率>90% | Week 6 |
| M4: 元认知 | 用户满意度>4.5/5，自我改进可观测 | Week 8 |
| M5: 生产就绪 | 稳定运行7天，无重大故障 | Month 3 |

### 9.3 风险缓解

| 风险 | 缓解策略 |
|-----|---------|
| 过度复杂 | 每个阶段严格验收，不达标不进入下一阶段 |
| 性能问题 | 持续监控token使用，设置预算上限 |
| 用户不适 | 提供"简单模式"，逐步引入新功能 |
| 数据丢失 | 所有状态文件版本控制，定期备份 |
| 学习偏差 | 人工审核学习事件，防止错误累积 |

---

## 十、总结

WiseClaw架构的核心创新：

1. **认知优先**: 架构服务于认知，不是认知服务于架构
2. **分层注意力**: 不是所有输入都值得同等处理
3. **自知之明**: 知道自己知道什么、不知道什么
4. **外部化思考**: 用文件扩展认知，不是只靠上下文
5. **渐进增强**: 基础功能简单，高级功能可插拔

**最终目标**: 不是"更聪明的Agent"，而是"更懂何时聪明、何时简单的Agent"。

---

*架构设计完成*
*版本: 1.0*
*日期: 2026-02-19*
