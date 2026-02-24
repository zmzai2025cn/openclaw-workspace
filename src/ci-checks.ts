/**
 * CI 环境防御性检查模块
 * 提前发现 CI/本地环境差异导致的问题
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EnvironmentCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * 运行所有环境检查
 */
export function runEnvironmentChecks(): EnvironmentCheck[] {
  const checks: EnvironmentCheck[] = [];

  // 1. Node 版本检查
  checks.push(checkNodeVersion());

  // 2. 时区检查
  checks.push(checkTimezone());

  // 3. 文件大小写检查
  checks.push(checkCaseSensitivity());

  // 4. 依赖完整性检查
  checks.push(checkDependencies());

  // 5. 文件路径检查
  checks.push(checkFilePaths());

  // 6. 权限检查
  checks.push(checkPermissions());

  return checks;
}

/**
 * 检查 Node 版本
 */
function checkNodeVersion(): EnvironmentCheck {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  // CI 使用 18.x，本地建议一致
  if (major < 18) {
    return {
      name: 'Node Version',
      passed: false,
      message: `Node 版本 ${version} 过低，CI 使用 18.x，建议升级`,
      severity: 'error',
    };
  }
  
  if (major > 18) {
    return {
      name: 'Node Version',
      passed: true,
      message: `Node 版本 ${version}，CI 使用 18.x，版本较新但可能有不一致风险`,
      severity: 'warning',
    };
  }

  return {
    name: 'Node Version',
    passed: true,
    message: `Node 版本 ${version}，与 CI 一致`,
    severity: 'info',
  };
}

/**
 * 检查时区设置
 */
function checkTimezone(): EnvironmentCheck {
  const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // CI 通常是 UTC，本地可能是其他时区
  if (tz !== 'UTC') {
    return {
      name: 'Timezone',
      passed: true,
      message: `时区为 ${tz}，CI 使用 UTC，日期测试可能有差异`,
      severity: 'warning',
    };
  }

  return {
    name: 'Timezone',
    passed: true,
    message: `时区为 UTC，与 CI 一致`,
    severity: 'info',
  };
}

/**
 * 检查文件系统大小写敏感性
 */
function checkCaseSensitivity(): EnvironmentCheck {
  const testDir = path.join(process.cwd(), '.case_test_' + Date.now());
  
  try {
    // 创建测试文件
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'Test.txt'), 'test');
    
    // 尝试用小写访问
    const lowerExists = fs.existsSync(path.join(testDir, 'test.txt'));
    const upperExists = fs.existsSync(path.join(testDir, 'Test.txt'));
    
    // 清理
    fs.unlinkSync(path.join(testDir, 'Test.txt'));
    fs.rmdirSync(testDir);
    
    if (lowerExists && upperExists && lowerExists === upperExists) {
      return {
        name: 'Case Sensitivity',
        passed: false,
        message: '文件系统不区分大小写（macOS/Windows），CI 的 Linux 区分大小写，注意 import 路径',
        severity: 'warning',
      };
    }

    return {
      name: 'Case Sensitivity',
      passed: true,
      message: '文件系统区分大小写，与 CI 一致',
      severity: 'info',
    };
  } catch (err) {
    return {
      name: 'Case Sensitivity',
      passed: false,
      message: `无法检测大小写敏感性: ${err}`,
      severity: 'warning',
    };
  }
}

/**
 * 检查依赖完整性
 */
function checkDependencies(): EnvironmentCheck {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const lockFilePath = path.join(process.cwd(), 'package-lock.json');
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');

  if (!fs.existsSync(packageJsonPath)) {
    return {
      name: 'Dependencies',
      passed: false,
      message: '找不到 package.json',
      severity: 'error',
    };
  }

  // 检查 lock 文件是否提交
  if (!fs.existsSync(lockFilePath)) {
    return {
      name: 'Dependencies',
      passed: false,
      message: '缺少 package-lock.json，CI 使用 npm ci 需要 lock 文件',
      severity: 'error',
    };
  }

  // 检查 node_modules 是否存在
  if (!fs.existsSync(nodeModulesPath)) {
    return {
      name: 'Dependencies',
      passed: false,
      message: 'node_modules 不存在，请先运行 npm install',
      severity: 'error',
    };
  }

  // 检查是否有未安装的依赖
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const missing: string[] = [];
    for (const dep of Object.keys(deps)) {
      const depPath = path.join(nodeModulesPath, dep);
      if (!fs.existsSync(depPath)) {
        missing.push(dep);
      }
    }

    if (missing.length > 0) {
      return {
        name: 'Dependencies',
        passed: false,
        message: `缺少依赖: ${missing.join(', ')}`,
        severity: 'error',
      };
    }
  } catch (err) {
    return {
      name: 'Dependencies',
      passed: false,
      message: `解析 package.json 失败: ${err}`,
      severity: 'error',
    };
  }

  return {
    name: 'Dependencies',
    passed: true,
    message: '依赖完整',
    severity: 'info',
  };
}

/**
 * 检查关键文件路径
 */
function checkFilePaths(): EnvironmentCheck {
  const issues: string[] = [];
  
  // 检查 src 目录下的文件引用
  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    
    // 检查是否有大小写不一致的文件名
    const lowerCaseNames = files.map(f => f.toLowerCase());
    const duplicates = lowerCaseNames.filter((item, index) => lowerCaseNames.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      issues.push(`发现大小写重复的文件: ${duplicates.join(', ')}`);
    }
  }

  if (issues.length > 0) {
    return {
      name: 'File Paths',
      passed: false,
      message: issues.join('; '),
      severity: 'warning',
    };
  }

  return {
    name: 'File Paths',
    passed: true,
    message: '文件路径检查通过',
    severity: 'info',
  };
}

/**
 * 检查文件权限
 */
function checkPermissions(): EnvironmentCheck {
  const logsDir = path.join(process.cwd(), 'logs');
  const dataDir = path.join(process.cwd(), 'data');
  
  const dirsToCheck = [logsDir, dataDir];
  const issues: string[] = [];
  
  for (const dir of dirsToCheck) {
    if (fs.existsSync(dir)) {
      try {
        // 尝试写入测试文件
        const testFile = path.join(dir, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (err) {
        issues.push(`无法写入 ${dir}`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Permissions',
      passed: false,
      message: issues.join('; '),
      severity: 'warning',
    };
  }

  return {
    name: 'Permissions',
    passed: true,
    message: '目录权限检查通过',
    severity: 'info',
  };
}

/**
 * 打印检查结果
 */
export function printCheckResults(checks: EnvironmentCheck[]): void {
  console.log('\n🔍 环境检查报告\n');
  
  const errors = checks.filter(c => c.severity === 'error');
  const warnings = checks.filter(c => c.severity === 'warning');
  const infos = checks.filter(c => c.severity === 'info');

  for (const check of checks) {
    const icon = check.severity === 'error' ? '❌' : 
                 check.severity === 'warning' ? '⚠️' : '✅';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }

  console.log('\n-------------------');
  console.log(`总计: ${checks.length} 项 | ❌ 错误: ${errors.length} | ⚠️ 警告: ${warnings.length} | ✅ 通过: ${infos.length}`);
  
  if (errors.length > 0) {
    console.log('\n请修复错误后再提交代码，以避免 CI 失败。');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n有警告项，建议检查但非阻塞。');
  } else {
    console.log('\n所有检查通过！');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const checks = runEnvironmentChecks();
  printCheckResults(checks);
}