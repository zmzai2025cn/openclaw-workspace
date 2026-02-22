# 测试执行手册

## 1. 快速开始

### 1.1 环境准备

```bash
# 克隆仓库
git clone <repository-url>
cd silktalk-pro

# 安装依赖
npm install

# 构建项目
npm run build
```

### 1.2 运行所有测试

```bash
npm test
```

## 2. 测试类型详解

### 2.1 单元测试

**目的**: 验证单个模块的功能正确性

**执行**:
```bash
# 运行所有单元测试
npm run test:unit

# 运行特定模块
npx vitest run tests/unit/core/node.test.ts

# 监视模式
npx vitest tests/unit/core/node.test.ts
```

**预期输出**:
```
 ✓ tests/unit/core/node.test.ts (12 tests) 1234ms
 ✓ tests/unit/network/connection-manager.test.ts (8 tests) 890ms
 ...
Test Files  5 passed (5)
     Tests  45 passed (45)
  Duration  3.12s
```

### 2.2 集成测试

**目的**: 验证模块间的协作

**执行**:
```bash
npm run test:integration
```

**注意**: 集成测试会启动实际的网络服务，请确保端口未被占用。

### 2.3 E2E 测试

**目的**: 验证端到端场景

**执行**:
```bash
npm run test:e2e
```

### 2.4 环境测试

**目的**: 验证跨平台兼容性

**执行**:
```bash
npm run test:environment
```

**测试内容**:
- 平台检测 (Linux/macOS/Windows)
- Node.js 版本兼容性
- 时区处理
- 字符编码
- 库版本兼容性

### 2.5 性能测试

**目的**: 验证性能基线

**执行**:
```bash
npm run test:performance
```

**输出指标**:
- 消息延迟 (P50/P99)
- 吞吐量 (msg/s)
- 内存使用
- CPU 使用

### 2.6 混沌测试

**目的**: 验证系统韧性

**执行**:
```bash
npm run test:chaos
```

**注意**: 混沌测试会模拟各种故障场景，可能需要 root 权限进行网络操作。

### 2.7 模糊测试

**目的**: 发现边界缺陷

**执行**:
```bash
npm run test:fuzzing
```

### 2.8 安全测试

**目的**: 验证安全防护

**执行**:
```bash
npm run test:security
```

## 3. Docker 测试环境

### 3.1 构建测试镜像

```bash
cd docker
docker-compose -f docker-compose.test.yml build
```

### 3.2 运行特定测试

```bash
# 单元测试
docker-compose -f docker-compose.test.yml run --rm unit-test

# 集成测试
docker-compose -f docker-compose.test.yml run --rm integration-test

# 性能测试
docker-compose -f docker-compose.test.yml run --rm performance-test

# 混沌测试 (需要特权)
docker-compose -f docker-compose.test.yml run --rm chaos-test

# 环境测试
docker-compose -f docker-compose.test.yml run --rm environment-test
```

### 3.3 启动完整测试环境

```bash
# 启动所有服务
docker-compose -f docker-compose.test.yml up -d

# 查看日志
docker-compose -f docker-compose.test.yml logs -f bootstrap-node

# 停止环境
docker-compose -f docker-compose.test.yml down
```

### 3.4 网络故障注入

```bash
# 启动带延迟注入的测试
docker-compose -f docker-compose.test.yml up -d latency-injector

# 查看网络配置
docker-compose -f docker-compose.test.yml exec latency-injector tc qdisc show
```

## 4. CI/CD 集成

### 4.1 GitHub Actions

测试会在以下情况自动触发:
- 推送到 main/develop 分支
- 创建 Pull Request
- 每日定时任务 (凌晨 2 点)

### 4.2 本地模拟 CI

```bash
# 安装 act (GitHub Actions 本地运行器)
brew install act

# 运行完整 CI 流程
act

# 运行特定 job
act -j unit-test
```

### 4.3 覆盖率检查

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看报告
open coverage/index.html
```

## 5. 调试技巧

### 5.1 启用详细日志

```bash
# 设置日志级别
export SILKTALK_LOG_LEVEL=debug

# 运行测试
npm run test:e2e
```

### 5.2 使用 Vitest UI

```bash
npx vitest --ui
```

### 5.3 调试特定测试

```bash
# 在 Node.js 调试模式下运行
node --inspect-brk node_modules/vitest/vitest.mjs run tests/unit/core/node.test.ts
```

然后在 Chrome DevTools 或 VS Code 中连接调试器。

### 5.4 捕获网络流量

```bash
# 使用 tcpdump
docker-compose -f docker-compose.test.yml exec chaos-test tcpdump -i eth0 -w /tmp/capture.pcap
```

## 6. 故障排查

### 6.1 端口冲突

**问题**: `EADDRINUSE` 错误

**解决**:
```bash
# 查找占用端口的进程
lsof -i :4001

# 终止进程
kill -9 <PID>

# 或在测试中使用随机端口
```

### 6.2 测试超时

**问题**: 测试运行时间过长

**解决**:
```bash
# 增加超时时间
npx vitest run --timeout 60000
```

### 6.3 内存不足

**问题**: `JavaScript heap out of memory`

**解决**:
```bash
# 增加 Node.js 内存限制
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

### 6.4 Docker 权限

**问题**: 混沌测试需要网络权限

**解决**:
```bash
# 以特权模式运行
docker-compose -f docker-compose.test.yml run --rm --privileged chaos-test
```

## 7. 性能基准

### 7.1 建立性能基线

```bash
# 运行性能测试并保存结果
npm run test:performance > reports/performance/baseline.txt
```

### 7.2 比较性能回归

```bash
# 运行当前测试
npm run test:performance > reports/performance/current.txt

# 比较结果
diff reports/performance/baseline.txt reports/performance/current.txt
```

## 8. 测试数据管理

### 8.1 清理测试数据

```bash
# 清理临时文件
rm -rf /tmp/silktalk-test-*

# 清理 Docker 卷
docker-compose -f docker-compose.test.yml down -v
```

### 8.2 生成测试报告

```bash
# JSON 格式
npx vitest run --reporter=json > reports/test-results.json

# JUnit XML 格式
npx vitest run --reporter=junit > reports/test-results.xml
```

## 9. 持续测试

### 9.1 预提交钩子

```bash
# 安装 husky
npx husky install

# 添加预提交钩子
echo "npm run lint && npm run typecheck && npm run test:unit" > .husky/pre-commit
```

### 9.2 监视模式开发

```bash
# 开发时自动运行相关测试
npx vitest --watch
```

## 10. 最佳实践

1. **测试隔离**: 每个测试应该独立运行，不依赖其他测试的状态
2. **清理资源**: 使用 `afterEach`/`afterAll` 清理创建的资源
3. **明确断言**: 使用具体的断言，避免模糊的 `toBeTruthy()`
4. **描述清晰**: 测试描述应该说明被测行为和预期结果
5. **快速反馈**: 单元测试应该快速执行 (< 100ms)
6. **确定性**: 测试应该产生一致的结果，避免随机失败
