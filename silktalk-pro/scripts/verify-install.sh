#!/bin/bash
#==============================================================================
# 脚本名称: verify-install.sh
# 功能描述: SilkTalk Pro 安装验证脚本 - 全面验证部署结果
# 作者: SilkTalk Team
# 版本: 1.0.0
# 日期: 2026-02-22
#==============================================================================
#
# 设计目标:
#   - 全面验证: 覆盖文件、依赖、配置、服务、网络、性能
#   - 自动报告: 生成详细的验证报告
#   - 可扩展: 易于添加新的验证项
#   - 非阻塞: 警告不阻断，仅错误阻断
#
# 验证项目:
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  文件完整性  │    │  依赖检查   │    │  配置验证   │
#   │ (关键文件)  │    │ (node_modules│    │ (JSON格式) │
#   └─────────────┘    └─────────────┘    └─────────────┘
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  服务检查   │    │  网络检查   │    │  性能测试   │
#   │ (systemd)  │    │ (端口/防火墙)│    │ (内存/磁盘) │
#   └─────────────┘    └─────────────┘    └─────────────┘
#
# 使用方法:
#   ./verify-install.sh [选项]
#
# 选项:
#   --mode <mode>      验证模式: auto|verbose (默认: auto)
#   --output <dir>     报告输出目录 (默认: ./reports)
#   --verbose          详细输出
#
# 返回值:
#   0 - 验证通过
#   1 - 验证失败
#
# 示例:
#   # 标准验证
#   ./verify-install.sh
#
#   # 详细验证
#   ./verify-install.sh --verbose
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

# 命令行参数
MODE="auto"
OUTPUT_DIR="${PROJECT_ROOT}/reports"
VERBOSE=false

# 验证结果存储
declare -a VERIFY_PASSED=()    # 通过的检查
declare -a VERIFY_FAILED=()    # 失败的检查
declare -a VERIFY_WARNINGS=()  # 警告项

#------------------------------------------------------------------------------
# 颜色定义
#------------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# 日志函数
#------------------------------------------------------------------------------
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }

#------------------------------------------------------------------------------
# 参数解析
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode) MODE="$2"; shift 2 ;;
            --output) OUTPUT_DIR="$2"; shift 2 ;;
            --verbose) VERBOSE=true; shift ;;
            *) shift ;;
        esac
    done
}

#------------------------------------------------------------------------------
# 文件完整性验证
#------------------------------------------------------------------------------

#==============================================================================
# 函数: verify_files
# 描述: 验证项目文件完整性
# 参数: 无
# 返回值: 无
# 验证项:
#   - 安装目录存在
#   - 关键文件存在 (package.json, dist/index.js, config)
#   - 目录结构完整 (logs, config, data)
#==============================================================================
verify_files() {
    log_info "验证文件完整性..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    local checks_passed=0
    local checks_total=0
    
    #------------------------------------------------------------------------------
    # 检查安装目录
    #------------------------------------------------------------------------------
    ((checks_total++))
    if [[ -d "$install_dir" ]]; then
        VERIFY_PASSED+=("安装目录存在: $install_dir")
        ((checks_passed++))
    else
        VERIFY_FAILED+=("安装目录不存在: $install_dir")
    fi
    
    #------------------------------------------------------------------------------
    # 检查关键文件
    #------------------------------------------------------------------------------
    local key_files=("package.json" "dist/index.js" "config/silktalk.config.json")
    for file in "${key_files[@]}"; do
        ((checks_total++))
        if [[ -f "${install_dir}/${file}" ]]; then
            VERIFY_PASSED+=("文件存在: $file")
            ((checks_passed++))
        else
            VERIFY_FAILED+=("文件缺失: $file")
        fi
    done
    
    #------------------------------------------------------------------------------
    # 检查目录结构
    #------------------------------------------------------------------------------
    local key_dirs=("logs" "config" "data")
    for dir in "${key_dirs[@]}"; do
        ((checks_total++))
        if [[ -d "${install_dir}/${dir}" ]]; then
            VERIFY_PASSED+=("目录存在: $dir")
            ((checks_passed++))
        else
            VERIFY_WARNINGS+=("目录缺失: $dir (将自动创建)")
        fi
    done
    
    log_info "文件检查: ${checks_passed}/${checks_total} 通过"
}

#------------------------------------------------------------------------------
# 依赖验证
#------------------------------------------------------------------------------

#==============================================================================
# 函数: verify_dependencies
# 描述: 验证项目依赖安装情况
# 参数: 无
# 返回值: 无
# 验证项:
#   - node_modules 目录存在
#   - 关键依赖包已安装
#==============================================================================
verify_dependencies() {
    log_info "验证依赖..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    
    if [[ ! -f "${install_dir}/package.json" ]]; then
        VERIFY_FAILED+=("无法验证依赖: package.json 不存在")
        return
    fi
    
    cd "$install_dir"
    
    #------------------------------------------------------------------------------
    # 检查 node_modules
    #------------------------------------------------------------------------------
    if [[ -d "node_modules" ]]; then
        local module_count
        module_count=$(find node_modules -maxdepth 1 -type d | wc -l)
        VERIFY_PASSED+=("node_modules 存在 (${module_count} 个模块)")
    else
        VERIFY_FAILED+=("node_modules 不存在")
    fi
    
    #------------------------------------------------------------------------------
    # 检查关键依赖
    #------------------------------------------------------------------------------
    local key_deps=("express" "ws" "socket.io")
    for dep in "${key_deps[@]}"; do
        if [[ -d "node_modules/${dep}" ]]; then
            VERIFY_PASSED+=("依赖已安装: $dep")
        else
            VERIFY_WARNINGS+=("依赖可能缺失: $dep")
        fi
    done
}

#------------------------------------------------------------------------------
# 配置验证
#------------------------------------------------------------------------------

#==============================================================================
# 函数: verify_config
# 描述: 验证配置文件有效性
# 参数: 无
# 返回值: 无
# 验证项:
#   - 配置文件存在
#   - JSON 格式有效
#   - 关键配置项存在
#==============================================================================
verify_config() {
    log_info "验证配置..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    local config_file="${install_dir}/config/silktalk.config.json"
    
    if [[ ! -f "$config_file" ]]; then
        VERIFY_FAILED+=("配置文件不存在")
        return
    fi
    
    #------------------------------------------------------------------------------
    # 验证 JSON 格式
    #------------------------------------------------------------------------------
    if node -e "JSON.parse(require('fs').readFileSync('$config_file'))" 2>/dev/null; then
        VERIFY_PASSED+=("配置文件 JSON 格式有效")
    else
        VERIFY_FAILED+=("配置文件 JSON 格式无效")
        return
    fi
    
    #------------------------------------------------------------------------------
    # 检查关键配置项
    #------------------------------------------------------------------------------
    local config_content
    config_content=$(cat "$config_file")
    
    if echo "$config_content" | grep -q '"port"'; then
        VERIFY_PASSED+=("配置包含端口设置")
    fi
    
    if echo "$config_content" | grep -q '"jwt_secret"'; then
        VERIFY_PASSED+=("配置包含 JWT 密钥")
    fi
}

#------------------------------------------------------------------------------
# 服务验证
#------------------------------------------------------------------------------

#==============================================================================
# 函数: verify_service
# 描述: 验证服务配置和状态
# 参数: 无
# 返回值: 无
# 验证项:
#   - 启动脚本存在
#   - systemd 服务配置
#   - 服务运行状态
#==============================================================================
verify_service() {
    log_info "验证服务..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    
    #------------------------------------------------------------------------------
    # 检查启动脚本
    #------------------------------------------------------------------------------
    if [[ -f "${INSTALL_PREFIX:-/usr/local}/bin/silktalk" ]]; then
        VERIFY_PASSED+=("启动脚本存在")
    else
        VERIFY_WARNINGS+=("启动脚本不存在")
    fi
    
    #------------------------------------------------------------------------------
    # 检查 systemd 服务
    #------------------------------------------------------------------------------
    if [[ -f "/etc/systemd/system/silktalk.service" ]]; then
        VERIFY_PASSED+=("systemd 服务已配置")
        
        # 检查服务状态
        if systemctl is-active --quiet silktalk 2>/dev/null; then
            VERIFY_PASSED+=("服务正在运行")
        else
            VERIFY_WARNINGS+=("服务未运行 (可手动启动)")
        fi
    fi
}

#------------------------------------------------------------------------------
# 网络验证
#------------------------------------------------------------------------------

#==============================================================================
# 函数: verify_network
# 描述: 验证网络配置
# 参数: 无
# 返回值: 无
# 验证项:
#   - 端口占用情况
#   - 防火墙配置
#==============================================================================
verify_network() {
    log_info "验证网络..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    local config_file="${install_dir}/config/silktalk.config.json"
    
    if [[ ! -f "$config_file" ]]; then
        return
    fi
    
    #------------------------------------------------------------------------------
    # 读取端口配置
    #------------------------------------------------------------------------------
    local http_port
    http_port=$(grep -o '"port":[0-9]*' "$config_file" | head -1 | cut -d: -f2)
    http_port=${http_port:-3000}
    
    #------------------------------------------------------------------------------
    # 检查端口占用
    #------------------------------------------------------------------------------
    if netstat -tuln 2>/dev/null | grep -q ":${http_port} "; then
        local pid
        pid=$(lsof -t -i:${http_port} 2>/dev/null || echo "")
        if [[ -n "$pid" ]]; then
            VERIFY_PASSED+=("端口 ${http_port} 已被占用 (PID: $pid)")
        else
            VERIFY_WARNINGS+=("端口 ${http_port} 已被占用")
        fi
    else
        VERIFY_PASSED+=("端口 ${http_port} 可用")
    fi
    
    #------------------------------------------------------------------------------
    # 检查防火墙
    #------------------------------------------------------------------------------
    if command -v ufw > /dev/null && ufw status | grep -q "Status: active"; then
        if ufw status | grep -q "${http_port}"; then
            VERIFY_PASSED+=("防火墙已开放端口 ${http_port}")
        else
            VERIFY_WARNINGS+=("防火墙可能需要开放端口 ${http_port}")
        fi
    fi
}

#------------------------------------------------------------------------------
# 功能测试
#------------------------------------------------------------------------------

#==============================================================================
# 函数: run_functional_tests
# 描述: 运行功能测试
# 参数: 无
# 返回值: 无
# 测试项:
#   - Node.js 运行测试
#   - 项目代码语法检查
#==============================================================================
run_functional_tests() {
    log_info "运行功能测试..."
    
    local install_dir="${INSTALL_PREFIX:-/usr/local}/silktalk-pro"
    
    #------------------------------------------------------------------------------
    # 测试 Node.js 运行
    #------------------------------------------------------------------------------
    if node -e "console.log('Node.js test OK')" > /dev/null 2>&1; then
        VERIFY_PASSED+=("Node.js 运行正常")
    else
        VERIFY_FAILED+=("Node.js 运行异常")
    fi
    
    #------------------------------------------------------------------------------
    # 测试项目代码语法
    #------------------------------------------------------------------------------
    if [[ -f "${install_dir}/dist/index.js" ]]; then
        if node --check "${install_dir}/dist/index.js" 2>/dev/null; then
            VERIFY_PASSED+=("主程序语法检查通过")
        else
            VERIFY_WARNINGS+=("主程序语法检查失败")
        fi
    fi
}

#------------------------------------------------------------------------------
# 性能测试
#------------------------------------------------------------------------------

#==============================================================================
# 函数: run_performance_tests
# 描述: 运行性能测试
# 参数: 无
# 返回值: 无
# 测试项:
#   - 内存可用量
#   - 磁盘可用空间
#==============================================================================
run_performance_tests() {
    log_info "运行性能测试..."
    
    #------------------------------------------------------------------------------
    # 内存测试
    #------------------------------------------------------------------------------
    local mem_available
    mem_available=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo "0")
    if [[ "$mem_available" -gt 512 ]]; then
        VERIFY_PASSED+=("内存充足 (${mem_available}MB 可用)")
    else
        VERIFY_WARNINGS+=("内存较低 (${mem_available}MB 可用)")
    fi
    
    #------------------------------------------------------------------------------
    # 磁盘测试
    #------------------------------------------------------------------------------
    local disk_available
    disk_available=$(df -BM "${INSTALL_PREFIX:-/usr/local}" 2>/dev/null | awk 'NR==2{print $4}' | sed 's/M//' || echo "0")
    if [[ "$disk_available" -gt 100 ]]; then
        VERIFY_PASSED+=("磁盘空间充足 (${disk_available}MB 可用)")
    else
        VERIFY_WARNINGS+=("磁盘空间较低 (${disk_available}MB 可用)")
    fi
}

#------------------------------------------------------------------------------
# 报告生成
#------------------------------------------------------------------------------

#==============================================================================
# 函数: generate_report
# 描述: 生成验证报告
# 参数: 无
# 返回值:
#   0 - 无失败项
#   1 - 有失败项
# 副作用: 创建 Markdown 报告文件
#==============================================================================
generate_report() {
    local report_file="${OUTPUT_DIR}/verify-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p "$OUTPUT_DIR"
    
    local total_checks
    total_checks=$((${#VERIFY_PASSED[@]} + ${#VERIFY_FAILED[@]} + ${#VERIFY_WARNINGS[@]}))
    local overall_status="✅ 通过"
    
    if [[ ${#VERIFY_FAILED[@]} -gt 0 ]]; then
        overall_status="❌ 失败"
    elif [[ ${#VERIFY_WARNINGS[@]} -gt 0 ]]; then
        overall_status="⚠️ 有警告"
    fi
    
    #------------------------------------------------------------------------------
    # 生成 Markdown 报告
    #------------------------------------------------------------------------------
    cat > "$report_file" << EOF
# SilkTalk Pro 安装验证报告

**验证时间:** $(date '+%Y-%m-%d %H:%M:%S')  
**整体状态:** $overall_status  
**总检查项:** $total_checks  
**通过:** ${#VERIFY_PASSED[@]}  
**失败:** ${#VERIFY_FAILED[@]}  
**警告:** ${#VERIFY_WARNINGS[@]}

## 通过的检查

EOF

    for item in "${VERIFY_PASSED[@]}"; do
        echo "- ✅ $item" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## 失败的检查

EOF

    if [[ ${#VERIFY_FAILED[@]} -eq 0 ]]; then
        echo "✅ 无" >> "$report_file"
    else
        for item in "${VERIFY_FAILED[@]}"; do
            echo "- ❌ $item" >> "$report_file"
        done
    fi
    
    cat >> "$report_file" << EOF

## 警告

EOF

    if [[ ${#VERIFY_WARNINGS[@]} -eq 0 ]]; then
        echo "✅ 无" >> "$report_file"
    else
        for item in "${VERIFY_WARNINGS[@]}"; do
            echo "- ⚠️ $item" >> "$report_file"
        done
    fi
    
    cat >> "$report_file" << EOF

## 后续步骤

EOF

    if [[ ${#VERIFY_FAILED[@]} -gt 0 ]]; then
        cat >> "$report_file" << 'EOF'
1. 修复失败的检查项
2. 运行故障诊断: `./scripts/troubleshoot.sh`
3. 重新验证: `./scripts/verify-install.sh`
EOF
    else
        cat >> "$report_file" << 'EOF'
1. 启动服务: `silktalk` 或 `sudo systemctl start silktalk`
2. 查看日志: `tail -f /usr/local/silktalk-pro/logs/app.log`
3. 访问服务: `http://localhost:3000`
EOF
    fi
    
    log_info "验证报告已保存: $report_file"
    
    #------------------------------------------------------------------------------
    # 输出控制台摘要
    #------------------------------------------------------------------------------
    echo ""
    echo "=========================================="
    echo "验证摘要"
    echo "=========================================="
    echo "总检查项: $total_checks"
    echo "通过: ${#VERIFY_PASSED[@]}"
    echo "失败: ${#VERIFY_FAILED[@]}"
    echo "警告: ${#VERIFY_WARNINGS[@]}"
    echo "状态: $overall_status"
    echo "=========================================="
    
    #------------------------------------------------------------------------------
    # 返回码
    #------------------------------------------------------------------------------
    if [[ ${#VERIFY_FAILED[@]} -gt 0 ]]; then
        return 1
    fi
    return 0
}

#------------------------------------------------------------------------------
# 主函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: main
# 描述: 脚本入口函数
# 参数: $@ - 所有命令行参数
# 返回值:
#   0 - 验证通过
#   1 - 验证失败
#==============================================================================
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 输出开始信息
    log_info "=========================================="
    log_info "SilkTalk Pro 安装验证"
    log_info "=========================================="
    
    #------------------------------------------------------------------------------
    # 执行各项验证
    #------------------------------------------------------------------------------
    verify_files
    verify_dependencies
    verify_config
    verify_service
    verify_network
    run_functional_tests
    run_performance_tests
    
    # 生成报告
    generate_report
}

# 调用主函数
main "$@"
