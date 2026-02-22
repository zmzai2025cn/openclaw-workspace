#!/bin/bash
#==============================================================================
# 脚本名称: check-env.sh
# 功能描述: SilkTalk Pro 环境检测脚本 - 全面扫描系统环境，生成兼容性报告
# 作者: SilkTalk Team
# 版本: 1.0.0
# 日期: 2026-02-22
#==============================================================================
#
# 设计目标:
#   - 全面检测: 覆盖操作系统、网络、资源、依赖等
#   - 自动适配: 根据检测结果推荐部署策略
#   - 详细报告: 生成 Markdown 格式的检测报告
#   - 零依赖: 仅使用系统自带工具
#
# 检测项目:
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  操作系统   │    │   Node.js   │    │    网络     │
#   │  (OS检测)   │    │  (版本检测)  │    │  (连通性)   │
#   └─────────────┘    └─────────────┘    └─────────────┘
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │   资源      │    │    依赖     │    │    权限     │
#   │ (CPU/内存)  │    │  (工具检测)  │    │ (root/sudo) │
#   └─────────────┘    └─────────────┘    └─────────────┘
#
# 使用方法:
#   ./check-env.sh [选项]
#
# 选项:
#   --mode <mode>        检测模式: auto|semi|diagnose (默认: auto)
#   --node-version <ver>  期望的 Node.js 版本 (默认: 20)
#   --prefix <path>      安装前缀 (默认: /usr/local)
#   --mirror <source>    镜像源: auto|cn|global (默认: auto)
#   --verbose             详细输出
#
# 返回值:
#   0 - 环境检测通过
#   1 - 环境存在问题
#
# 输出:
#   - 控制台彩色输出
#   - Markdown 报告: reports/env-report-*.md
#
# 示例:
#   # 标准检测
#   ./check-env.sh
#
#   # 详细检测
#   ./check-env.sh --verbose
#
#   # 指定配置检测
#   ./check-env.sh --node-version 18 --prefix ~/.local
#
#==============================================================================

#------------------------------------------------------------------------------
# 严格模式设置
#------------------------------------------------------------------------------
set -euo pipefail

#------------------------------------------------------------------------------
# 全局配置
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly REPORT_DIR="${PROJECT_ROOT}/reports"

# 命令行参数
MODE="auto"
NODE_VERSION="20"
INSTALL_PREFIX="/usr/local"
USE_MIRROR="auto"
VERBOSE=false

#------------------------------------------------------------------------------
# 检测结果存储
#------------------------------------------------------------------------------
# 使用关联数组存储各项检测结果
declare -A ENV_CHECK_RESULTS
declare -a ENV_ISSUES=()      # 严重问题列表
declare -a ENV_WARNINGS=()    # 警告列表

#------------------------------------------------------------------------------
# 颜色定义
#------------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# 日志函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: log_info
# 描述: 输出信息级别日志（蓝色）
# 参数: $* - 日志消息
#==============================================================================
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }

#==============================================================================
# 函数: log_warn
# 描述: 输出警告级别日志（黄色）
# 参数: $* - 日志消息
#==============================================================================
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

#==============================================================================
# 函数: log_error
# 描述: 输出错误级别日志（红色）
# 参数: $* - 日志消息
#==============================================================================
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

#==============================================================================
# 函数: log_success
# 描述: 输出成功级别日志（绿色）
# 参数: $* - 日志消息
#==============================================================================
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }

#==============================================================================
# 函数: log_debug
# 描述: 输出调试级别日志（青色），仅在 verbose 模式下显示
# 参数: $* - 日志消息
#==============================================================================
log_debug() { if [[ "$VERBOSE" == true ]]; then echo -e "${CYAN}[DEBUG]${NC} $*"; fi; }

#------------------------------------------------------------------------------
# 参数解析
#------------------------------------------------------------------------------

#==============================================================================
# 函数: parse_args
# 描述: 解析命令行参数
# 参数: $@ - 所有命令行参数
#==============================================================================
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode) MODE="$2"; shift 2 ;;
            --node-version) NODE_VERSION="$2"; shift 2 ;;
            --prefix) INSTALL_PREFIX="$2"; shift 2 ;;
            --mirror) USE_MIRROR="$2"; shift 2 ;;
            --verbose) VERBOSE=true; shift ;;
            *) shift ;;
        esac
    done
}

#------------------------------------------------------------------------------
# 操作系统检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_os
# 描述: 检测操作系统信息，包括发行版、版本、架构、容器环境等
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组
# 检测项:
#   - 操作系统名称和版本
#   - 系统架构 (x64/arm64/arm)
#   - 内核版本
#   - 容器环境 (Docker/WSL/LXC)
#==============================================================================
check_os() {
    log_info "检测操作系统..."
    
    # 初始化变量
    local os_name="unknown"
    local os_version="unknown"
    local os_id="unknown"
    local kernel_version=""
    local arch=""
    local is_docker=false
    local is_wsl=false
    local is_container=false
    
    #------------------------------------------------------------------------------
    # 检测系统架构
    #------------------------------------------------------------------------------
    # uname -m 输出架构标识符，需要映射到标准名称
    arch=$(uname -m)
    case "$arch" in
        x86_64) 
            arch="x64" 
            log_debug "检测到 x86_64 架构，映射为 x64"
            ;;
        aarch64|arm64) 
            arch="arm64" 
            log_debug "检测到 ARM64 架构"
            ;;
        armv7l) 
            arch="arm" 
            log_debug "检测到 ARMv7 架构"
            ;;
        *) 
            log_warn "未知架构: $arch"
            ;;
    esac
    
    #------------------------------------------------------------------------------
    # 检测内核版本
    #------------------------------------------------------------------------------
    kernel_version=$(uname -r)
    
    #------------------------------------------------------------------------------
    # 检测 Linux 发行版
    #------------------------------------------------------------------------------
    # 优先使用 /etc/os-release（systemd 标准）
    if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        source /etc/os-release
        os_name="$NAME"
        os_version="$VERSION_ID"
        os_id="$ID"
    # 兼容旧版 CentOS/RHEL
    elif [[ -f /etc/redhat-release ]]; then
        os_name=$(cat /etc/redhat-release)
        os_id="rhel"
    # 兼容旧版 Debian
    elif [[ -f /etc/debian_version ]]; then
        os_name="Debian"
        os_version=$(cat /etc/debian_version)
        os_id="debian"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 Docker 环境
    #------------------------------------------------------------------------------
    # 方法 1: 检查 .dockerenv 文件
    # 方法 2: 检查 cgroup 中是否包含 docker
    if [[ -f /.dockerenv ]] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        is_docker=true
        is_container=true
        log_debug "检测到 Docker 环境"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 WSL 环境
    #------------------------------------------------------------------------------
    # 检查 /proc/version 中是否包含 Microsoft 或 WSL
    if grep -q Microsoft /proc/version 2>/dev/null || grep -q WSL /proc/version 2>/dev/null; then
        is_wsl=true
        log_debug "检测到 WSL 环境"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 LXC/containerd 容器
    #------------------------------------------------------------------------------
    # 检查 /proc/vz 存在但 /proc/bc 不存在（OpenVZ/LXC 特征）
    if [[ -d /proc/vz ]] && [[ ! -d /proc/bc ]]; then
        is_container=true
        log_debug "检测到 LXC/containerd 环境"
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["os_name"]="$os_name"
    ENV_CHECK_RESULTS["os_version"]="$os_version"
    ENV_CHECK_RESULTS["os_id"]="$os_id"
    ENV_CHECK_RESULTS["kernel"]="$kernel_version"
    ENV_CHECK_RESULTS["arch"]="$arch"
    ENV_CHECK_RESULTS["is_docker"]="$is_docker"
    ENV_CHECK_RESULTS["is_wsl"]="$is_wsl"
    ENV_CHECK_RESULTS["is_container"]="$is_container"
    
    #------------------------------------------------------------------------------
    # 输出检测结果
    #------------------------------------------------------------------------------
    log_info "  操作系统: $os_name $os_version"
    log_info "  系统ID: $os_id"
    log_info "  内核版本: $kernel_version"
    log_info "  架构: $arch"
    log_info "  Docker环境: $is_docker"
    log_info "  WSL环境: $is_wsl"
    log_info "  容器环境: $is_container"
    
    #------------------------------------------------------------------------------
    # 兼容性检查
    #------------------------------------------------------------------------------
    # 检查架构兼容性
    if [[ "$arch" != "x64" && "$arch" != "arm64" ]]; then
        ENV_WARNINGS+=("架构 $arch 可能不完全兼容，建议使用 x64 或 arm64")
    fi
    
    # WSL 环境警告
    if [[ "$is_wsl" == true ]]; then
        ENV_WARNINGS+=("WSL 环境检测，建议使用 WSL2 以获得更好性能")
    fi
    
    log_success "操作系统检测完成"
}

#------------------------------------------------------------------------------
# Node.js 检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_nodejs
# 描述: 检测 Node.js 安装状态和版本兼容性
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组，可能添加警告
# 检测项:
#   - Node.js 是否安装
#   - Node.js 版本号
#   - Node.js 路径
#   - 版本兼容性 (>= 18)
#   - npm/yarn/pnpm 安装状态
#==============================================================================
check_nodejs() {
    log_info "检测 Node.js..."
    
    # 初始化变量
    local node_installed=false
    local node_version=""
    local node_path=""
    local npm_installed=false
    local npm_version=""
    local yarn_installed=false
    local pnpm_installed=false
    local node_compatible=false
    
    #------------------------------------------------------------------------------
    # 检测 Node.js 安装
    #------------------------------------------------------------------------------
    if command -v node &> /dev/null; then
        node_installed=true
        node_version=$(node --version | sed 's/v//')
        node_path=$(which node)
        
        #------------------------------------------------------------------------------
        # 版本兼容性检查
        #------------------------------------------------------------------------------
        # 提取主版本号进行比较
        local major_version=$(echo "$node_version" | cut -d. -f1)
        if [[ "$major_version" -ge 18 ]]; then
            node_compatible=true
        fi
        
        log_info "  Node.js: v${node_version} ($node_path)"
    else
        ENV_ISSUES+=("Node.js 未安装")
        log_warn "  Node.js 未安装"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 npm
    #------------------------------------------------------------------------------
    if command -v npm &> /dev/null; then
        npm_installed=true
        npm_version=$(npm --version)
        log_info "  npm: v${npm_version}"
    else
        ENV_ISSUES+=("npm 未安装")
    fi
    
    #------------------------------------------------------------------------------
    # 检测 yarn（可选）
    #------------------------------------------------------------------------------
    if command -v yarn &> /dev/null; then
        yarn_installed=true
        log_info "  yarn: $(yarn --version)"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 pnpm（可选）
    #------------------------------------------------------------------------------
    if command -v pnpm &> /dev/null; then
        pnpm_installed=true
        log_info "  pnpm: $(pnpm --version)"
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["node_installed"]="$node_installed"
    ENV_CHECK_RESULTS["node_version"]="$node_version"
    ENV_CHECK_RESULTS["node_path"]="$node_path"
    ENV_CHECK_RESULTS["node_compatible"]="$node_compatible"
    ENV_CHECK_RESULTS["npm_installed"]="$npm_installed"
    ENV_CHECK_RESULTS["npm_version"]="$npm_version"
    ENV_CHECK_RESULTS["yarn_installed"]="$yarn_installed"
    ENV_CHECK_RESULTS["pnpm_installed"]="$pnpm_installed"
    
    #------------------------------------------------------------------------------
    # 输出兼容性状态
    #------------------------------------------------------------------------------
    if [[ "$node_compatible" == true ]]; then
        log_success "Node.js 检测完成 (兼容)"
    elif [[ "$node_installed" == true ]]; then
        log_warn "Node.js 版本不兼容 (需要 >= 18)"
    fi
}

#------------------------------------------------------------------------------
# 网络检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_network
# 描述: 检测网络环境和连通性
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组，自动选择镜像源
# 检测项:
#   - 外网连通性 (ping 8.8.8.8 / 223.5.5.5)
#   - IPv6 支持
#   - DNS 解析
#   - 网络区域（中国/全球）
#   - 可用端口
#==============================================================================
check_network() {
    log_info "检测网络环境..."
    
    # 初始化变量
    local has_internet=false
    local has_ipv6=false
    local network_type="unknown"
    local dns_working=false
    local ports_available=""
    
    #------------------------------------------------------------------------------
    # 检测外网连通性
    #------------------------------------------------------------------------------
    # 尝试 ping Google DNS (8.8.8.8) 或阿里云 DNS (223.5.5.5)
    if ping -c 1 -W 3 8.8.8.8 > /dev/null 2>&1 || \
       ping -c 1 -W 3 223.5.5.5 > /dev/null 2>&1; then
        has_internet=true
        log_info "  外网连通性: 正常"
    else
        ENV_WARNINGS+=("外网连接可能受限")
        log_warn "  外网连通性: 受限"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 IPv6 支持
    #------------------------------------------------------------------------------
    if [[ -f /proc/net/if_inet6 ]] && [[ $(wc -l < /proc/net/if_inet6) -gt 0 ]]; then
        has_ipv6=true
        log_info "  IPv6: 支持"
    fi
    
    #------------------------------------------------------------------------------
    # DNS 检测
    #------------------------------------------------------------------------------
    if nslookup github.com > /dev/null 2>&1 || \
       nslookup gitee.com > /dev/null 2>&1; then
        dns_working=true
        log_info "  DNS: 正常"
    else
        ENV_WARNINGS+=("DNS 解析可能有问题")
    fi
    
    #------------------------------------------------------------------------------
    # 检测网络区域（中国/全球）
    #------------------------------------------------------------------------------
    if [[ "$has_internet" == true ]]; then
        # 使用 ipinfo.io 或 ipip.net 检测国家
        if curl -s --max-time 5 http://ipinfo.io/country 2>/dev/null | grep -q "CN" || \
           curl -s --max-time 5 http://myip.ipip.net 2>/dev/null | grep -q "中国"; then
            network_type="cn"
            log_info "  网络区域: 中国大陆"
        else
            network_type="global"
            log_info "  网络区域: 国际"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 检测可用端口
    #------------------------------------------------------------------------------
    # SilkTalk 常用端口范围
    local ports=(3000 8080 8081 9000 3478 5349)
    local available_ports=()
    
    for port in "${ports[@]}"; do
        # 使用 netstat 检查端口是否被占用
        if ! netstat -tuln 2>/dev/null | grep -q ":${port} "; then
            available_ports+=("$port")
        fi
    done
    
    ports_available="${available_ports[*]}"
    log_info "  可用端口: ${ports_available:-无}"
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["has_internet"]="$has_internet"
    ENV_CHECK_RESULTS["has_ipv6"]="$has_ipv6"
    ENV_CHECK_RESULTS["network_type"]="$network_type"
    ENV_CHECK_RESULTS["dns_working"]="$dns_working"
    ENV_CHECK_RESULTS["available_ports"]="$ports_available"
    
    #------------------------------------------------------------------------------
    # 自动选择镜像源
    #------------------------------------------------------------------------------
    if [[ "$USE_MIRROR" == "auto" ]]; then
        if [[ "$network_type" == "cn" ]]; then
            USE_MIRROR="cn"
            log_info "  自动选择: 中国镜像源"
        else
            USE_MIRROR="global"
            log_info "  自动选择: 全球镜像源"
        fi
    fi
    
    log_success "网络检测完成"
}

#------------------------------------------------------------------------------
# 资源检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_resources
# 描述: 检测系统资源（CPU、内存、磁盘）
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组，可能添加警告
# 检测项:
#   - CPU 核心数和型号
#   - 内存总量和可用量
#   - 磁盘总量和可用量
#   - 系统负载
#==============================================================================
check_resources() {
    log_info "检测系统资源..."
    
    # 初始化变量
    local cpu_cores=""
    local cpu_model=""
    local mem_total=""
    local mem_available=""
    local disk_total=""
    local disk_available=""
    local load_avg=""
    
    #------------------------------------------------------------------------------
    # CPU 检测
    #------------------------------------------------------------------------------
    # 获取 CPU 核心数
    cpu_cores=$(nproc 2>/dev/null || echo "1")
    
    # 获取 CPU 型号
    cpu_model=$(grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo "Unknown")
    
    # 获取系统负载
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    
    log_info "  CPU: ${cpu_cores} 核 - ${cpu_model}"
    log_info "  负载: ${load_avg}"
    
    #------------------------------------------------------------------------------
    # 内存检测
    #------------------------------------------------------------------------------
    if [[ -f /proc/meminfo ]]; then
        # 从 /proc/meminfo 读取内存信息（单位：KB，转换为 GB）
        mem_total=$(awk '/MemTotal/{print int($2/1024/1024)}' /proc/meminfo)
        mem_available=$(awk '/MemAvailable/{print int($2/1024/1024)}' /proc/meminfo)
        log_info "  内存: ${mem_available}GB 可用 / ${mem_total}GB 总计"
    fi
    
    #------------------------------------------------------------------------------
    # 磁盘检测
    #------------------------------------------------------------------------------
    # 检查安装前缀所在分区的磁盘空间
    disk_available=$(df -BG "$INSTALL_PREFIX" 2>/dev/null | awk 'NR==2{print $4}' | sed 's/G//' || echo "")
    disk_total=$(df -BG "$INSTALL_PREFIX" 2>/dev/null | awk 'NR==2{print $2}' | sed 's/G//' || echo "")
    
    # 如果安装前缀不存在，检查根分区
    if [[ -z "$disk_available" ]]; then
        disk_available=$(df -BG / 2>/dev/null | awk 'NR==2{print $4}' | sed 's/G//' || echo "0")
        disk_total=$(df -BG / 2>/dev/null | awk 'NR==2{print $2}' | sed 's/G//' || echo "0")
    fi
    
    log_info "  磁盘: ${disk_available}GB 可用 / ${disk_total}GB 总计"
    
    #------------------------------------------------------------------------------
    # 资源警告
    #------------------------------------------------------------------------------
    # 内存不足警告
    if [[ "${mem_total:-0}" -lt 1 ]]; then
        ENV_WARNINGS+=("内存不足 1GB，可能影响性能")
    fi
    
    # 磁盘空间不足警告
    if [[ "${disk_available:-0}" -lt 2 ]]; then
        ENV_WARNINGS+=("磁盘空间不足 2GB")
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["cpu_cores"]="$cpu_cores"
    ENV_CHECK_RESULTS["cpu_model"]="$cpu_model"
    ENV_CHECK_RESULTS["mem_total"]="${mem_total:-0}"
    ENV_CHECK_RESULTS["mem_available"]="${mem_available:-0}"
    ENV_CHECK_RESULTS["disk_total"]="${disk_total:-0}"
    ENV_CHECK_RESULTS["disk_available"]="${disk_available:-0}"
    ENV_CHECK_RESULTS["load_avg"]="$load_avg"
    
    log_success "资源检测完成"
}

#------------------------------------------------------------------------------
# 依赖检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_dependencies
# 描述: 检测系统依赖工具是否安装
# 参数: 无
# 返回值:
#   0 - 检测完成（可能有缺失）
# 副作用: 填充 ENV_CHECK_RESULTS 数组，记录缺失依赖
# 检测项:
#   - 基础依赖: git, curl, wget, tar, unzip
#   - 构建依赖: make, gcc, g++, python3
#==============================================================================
check_dependencies() {
    log_info "检测系统依赖..."
    
    # 定义需要检测的依赖
    local deps=("git" "curl" "wget" "tar" "unzip")
    local build_deps=("make" "gcc" "g++" "python3")
    local missing_deps=()
    local missing_build_deps=()
    
    #------------------------------------------------------------------------------
    # 检测基础依赖
    #------------------------------------------------------------------------------
    for dep in "${deps[@]}"; do
        if type -p "$dep" > /dev/null 2>&1; then
            log_debug "  ✓ $dep"
        else
            missing_deps+=("$dep")
            ENV_ISSUES+=("缺少依赖: $dep")
        fi
    done
    
    #------------------------------------------------------------------------------
    # 检测构建依赖
    #------------------------------------------------------------------------------
    for dep in "${build_deps[@]}"; do
        if type -p "$dep" > /dev/null 2>&1; then
            log_debug "  ✓ $dep"
        else
            missing_build_deps+=("$dep")
        fi
    done
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["missing_deps"]="${missing_deps[*]}"
    ENV_CHECK_RESULTS["missing_build_deps"]="${missing_build_deps[*]}"
    
    #------------------------------------------------------------------------------
    # 输出检测摘要
    #------------------------------------------------------------------------------
    if [[ ${#missing_deps[@]} -eq 0 ]]; then
        log_success "基础依赖检测完成"
    else
        log_warn "缺少依赖: ${missing_deps[*]}"
    fi
    
    if [[ ${#missing_build_deps[@]} -gt 0 ]]; then
        log_warn "缺少构建依赖: ${missing_build_deps[*]}"
    fi
    
    return 0
}

#------------------------------------------------------------------------------
# 权限检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_permissions
# 描述: 检测当前用户权限和安装目录写入权限
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组，可能调整 INSTALL_PREFIX
# 检测项:
#   - 是否 root 用户
#   - sudo 是否可用
#   - 安装目录是否可写
#==============================================================================
check_permissions() {
    log_info "检测权限..."
    
    # 初始化变量
    local is_root=false
    local can_sudo=false
    local can_write_prefix=false
    
    #------------------------------------------------------------------------------
    # 检测 root 权限
    #------------------------------------------------------------------------------
    if [[ $EUID -eq 0 ]]; then
        is_root=true
        log_info "  当前用户: root"
    else
        log_info "  当前用户: $(whoami) (UID: $EUID)"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 sudo 可用性
    #------------------------------------------------------------------------------
    # 检查 sudo 命令是否存在且无需密码即可使用
    if command -v sudo &> /dev/null && sudo -n true 2>/dev/null; then
        can_sudo=true
        log_info "  sudo: 可用"
    else
        log_warn "  sudo: 不可用或需要密码"
    fi
    
    #------------------------------------------------------------------------------
    # 检测安装目录写入权限
    #------------------------------------------------------------------------------
    if [[ -d "$INSTALL_PREFIX" ]]; then
        if [[ -w "$INSTALL_PREFIX" ]]; then
            can_write_prefix=true
            log_info "  写入权限: ${INSTALL_PREFIX} 可写"
        else
            log_warn "  写入权限: ${INSTALL_PREFIX} 不可写"
        fi
    else
        # 尝试创建目录
        if mkdir -p "$INSTALL_PREFIX" 2>/dev/null; then
            can_write_prefix=true
            log_info "  写入权限: ${INSTALL_PREFIX} 可创建"
        else
            log_warn "  写入权限: 无法创建 ${INSTALL_PREFIX}"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["is_root"]="$is_root"
    ENV_CHECK_RESULTS["can_sudo"]="$can_sudo"
    ENV_CHECK_RESULTS["can_write_prefix"]="$can_write_prefix"
    
    #------------------------------------------------------------------------------
    # 调整安装策略
    #------------------------------------------------------------------------------
    # 如果无 root、无 sudo、无法写入安装目录，则切换到用户级安装
    if [[ "$is_root" == false && "$can_write_prefix" == false && "$can_sudo" == false ]]; then
        ENV_WARNINGS+=("无 root 权限且无法写入 ${INSTALL_PREFIX}，将使用用户级安装")
        INSTALL_PREFIX="$HOME/.local"
        log_info "  调整安装前缀为: $INSTALL_PREFIX"
    fi
    
    log_success "权限检测完成"
}

#------------------------------------------------------------------------------
# OpenClaw 环境检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_openclaw
# 描述: 检测 OpenClaw 环境
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组
# 检测项:
#   - OpenClaw CLI 版本
#   - Node.js 当前版本
#   - 工作空间环境变量
#==============================================================================
check_openclaw() {
    log_info "检测 OpenClaw 环境..."
    
    local openclaw_version=""
    local node_version_current=""
    
    #------------------------------------------------------------------------------
    # 检测 OpenClaw CLI
    #------------------------------------------------------------------------------
    if command -v openclaw &> /dev/null; then
        openclaw_version=$(openclaw --version 2>&1 | head -1 || echo "unknown")
        log_info "  OpenClaw: $openclaw_version"
    else
        log_info "  OpenClaw CLI: 未直接安装"
    fi
    
    #------------------------------------------------------------------------------
    # 检测 Node.js 版本
    #------------------------------------------------------------------------------
    node_version_current=$(node --version 2>/dev/null || echo "none")
    log_info "  Node.js 当前: $node_version_current"
    
    #------------------------------------------------------------------------------
    # 检测工作空间
    #------------------------------------------------------------------------------
    if [[ -n "${WORKSPACE:-}" ]]; then
        log_info "  工作空间: $WORKSPACE"
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["openclaw_version"]="${openclaw_version:-unknown}"
    ENV_CHECK_RESULTS["node_current"]="$node_version_current"
    
    log_success "OpenClaw 检测完成"
}

#------------------------------------------------------------------------------
# 防火墙检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: check_firewall
# 描述: 检测防火墙状态和配置
# 参数: 无
# 返回值: 无
# 副作用: 填充 ENV_CHECK_RESULTS 数组，可能添加警告
# 检测项:
#   - ufw 状态
#   - firewalld 状态
#   - iptables 规则
#==============================================================================
check_firewall() {
    log_info "检测防火墙..."
    
    # 初始化变量
    local firewall_active=false
    local firewall_type="none"
    
    #------------------------------------------------------------------------------
    # 检测 ufw (Ubuntu/Debian)
    #------------------------------------------------------------------------------
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            firewall_active=true
            firewall_type="ufw"
            log_info "  防火墙: ufw (active)"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 检测 firewalld (CentOS/RHEL/Fedora)
    #------------------------------------------------------------------------------
    if command -v firewall-cmd &> /dev/null; then
        if firewall-cmd --state 2>&1 | grep -q "running"; then
            firewall_active=true
            firewall_type="firewalld"
            log_info "  防火墙: firewalld (running)"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 检测 iptables
    #------------------------------------------------------------------------------
    if iptables -L > /dev/null 2>&1; then
        local rules_count
        rules_count=$(iptables -L | wc -l)
        if [[ $rules_count -gt 10 ]]; then
            log_info "  防火墙: iptables (有规则)"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 存储检测结果
    #------------------------------------------------------------------------------
    ENV_CHECK_RESULTS["firewall_active"]="$firewall_active"
    ENV_CHECK_RESULTS["firewall_type"]="$firewall_type"
    
    #------------------------------------------------------------------------------
    # 防火墙警告
    #------------------------------------------------------------------------------
    if [[ "$firewall_active" == true ]]; then
        ENV_WARNINGS+=("防火墙已启用，可能需要开放端口")
    fi
    
    log_success "防火墙检测完成"
}

#------------------------------------------------------------------------------
# 报告生成
#------------------------------------------------------------------------------

#==============================================================================
# 函数: generate_report
# 描述: 生成 Markdown 格式的环境检测报告
# 参数: 无
# 返回值:
#   0 - 无严重问题
#   1 - 存在严重问题
# 副作用: 创建报告文件，输出检测摘要
#==============================================================================
generate_report() {
    # 生成带时间戳的报告文件名
    local report_file="${REPORT_DIR}/env-report-$(date +%Y%m%d-%H%M%S).md"
    
    # 确保报告目录存在
    mkdir -p "$REPORT_DIR"
    
    # 确定整体状态
    local overall_status="✅ 通过"
    if [[ ${#ENV_ISSUES[@]} -gt 0 ]]; then
        overall_status="❌ 有问题"
    elif [[ ${#ENV_WARNINGS[@]} -gt 0 ]]; then
        overall_status="⚠️ 有警告"
    fi
    
    #------------------------------------------------------------------------------
    # 生成 Markdown 报告
    #------------------------------------------------------------------------------
    cat > "$report_file" << EOF
# SilkTalk Pro 环境检测报告

**检测时间:** $(date '+%Y-%m-%d %H:%M:%S')  
**整体状态:** $overall_status

## 系统信息

| 项目 | 值 |
|------|-----|
| 操作系统 | ${ENV_CHECK_RESULTS["os_name"]} ${ENV_CHECK_RESULTS["os_version"]} |
| 系统ID | ${ENV_CHECK_RESULTS["os_id"]} |
| 内核版本 | ${ENV_CHECK_RESULTS["kernel"]} |
| 架构 | ${ENV_CHECK_RESULTS["arch"]} |
| Docker | ${ENV_CHECK_RESULTS["is_docker"]} |
| WSL | ${ENV_CHECK_RESULTS["is_wsl"]} |
| 容器 | ${ENV_CHECK_RESULTS["is_container"]} |

## Node.js 状态

| 项目 | 值 |
|------|-----|
| 已安装 | ${ENV_CHECK_RESULTS["node_installed"]} |
| 版本 | ${ENV_CHECK_RESULTS["node_version"]:-N/A} |
| 路径 | ${ENV_CHECK_RESULTS["node_path"]:-N/A} |
| 兼容 | ${ENV_CHECK_RESULTS["node_compatible"]} |
| npm | ${ENV_CHECK_RESULTS["npm_installed"]} |
| yarn | ${ENV_CHECK_RESULTS["yarn_installed"]} |
| pnpm | ${ENV_CHECK_RESULTS["pnpm_installed"]} |

## 网络状态

| 项目 | 值 |
|------|-----|
| 外网连通 | ${ENV_CHECK_RESULTS["has_internet"]} |
| IPv6 | ${ENV_CHECK_RESULTS["has_ipv6"]} |
| 网络区域 | ${ENV_CHECK_RESULTS["network_type"]} |
| DNS | ${ENV_CHECK_RESULTS["dns_working"]} |
| 可用端口 | ${ENV_CHECK_RESULTS["available_ports"]} |

## 资源状态

| 项目 | 值 |
|------|-----|
| CPU 核心 | ${ENV_CHECK_RESULTS["cpu_cores"]} |
| CPU 型号 | ${ENV_CHECK_RESULTS["cpu_model"]} |
| 内存总计 | ${ENV_CHECK_RESULTS["mem_total"]} GB |
| 内存可用 | ${ENV_CHECK_RESULTS["mem_available"]} GB |
| 磁盘总计 | ${ENV_CHECK_RESULTS["disk_total"]} GB |
| 磁盘可用 | ${ENV_CHECK_RESULTS["disk_available"]} GB |
| 负载 | ${ENV_CHECK_RESULTS["load_avg"]} |

## 权限状态

| 项目 | 值 |
|------|-----|
| root | ${ENV_CHECK_RESULTS["is_root"]} |
| sudo | ${ENV_CHECK_RESULTS["can_sudo"]} |
| 可写前缀 | ${ENV_CHECK_RESULTS["can_write_prefix"]} |
| 安装前缀 | $INSTALL_PREFIX |

## 依赖状态

| 项目 | 值 |
|------|-----|
| 缺少依赖 | ${ENV_CHECK_RESULTS["missing_deps"]:-无} |
| 缺少构建依赖 | ${ENV_CHECK_RESULTS["missing_build_deps"]:-无} |

## 防火墙状态

| 项目 | 值 |
|------|-----|
| 防火墙启用 | ${ENV_CHECK_RESULTS["firewall_active"]} |
| 防火墙类型 | ${ENV_CHECK_RESULTS["firewall_type"]} |

## 问题列表

EOF

    # 添加问题列表
    if [[ ${#ENV_ISSUES[@]} -eq 0 ]]; then
        echo "✅ 无问题" >> "$report_file"
    else
        for issue in "${ENV_ISSUES[@]}"; do
            echo "- ❌ $issue" >> "$report_file"
        done
    fi
    
    # 添加警告列表
    cat >> "$report_file" << EOF

## 警告列表

EOF

    if [[ ${#ENV_WARNINGS[@]} -eq 0 ]]; then
        echo "✅ 无警告" >> "$report_file"
    else
        for warning in "${ENV_WARNINGS[@]}"; do
            echo "- ⚠️ $warning" >> "$report_file"
        done
    fi
    
    # 添加兼容性评估
    cat >> "$report_file" << EOF

## 兼容性评估

EOF

    # 确定部署策略
    local compatible=true
    local strategy="直接部署"
    
    if [[ "${ENV_CHECK_RESULTS["is_docker"]}" == "true" ]]; then
        strategy="Docker 容器内部署"
    elif [[ "${ENV_CHECK_RESULTS["is_wsl"]}" == "true" ]]; then
        strategy="WSL 适配部署"
    elif [[ "${ENV_CHECK_RESULTS["is_container"]}" == "true" ]]; then
        strategy="受限容器环境部署"
    elif [[ "${ENV_CHECK_RESULTS["is_root"]}" == "false" && "${ENV_CHECK_RESULTS["can_sudo"]}" == "false" ]]; then
        strategy="用户级安装 (无 root)"
    fi
    
    cat >> "$report_file" << EOF
- **部署策略:** $strategy
- **镜像源:** $USE_MIRROR
- **Node.js 版本:** $NODE_VERSION

## 建议操作

EOF

    if [[ ${#ENV_ISSUES[@]} -gt 0 ]]; then
        cat >> "$report_file" << 'EOF'
1. 安装缺失依赖
2. 运行修复脚本: `./scripts/troubleshoot.sh`
3. 重新验证: `./scripts/check-env.sh`
EOF
    else
        echo "✅ 环境就绪，可以开始部署" >> "$report_file"
    fi
    
    #------------------------------------------------------------------------------
    # 输出报告位置
    #------------------------------------------------------------------------------
    log_info ""
    log_info "检测报告已保存: $report_file"
    
    #------------------------------------------------------------------------------
    # 输出控制台摘要
    #------------------------------------------------------------------------------
    echo ""
    echo "=========================================="
    echo "环境检测摘要"
    echo "=========================================="
    echo "操作系统: ${ENV_CHECK_RESULTS["os_name"]} ${ENV_CHECK_RESULTS["os_version"]} (${ENV_CHECK_RESULTS["arch"]})"
    echo "Node.js: ${ENV_CHECK_RESULTS["node_version"]:-未安装}"
    echo "网络: ${ENV_CHECK_RESULTS["network_type"]}"
    echo "资源: ${ENV_CHECK_RESULTS["cpu_cores"]}核 / ${ENV_CHECK_RESULTS["mem_available"]}GB 可用"
    echo "策略: $strategy"
    echo "状态: $overall_status"
    echo "=========================================="
    
    #------------------------------------------------------------------------------
    # 返回码
    #------------------------------------------------------------------------------
    if [[ ${#ENV_ISSUES[@]} -gt 0 ]]; then
        return 1
    fi
    return 0
}

#------------------------------------------------------------------------------
# 主函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: main
# 描述: 脚本入口函数，协调所有检测步骤
# 参数: $@ - 所有命令行参数
# 返回值:
#   0 - 检测通过
#   1 - 检测发现问题
#==============================================================================
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 输出检测开始信息
    log_info "=========================================="
    log_info "SilkTalk Pro 环境检测"
    log_info "=========================================="
    
    # 执行各项检测
    check_os
    check_nodejs
    check_network
    check_resources
    check_dependencies
    check_permissions
    check_openclaw
    check_firewall
    
    # 生成检测报告
    generate_report
}

# 调用主函数
main "$@"
