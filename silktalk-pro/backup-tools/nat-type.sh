#!/bin/bash
# nat-type.sh - NAT类型检测工具
# 检测当前网络的NAT类型，这对P2P连接很重要

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    SilkTalk Pro NAT类型检测${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# NAT类型说明
echo -e "${CYAN}NAT类型说明:${NC}"
echo "  开放型(Open)      - 可直接接收外部连接，P2P效果最佳"
echo "  受限型(Restricted) - 需要打洞技术，P2P效果良好"
echo "  对称型(Symmetric)  - P2P最困难，通常需要中继服务器"
echo "  未知型(Unknown)    - 无法确定类型"
echo ""

# 获取公网IP
echo -e "${YELLOW}[1/4] 获取公网IP地址${NC}"
echo "----------------------------------------"

PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
            curl -s --max-time 5 https://ifconfig.me 2>/dev/null || \
            curl -s --max-time 5 https://icanhazip.com 2>/dev/null || \
            echo "无法获取")

if [ "$PUBLIC_IP" != "无法获取" ]; then
    echo -e "公网IP: ${GREEN}$PUBLIC_IP${NC}"
else
    echo -e "${RED}无法获取公网IP，请检查网络连接${NC}"
fi
echo ""

# 检查STUN服务器可达性
echo -e "${YELLOW}[2/4] STUN服务器测试${NC}"
echo "----------------------------------------"

STUN_SERVERS=(
    "stun.l.google.com:19302"
    "stun1.l.google.com:19302"
    "stun2.l.google.com:19302"
    "stun3.l.google.com:19302"
    "stun4.l.google.com:19302"
    "stun.cloudflare.com:3478"
    "stun.miwifi.com:3478"
    "stun.qq.com:3478"
)

AVAILABLE_STUN=()

for server in "${STUN_SERVERS[@]}"; do
    IFS=':' read -r host port <<< "$server"
    
    # 测试TCP连通性
    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $server (TCP)"
        AVAILABLE_STUN+=("$server")
    else
        echo -e "  ${RED}✗${NC} $server"
    fi
done

if [ ${#AVAILABLE_STUN[@]} -eq 0 ]; then
    echo -e "${RED}警告: 没有可用的STUN服务器${NC}"
else
    echo -e "可用STUN服务器: ${GREEN}${#AVAILABLE_STUN[@]}${NC} 个"
fi
echo ""

# 检测端口映射
echo -e "${YELLOW}[3/4] 端口映射检测${NC}"
echo "----------------------------------------"

# 检查UPnP
if command -v upnpc &>/dev/null; then
    echo "UPnP客户端已安装"
    upnpc -l 2>/dev/null | head -10 || echo "  无法获取UPnP信息"
else
    echo "UPnP客户端未安装 (安装: apt-get install miniupnpc)"
fi

# 检查本机端口范围
echo ""
echo "本地临时端口范围:"
sysctl net.ipv4.ip_local_port_range 2>/dev/null || echo "  无法获取"

# 检查端口转发
echo ""
echo "当前端口转发规则:"
iptables -t nat -L PREROUTING -n 2>/dev/null | head -10 || echo "  无端口转发规则"
echo ""

# NAT类型评估
echo -e "${YELLOW}[4/4] NAT类型评估${NC}"
echo "----------------------------------------"

# 基于一些启发式规则评估NAT类型
echo "基于网络配置分析:"

# 检查是否为公网IP
if [ "$PUBLIC_IP" != "无法获取" ]; then
    # 检查是否为私有IP
    if [[ "$PUBLIC_IP" =~ ^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\.|^127\.|^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\. ]]; then
        echo -e "  • 公网IP为私有地址段 - ${YELLOW}可能存在多层NAT${NC}"
        NAT_TYPE="Symmetric (可能)"
    else
        echo -e "  • 公网IP为公网地址 - ${GREEN}可能是开放型或受限型NAT${NC}"
        NAT_TYPE="Open/Restricted"
    fi
else
    NAT_TYPE="Unknown"
fi

# 检查防火墙规则
if command -v iptables &>/dev/null; then
    INPUT_RULES=$(iptables -L INPUT -n 2>/dev/null | wc -l)
    if [ "$INPUT_RULES" -gt 2 ]; then
        echo -e "  • 存在防火墙规则 - ${YELLOW}可能影响入站连接${NC}"
    else
        echo -e "  • 防火墙规则较少 - ${GREEN}有利于P2P连接${NC}"
    fi
fi

# 检查ISP类型
echo ""
echo "ISP信息:"
whois "$PUBLIC_IP" 2>/dev/null | grep -E "(netname|descr|org-name|OrgName)" | head -5 || echo "  无法获取ISP信息"

echo ""
echo -e "${CYAN}评估结果:${NC}"
echo "----------------------------------------"
case "$NAT_TYPE" in
    "Open/Restricted")
        echo -e "预计NAT类型: ${GREEN}开放型或受限型${NC}"
        echo -e "${GREEN}✓${NC} P2P连接应该可以正常工作"
        echo -e "${GREEN}✓${NC} 可能不需要中继服务器"
        ;;
    "Symmetric (可能)")
        echo -e "预计NAT类型: ${YELLOW}对称型 (可能)${NC}"
        echo -e "${YELLOW}!${NC} P2P连接可能困难"
        echo -e "${YELLOW}!${NC} 建议使用中继服务器"
        ;;
    *)
        echo -e "预计NAT类型: ${RED}未知${NC}"
        echo -e "${YELLOW}!${NC} 需要进一步测试"
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    检测完成${NC}"
echo -e "${BLUE}========================================${NC}"

echo ""
echo "建议:"
echo "  1. 如果NAT类型为对称型，请配置TURN中继服务器"
echo "  2. 考虑在路由器上配置端口转发"
echo "  3. 启用UPnP可以简化端口映射"
echo "  4. 使用支持ICE协议的P2P库"
