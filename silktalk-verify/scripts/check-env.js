#!/usr/bin/env node
/**
 * SilkTalk Environment Checker
 * 检测目标机器是否满足运行条件
 */

import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';

const CHECKS = {
  node: { min: '18.0.0', installed: false, version: null },
  npm: { min: '8.0.0', installed: false, version: null },
  openclaw: { installed: false, version: null, path: null },
  network: { internet: false, ports: [] }
};

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(level, message) {
  const color = level === 'success' ? COLORS.green : 
                level === 'error' ? COLORS.red : 
                level === 'warn' ? COLORS.yellow : COLORS.blue;
  console.log(`${color}[${level.toUpperCase()}]${COLORS.reset} ${message}`);
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function runCommand(cmd, args = [], timeout = 5000) {
  try {
    const result = execSync(`${cmd} ${args.join(' ')}`, { 
      encoding: 'utf8', 
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return { success: false, error: err.message, output: err.stdout?.toString() || '' };
  }
}

async function checkNode() {
  log('info', 'Checking Node.js...');
  const result = runCommand('node', ['--version']);
  
  if (!result.success) {
    log('error', 'Node.js not found');
    return false;
  }
  
  const version = result.output.replace('v', '');
  CHECKS.node.installed = true;
  CHECKS.node.version = version;
  
  if (compareVersions(version, CHECKS.node.min) >= 0) {
    log('success', `Node.js ${version} installed (>= ${CHECKS.node.min})`);
    return true;
  } else {
    log('error', `Node.js ${version} too old (need >= ${CHECKS.node.min})`);
    return false;
  }
}

async function checkNpm() {
  log('info', 'Checking npm...');
  const result = runCommand('npm', ['--version']);
  
  if (!result.success) {
    log('error', 'npm not found');
    return false;
  }
  
  const version = result.output;
  CHECKS.npm.installed = true;
  CHECKS.npm.version = version;
  
  if (compareVersions(version, CHECKS.npm.min) >= 0) {
    log('success', `npm ${version} installed (>= ${CHECKS.npm.min})`);
    return true;
  } else {
    log('warn', `npm ${version} may be old (recommend >= ${CHECKS.npm.min})`);
    return true;
  }
}

async function checkOpenClaw() {
  log('info', 'Checking OpenClaw...');
  
  // 检查全局安装
  let result = runCommand('which', ['openclaw']);
  if (!result.success) {
    // 检查常见路径
    const commonPaths = [
      '/usr/bin/openclaw',
      '/usr/local/bin/openclaw',
      `${homedir()}/.npm-global/bin/openclaw`,
      `${homedir()}/.local/bin/openclaw`
    ];
    
    for (const path of commonPaths) {
      if (existsSync(path)) {
        CHECKS.openclaw.path = path;
        break;
      }
    }
  } else {
    CHECKS.openclaw.path = result.output;
  }
  
  if (!CHECKS.openclaw.path) {
    log('warn', 'OpenClaw not found in PATH');
    return false;
  }
  
  // 检查版本
  result = runCommand('openclaw', ['--version']);
  if (result.success) {
    CHECKS.openclaw.installed = true;
    CHECKS.openclaw.version = result.output.split('\n')[0];
    log('success', `OpenClaw found: ${CHECKS.openclaw.path}`);
    log('success', `OpenClaw version: ${CHECKS.openclaw.version}`);
    return true;
  } else {
    log('warn', 'OpenClaw path found but execution failed');
    return false;
  }
}

async function checkNetwork() {
  log('info', 'Checking network...');
  
  // 检查互联网连接
  const result = runCommand('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'https://registry.npmjs.org'], 3000);
  CHECKS.network.internet = result.success && result.output === '200';
  
  if (CHECKS.network.internet) {
    log('success', 'Internet connection OK');
  } else {
    log('warn', 'Internet connection failed (offline mode)');
  }
  
  // 检查端口可用性
  const ports = [10001, 10002, 10003];
  for (const port of ports) {
    const result = runCommand('netstat', ['-tlnp']);
    if (!result.output.includes(`:${port}`)) {
      CHECKS.network.ports.push(port);
    }
  }
  
  log('success', `Available ports: ${CHECKS.network.ports.join(', ')}`);
  return true;
}

async function checkFirewall() {
  log('info', 'Checking firewall...');
  
  const result = runCommand('ufw', ['status']);
  if (result.success && result.output.includes('Status: active')) {
    log('warn', 'UFW firewall is active');
    log('info', 'You may need to run: sudo ufw allow 10001:10010/tcp');
    return false;
  }
  
  const iptablesResult = runCommand('iptables', ['-L']);
  if (iptablesResult.success && iptablesResult.output.includes('DROP')) {
    log('warn', 'iptables has DROP rules');
    return false;
  }
  
  log('success', 'Firewall check passed');
  return true;
}

function generateReport() {
  console.log('\n' + '='.repeat(50));
  log('info', 'ENVIRONMENT CHECK REPORT');
  console.log('='.repeat(50));
  
  const allPassed = CHECKS.node.installed && 
                    CHECKS.npm.installed && 
                    CHECKS.openclaw.installed;
  
  if (allPassed) {
    log('success', '✅ All checks passed! Ready to deploy.');
  } else {
    log('warn', '⚠️  Some checks failed. See details above.');
  }
  
  console.log('\nDetails:');
  console.log(`  Node.js: ${CHECKS.node.installed ? CHECKS.node.version : 'NOT INSTALLED'}`);
  console.log(`  npm: ${CHECKS.npm.installed ? CHECKS.npm.version : 'NOT INSTALLED'}`);
  console.log(`  OpenClaw: ${CHECKS.openclaw.installed ? CHECKS.openclaw.version : 'NOT INSTALLED'}`);
  console.log(`  OpenClaw Path: ${CHECKS.openclaw.path || 'N/A'}`);
  console.log(`  Internet: ${CHECKS.network.internet ? 'YES' : 'NO'}`);
  console.log(`  Available Ports: ${CHECKS.network.ports.join(', ')}`);
  
  // 保存检查结果供后续脚本使用
  const reportPath = '/tmp/silktalk-check.json';
  import('fs').then(fs => {
    fs.writeFileSync(reportPath, JSON.stringify(CHECKS, null, 2));
    log('info', `Check results saved to ${reportPath}`);
  });
  
  return allPassed ? 0 : 1;
}

async function main() {
  console.log('🔍 SilkTalk Environment Checker\n');
  
  await checkNode();
  await checkNpm();
  await checkOpenClaw();
  await checkNetwork();
  await checkFirewall();
  
  const exitCode = generateReport();
  process.exit(exitCode);
}

main().catch(err => {
  log('error', `Checker failed: ${err.message}`);
  process.exit(1);
});
