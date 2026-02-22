/**
 * OpenClaw Agent Bridge - Minimal
 */

import { spawn } from 'child_process';

export class OpenClawBridge {
  constructor(opts = {}) {
    this.path = opts.path || 'openclaw';
    this.timeout = opts.timeout || 60000;
  }

  async execute(cmd, timeout = this.timeout) {
    if (!cmd || !cmd.trim()) {
      throw new Error('Empty command');
    }
    // Simple parsing: split by space, basic quote support
    const args = cmd.split(' ').filter(Boolean).map(s => s.replace(/^["']|["']$/g, ''));

    return new Promise((resolve, reject) => {
      const child = spawn(this.path, ['agent', ...args], { timeout });
      let out = '', err = '';

      const cleanup = () => {
        child.stdout.removeAllListeners();
        child.stderr.removeAllListeners();
        child.removeAllListeners();
      };

      child.stdout.on('data', d => out += d);
      child.stderr.on('data', d => err += d);
      child.on('close', code => {
        cleanup();
        resolve({ output: out || err, exitCode: code, success: code === 0 });
      });
      child.on('error', e => {
        cleanup();
        reject(e);
      });
    });
  }

  async isAvailable() {
    try { return (await this.execute('--help', 5000)).success; } catch { return false; }
  }
}
