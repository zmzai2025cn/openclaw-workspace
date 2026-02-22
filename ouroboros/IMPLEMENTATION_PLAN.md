# Ouroboros Engine v2.0 实施计划
## 专业级项目管理文档

---

**文档版本**: 1.0.0  
**制定日期**: 2026-02-21  
**项目经理**: Kimi Claw  
**项目代号**: PROJECT-OURO-2026  
**保密级别**: 内部使用

---

## 1. 项目概述

### 1.1 项目目标
在 2 周内完成 Ouroboros Engine v2.0 的开发、测试与部署，为 OpenClaw 提供生产级的安全执行环境。

### 1.2 关键里程碑

```
Week 1 (Day 1-7): 核心功能开发
├── Day 1-2: 基础设施搭建 + 安全加固
├── Day 3-4: FileOps 模块开发
├── Day 5-6: Container Runner 模块开发
└── Day 7: 模块集成测试

Week 2 (Day 8-14): 集成与部署
├── Day 8-9: External Gate 模块 + 审计系统
├── Day 10-11: 端到端测试 + 安全审计
├── Day 12-13: 文档完善 + 部署准备
└── Day 14: 生产部署 + 验收
```

### 1.3 资源需求

| 资源类型 | 需求 | 状态 |
|---------|------|------|
| 开发环境 | Linux x64, 8GB RAM, Docker 24+ | ✅ 可用 |
| 测试环境 | 独立 Docker 主机 | ⚠️ 需确认 |
| 代码仓库 | /root/.openclaw/workspace/ouroboros | ✅ 已创建 |
| 人力 | 1 名架构师 (Kimi Claw) | ✅ 已分配 |

---

## 2. 详细任务分解 (WBS)

### Phase 1: 基础设施 (Day 1-2)

#### Task 1.1: 项目初始化
- **负责人**: Kimi Claw
- **工期**: 4 小时
- **交付物**:
  - [ ] package.json 配置
  - [ ] tsconfig.json 配置
  - [ ] 目录结构创建
  - [ ] 基础依赖安装
- **验收标准**: `npm install` 成功，无安全漏洞警告

#### Task 1.2: 核心类型定义
- **工期**: 2 小时
- **交付物**:
  - [ ] src/types/index.ts (所有接口定义)
  - [ ] src/config/schema.ts (Zod 校验 schema)
- **验收标准**: TypeScript 编译无错误

#### Task 1.3: 安全基础设施
- **工期**: 6 小时
- **交付物**:
  - [ ] src/core/validator.ts (路径验证)
  - [ ] src/core/risk-assessor.ts (风险评估)
  - [ ] src/utils/errors.ts (错误类定义)
- **关键代码**:
```typescript
// 路径验证器
export class PathValidator {
  private allowedPrefixes: string[];
  
  constructor(config: SecurityConfig) {
    this.allowedPrefixes = config.allowedPaths.map(p => 
      path.resolve(p)
    );
  }
  
  validatePath(inputPath: string): string {
    const resolved = path.resolve(inputPath);
    const normalized = path.normalize(resolved);
    
    // 检查路径遍历
    if (normalized.includes('..')) {
      throw new SecurityError('Path traversal detected');
    }
    
    // 检查白名单
    const allowed = this.allowedPrefixes.some(prefix => 
      normalized.startsWith(prefix)
    );
    
    if (!allowed) {
      throw new SecurityError(
        `Path ${inputPath} outside allowed workspace. ` +
        `Allowed: ${this.allowedPrefixes.join(', ')}`
      );
    }
    
    return normalized;
  }
}
```
- **验收标准**: 通过路径遍历测试用例

#### Task 1.4: 审计日志系统
- **工期**: 4 小时
- **交付物**:
  - [ ] src/core/audit-logger.ts
  - [ ] 日志轮转配置
  - [ ] 敏感信息脱敏
- **验收标准**: 日志文件正确轮转，敏感信息已脱敏

---

### Phase 2: FileOps 模块 (Day 3-4)

#### Task 2.1: Git 集成封装
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/file-ops/git-wrapper.ts
- **功能**:
  - 检测 Git 仓库
  - 自动 stage/unstage
  - 状态查询

#### Task 2.2: 回收站管理
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/file-ops/trash-manager.ts
- **功能**:
  - 安全删除（移动而非删除）
  - 元数据记录
  - 自动清理（7天）
  - 恢复功能

#### Task 2.3: 文件操作实现
- **工期**: 8 小时
- **交付物**:
  - [ ] src/modules/file-ops/index.ts
- **功能清单**:
  | 操作 | 风险等级 | 实现方式 |
  |------|---------|---------|
  | read | LOW | 直接读取 |
  | write | MEDIUM | 备份后写入 |
  | append | MEDIUM | 备份后追加 |
  | remove | HIGH | 移至回收站 |
  | move | MEDIUM | Git mv 或复制 |
  | list | LOW | readdir |
  | search | LOW | grep/ripgrep |
  | diff | LOW | git diff |
  | restore | MEDIUM | 从回收站恢复 |

- **验收标准**: 所有操作通过单元测试

---

### Phase 3: Container Runner (Day 5-6)

#### Task 3.1: Docker 客户端封装
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/container-runner/docker-client.ts
- **功能**:
  - 镜像管理
  - 容器生命周期
  - 资源限制

#### Task 3.2: 影子工作区管理
- **工期**: 6 小时
- **交付物**:
  - [ ] src/modules/container-runner/shadow-manager.ts
- **关键代码**:
```typescript
export class ShadowManager {
  private shadowsDir: string;
  
  async createShadow(sourcePath: string, requestId: string): Promise<string> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    
    // 使用 rsync 快速复制
    await execa('rsync', [
      '-a',                    // 归档模式
      '--delete',              // 删除目标多余文件
      '--link-dest', sourcePath, // 硬链接优化
      sourcePath + '/',
      shadowPath + '/',
    ]);
    
    // 记录元数据
    await fs.writeJson(`${shadowPath}.meta.json`, {
      sourcePath: path.resolve(sourcePath),
      createdAt: new Date().toISOString(),
      requestId,
    });
    
    return shadowPath;
  }
  
  async applyShadow(requestId: string): Promise<string[]> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    const meta = await fs.readJson(`${shadowPath}.meta.json`);
    
    // 使用 rsync 同步回源目录
    const { stdout } = await execa('rsync', [
      '-av',                   // 详细输出
      '--delete',              // 同步删除
      '--dry-run',             // 先试运行
      shadowPath + '/',
      meta.sourcePath + '/',
    ]);
    
    // 解析变更文件
    const changes = this.parseRsyncOutput(stdout);
    
    // 实际应用
    await execa('rsync', [
      '-a',
      '--delete',
      shadowPath + '/',
      meta.sourcePath + '/',
    ]);
    
    // 清理
    await this.destroyShadow(requestId);
    
    return changes;
  }
  
  async destroyShadow(requestId: string): Promise<void> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    await fs.remove(shadowPath);
    await fs.remove(`${shadowPath}.meta.json`);
  }
  
  private parseRsyncOutput(output: string): string[] {
    // 解析 rsync 输出提取变更文件
    return output
      .split('\n')
      .filter(line => line.startsWith('>'))
      .map(line => line.substring(2));
  }
}
```

#### Task 3.3: 容器执行器
- **工期**: 6 小时
- **交付物**:
  - [ ] src/modules/container-runner/index.ts
- **功能**:
  - 创建影子工作区
  - 启动容器执行
  - 捕获输出
  - 变更检测
  - 应用/放弃变更

---

### Phase 4: External Gate (Day 8-9)

#### Task 4.1: 队列管理
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/external-gate/queue-manager.ts
- **技术**: SQLite + better-sqlite3

#### Task 4.2: 通知系统
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/external-gate/notifier.ts
- **功能**: Webhook 通知

#### Task 4.3: 回调处理
- **工期**: 4 小时
- **交付物**:
  - [ ] src/modules/external-gate/callback-handler.ts

---

### Phase 5: 集成与测试 (Day 10-11)

#### Task 5.1: MCP Server 集成
- **工期**: 4 小时
- **交付物**:
  - [ ] src/index.ts (完整版)
  - [ ] src/core/server.ts

#### Task 5.2: 单元测试
- **工期**: 8 小时
- **交付物**:
  - [ ] tests/unit/validator.test.ts
  - [ ] tests/unit/file-ops.test.ts
  - [ ] tests/unit/shadow-manager.test.ts
- **覆盖率目标**: >80%

#### Task 5.3: 集成测试
- **工期**: 4 小时
- **交付物**:
  - [ ] tests/integration/end-to-end.test.ts
- **测试场景**:
  1. 正常文件读写
  2. 容器执行成功并应用
  3. 容器执行失败回滚
  4. 路径遍历攻击防护
  5. 并发容器执行

#### Task 5.4: 安全审计
- **工期**: 4 小时
- **检查清单**:
  - [ ] 路径遍历测试
  - [ ] 命令注入测试
  - [ ] 资源耗尽测试
  - [ ] 敏感信息泄露测试
  - [ ] 竞争条件测试

---

### Phase 6: 部署准备 (Day 12-13)

#### Task 6.1: 部署脚本
- **工期**: 4 小时
- **交付物**:
  - [ ] scripts/install.sh
  - [ ] scripts/verify.sh

#### Task 6.2: 运维工具
- **工期**: 4 小时
- **交付物**:
  - [ ] bin/recovery-cli.ts

#### Task 6.3: 文档完善
- **工期**: 4 小时
- **交付物**:
  - [ ] README.md
  - [ ] OPERATIONS.md
  - [ ] TROUBLESHOOTING.md

---

### Phase 7: 生产部署 (Day 14)

#### Task 7.1: 部署执行
- **工期**: 4 小时
- **步骤**:
  1. 备份现有配置
  2. 安装依赖
  3. 编译代码
  4. 配置 OpenClaw
  5. 重启服务
  6. 功能验证

#### Task 7.2: 验收测试
- **工期**: 2 小时
- **验收清单**:
  - [ ] file_operation:read 成功
  - [ ] file_operation:write 成功
  - [ ] container_run 成功
  - [ ] 审计日志正常写入
  - [ ] 错误处理正常

#### Task 7.3: 项目收尾
- **工期**: 2 小时
- **交付物**:
  - [ ] 项目总结报告
  - [ ] 已知问题清单
  - [ ] 后续优化建议

---

## 3. 风险管理

### 3.1 风险登记册

| ID | 风险描述 | 概率 | 影响 | 应对策略 | 负责人 |
|----|---------|------|------|---------|--------|
| R1 | Docker 未安装或版本过低 | 中 | 高 | 提前检查，提供安装脚本 | Kimi |
| R2 | 路径验证绕过 | 低 | 极高 | 代码审查 + 安全测试 | Kimi |
| R3 | 并发性能瓶颈 | 中 | 中 | 限制并发数，后续优化 | Kimi |
| R4 | 磁盘空间不足 | 中 | 高 | 监控 + 自动清理 | Kimi |
| R5 | 用户不接受确认流程 | 高 | 中 | 提供配置选项 | Kimi |

### 3.2 应急预案

**场景: 部署后 OpenClaw 无法启动**
1. 立即回滚配置: `cp openclaw.json.bak openclaw.json`
2. 重启服务: `openclaw gateway restart`
3. 检查日志: `tail -f /root/.openclaw/logs/gateway.log`
4. 修复问题后重新部署

**场景: 容器执行导致系统负载过高**
1. 立即限制并发: 修改 config 降低 maxConcurrent
2. 重启服务生效
3. 分析原因，优化资源限制

---

## 4. 沟通计划

| 会议 | 频率 | 参与者 | 目的 |
|------|------|--------|------|
| 每日站会 | 每天 9:00 | Kimi + 用户 | 同步进度，解决问题 |
| 周会 | 每周五 | Kimi + 用户 | 回顾本周，计划下周 |
| 里程碑评审 | Day 7, 14 | Kimi + 用户 | 验收交付物 |

---

## 5. 质量保证

### 5.1 代码审查清单

- [ ] 所有路径操作经过 PathValidator
- [ ] 所有异步操作有 try-catch
- [ ] 所有资源有清理逻辑 (finally)
- [ ] 敏感信息已脱敏
- [ ] 无 console.log，使用 logger
- [ ] TypeScript 严格模式无错误

### 5.2 测试策略

| 类型 | 工具 | 覆盖率目标 |
|------|------|-----------|
| 单元测试 | Vitest | 80% |
| 集成测试 | Vitest | 核心流程 |
| 安全测试 | 手工 | 所有威胁 |
| 性能测试 | 手工 | 并发场景 |

---

## 6. 附录

### 6.1 每日详细计划

#### Day 1 (2026-02-21)
- [ ] 09:00-13:00: Task 1.1 项目初始化
- [ ] 14:00-16:00: Task 1.2 类型定义
- [ ] 16:00-18:00: Task 1.3 安全基础设施 (部分)

#### Day 2 (2026-02-22)
- [ ] 09:00-12:00: Task 1.3 安全基础设施 (完成)
- [ ] 13:00-17:00: Task 1.4 审计日志系统
- [ ] 17:00-18:00: Day 1-2 回顾

#### Day 3 (2026-02-23)
- [ ] 09:00-13:00: Task 2.1 Git 集成
- [ ] 14:00-18:00: Task 2.2 回收站管理

#### Day 4 (2026-02-24)
- [ ] 09:00-13:00: Task 2.3 文件操作 (上午)
- [ ] 14:00-18:00: Task 2.3 文件操作 (完成)

#### Day 5 (2026-02-25)
- [ ] 09:00-13:00: Task 3.1 Docker 客户端
- [ ] 14:00-18:00: Task 3.2 影子工作区 (部分)

#### Day 6 (2026-02-26)
- [ ] 09:00-12:00: Task 3.2 影子工作区 (完成)
- [ ] 13:00-18:00: Task 3.3 容器执行器
- [ ] 18:00-18:30: Week 1 里程碑评审

#### Day 7 (2026-02-27)
- [ ] 休息日 / 缓冲时间

#### Day 8-14: 按计划执行

### 6.2 关键决策点

| 决策点 | 时间 | 决策内容 | 决策人 |
|--------|------|---------|--------|
| D1 | Day 2 | 确认安全策略严格程度 | 用户 |
| D2 | Day 6 | 确认容器镜像白名单 | 用户 |
| D3 | Day 10 | 确认是否启用 External Gate | 用户 |
| D4 | Day 13 | 确认部署时间窗口 | 用户 |

---

**文档结束**

*PROJECT-OURO-2026 实施计划 v1.0.0*
