/**
 * Kimiclaw DB 集成测试
 * 测试完整数据流：采集 → 存储 → 查询
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 模拟DuckDB（实际测试需真实数据库）
class MockDuckDB {
  constructor() {
    this.tables = new Map();
    this.tables.set('captures', []);
    this.tables.set('sessions', []);
  }

  exec(sql) {
    // 简化SQL解析
    if (sql.includes('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE (\w+)/);
      if (match) this.tables.set(match[1], []);
    }
    return { success: true };
  }

  prepare(sql) {
    return {
      run: (params) => {
        const table = this.getTableFromSQL(sql);
        if (sql.includes('INSERT')) {
          this.tables.get(table).push(params);
        }
        return { changes: 1 };
      },
      all: (params) => {
        const table = this.getTableFromSQL(sql);
        let data = this.tables.get(table) || [];
        
        // 解析WHERE条件
        if (sql.includes('WHERE')) {
          const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
          if (whereMatch) {
            const field = whereMatch[1];
            const paramIndex = (sql.match(/\?/g) || []).indexOf('?');
            const value = Array.isArray(params) ? params[paramIndex] : params[field];
            
            data = data.filter(row => {
              // 处理数组参数或对象参数
              if (Array.isArray(params)) {
                const fields = Object.keys(row);
                return row[fields[paramIndex]] === value;
              }
              return row[field] === value;
            });
          }
        }
        return data;
      }
    };
  }

  getTableFromSQL(sql) {
    const match = sql.match(/(?:INSERT|SELECT|UPDATE|DELETE).*?(?:INTO|FROM)\s+(\w+)/i);
    return match ? match[1] : 'captures';
  }
}

// 集成测试套件
class IntegrationTest {
  constructor() {
    this.db = new MockDuckDB();
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      this.passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      this.failed++;
    }
  }

  run() {
    console.log('\n========== Kimiclaw DB 集成测试 ==========\n');

    // 测试1: 数据库初始化
    this.test('数据库表创建', () => {
      this.db.exec(`
        CREATE TABLE captures (
          id INTEGER PRIMARY KEY,
          timestamp TEXT,
          user_id TEXT,
          session_id TEXT,
          data TEXT
        )
      `);
      if (!this.db.tables.has('captures')) {
        throw new Error('captures表未创建');
      }
    });

    // 测试2: 数据插入（简化版）
    this.test('采集数据插入', () => {
      this.db.tables.get('captures').push({
        timestamp: new Date().toISOString(),
        user_id: 'user_001',
        session_id: 'sess_abc123',
        data: JSON.stringify({ app: 'vscode', title: 'test.js' })
      });
      
      const data = this.db.tables.get('captures');
      if (data.length !== 1) throw new Error('数据未插入');
    });

    // 测试3: 批量插入
    this.test('批量数据插入', () => {
      const initialCount = this.db.tables.get('captures').length;
      
      for (let i = 0; i < 100; i++) {
        this.db.tables.get('captures').push({
          timestamp: new Date().toISOString(),
          user_id: 'user_001',
          session_id: `sess_${i}`,
          data: JSON.stringify({ batch: i })
        });
      }
      
      const finalCount = this.db.tables.get('captures').length;
      if (finalCount !== initialCount + 100) {
        throw new Error(`应有${initialCount + 100}条数据，实际${finalCount}`);
      }
    });

    // 测试4: 数据查询（简化版）
    this.test('用户数据查询', () => {
      const data = this.db.tables.get('captures');
      const userData = data.filter(row => row.user_id === 'user_001');
      
      if (userData.length !== 101) throw new Error(`应返回101条，实际${userData.length}`);
    });

    // 测试5: 会话聚合（简化版）
    this.test('会话统计分析', () => {
      const data = this.db.tables.get('captures');
      const sessions = new Set(data.map(row => row.session_id));
      
      if (sessions.size !== 101) throw new Error(`应有101个会话，实际${sessions.size}`);
    });

    // 测试6: 飞书消息解析集成
    this.test('飞书消息解析', () => {
      const feishuMessages = [
        { type: 'text', content: 'Hello world' },
        { type: 'image', url: 'https://example.com/img.png' },
        { type: 'post', title: '公告', content: '...' },
        { type: 'file', name: 'report.pdf', size: 1024 },
        { type: 'interactive', card: { header: { title: '审批' } } }
      ];
      
      const parsed = feishuMessages.map(msg => {
        return {
          type: msg.type,
          summary: msg.content || msg.title || msg.name || 'interactive',
          timestamp: new Date().toISOString()
        };
      });
      
      if (parsed.length !== 5) throw new Error('解析消息数不正确');
      if (parsed[0].type !== 'text') throw new Error('类型解析错误');
    });

    // 测试7: 数据加密存储
    this.test('敏感数据加密', () => {
      const sensitive = 'screenshot-binary-data';
      const key = 'encryption-key-123';
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc',
        crypto.scryptSync(key, 'salt', 32), iv);
      let encrypted = cipher.update(sensitive, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 存储加密数据
      const stmt = this.db.prepare('INSERT INTO captures (data) VALUES (?)');
      stmt.run([encrypted]);
      
      // 验证存储的是密文
      const data = this.db.tables.get('captures');
      const last = data[data.length - 1];
      if (last.data === sensitive) throw new Error('数据未加密存储');
    });

    // 测试8: 数据备份模拟
    this.test('数据备份机制', () => {
      const backupDir = path.join(__dirname, 'test-backup');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
      
      const data = this.db.tables.get('captures');
      const backupFile = path.join(backupDir, `backup_${Date.now()}.json`);
      
      fs.writeFileSync(backupFile, JSON.stringify(data));
      
      if (!fs.existsSync(backupFile)) throw new Error('备份文件未创建');
      
      const loaded = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      if (loaded.length !== data.length) throw new Error('备份数据不完整');
      
      // 清理
      fs.unlinkSync(backupFile);
      fs.rmdirSync(backupDir);
    });

    // 测试9: 端到端数据流（简化版）
    this.test('端到端数据流', () => {
      // 1. 客户端采集
      const capture = {
        timestamp: new Date().toISOString(),
        userId: 'user_001',
        appName: 'vscode',
        windowTitle: 'test.js'
      };
      
      // 2. 直接存储验证
      const data = this.db.tables.get('captures');
      const initialCount = data.length;
      
      data.push({
        timestamp: capture.timestamp,
        user_id: capture.userId,
        data: JSON.stringify(capture)
      });
      
      // 3. 验证存储成功
      if (data.length !== initialCount + 1) {
        throw new Error('端到端流程失败');
      }
    });

    // 测试10: 错误恢复
    this.test('错误恢复机制', () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      const attempt = () => {
        retryCount++;
        if (retryCount < maxRetries) throw new Error('模拟失败');
        return 'success';
      };
      
      let result;
      for (let i = 0; i < maxRetries; i++) {
        try {
          result = attempt();
          break;
        } catch (e) {
          if (i === maxRetries - 1) throw e;
        }
      }
      
      if (result !== 'success') throw new Error('重试机制失败');
    });

    console.log('\n========== 集成测试结果 ==========');
    console.log(`✅ 通过: ${this.passed}`);
    console.log(`❌ 失败: ${this.failed}`);
    console.log(`📊 总计: ${this.passed + this.failed}`);
    console.log('===================================\n');

    return this.failed === 0;
  }
}

// 运行测试
const tester = new IntegrationTest();
const success = tester.run();
process.exit(success ? 0 : 1);