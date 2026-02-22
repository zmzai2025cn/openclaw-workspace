#!/usr/bin/env node
/**
 * SilkTalk Auto Installer
 * 自动安装缺失的依赖
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

function runCommand(cmd, args = [], options = {}) {
  const { timeout = 60000, silent = false } = options;
  try {
    const result = execSync(`${cmd} ${args.join(' ')}`, { 
      encoding: 'utf8', 
      timeout,
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
    });
    return { success: true, output: result?.trim() || '' };
  } catch (err) {
    return { success: false, error: err.message, code: err.status };
  }
}

async function loadCheckResults() {
  const checkPath = '/tmp/silktalk-check.json';
  if (existsSync(checkPath)) {
    try {
      return JSON.parse(readFileSync(checkPath, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

async function installNode() {
  log('info', 'Installing Node.js...');
  
  // 检测系统类型
  const osInfo = runCommand('cat', ['/etc/os-release'], { silent: true });
  const isUbuntu = osInfo.success && osInfo.output.includes('Ubuntu');
  const isDebian = osInfo.success && osInfo.output.includes('Debian');
  const isCentOS = osInfo.success && osInfo.output.includes('CentOS');
  
  if (isUbuntu || isDebian) {
    log('info', 'Detected Debian/Ubuntu system');
    
    // 使用NodeSource安装
    const installCmd = `
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
      apt-get install -y nodejs
    `;
    
    const result = runCommand('bash', ['-c', installCmd], { timeout: 120000 });
    if (result.success) {
      log('success', 'Node.js installed successfully');
      return true;
    } else {
      log('error', `Node.js installation failed: ${result.error}`);
      return false;
    }
  } else if (isCentOS) {
    log('info', 'Detected CentOS/RHEL system');
    
    const installCmd = `
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && \
      yum install -y nodejs
    `;
    
    const result = runCommand('bash', ['-c', installCmd], { timeout: 120000 });
    if (result.success) {
      log('success', 'Node.js installed successfully');
      return true;
    } else {
      log('error', `Node.js installation failed: ${result.error}`);
      return false;
    }
  } else {
    // 通用安装：使用nvm
    log('info', 'Using nvm for installation...');
    
    const nvmInstall = `
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && \
      export NVM_DIR="$HOME/.nvm" && \
      [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh" && \
      nvm install 20 && \
      nvm use 20
    `;
    
    const result = runCommand('bash', ['-c', nvmInstall], { timeout: 180000 });
    if (result.success) {
      log('success', 'Node.js installed via nvm');
      // 添加到.bashrc
      runCommand('bash', ['-c', 'echo "export NVM_DIR=\\"$HOME/.nvm\\"" >> ~/.bashrc']);
      runCommand('bash', ['-c', 'echo "[ -s \\"$NVM_DIR/nvm.sh\\" ] && \\\. \\"$NVM_DIR/nvm.sh\\"" >> ~/.bashrc']);
      return true;
    } else {
      log('error', `nvm installation failed: ${result.error}`);
      return false;
    }
  }
}

async function installOpenClaw() {
  log('info', 'Installing OpenClaw...');
  
  // 方法1: npm全局安装
  log('info', 'Trying npm global install...');
  let result = runCommand('npm', ['install', '-g', 'openclaw'], { timeout: 120000 });
  
  if (result.success) {
    log('success', 'OpenClaw installed via npm');
    return true;
  }
  
  // 方法2: 使用npx（如果npm全局失败）
  log('warn', 'Global install failed, trying alternative methods...');
  
  // 检查是否有预编译二进制
  const binaryPaths = [
    '/usr/local/bin/openclaw',
    '/usr/bin/openclaw',
    join(homedir(), '.local/bin/openclaw')
  ];
  
  for (const path of binaryPaths) {
    if (existsSync(path)) {
      log('success', `Found existing OpenClaw at ${path}`);
      // 添加到PATH
      const profile = existsSync(join(homedir(), '.bashrc')) ? '.bashrc' : '.profile';
      runCommand('bash', ['-c', `echo 'export PATH="${path.replace('/openclaw', '')}:$PATH"' >> ~/${profile}`]);
      return true;
    }
  }
  
  log('error', 'OpenClaw installation failed. Please install manually:');
  log('info', '  npm install -g openclaw');
  log('info', '  or visit: https://docs.openclaw.ai/installation');
  return false;
}

async function configureFirewall() {
  log('info', 'Configuring firewall...');
  
  // 检查ufw
  const ufwResult = runCommand('which', ['ufw'], { silent: true });
  if (ufwResult.success) {
    log('info', 'UFW detected, opening ports 10001-10010...');
    runCommand('ufw', ['allow', '10001:10010/tcp']);
    log('success', 'UFW rules added');
    return true;
  }
  
  // 检查firewalld
  const firewallCmd = runCommand('which', ['firewall-cmd'], { silent: true });
  if (firewallCmd.success) {
    log('info', 'Firewalld detected, opening ports...');
    runCommand('firewall-cmd', ['--permanent', '--add-port=10001-10010/tcp']);
    runCommand('firewall-cmd', ['--reload']);
    log('success', 'Firewalld rules added');
    return true;
  }
  
  // 检查iptables
  const iptablesResult = runCommand('which', ['iptables'], { silent: true });
  if (iptablesResult.success) {
    log('info', 'iptables detected, adding rules...');
    for (let port = 10001; port <= 10010; port++) {
      runCommand('iptables', ['-I', 'INPUT', '-p', 'tcp', '--dport', `${port}`, '-j', 'ACCEPT']);
    }
    log('success', 'iptables rules added');
    return true;
  }
  
  log('warn', 'No recognized firewall found. Please manually open ports 10001-10010.');
  return false;
}

async function installSilkTalk() {
  log('info', 'Installing SilkTalk...');
  
  const targetDir = process.argv[2] || join(homedir(), 'silktalk-verify');
  
  // 检查是否已存在
  if (existsSync(targetDir)) {
    log('warn', `Directory ${targetDir} already exists`);
    const packageJson = join(targetDir, 'package.json');
    if (existsSync(packageJson)) {
      log('info', 'Existing installation found, updating...');
      process.chdir(targetDir);
      const result = runCommand('npm', ['install'], { timeout: 120000 });
      if (result.success) {
        log('success', 'SilkTalk updated successfully');
        return true;
      }
    }
  }
  
  // 从源复制（假设脚本在项目中运行）
  const sourceDir = process.cwd();
  log('info', `Copying from ${sourceDir} to ${targetDir}...`);
  
  const copyResult = runCommand('cp', ['-r', sourceDir, targetDir]);
  if (!copyResult.success) {
    log('error', `Copy failed: ${copyResult.error}`);
    return false;
  }
  
  process.chdir(targetDir);
  
  // 安装依赖
  log('info', 'Installing dependencies...');
  const installResult = runCommand('npm', ['install', '--production'], { timeout: 180000 });
  
  if (installResult.success) {
    log('success', 'SilkTalk installed successfully');
    log('info', `Installation path: ${targetDir}`);
    return true;
  } else {
    log('error', `Installation failed: ${installResult.error}`);
    return false;
  }
}

async function createLauncher() {
  log('info', 'Creating launcher script...');
  
  const launcherContent = `#!/bin/bash
# SilkTalk Launcher

cd "$(dirname "$0")"

NODE=node
OPENCLAW=openclaw

# Check if running in special environments
if [ -f ".nvmrc" ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
fi

# Parse arguments
NAME="${1:-node}"
PORT="${2:-0}"
BOOTSTRAP="${3:-}"

echo "🚀 Starting SilkTalk node: $NAME"

if [ -n "$BOOTSTRAP" ]; then
  exec $NODE src/index.js --name "$NAME" --port "$PORT" --bootstrap "$BOOTSTRAP"
else
  exec $NODE src/index.js --name "$NAME" --port "$PORT"
fi
`;
  
  const launcherPath = join(process.cwd(), 'start.sh');
  import('fs').then(fs => {
    fs.writeFileSync(launcherPath, launcherContent);
    runCommand('chmod', ['+x', launcherPath]);
    log('success', `Launcher created: ${launcherPath}`);
    log('info', 'Usage: ./start.sh <name> <port> [bootstrap]');
  });
}

async function main() {
  console.log('🔧 SilkTalk Auto Installer\n');
  
  // 加载检查结果
  const checks = await loadCheckResults();
  
  if (!checks) {
    log('warn', 'No check results found. Run check-env.js first.');
    log('info', '  node scripts/check-env.js');
    
    // 继续执行，但会检查所有项目
  }
  
  let success = true;
  
  // 安装Node.js（如果需要）
  if (!checks?.node?.installed) {
    success = await installNode() && success;
  } else {
    log('success', 'Node.js already installed, skipping');
  }
  
  // OpenClaw处理（即使已安装也尝试确保可用）
  if (!checks?.openclaw?.installed) {
    success = await installOpenClaw() && success;
  } else {
    log('success', 'OpenClaw already installed, skipping');
  }
  
  // 配置防火墙
  await configureFirewall();
  
  // 安装SilkTalk
  success = await installSilkTalk() && success;
  
  // 创建启动器
  await createLauncher();
  
  // 最终报告
  console.log('\n' + '='.repeat(50));
  if (success) {
    log('success', '✅ Installation completed!');
    log('info', 'Next steps:');
    log('info', '  1. cd ~/silktalk-verify');
    log('info', '  2. ./start.sh nodeA 10001');
    log('info', '  3. In another terminal: ./start.sh nodeB 10002 /ip4/127.0.0.1/tcp/10001/p2p/<PEER_ID>');
  } else {
    log('error', '❌ Installation completed with errors');
    log('info', 'Please check the logs above and fix the issues.');
    process.exit(1);
  }
}

main().catch(err => {
  log('error', `Installer failed: ${err.message}`);
  process.exit(1);
});
