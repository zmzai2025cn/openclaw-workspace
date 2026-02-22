#!/bin/bash
# monitor.sh - 连接状态监控脚本
# 实时监控网络连接和节点状态

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
INTERVAL=${1:-5}  # 默认5秒刷新
LOG_FILE=${2:-"connection-monitor.log"}

# 清屏函数
clear_screen() {
    printf "\033[2J\033[H"
}

# 获取连接统计
get_connection_stats() {
    echo -e "${BLUE}=== TCP连接统计 ===${NC}"
    
    # 总连接数
    local total=$(ss -t | grep -c ESTAB 2>/dev/null || echo 0)
    echo -e "活跃TCP连接: ${CYAN}$total${NC}"
    
    # 按状态统计
    echo ""
    echo "连接状态分布:"
    ss -tan 2>/dev/null | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn | head -10 || echo "  无法获取"
    
    # 按端口统计
    echo ""
    echo "端口连接数 (前10):"
    ss -tan 2>/dev/null | awk 'NR>1 {print $4}' | cut -d: -f2 | sort | uniq -c | sort -rn | head -10 || echo "  无法获取"
}

# 获取网络接口统计
get_interface_stats() {
    echo ""
    echo -e "${BLUE}=== 网络接口统计 ===${NC}"
    
    if command -v ifconfig &>/dev/null; then
        ifconfig | grep -E "(RX|TX) (packets|bytes)" | head -20
    elif command -v ip &>/dev/null; then
        ip -s link show | grep -E "(RX|TX):" -A 3 | head -30
    else
        echo "  无法获取接口统计"
    fi
}

# 获取监听端口
get_listening_ports() {
    echo ""
    echo -e "${BLUE}=== 监听端口 ===${NC}"
    
    ss -tlnp 2>/dev/null | head -20 || netstat -tlnp 2>/dev/null | head -20 || echo "  无法获取"
}

# 检查特定服务
check_services() {
    echo ""
    echo -e "${BLUE}=== 服务状态 ===${NC}"
    
    # 检查常见P2P端口
    local ports=(4001 4002 4003 8080 8081 9001 9002)
    
    for port in "${ports[@]}"; do
        if ss -tln | grep -q ":$port "; then
            local pid=$(ss -tlnp | grep ":$port " | head -1 | grep -oP 'pid=\K[0-9]+')
            local proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo -e "  ${GREEN}●${NC} 端口 $port - $proc (PID: $pid)"
        else
            echo -e "  ${RED}○${NC} 端口 $port - 未监听"
        fi
    done
}

# 获取系统负载
get_system_load() {
    echo ""
    echo -e "${BLUE}=== 系统负载 ===${NC}"
    
    # CPU负载
    local load=$(uptime | awk -F'load average:' '{print $2}')
    echo -e "负载: ${CYAN}$load${NC}"
    
    # 内存使用
    local mem_info=$(free -h | grep Mem)
    local mem_used=$(echo "$mem_info" | awk '{print $3}')
    local mem_total=$(echo "$mem_info" | awk '{print $2}')
    echo -e "内存: ${CYAN}$mem_used / $mem_total${NC}"
    
    # 网络连接追踪表
    if [ -f /proc/sys/net/netfilter/nf_conntrack_count ]; then
        local conntrack=$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0)
        local conntrack_max=$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo 0)
        echo -e "连接追踪: ${CYAN}$conntrack / $conntrack_max${NC}"
    fi
}

# 主监控循环
main() {
    clear_screen
    
    echo -e "${GREEN}SilkTalk Pro 连接监控${NC}"
    echo -e "刷新间隔: ${CYAN}${INTERVAL}秒${NC} | 日志: ${CYAN}$LOG_FILE${NC}"
    echo "按 Ctrl+C 退出"
    echo ""
    
    while true; do
        # 保存光标位置
        tput sc 2>/dev/null || true
        
        # 移动光标到第6行
        tput cup 5 0 2>/dev/null || clear_screen
        
        local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        echo -e "${YELLOW}更新时间: $timestamp${NC}"
        echo ""
        
        get_connection_stats
        get_interface_stats
        get_listening_ports
        check_services
        get_system_load
        
        # 记录到日志文件
        {
            echo "[$timestamp]"
            ss -tan 2>/dev/null | wc -l | xargs echo "TCP connections:"
            ss -tln 2>/dev/null | wc -l | xargs echo "Listening ports:"
            uptime
            echo "---"
        } >> "$LOG_FILE"
        
        # 限制日志文件大小
        if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 10000 ]; then
            tail -n 5000 "$LOG_FILE" > "$LOG_FILE.tmp"
            mv "$LOG_FILE.tmp" "$LOG_FILE"
        fi
        
        sleep "$INTERVAL"
    done
}

# 单次模式
if [ "${1:-}" = "-o" ] || [ "${1:-}" = "--once" ]; then
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}更新时间: $timestamp${NC}"
    echo ""
    get_connection_stats
    get_interface_stats
    get_listening_ports
    check_services
    get_system_load
    exit 0
fi

# 帮助
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
    echo "SilkTalk Pro 连接监控"
    echo ""
    echo "用法: $0 [选项] [间隔秒数] [日志文件]"
    echo ""
    echo "选项:"
    echo "  -o, --once     运行一次后退出"
    echo "  -h, --help     显示帮助"
    echo ""
    echo "示例:"
    echo "  $0                    # 持续监控，5秒刷新"
    echo "  $0 10                 # 持续监控，10秒刷新"
    echo "  $0 5 /var/log/monitor.log  # 指定日志文件"
    echo "  $0 -o                 # 单次运行"
    exit 0
fi

# 捕获Ctrl+C
trap 'echo -e "\n${YELLOW}监控已停止${NC}"; exit 0' INT

main
