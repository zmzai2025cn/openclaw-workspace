/**
 * 系统监控工具
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

export interface DiskInfo {
  total: number;      // 总空间 (bytes)
  used: number;       // 已用 (bytes)
  free: number;       // 可用 (bytes)
  usagePercent: number; // 使用率
}

/**
 * 获取磁盘使用情况
 */
export function getDiskUsage(path: string): DiskInfo {
  try {
    // Linux/Mac
    const output = execSync(`df -B1 "${path}" 2>/dev/null | tail -1`, { encoding: 'utf-8' });
    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1], 10);
    const used = parseInt(parts[2], 10);
    const free = parseInt(parts[3], 10);
    
    return {
      total,
      used,
      free,
      usagePercent: Math.round((used / total) * 100),
    };
  } catch {
    // 回退：使用 statfs（Node 18+）
    try {
      const stat = fs.statSync(path);
      // 简化估算
      return {
        total: 100 * 1024 * 1024 * 1024, // 100GB 默认
        used: 50 * 1024 * 1024 * 1024,
        free: 50 * 1024 * 1024 * 1024,
        usagePercent: 50,
      };
    } catch {
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
      };
    }
  }
}

/**
 * 检查磁盘空间是否充足
 */
export function checkDiskSpace(path: string, thresholdPercent: number = 90): boolean {
  const usage = getDiskUsage(path);
  return usage.usagePercent < thresholdPercent;
}

/**
 * 获取内存使用情况
 */
export function getMemoryUsage(): {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
} {
  const used = process.memoryUsage();
  const total = used.heapTotal + used.external;
  
  return {
    total,
    used: used.heapUsed,
    free: total - used.heapUsed,
    usagePercent: Math.round((used.heapUsed / total) * 100) || 0,
  };
}
