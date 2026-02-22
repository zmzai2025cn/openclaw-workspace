#!/bin/bash
#==============================================================================
# SilkTalk Mini - 自动化部署测试脚本
# 一键完成：检查、安装、启动、测试
#==============================================================================

set -e

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly NODE_ID="alibot-$(date +%s)"
readonly LOG_FILE="/tmp/silktalk-mini-$(date +%Y%m%d-%H%M%S).log"

# 颜色
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[!]${NC} $*" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[✗]${NC} $*" | tee -a "$LOG_FILE"; }

#==============================================================================
# 步骤1: 环境检查
#==============================================================================
check_env() {
    log "步骤1/5: 环境检查"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js 未安装"
        exit 1
    fi
    
    local node_version
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        error "Node.js 版本过低 (需要 16+), 当前: $(node --version)"
        exit 1
    fi
    
    log "Node.js: $(node --version) ✓"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        error "npm 未安装"
        exit 1
    fi
    log "npm: $(npm --version) ✓"
    
    # 检查网络
    if curl -s --max-time 5 http://www.google.com &> /dev/null || \
       curl -s --max-time 5 http://www.baidu.com &> /dev/null; then
        log "网络连接: 正常 ✓"
    else
        warn "网络连接: 受限 (可能无法下载依赖)"
    fi
    
    # 检查端口
    local port=${PORT:-8080}
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        warn "端口 $port 已被占用，将使用随机端口"
        export PORT=0
    else
        log "端口 $port: 可用 ✓"
    fi
}

#==============================================================================
# 步骤2: 安装依赖
#==============================================================================
install_deps() {
    log "步骤2/5: 安装依赖"
    
    cd "$SCRIPT_DIR"
    
    # 检查是否已有 node_modules
    if [ -d "node_modules/ws" ]; then
        log "依赖已安装，跳过 ✓"
        return 0
    fi
    
    # 创建 package.json
    cat > package.json << 'EOF'
{
  "name": "silktalk-mini",
  "version": "1.0.0",
  "dependencies": {
    "ws": "^8.14.0"
  }
}
EOF
    
    # 安装 ws
    log "正在安装 ws 模块..."
    if npm install --silent 2>&1 | tee -a "$LOG_FILE"; then
        log "依赖安装完成 ✓"
    else
        error "依赖安装失败"
        exit 1
    fi
}

#==============================================================================
# 步骤3: 启动节点
#==============================================================================
start_node() {
    log "步骤3/5: 启动节点"
    
    cd "$SCRIPT_DIR"
    
    # 检查 mini-silktalk.js
    if [ ! -f "mini-silktalk.js" ]; then
        error "mini-silktalk.js 不存在"
        exit 1
    fi
    
    # 获取 IP
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
    local port=${PORT:-8080}
    
    log "节点信息:"
    log "  ID: $NODE_ID"
    log "  IP: $ip"
    log "  Port: $port"
    log "  WebSocket: ws://$ip:$port"
    
    # 保存节点信息
    cat > node-info.json << EOF
{
  "nodeId": "$NODE_ID",
  "ip": "$ip",
  "port": $port,
  "websocket": "ws://$ip:$port",
  "startedAt": "$(date -Iseconds)"
}
EOF
    
    log "节点信息已保存到 node-info.json"
    
    # 后台启动节点
    log "正在启动节点..."
    nohup node mini-silktalk.js > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo $pid > node.pid
    
    # 等待启动
    sleep 2
    
    # 检查是否启动成功
    if kill -0 $pid 2>/dev/null; then
        log "节点启动成功 (PID: $pid) ✓"
    else
        error "节点启动失败"
        exit 1
    fi
}

#==============================================================================
# 步骤4: 连接测试
#==============================================================================
test_connection() {
    log "步骤4/5: 连接测试"
    
    local target=$1
    
    if [ -z "$target" ]; then
        log "无目标节点，跳过连接测试"
        log "等待其他节点连接到: $(cat node-info.json | grep websocket | cut -d'"' -f4)"
        return 0
    fi
    
    log "测试连接到: $target"
    
    # 创建测试脚本
    cat > test-connect.js << 'EOF'
const WebSocket = require('ws');
const target = process.argv[2];

console.log(`Connecting to ${target}...`);

const ws = new WebSocket(target);

ws.on('open', () => {
  console.log('✓ Connected!');
  ws.send(JSON.stringify({
    type: 'test',
    from: 'alibot-test',
    timestamp: Date.now()
  }));
});

ws.on('message', (data) => {
  console.log('✓ Received:', data.toString());
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.log('✗ Error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('✓ Connection closed');
});

setTimeout(() => {
  console.log('✗ Timeout');
  process.exit(1);
}, 10000);
EOF
    
    if node test-connect.js "$target"; then
        log "连接测试通过 ✓"
    else
        error "连接测试失败"
        return 1
    fi
}

#==============================================================================
# 步骤5: 生成报告
#==============================================================================
generate_report() {
    log "步骤5/5: 生成报告"
    
    local report_file="/tmp/silktalk-mini-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# SilkTalk Mini 部署测试报告

## 基本信息
- 节点ID: $NODE_ID
- 部署时间: $(date -Iseconds)
- 日志文件: $LOG_FILE

## 节点信息
$(cat node-info.json 2>/dev/null || echo "{}" | python3 -m json.tool 2>/dev/null || cat node-info.json)

## 进程状态
$(ps aux | grep mini-silktalk | grep -v grep || echo "未运行")

## 端口监听
$(netstat -tlnp 2>/dev/null | grep node || ss -tlnp 2>/dev/null | grep node || echo "无法获取端口信息")

## 日志摘要
$(tail -20 "$LOG_FILE")

## 下一步
1. 将 WebSocket 地址提供给对方节点
2. 等待对方连接或主动连接对方
3. 验证消息传输

---
生成时间: $(date)
EOF
    
    log "报告已生成: $report_file"
    
    # 显示关键信息
    echo ""
    echo "========================================"
    echo "  SilkTalk Mini 部署完成"
    echo "========================================"
    echo ""
    echo "节点ID: $NODE_ID"
    echo "WebSocket: $(cat node-info.json | grep websocket | cut -d'"' -f4)"
    echo "日志: $LOG_FILE"
    echo "报告: $report_file"
    echo ""
    echo "查看日志: tail -f $LOG_FILE"
    echo "停止节点: kill $(cat node.pid)"
    echo ""
}

#==============================================================================
# 主函数
#==============================================================================
main() {
    local target=$1
    
    echo "========================================"
    echo "  SilkTalk Mini 自动化部署"
    echo "  节点: alibot"
    echo "========================================"
    echo ""
    
    check_env
    install_deps
    start_node
    test_connection "$target"
    generate_report
    
    echo ""
    log "部署测试完成！"
    
    # 保持运行
    if [ -z "$target" ]; then
        echo ""
        echo "节点正在运行，按 Ctrl+C 停止"
        tail -f "$LOG_FILE"
    fi
}

# 处理参数
case "${1:-}" in
    --help|-h)
        echo "用法: $0 [目标WebSocket地址]"
        echo ""
        echo "示例:"
        echo "  $0                    # 启动主节点"
        echo "  $0 ws://1.2.3.4:8080  # 启动并连接目标"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
