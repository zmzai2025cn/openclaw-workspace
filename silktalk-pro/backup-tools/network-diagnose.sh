#!/bin/bash
# network-diagnose.sh - 网络连通性诊断工具
# 用于诊断 P2P 连接问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    SilkTalk Pro 网络诊断工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 基础网络信息
echo -e "${YELLOW}[1/8] 基础网络信息${NC}"
echo "----------------------------------------"
echo "主机名: $(hostname)"
echo "操作系统: $(uname -s) $(uname -r)"
echo ""

# 2. IP地址信息
echo -e "${YELLOW}[2/8] IP地址信息${NC}"
echo "----------------------------------------"
echo "本机IP地址:"
ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print "  " $2}' || echo "  无法获取IP地址"
echo ""

# 3. 网关和DNS
echo -e "${YELLOW}[3/8] 网关和DNS${NC}"
echo "----------------------------------------"
echo "默认网关:"
ip route | grep default | awk '{print "  " $3 " via " $5}' || echo "  无法获取网关"
echo ""
echo "DNS服务器:"
cat /etc/resolv.conf | grep nameserver | awk '{print "  " $2}' || echo "  无法获取DNS"
echo ""

# 4. 互联网连通性测试
echo -e "${YELLOW}[4/8] 互联网连通性测试${NC}"
echo "----------------------------------------"

# 测试多个公共服务器
SERVERS=(
    "8.8.8.8:Google DNS"
    "1.1.1.1:Cloudflare DNS"
    "114.114.114.114:国内DNS"
    "baidu.com:百度"
    "google.com:Google"
)

for server in "${SERVERS[@]}"; do
    IFS=':' read -r ip name <<< "$server"
    if ping -c 1 -W 2 "$ip" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $name ($ip) - 可达"
    else
        echo -e "  ${RED}✗${NC} $name ($ip) - 不可达"
    fi
done
echo ""

# 5. 常用P2P端口连通性
echo -e "${YELLOW}[5/8] P2P相关端口测试${NC}"
echo "----------------------------------------"

# 测试STUN/TURN服务器
STUN_SERVERS=(
    "stun.l.google.com:19302"
    "stun1.l.google.com:19302"
    "stun.cloudflare.com:3478"
    "stun.miwifi.com:3478"
)

echo "STUN服务器测试:"
for server in "${STUN_SERVERS[@]}"; do
    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/${server/:/\/}" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $server - 可连接"
    else
        echo -e "  ${RED}✗${NC} $server - 不可连接"
    fi
done
echo ""

# 6. 网络接口统计
echo -e "${YELLOW}[6/8] 网络接口统计${NC}"
echo "----------------------------------------"
echo "接口状态:"
ip -s link show 2>/dev/null | grep -E "^[0-9]+:|RX:|TX:" | head -20 || echo "  无法获取接口统计"
echo ""

# 7. 路由表
echo -e "${YELLOW}[7/8] 路由表${NC}"
echo "----------------------------------------"
ip route show | head -10
echo ""

# 8. 防火墙状态
echo -e "${YELLOW}[8/8] 防火墙状态${NC}"
echo "----------------------------------------"

# 检查iptables
if command -v iptables &>/dev/null; then
    echo "iptables规则数: $(iptables -L 2>/dev/null | wc -l)"
    echo "当前iptables规则 (INPUT链):"
    iptables -L INPUT -n --line-numbers 2>/dev/null | head -10 || echo "  无法读取iptables"
else
    echo "iptables未安装"
fi

# 检查ufw
if command -v ufw &>/dev/null; then
    echo ""
    echo "UFW状态:"
    ufw status 2>/dev/null || echo "  无法获取UFW状态"
fi

# 检查firewalld
if command -v firewall-cmd &>/dev/null; then
    echo ""
    echo "Firewalld状态:"
    firewall-cmd --state 2>/dev/null || echo "  Firewalld未运行"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    诊断完成${NC}"
echo -e "${BLUE}========================================${NC}"

# 保存结果到文件
OUTPUT_FILE="network-diagnose-$(date +%Y%m%d-%H%M%S).log"
echo "诊断结果已保存到: $OUTPUT_FILE"
