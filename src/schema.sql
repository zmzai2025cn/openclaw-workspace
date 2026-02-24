-- DuckDB Schema for Kimiclaw
-- 时序数据核心表

-- 原始事件表（分区按月）
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(100) PRIMARY KEY,      -- 唯一标识（幂等）
    timestamp TIMESTAMP NOT NULL,
    source VARCHAR(50) NOT NULL,      -- mail/ticket/ad/monitor/im
    type VARCHAR(50) NOT NULL,        -- create/update/alert/message
    actor VARCHAR(100),               -- 操作人
    target VARCHAR(200),              -- 操作对象
    action VARCHAR(100),              -- 具体动作
    status VARCHAR(20),               -- success/fail/pending
    content JSON,                     -- 详细内容
    tags VARCHAR(100)[],              -- 标签数组
    
    -- 分区键
    year_month INTEGER GENERATED ALWAYS AS (
        CAST(strftime('%Y%m', timestamp) AS INTEGER)
    ) STORED
);

-- 创建分区视图（简化查询）
CREATE VIEW IF NOT EXISTS events_latest AS
SELECT * FROM events
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days';

-- 小时聚合表（预计算）
CREATE TABLE IF NOT EXISTS events_hourly (
    hour TIMESTAMP NOT NULL,
    source VARCHAR(50),
    type VARCHAR(50),
    actor VARCHAR(100),
    count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    avg_duration_ms DOUBLE,
    
    PRIMARY KEY (hour, source, type, actor)
);

-- 个人画像表
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(100) PRIMARY KEY,
    role VARCHAR(50),                 -- 账号处理/客服/运维/项目经理
    preferences JSON,                 -- 偏好设置
    common_tasks JSON,                -- 常见任务模式
    workload_stats JSON,              -- 负荷统计
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识库表（解决方案）
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY,
    problem_pattern VARCHAR(500),     -- 问题描述
    solution TEXT,                    -- 解决方案
    source_events INTEGER[],          -- 来源事件ID
    success_rate DOUBLE,              -- 成功率
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 我的操作记录表
CREATE TABLE IF NOT EXISTS kimiclaw_actions (
    id INTEGER PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50),          -- query/execute/notify
    target_user VARCHAR(100),         -- 目标用户
    input_params JSON,                -- 输入参数
    output_result JSON,               -- 输出结果
    status VARCHAR(20),               -- success/fail
    reasoning TEXT                    -- 决策理由
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_events_time ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor);
CREATE INDEX IF NOT EXISTS idx_events_target ON events(target);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_year_month ON events(year_month);

-- 创建分区（示例：当前月）
-- 实际运行时动态创建
-- CREATE TABLE events_202402 PARTITION OF events 
-- FOR VALUES IN (202402);