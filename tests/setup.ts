/**
 * Jest 全局 setup
 * 在测试运行前执行环境检查
 */

import { runEnvironmentChecks, printCheckResults, EnvironmentCheck } from '../src/ci-checks';

export default async function globalSetup(): Promise<void> {
  console.log('\n🧪 测试前环境检查...\n');
  
  const checks = runEnvironmentChecks();
  
  // 只打印，不阻塞测试（让测试本身决定成败）
  const errors = checks.filter(c => c.severity === 'error');
  const warnings = checks.filter(c => c.severity === 'warning');
  
  for (const check of checks) {
    const icon = check.severity === 'error' ? '❌' : 
                 check.severity === 'warning' ? '⚠️' : '✅';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }
  
  console.log('\n-------------------');
  console.log(`环境检查: ${checks.length} 项 | ❌ 错误: ${errors.length} | ⚠️ 警告: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  发现环境错误，测试可能失败！\n');
  } else if (warnings.length > 0) {
    console.log('\n⚠️  有环境警告，请注意。\n');
  } else {
    console.log('\n✅ 环境检查通过\n');
  }
}