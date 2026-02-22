#!/bin/bash
# port-check.sh - 端口检查和监听测试
# 用于检查端口是否开放和可连接

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 默认端口范围
START_PORT=${1:-10000}
END_PORT=${2:-10100}
HOST=${3:-127.0.0.1}

show_help() {
    echo "用法: $0 [起始端口] [结束端口] [主机地址]"
    echo ""
    echo "示例:"
    echo "  $0                    # 检查 127.0.0.1:10000-10100"
    echo "  $0 8080 8090          # 检查 127.0.0.1:8080-8090"
    echo "  $0 4001 4005 1.2.3.4  # 检查 1.2.3.4:4001-4005"
    echo ""
    echo "命令选项:"
    echo "  -l, --listen [端口]   # 在指定端口启动监听测试"
    echo "  -c, --connect [主机:端口] # 测试连接到指定地址"
    echo "  -h, --help            # 显示帮助"
}

# 检查单个端口
check_port() {
    local host=$1
    local port=$2
    
    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $host:$port - 开放"
        return 0
    else
        echo -e "${RED}✗${NC} $host:$port - 关闭"
        return 1
    fi
}

# 扫描端口范围
scan_ports() {
    local host=$1
    local start=$2
    local end=$3
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    端口扫描: $host:$start-$end${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    local open_count=0
    
    for ((port=start; port<=end; port++)); do
        if check_port "$host" "$port"; then
            ((open_count++))
        fi
    done
    
    echo ""
    echo -e "扫描完成: 发现 ${GREEN}$open_count${NC} 个开放端口"
}

# 启动监听服务器
test_listen() {
    local port=$1
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    端口监听测试${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "正在启动监听服务器在端口 $port..."
    echo "按 Ctrl+C 停止"
    echo ""
    
    # 使用nc监听
    if command -v nc &>/dev/null; then
        echo "使用 netcat 监听 $port..."
        nc -l -p "$port" -v
    elif command -v nc.traditional &>/dev/null; then
        echo "使用 nc.traditional 监听 $port..."
        nc.traditional -l -p "$port" -v
    else
        # 使用bash内置功能
        echo "使用 bash 监听 $port..."
        while true; do
            { echo -e "HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello, World!"; } | nc -l -p "$port" 2>/dev/null || true
        done
    fi
}

# 测试连接
test_connect() {
    local target=$1
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    连接测试: $target${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    IFS=':' read -r host port <<< "$target"
    
    if [ -z "$port" ]; then
        echo -e "${RED}错误: 请指定端口，格式: 主机:端口${NC}"
        exit 1
    fi
    
    echo "测试连接到 $host:$port..."
    
    # 尝试TCP连接
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ TCP连接成功${NC}"
    else
        echo -e "${RED}✗ TCP连接失败${NC}"
    fi
    
    # 使用nc进行更详细的测试
    if command -v nc &>/dev/null; then
        echo ""
        echo "使用 netcat 进行详细测试:"
        echo "---"
        echo "test" | timeout 3 nc -v "$host" "$port" 2>&1 || echo "连接超时或失败"
        echo "---"
    fi
}

# 检查本地监听端口
check_listening() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    本地监听端口${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    echo "TCP监听端口:"
    ss -tlnp 2>/dev/null | grep LISTEN | head -20 || netstat -tlnp 2>/dev/null | grep LISTEN | head -20 || echo "  无法获取监听端口"
    
    echo ""
    echo "UDP监听端口:"
    ss -ulnp 2>/dev/null | head -20 || netstat -ulnp 2>/dev/null | head -20 || echo "  无法获取UDP端口"
}

# 主逻辑
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -l|--listen)
        port=${2:-8080}
        test_listen "$port"
        ;;
    -c|--connect)
        target=${2:-}
        if [ -z "$target" ]; then
            echo -e "${RED}错误: 请指定目标地址${NC}"
            show_help
            exit 1
        fi
        test_connect "$target"
        ;;
    -L|--listening)
        check_listening
        ;;
    *)
        if [ $# -eq 0 ]; then
            scan_ports "$HOST" "$START_PORT" "$END_PORT"
        else
            scan_ports "$HOST" "$START_PORT" "$END_PORT"
        fi
        ;;
esac
