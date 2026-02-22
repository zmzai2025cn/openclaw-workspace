# SilkTalk 测试指南 (Testing Guide)

**版本**: 0.1.0  
**测试体系**: STTS (SilkTalk Testing Standard)  
**目标读者**: 测试工程师、开发人员、QA

---

## 快速测试 (1分钟)

```bash
# 执行完整测试套件
node scripts/test-runner.js

# 或使用主控脚本
./silktalk.sh test
```

**预期结果**: 所有测试通过，显示 ✅

---

## 1. 测试体系概述

### 1.1 测试层级

```
Level 5: 验收测试 (Acceptance)  ← 端到端场景
Level 4: 集成测试 (Integration)  ← 模块间接口
Level 3: 单元测试 (Unit)         ← 函数/方法
Level 2: 静态分析 (Static)       ← 代码质量
Level 1: 环境验证 (Environment)  ← 依赖检查
```

### 1.2 测试类型

| 类型 | 占比 | 说明 |
|------|------|------|
| 功能测试 | 40% | 验证功能正确性 |
| 接口测试 | 25% | 验证模块契约 |
| 性能测试 | 15% | 验证性能指标 |
| 异常测试 | 15% | 验证错误处理 |
| 兼容性测试 | 5% | 验证环境适配 |

---

## 2. 测试执行

### 2.1 自动化测试（推荐）

```bash
# 完整测试套件
node scripts/test-runner.js

# 输出示例:
# ============================================================
# L1 环境验证 (Environment Validation)
# ============================================================
# ✅ ST-ENV-001: Node.js版本检查 (5ms)
# ✅ ST-ENV-002: npm可用性检查 (67ms)
# ...
# ============================================================
# 测试报告 (Test Report)
# ============================================================
# 总耗时: 4076ms
# 总用例: 12
# 通过: 12
# 失败: 0
# 通过率: 100.00%
# ✅ 所有测试通过
```

### 2.2 手动测试

#### L1 环境验证

```bash
# ST-ENV-001: Node.js版本
node --version  # 期望: v18.x.x 或更高

# ST-ENV-002: npm版本
npm --version   # 期望: 8.x.x 或更高

# ST-ENV-003: OpenClaw版本
openclaw --version  # 期望: 2026.2.x

# ST-ENV-004: 项目目录
ls package.json src/  # 期望: 文件存在
```

#### L2 静态分析

```bash
# ST-STA-001: ESLint检查
npx eslint src/
# 期望: 无错误

# ST-STA-002: 语法检查
for f in src/**/*.js; do node --check "$f"; done
# 期望: 全部通过
```

#### L3 单元测试

```bash
# ST-MSG-001/002/003: 消息协议测试
node -e "
const { createMessage, encode, decode, MessageType } = require('./src/protocol/message.js');
const msg = createMessage(MessageType.PING, 'A', 'B', {});
console.log('Message created:', msg.type === 'ping' ? 'PASS' : 'FAIL');
const decoded = decode(encode(msg));
console.log('Encode/Decode:', decoded.type === msg.type ? 'PASS' : 'FAIL');
"

# ST-BRD-001: OpenClaw桥接测试
node -e "
const { OpenClawBridge } = require('./src/agent-bridge/bridge.js');
const bridge = new OpenClawBridge();
bridge.isAvailable().then(ok => console.log('Bridge:', ok ? 'PASS' : 'FAIL'));
"
```

#### L4 集成测试

```bash
# ST-NET-001: 节点启动测试
timeout 10 node -e "
const { SilkNode } = require('./src/network/node.js');
const node = new SilkNode({ name: 'test', port: 10001 });
node.start().then(id => {
  console.log('Node started:', id ? 'PASS' : 'FAIL');
  node.stop().then(() => process.exit(0));
});
" 2>&1 | grep PASS
```

---

## 3. 验收测试 (L5)

### 3.1 测试场景设计

#### 场景1: 单机双节点完整流程

**目的**: 验证单机双节点协作

**前置条件**:
- SilkTalk已部署
- 端口10001和10002可用

**测试步骤**:

```bash
# Step 1: 启动节点A
cd silktalk-verify
./scripts/deploy.sh nodeA 10001
# 记录PeerId: 12D3KooW...

# Step 2: 启动节点B（连接A）
./scripts/deploy.sh nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/<节点A的PeerId>

# Step 3: 验证节点发现（在节点B日志中）
tail -f /tmp/silktalk-nodeB.log | grep "Discovered"
# 期望: 显示发现节点A

# Step 4: 停止测试
./silktalk.sh stop
```

**通过标准**:
- [ ] 节点A启动成功
- [ ] 节点B启动成功
- [ ] 节点B发现节点A
- [ ] 无错误日志

#### 场景2: 任务委托执行

**目的**: 验证远程任务委托

**前置条件**:
- 两节点已连接

**测试步骤**:

```bash
# 启动交互模式（节点B）
./silktalk.sh start nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/<节点A的PeerId>

# 在silktalk>提示符下执行:
silktalk> peers
# 期望: 显示节点A的PeerId

silktalk> ping <节点A的PeerId>
# 期望: "Ping sent" 和收到pong的日志

silktalk> delegate <节点A的PeerId> --message "Hello from B"
# 期望: 返回执行结果，success=true

silktalk> quit
```

**通过标准**:
- [ ] peers命令显示节点A
- [ ] ping命令成功
- [ ] delegate命令返回成功结果

#### 场景3: 异常恢复

**目的**: 验证故障恢复能力

**测试步骤**:

```bash
# Step 1: 启动节点A
./scripts/deploy.sh nodeA 10001
PEER_A=$(tail /tmp/silktalk-nodeA.log | grep PeerId | tail -1 | awk '{print $2}')

# Step 2: 启动节点B
./scripts/deploy.sh nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/$PEER_A

# Step 3: 验证连接
tail /tmp/silktalk-nodeB.log | grep "Connected"

# Step 4: 停止节点A
kill $(cat /tmp/silktalk-nodeA.pid)

# Step 5: 等待后重启节点A
sleep 5
./scripts/deploy.sh nodeA 10001

# Step 6: 验证节点B重新发现节点A
tail -f /tmp/silktalk-nodeB.log | grep "Discovered"
# 期望: 再次发现节点A
```

**通过标准**:
- [ ] 节点A重启后，节点B能重新发现

---

## 4. 性能测试

### 4.1 延迟测试

```bash
# 使用ping测试往返延迟
# 在节点B上执行多次ping，计算平均延迟

# 手动记录时间戳
# 或使用脚本自动化
```

**期望指标**:
- 局域网内往返延迟 < 100ms
- 单机内往返延迟 < 10ms

### 4.2 吞吐量测试

```bash
# 连续发送多个任务，测量处理能力
# 待实现
```

**期望指标**:
- 消息吞吐量 > 100 msg/s
- 任务执行并发 > 10

---

## 5. 测试报告模板

### 5.1 测试执行报告

```markdown
# 测试执行报告

**日期**: YYYY-MM-DD  
**执行人**: [姓名]  
**版本**: 0.1.0  

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总用例 | 12 |
| 通过 | 12 |
| 失败 | 0 |
| 跳过 | 0 |
| 通过率 | 100% |

## 详细结果

### L1 环境验证
- ✅ ST-ENV-001: Node.js版本检查
- ✅ ST-ENV-002: npm可用性检查
- ✅ ST-ENV-003: OpenClaw可用性检查
- ✅ ST-ENV-004: 项目目录检查

### L2 静态分析
- ✅ ST-STA-001: ESLint检查
- ✅ ST-STA-002: 语法检查

### L3 单元测试
- ✅ ST-MSG-001: 消息创建
- ✅ ST-MSG-002: 消息编码解码
- ✅ ST-MSG-003: 无效消息解码
- ✅ ST-BRD-001: OpenClaw桥接可用性

### L4 集成测试
- ✅ ST-NET-001: 节点启动
- ✅ ST-NET-002: 节点停止

### L5 验收测试
- ⏳ ST-ACC-001: 单机双节点完整流程 (待执行)
- ⏳ ST-ACC-002: 局域网双机完整流程 (待执行)

## 缺陷记录

| ID | 描述 | 严重级别 | 状态 |
|----|------|----------|------|
| - | - | - | - |

## 结论

[通过/有条件通过/不通过]

## 签字

测试: _______________  
审核: _______________
```

---

## 6. 持续集成

### 6.1 GitHub Actions示例

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install OpenClaw
      run: npm install -g openclaw
    
    - name: Install dependencies
      run: npm install
    
    - name: Run tests
      run: node scripts/test-runner.js
    
    - name: Upload results
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: test-report.json
```

### 6.2 本地CI脚本

```bash
#!/bin/bash
# ci-test.sh - 本地持续集成

set -e

echo "=== SilkTalk CI Test ==="

# L1: 环境检查
echo "[1/5] Environment check..."
node scripts/check-env.js

# L2: 静态分析
echo "[2/5] Static analysis..."
npx eslint src/

# L3-L4: 自动化测试
echo "[3/5] Unit & Integration tests..."
node scripts/test-runner.js

# L5: 部署测试
echo "[4/5] Deployment test..."
./scripts/deploy.sh test-node 10001
sleep 5
./silktalk.sh stop

# 报告
echo "[5/5] Generating report..."
echo "✅ All tests passed!"
```

---

## 7. 附录

### 7.1 测试用例ID速查

| ID | 名称 | 层级 | 优先级 |
|----|------|------|--------|
| ST-ENV-001 | Node.js版本检查 | L1 | P0 |
| ST-ENV-002 | npm可用性检查 | L1 | P0 |
| ST-ENV-003 | OpenClaw可用性检查 | L1 | P0 |
| ST-ENV-004 | 项目目录检查 | L1 | P0 |
| ST-STA-001 | ESLint检查 | L2 | P0 |
| ST-STA-002 | 语法检查 | L2 | P0 |
| ST-MSG-001 | 消息创建 | L3 | P0 |
| ST-MSG-002 | 消息编码解码 | L3 | P0 |
| ST-MSG-003 | 无效消息解码 | L3 | P1 |
| ST-BRD-001 | OpenClaw桥接可用性 | L3 | P0 |
| ST-NET-001 | 节点启动 | L4 | P0 |
| ST-NET-002 | 节点停止 | L4 | P0 |
| ST-ACC-001 | 单机双节点完整流程 | L5 | P0 |
| ST-ACC-002 | 局域网双机完整流程 | L5 | P0 |

### 7.2 常见问题

**Q: 测试执行时间过长**  
A: 检查网络连接，或跳过L5测试（需手动执行）

**Q: L4测试失败**  
A: 检查端口是否被占用，或防火墙设置

**Q: 如何只执行特定层级测试**  
A: 修改test-runner.js，过滤tests数组

---

**测试完成！** 所有测试通过后，即可部署到生产环境。
