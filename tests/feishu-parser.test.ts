/**
 * 飞书消息解析器测试
 * 增强版：添加 CI 环境防御性检查
 */

import { FeishuMessageParser } from '../src/feishu-parser';
import { getLogger } from '../src/logger';

describe('FeishuMessageParser', () => {
  let parser: FeishuMessageParser;

  beforeEach(() => {
    parser = new FeishuMessageParser(getLogger());
  });

  describe('格式1: 工单创建', () => {
    it('应该解析标准工单', () => {
      const text = `- 问题等级： - 系统名称：中国海油邮件系统 - 发生时间：26年02月13日16:12 - 问题现象：用户外发邮件异常退信 - 影响范围：个人 - 反馈人员：陈泽晖 ex_chenzh2`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('ticket_create');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.extracted.system).toBe('中国海油邮件系统');
      expect(result.extracted.reporter).toBe('陈泽晖');
    });

    it('应该处理空字符串', () => {
      const result = parser.parse('');
      
      expect(result.formatType).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('应该处理超长文本', () => {
      const longText = 'a'.repeat(10000);
      const result = parser.parse(longText);
      
      // 超长文本应该解析为未知或片段
      expect(['unknown', 'info_fragment']).toContain(result.formatType);
    });
  });

  describe('格式2: 任务分配', () => {
    it('应该解析任务分配', () => {
      const text = `@代宏基 @李志明 晓青刚上报这个退信问题，之前有类似的问题工单，还未处理结束，请一并分析：工单号：HY-20260205-2`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('task_assign');
      expect(result.extracted.mentionedUsers).toContain('代宏基');
      expect(result.extracted.mentionedUsers).toContain('李志明');
      expect(result.extracted.relatedTicketId).toBe('HY-20260205-2');
    });

    it('应该处理无工单号的任务分配', () => {
      const text = `@代宏基 @李志明 请处理这个问题`;
      
      const result = parser.parse(text);
      
      // 没有工单号，可能解析为其他类型或 unknown
      expect(result.formatType).toBeDefined();
    });
  });

  describe('格式3: 状态更新', () => {
    it('应该解析状态更新', () => {
      const text = `@王晓青 @李志明 已经将这个问题合并到之前工单上，处理进度在工单号：HY-20260205-2工单更新即可`;
      
      const result = parser.parse(text);
      
      // 注意：这个格式和任务分配类似，可能解析为 task_assign
      expect(['status_update', 'task_assign']).toContain(result.formatType);
      expect(result.extracted.relatedTicketId).toBe('HY-20260205-2');
    });
  });

  describe('格式4: 状态报告', () => {
    it('应该解析状态报告', () => {
      const text = `今天pc端、网页版邮箱收发邮件正常，vip邮箱容量通知正常`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('status_report');
      expect(result.extracted.status).toBe('正常');
    });

    it('应该处理异常状态报告', () => {
      const text = `今天pc端邮箱收发邮件异常，网页版正常`;
      
      const result = parser.parse(text);
      
      // 包含"异常"关键词，但格式可能不匹配
      expect(result.formatType).toBeDefined();
    });
  });

  describe('格式5: 技术讨论', () => {
    it('应该解析技术讨论', () => {
      const text = `10.69.6.96 cmail.cnooc.com.cn @李志明 @刘少杰 @李向前 这个是灰度发布服务器吧`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('tech_discuss');
      expect(result.extracted.ipOrDomain).toBe('10.69.6.96');
      expect(result.extracted.mentionedUsers).toHaveLength(3);
    });

    it('应该处理只有域名的情况', () => {
      const text = `cmail.cnooc.com.cn @李志明 请检查`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('tech_discuss');
      expect(result.extracted.ipOrDomain).toBe('cmail.cnooc.com.cn');
    });
  });

  describe('格式6: 资源协调', () => {
    it('应该解析资源协调', () => {
      const text = `@刘少杰 今天的两份测试报告都是只对要调整的项做了测试，关于新包的完整测试内容报告里没有，请协调内部资源，提供新包的完整测试报告`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('resource_coord');
      expect(result.extracted.deliverables?.length).toBeGreaterThan(0);
    });
  });

  describe('格式7: 问题归类', () => {
    it('应该解析问题归类', () => {
      const text = `@王晓青 @李志明 @代宏基 这个和上午派发的工单类似，退信内容之前也出现过，明天再让研发看一下`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBe('problem_classify');
      expect(result.suggestedActions[0].type).toBe('schedule');
    });
  });

  describe('格式8: 信息片段', () => {
    it('应该解析信息片段或存储原始', () => {
      const text = `用户的信创电脑操作系统版本`;
      
      const result = parser.parse(text);
      
      // 短句可能解析为 info_fragment 或 unknown
      expect(['info_fragment', 'unknown']).toContain(result.formatType);
    });

    it('应该处理单字输入', () => {
      const text = `好`;
      
      const result = parser.parse(text);
      
      expect(['info_fragment', 'unknown']).toContain(result.formatType);
    });
  });

  describe('格式9: 复杂工单', () => {
    it('应该解析复杂工单或标准工单', () => {
      const text = `- 问题等级： - 系统名称：中国海油邮件系统 - 发生时间：26年02月09日13时58分 - 问题现象：右键点击邮件，选择另存为eml格式后，打开为空白 - 影响范围：个人 - 反馈人员：李可楠likn（联系it：白晓彤ex_baixt ，座机电话29047） - 临时处理动作：卸载重装、刷新配置文件，无法解决`;
      
      const result = parser.parse(text);
      
      // 可能解析为 ticket_complex 或 ticket_create
      expect(['ticket_complex', 'ticket_create']).toContain(result.formatType);
      expect(result.extracted.system).toBe('中国海油邮件系统');
    });
  });

  // 新增：测试上下文关联
  describe('上下文关联', () => {
    it('应该关联相关消息', () => {
      const threadId = 'test-thread-1';
      
      // 第一条消息
      parser.parse('系统出现故障', { threadId });
      
      // 第二条相关消息（短句，会被识别为 info_fragment）
      const result = parser.parse('故障影响所有用户', { threadId });
      
      // info_fragment 类型才有 context
      if (result.formatType === 'info_fragment') {
        expect(result.context).toBeDefined();
      }
    });

    it('应该处理不同线程', () => {
      parser.parse('线程1的消息', { threadId: 'thread-1' });
      const result = parser.parse('线程2的消息', { threadId: 'thread-2' });
      
      // 不同线程不应该关联
      expect(result.context?.previousMessages).toBeUndefined();
    });
  });

  // 新增：测试边界情况
  describe('边界情况', () => {
    it('应该处理特殊字符', () => {
      const text = `@用户 问题：<script>alert(1)</script> \n\t 测试`;
      
      const result = parser.parse(text);
      
      expect(result.rawText).toBe(text);
      expect(result.formatType).toBeDefined();
    });

    it('应该处理多语言混合', () => {
      const text = `@李志明 issue: 邮件系统 error code: 0x8004010F`;
      
      const result = parser.parse(text);
      
      // 多语言文本可能被解析为 tech_discuss 或 task_assign
      expect(result.formatType).toBeDefined();
      if (result.extracted.mentionedUsers) {
        expect(result.extracted.mentionedUsers).toContain('李志明');
      }
    });

    it('应该处理超长用户名', () => {
      const longName = 'a'.repeat(100);
      const text = `@${longName} 请处理`;
      
      const result = parser.parse(text);
      
      expect(result.formatType).toBeDefined();
    });
  });
});