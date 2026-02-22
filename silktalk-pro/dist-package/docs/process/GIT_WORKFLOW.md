# Git 分支策略
## Git Branching Strategy

**文档编号**: STP-GIT-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro 开发团队  

---

## 1. 分支模型

采用 **Git Flow** 简化版分支模型。

```
main (生产分支)
  ↑
develop (开发分支)
  ↑
feature/* (功能分支)
  ↑
hotfix/* (热修复分支)
  ↑
release/* (发布分支)
```

---

## 2. 分支说明

### 2.1 main 分支
- **用途**: 生产环境代码
- **保护**: 禁止直接推送
- **合并**: 只能通过 PR 从 release 或 hotfix 分支合并
- **标签**: 每个发布版本打标签

### 2.2 develop 分支
- **用途**: 开发集成
- **保护**: 禁止直接推送
- **合并**: 通过 PR 从 feature 分支合并
- **触发**: 自动运行集成测试

### 2.3 feature/* 分支
- **命名**: `feature/功能描述` 或 `feature/ISSUE-ID-描述`
- **来源**: 从 develop 分支创建
- **合并**: 合并回 develop 分支
- **生命周期**: 功能开发完成后删除

**示例**:
```bash
git checkout -b feature/add-webrtc-support develop
git checkout -b feature/STP-123-nat-traversal develop
```

### 2.4 release/* 分支
- **命名**: `release/版本号`
- **来源**: 从 develop 分支创建
- **用途**: 发布准备，仅允许 bug 修复
- **合并**: 合并到 main 和 develop

**示例**:
```bash
git checkout -b release/1.0.0 develop
```

### 2.5 hotfix/* 分支
- **命名**: `hotfix/描述`
- **来源**: 从 main 分支创建
- **用途**: 生产环境紧急修复
- **合并**: 合并到 main 和 develop

**示例**:
```bash
git checkout -b hotfix/fix-memory-leak main
```

---

## 3. 工作流程

### 3.1 功能开发流程
```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# 2. 开发和提交
git add .
git commit -m "feat: add new feature"

# 3. 推送到远程
git push -u origin feature/my-feature

# 4. 创建 PR 到 develop
# 5. 代码审查
# 6. 合并后删除分支
git branch -d feature/my-feature
```

### 3.2 发布流程
```bash
# 1. 从 develop 创建 release 分支
git checkout -b release/1.1.0 develop

# 2. 版本号更新和最后修复
# 3. 测试

# 4. 合并到 main
git checkout main
git merge --no-ff release/1.1.0
git tag -a v1.1.0 -m "Release version 1.1.0"

# 5. 合并回 develop
git checkout develop
git merge --no-ff release/1.1.0

# 6. 删除 release 分支
git branch -d release/1.1.0
```

### 3.3 热修复流程
```bash
# 1. 从 main 创建 hotfix 分支
git checkout -b hotfix/critical-fix main

# 2. 修复和提交

# 3. 合并到 main
git checkout main
git merge --no-ff hotfix/critical-fix
git tag -a v1.0.1 -m "Hotfix version 1.0.1"

# 4. 合并到 develop
git checkout develop
git merge --no-ff hotfix/critical-fix

# 5. 删除 hotfix 分支
git branch -d hotfix/critical-fix
```

---

## 4. 提交规范

### 4.1 Conventional Commits

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 4.2 类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: add WebSocket transport` |
| `fix` | 修复 | `fix: handle null pointer exception` |
| `docs` | 文档 | `docs: update API documentation` |
| `style` | 格式 | `style: fix indentation` |
| `refactor` | 重构 | `refactor: simplify connection logic` |
| `perf` | 性能 | `perf: optimize message encoding` |
| `test` | 测试 | `test: add unit tests for DHT` |
| `chore` | 构建 | `chore: update dependencies` |
| `ci` | CI/CD | `ci: add GitHub Actions workflow` |
| `security` | 安全 | `security: fix vulnerability in deps` |

### 4.3 范围说明

| 范围 | 说明 |
|------|------|
| `core` | 核心模块 |
| `network` | 网络模块 |
| `protocol` | 协议模块 |
| `routing` | 路由模块 |
| `cli` | 命令行接口 |
| `bridge` | 桥接模块 |
| `deps` | 依赖 |

### 4.4 提交示例

```bash
# 功能提交
git commit -m "feat(network): add NAT traversal support

- Implement UPnP port mapping
- Add AutoNAT detection
- Support DCUtR protocol

Closes #123"

# 修复提交
git commit -m "fix(protocol): handle invalid message format

Previously, invalid messages would crash the handler.
Now they are properly caught and logged.

Fixes #456"

# 文档提交
git commit -m "docs(api): update REST API documentation"

# 重构提交
git commit -m "refactor(core): simplify node initialization

- Extract config building to separate method
- Remove redundant error handling
- Add more detailed logging"
```

---

## 5. Pull Request 规范

### 5.1 PR 标题格式
```
[<type>][<scope>] <description>

示例:
[feat][network] Add WebRTC transport support
[fix][core] Fix memory leak in connection pool
[docs] Update deployment guide
```

### 5.2 PR 描述模板
```markdown
## 描述
简要描述本次变更的目的和内容。

## 变更类型
- [ ] 新功能 (feat)
- [ ] 修复 (fix)
- [ ] 文档 (docs)
- [ ] 重构 (refactor)
- [ ] 性能优化 (perf)
- [ ] 测试 (test)

## 相关 Issue
Fixes #123
Relates to #456

## 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试通过

## 检查清单
- [ ] 代码遵循编码规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 变更日志已更新
```

### 5.3 PR 审查要求
- 至少 1 人审查通过
- 所有 CI 检查通过
- 无冲突
- 符合编码规范

---

## 6. 版本标签

### 6.1 标签格式
- 版本标签: `v主版本.次版本.修订号`
- 示例: `v1.0.0`, `v1.1.0`, `v1.1.1`

### 6.2 创建标签
```bash
# 附注标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签
git push origin v1.0.0

# 推送所有标签
git push origin --tags
```

---

## 7. 附录

### 7.1 常用命令速查

```bash
# 创建功能分支
git checkout -b feature/xxx develop

# 创建修复分支
git checkout -b fix/xxx develop

# 创建热修复分支
git checkout -b hotfix/xxx main

# 创建发布分支
git checkout -b release/x.x.x develop

# 删除已合并分支
git branch --merged | grep -v "\*" | xargs -n 1 git branch -d

# 清理远程已删除分支
git fetch --prune
```

### 7.2 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk Team | 初始版本 |

---

**文档结束**
