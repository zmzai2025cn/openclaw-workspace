#!/bin/bash
# latency-test.sh - 网络延迟测试
# 测试到各种服务器的延迟和连通性

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 测试目标
TEST_SERVERS=(
    "8.8.8.8:Google DNS"
    "1.1.1.1:Cloudflare DNS"
    "114.114.114.114:国内DNS"
    "baidu.com:百度"
    "google.com:Google"
    "github.com:GitHub"
)

STUN_SERVERS=(
    "stun.l.google.com:19302"
    "stun1.l.google.com:19302"
    "stun.cloudflare.com:3478"
)

# 显示帮助
show_help() {
    echo "SilkTalk Pro 延迟测试工具"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -c, --continuous    持续测试模式"
    echo "  -n, --count NUM     每个目标测试次数 (默认: 5)"
    echo "  -t, --target HOST   测试特定目标"
    echo "  -p, --p2p           测试P2P相关服务器"
    echo "  -h, --help          显示帮助"
    echo ""
    echo "示例:"
    echo "  $0                  # 基础延迟测试"
    echo "  $0 -c               # 持续测试"
    echo "  $0 -n 10            # 每个目标测试10次"
    echo "  $0 -t example.com   # 测试特定主机"
    echo "  $0 -p               # 测试P2P服务器"
}

# 测试单个主机延迟
test_latency() {
    local host=$1
    local count=${2:-5}
    local name=${3:-$host}
    
    echo -e "${CYAN}测试 $name ($host)${NC}"
    
    # 使用ping测试
    local result=$(ping -c "$count" -W 2 "$host" 2>/dev/null | tail -1)
    
    if [ -n "$result" ]; then
        # 解析ping结果
        local avg=$(echo "$result" | grep -oP 'avg[^/]+/\K[0-9.]+' || echo "N/A")
        local min=$(echo "$result" | grep -oP 'min[^/]+/\K[0-9.]+' || echo "N/A")
        local max=$(echo "$result" | grep -oP 'max[^/]+/\K[0-9.]+' || echo "N/A")
        
        if [ "$avg" != "N/A" ]; then
            # 根据延迟显示颜色
            local color=$GREEN
            if (( $(echo "$avg > 200" | bc -l 2>/dev/null || echo 0) )); then
                color=$RED
            elif (( $(echo "$avg > 100" | bc -l 2>/dev/null || echo 0) )); then
                color=$YELLOW
            fi
            
            echo -e "  延迟: ${color}avg=${avg}ms${NC}, min=${min}ms, max=${max}ms"
        else
            echo -e "  ${RED}无法获取延迟数据${NC}"
        fi
        
        # 丢包率
        local loss=$(ping -c "$count" -W 2 "$host" 2>/dev/null | grep -oP '\d+(?=% packet loss)' || echo "100")
        if [ "$loss" = "0" ]; then
            echo -e "  丢包率: ${GREEN}0%${NC}"
        else
            echo -e "  丢包率: ${RED}${loss}%${NC}"
        fi
    else
        echo -e "  ${RED}无法连接到主机${NC}"
    fi
    echo ""
}

# 测试TCP连接延迟
test_tcp_latency() {
    local host=$1
    local port=$2
    local name=$3
    
    echo -e "${CYAN}TCP测试 $name ($host:$port)${NC}"
    
    local start=$(date +%s%N)
    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        local end=$(date +%s%N)
        local latency=$(( (end - start) / 1000000 ))
        
        local color=$GREEN
        if [ $latency -gt 200 ]; then
            color=$RED
        elif [ $latency -gt 100 ]; then
            color=$YELLOW
        fi
        
        echo -e "  连接延迟: ${color}${latency}ms${NC}"
    else
        echo -e "  ${RED}连接失败或超时${NC}"
    fi
    echo ""
}

# 测试DNS解析
test_dns() {
    local domain=$1
    
    echo -e "${CYAN}DNS解析测试: $domain${NC}"
    
    local start=$(date +%s%N)
    local result=$(dig +short "$domain" 2>/dev/null | head -1)
    local end=$(date +%s%N)
    
    if [ -n "$result" ]; then
        local latency=$(( (end - start) / 1000000 ))
        echo -e "  解析结果: ${GREEN}$result${NC}"
        echo -e "  解析耗时: ${CYAN}${latency}ms${NC}"
    else
        echo -e "  ${RED}DNS解析失败${NC}"
    fi
    echo ""
}

# 测试路由路径
test_traceroute() {
    local host=$1
    local name=$2
    
    echo -e "${CYAN}路由路径: $name ($host)${NC}"
    
    if command -v traceroute &>/dev/null; then
        traceroute -m 15 -w 2 "$host" 2>/dev/null | head -15 || echo "  无法完成traceroute"
    elif command -v tracepath &>/dev/null; then
        tracepath -m 15 "$host" 2>/dev/null | head -15 || echo "  无法完成tracepath"
    else
        echo "  traceroute/tracepath 未安装"
    fi
    echo ""
}

# 基础测试
run_basic_tests() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    基础延迟测试${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    for server in "${TEST_SERVERS[@]}"; do
        IFS=':' read -r host name <<< "$server"
        test_latency "$host" 5 "$name"
    done
}

# P2P相关测试
run_p2p_tests() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    P2P服务器测试${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    echo -e "${YELLOW}STUN服务器测试:${NC}"
    for server in "${STUN_SERVERS[@]}"; do
        IFS=':' read -r host port <<< "$server"
        test_tcp_latency "$host" "$port" "STUN $host"
    done
    
    echo ""
    echo -e "${YELLOW}DNS解析测试:${NC}"
    test_dns "stun.l.google.com"
    test_dns "bootstrap.libp2p.io"
}

# 持续测试模式
run_continuous() {
    local count=${1:-5}
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    持续延迟测试 (按Ctrl+C停止)${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    while true; do
        clear
        echo -e "${YELLOW}测试时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        echo ""
        
        for server in "${TEST_SERVERS[@]}"; do
            IFS=':' read -r host name <<< "$server"
            test_latency "$host" "$count" "$name"
        done
        
        echo -e "${YELLOW}下次更新: 10秒后...${NC}"
        sleep 10
    done
}

# 主程序
main() {
    local count=5
    local continuous=false
    local target=""
    local p2p=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--continuous)
                continuous=true
                shift
                ;;
            -n|--count)
                count="$2"
                shift 2
                ;;
            -t|--target)
                target="$2"
                shift 2
                ;;
            -p|--p2p)
                p2p=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                echo "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    if [ "$continuous" = true ]; then
        trap 'echo -e "\n测试已停止"; exit 0' INT
        run_continuous "$count"
    elif [ -n "$target" ]; then
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}    测试目标: $target${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""
        test_latency "$target" "$count"
        test_dns "$target"
        test_traceroute "$target"
    elif [ "$p2p" = true ]; then
        run_p2p_tests
    else
        run_basic_tests
        echo ""
        run_p2p_tests
    fi
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    测试完成${NC}"
    echo -e "${BLUE}========================================${NC}"
}

main "$@"
