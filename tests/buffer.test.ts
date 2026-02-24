/**
 * Buffer 模块测试
 * 增强版：添加 CI 环境防御性检查
 */

import { BufferedWriter, Event } from '../src/buffer';

describe('BufferedWriter', () => {
  let writer: BufferedWriter;

  beforeEach(async () => {
    writer = new BufferedWriter({
      maxSize: 10,
      flushIntervalMs: 10000, // 长间隔，手动控制刷盘
      dbPath: ':memory:',
    });
    // 等待初始化 - 增加等待时间以应对 CI 较慢的环境
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(async () => {
    if (writer) {
      await writer.close();
    }
  });

  it('应该缓冲写入', async () => {
    const event: Event = {
      timestamp: new Date(),
      source: 'test',
      type: 'test',
      actor: 'tester',
    };

    await writer.write(event);
    
    const stats = writer.getStats();
    expect(stats.buffered).toBe(1);
  });

  it('应该批量刷盘', async () => {
    // 写入10条，触发刷盘
    const writePromises: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      writePromises.push(writer.write({
        timestamp: new Date(),
        source: 'test',
        type: 'test',
        actor: `user${i}`,
      }));
    }
    
    // 等待所有写入完成
    await Promise.all(writePromises);

    // 等待刷盘完成 - 增加等待时间
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const stats = writer.getStats();
    expect(stats.buffered).toBe(0); // 已刷盘
  });

  it('应该手动刷盘', async () => {
    await writer.write({
      timestamp: new Date(),
      source: 'test',
      type: 'test',
    });

    await writer.flush();
    
    const stats = writer.getStats();
    expect(stats.buffered).toBe(0);
  });

  // 新增：测试并发写入
  it('应该处理并发写入', async () => {
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < 20; i++) {
      promises.push(
        writer.write({
          timestamp: new Date(),
          source: 'test',
          type: 'test',
          actor: `concurrent_user${i}`,
        })
      );
    }
    
    await Promise.all(promises);
    
    // 等待可能的刷盘
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const stats = writer.getStats();
    // 缓冲应该为空或小于20（部分已刷盘）
    expect(stats.buffered).toBeLessThan(20);
  });

  // 新增：测试重复刷盘不会出错
  it('应该允许重复刷盘', async () => {
    await writer.write({
      timestamp: new Date(),
      source: 'test',
      type: 'test',
    });

    await writer.flush();
    await writer.flush(); // 第二次刷盘应该无操作
    await writer.flush(); // 第三次刷盘应该无操作
    
    const stats = writer.getStats();
    expect(stats.buffered).toBe(0);
  });

  // 新增：测试空刷盘不会出错
  it('应该允许空刷盘', async () => {
    await writer.flush(); // 空缓冲刷盘
    
    const stats = writer.getStats();
    expect(stats.buffered).toBe(0);
  });
});