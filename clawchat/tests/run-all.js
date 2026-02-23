#!/usr/bin/env node
/**
 * ClawChat 测试运行器
 * 运行所有测试套件并生成综合报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = __dirname;
const TEST_SUITES = [
  { name: '单元测试', file: 'unit.test.js', critical: true },
  { name: '集成测试', file: 'integration.test.js', critical: true },
  { name: '压力测试', file: 'stress.test.js', critical: false },
  { name: '故障注入测试', file: 'fault.test.js', critical: true },
  { name: '安全测试', file: 'security.test.js', critical: true },
  { name: '兼容性测试', file: 'compatibility.test.js', critical: false }
];

const results = {
  startTime: new Date().toISOString(),
  suites: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    duration: 0
  }
};

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           ClawChat 全方位测试套件 v1.0.0                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`\n开始时间: ${results.startTime}`);
console.log(`Node.js: ${process.version}`);
console.log(`平台: ${process.platform} ${process.arch}\n`);

const overallStart = Date.now();

for (const suite of TEST_SUITES) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${suite.name}`);
  console.log('='.repeat(60));
  
  const suiteStart = Date.now();
  let suiteResult = {
    name: suite.name,
    file: suite.file,
    critical: suite.critical,
    passed: 0,
    failed: 0,
    duration: 0,
    status: 'skipped'
  };
  
  try {
    const output = execSync(`node ${path.join(TESTS_DIR, suite.file)}`, {
      encoding: 'utf8',
      timeout: 300000, // 5分钟超时
      stdio: 'pipe'
    });
    
    // 解析测试结果
    const passedMatch = output.match(/(\d+) 通过/);
    const failedMatch = output.match(/(\d+) 失败/);
    
    suiteResult.passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    suiteResult.failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    suiteResult.status = suiteResult.failed === 0 ? 'passed' : 'failed';
    
    console.log(output);
  } catch (error) {
    suiteResult.status = 'error';
    suiteResult.error = error.message;
    console.error(`❌ 测试套件执行失败: ${error.message}`);
    if (error.stdout) console.log(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
  }
  
  suiteResult.duration = Date.now() - suiteStart;
  results.suites.push(suiteResult);
  
  results.summary.total++;
  if (suiteResult.status === 'passed') {
    results.summary.passed++;
  } else {
    results.summary.failed++;
  }
  
  // 关键测试失败时停止
  if (suite.critical && suiteResult.status !== 'passed') {
    console.error(`\n🚨 关键测试失败，停止后续测试`);
    break;
  }
}

results.summary.duration = Date.now() - overallStart;
results.endTime = new Date().toISOString();

// 保存测试结果
const reportPath = path.join(TESTS_DIR, 'test-results.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

// 生成报告
console.log('\n' + '═'.repeat(60));
console.log('📊 测试结果汇总');
console.log('═'.repeat(60));

console.log('\n| 测试项 | 状态 | 耗时 | 通过 | 失败 |');
console.log('|--------|------|------|------|------|');

for (const suite of results.suites) {
  const status = suite.status === 'passed' ? '✅ 通过' : 
                 suite.status === 'failed' ? '❌ 失败' : '⚠️ 错误';
  const duration = `${(suite.duration / 1000).toFixed(1)}s`;
  console.log(`| ${suite.name} | ${status} | ${duration} | ${suite.passed} | ${suite.failed} |`);
}

console.log('\n' + '═'.repeat(60));
console.log(`总计: ${results.summary.passed}/${results.summary.total} 测试套件通过`);
console.log(`总耗时: ${(results.summary.duration / 1000).toFixed(1)}s`);
console.log('═'.repeat(60));

// 生成详细报告文件
const markdownReport = generateMarkdownReport(results);
fs.writeFileSync(path.join(TESTS_DIR, 'TEST-REPORT.md'), markdownReport);

console.log(`\n📄 详细报告已保存: ${path.join(TESTS_DIR, 'TEST-REPORT.md')}`);
console.log(`📄 JSON结果已保存: ${reportPath}`);

process.exit(results.summary.failed > 0 ? 1 : 0);

function generateMarkdownReport(results) {
  return `# ClawChat 测试报告

**测试时间**: ${results.startTime}  
**结束时间**: ${results.endTime}  
**Node.js**: ${process.version}  
**平台**: ${process.platform} ${process.arch}

## 测试结果汇总

| 测试项 | 状态 | 耗时 | 通过 | 失败 | 关键 |
|--------|------|------|------|------|------|
${results.suites.map(s => 
  `| ${s.name} | ${s.status === 'passed' ? '✅ 通过' : s.status === 'failed' ? '❌ 失败' : '⚠️ 错误'} | ${(s.duration / 1000).toFixed(1)}s | ${s.passed} | ${s.failed} | ${s.critical ? '是' : '否'} |`
).join('\n')}

## 统计信息

- **测试套件总数**: ${results.summary.total}
- **通过**: ${results.summary.passed}
- **失败**: ${results.summary.failed}
- **总耗时**: ${(results.summary.duration / 1000).toFixed(1)}s
- **成功率**: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%

## 结论

${results.summary.failed === 0 
  ? '✅ **所有测试通过，系统可以上线**' 
  : results.suites.some(s => s.critical && s.status !== 'passed')
    ? '❌ **关键测试失败，系统不可上线**'
    : '⚠️ **非关键测试失败，建议修复后上线**'
}

---
*报告生成时间: ${new Date().toISOString()}*
`;
}
