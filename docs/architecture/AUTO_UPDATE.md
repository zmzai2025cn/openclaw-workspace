# 客户端自动更新机制

## 问题
- 客户端版本分散
- 新功能无法触达用户
- 安全补丁更新困难

## 方案：增量更新 + 灰度发布

```
┌─────────────────────────────────────────┐
│           版本服务器                     │
│  /api/version/latest → 1.0.1           │
│  /api/version/1.0.1/patch → 增量包      │
│  /api/version/1.0.1/full → 完整包       │
└─────────────────┬───────────────────────┘
                  │ 检查更新
┌─────────────────▼───────────────────────┐
│              客户端                      │
│  1. 启动时检查版本                        │
│  2. 下载增量包                            │
│  3. 校验签名                              │
│  4. 热更新或重启更新                       │
└─────────────────────────────────────────┘
```

## 实现

```typescript
// src/update/updater.ts
import { autoUpdater } from 'electron-updater';
import crypto from 'crypto';

export class ClientUpdater {
  private currentVersion: string;
  private updateServer: string;

  constructor(config: { version: string; updateServer: string }) {
    this.currentVersion = config.version;
    this.updateServer = config.updateServer;
  }

  // 检查更新
  async checkForUpdates(): Promise<UpdateInfo | null> {
    const response = await fetch(`${this.updateServer}/api/version/latest`);
    const latest = await response.json();

    if (this.compareVersion(latest.version, this.currentVersion) > 0) {
      return {
        version: latest.version,
        releaseNotes: latest.notes,
        mandatory: latest.mandatory || false,
        downloadUrl: this.getDownloadUrl(latest.version),
      };
    }
    return null;
  }

  // 下载并安装更新
  async downloadAndInstall(update: UpdateInfo): Promise<void> {
    // 1. 下载更新包
    const updatePath = await this.downloadUpdate(update.downloadUrl);

    // 2. 校验签名
    const valid = await this.verifySignature(updatePath, update.signature);
    if (!valid) {
      throw new Error('Update signature verification failed');
    }

    // 3. 安装
    if (update.mandatory) {
      // 强制更新：立即重启
      await this.installAndRestart(updatePath);
    } else {
      // 可选更新：提示用户
      this.showUpdateNotification(update);
    }
  }

  // 灰度发布检查
  async isUpdateAllowed(userId: string, version: string): Promise<boolean> {
    // 根据用户ID哈希决定是否在灰度范围
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const bucket = parseInt(hash.substring(0, 4), 16) % 100;
    
    // 获取该版本的灰度比例
    const rollout = await this.getRolloutConfig(version);
    return bucket < rollout.percentage;
  }

  // 版本对比
  private compareVersion(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

// Electron集成
export function setupAutoUpdater(): void {
  // 开发环境禁用
  if (process.env.NODE_ENV === 'development') return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', () => {
    // 静默安装或提示用户
    dialog.showMessageBox({
      type: 'info',
      title: '更新就绪',
      message: '新版本已下载，是否现在安装？',
      buttons: ['立即安装', '稍后'],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}
```

## 版本管理策略

| 版本类型 | 说明 | 更新策略 |
|---------|------|----------|
| Major | 重大更新，可能不兼容 | 用户确认后更新 |
| Minor | 新功能 | 自动更新，可延迟 |
| Patch | Bug修复、安全补丁 | 强制自动更新 |

## 灰度发布流程

```
v1.0.1 发布
    │
    ▼ 5% 用户
  观察24小时
    │
    ▼ 无异常
  20% 用户
    │
    ▼ 无异常
  50% 用户
    │
    ▼ 无异常
  100% 用户
```

## 回滚机制

```typescript
async rollback(targetVersion: string): Promise<void> {
  // 1. 下载旧版本
  const oldVersion = await this.downloadVersion(targetVersion);
  
  // 2. 备份当前版本
  await this.backupCurrentVersion();
  
  // 3. 安装旧版本
  await this.installVersion(oldVersion);
  
  // 4. 上报回滚事件
  await this.reportRollback(targetVersion);
}
```