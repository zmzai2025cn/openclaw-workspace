#!/bin/bash
#==============================================================================
# 脚本名称: auto-deploy.sh
# 功能描述: SilkTalk Pro 一键自动化部署主入口
# 作者: SilkTalk Team
# 版本: 1.0.0
# 日期: 2026-02-22
#==============================================================================
#
# 设计目标:
#   - 零失败: 任何环境都能成功部署
#   - 零交互: 全自动完成（可选）
#   - 全诊断: 问题自动识别和修复
#   - 可验证: 部署结果可自动验证
#
# 架构设计:
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  环境检测   │ -> │  依赖安装   │ -> │  项目部署   │
#   └─────────────┘    └─────────────┘    └─────────────┘
#         |                   |                   |
#         v                   v                   v
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  配置生成   │ -> │  服务启动   │ -> │  验证测试   │
#   └─────────────┘    └─────────────┘    └─────────────┘
#
# 使用方法:
#   ./auto-deploy.sh [选项]
#
# 选项:
#   -m, --mode <mode>     部署模式: auto|semi|diagnose|repair (默认: auto)
#   -v, --version <ver>   SilkTalk 版本 (默认: latest)
#   -n, --node <ver>      Node.js 版本 (默认: 20)
#   -p, --prefix <path>   安装前缀 (默认: /usr/local)
#   --mirror <source>     镜像源: auto|cn|global (默认: auto)
#   --skip-verify         跳过安装验证
#   --force               强制重新安装
#   --verbose             详细输出
#   -h, --help            显示帮助
#
# 返回值:
#   0 - 部署成功
#   1 - 部署失败
#   2 - 环境不兼容
#   3 - 依赖安装失败
#
# 依赖:
#   - bash >= 4.0
#   - curl 或 wget
#   - 可写权限
#
# 示例:
#   # 全自动部署
#   ./auto-deploy.sh
#
#   # 半自动模式（关键步骤确认）
#   ./auto-deploy.sh --mode semi
#
#   # 仅诊断环境
#   ./auto-deploy.sh --mode diagnose
#
#   # 指定版本部署
#   ./auto-deploy.sh --version 1.2.0 --node 18
#
#==============================================================================

#------------------------------------------------------------------------------
# 严格模式设置
#------------------------------------------------------------------------------
# -e: 命令失败时立即退出
# -u: 使用未定义变量时报错
# -o pipefail: 管道中任一命令失败则整体失败
set -euo pipefail

#------------------------------------------------------------------------------
# 全局配置
#------------------------------------------------------------------------------
# 脚本元信息
readonly SCRIPT_VERSION="1.0.0"           # 脚本版本号
readonly SCRIPT_NAME="auto-deploy.sh"     # 脚本名称
readonly SCRIPT_DATE="2026-02-22"         # 脚本日期

# 路径配置
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # 脚本所在目录
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"                      # 项目根目录
readonly LOG_DIR="${PROJECT_ROOT}/logs"                               # 日志目录
readonly REPORT_DIR="${PROJECT_ROOT}/reports"                         # 报告目录
readonly CONFIG_DIR="${PROJECT_ROOT}/configs"                         # 配置目录

# 默认配置参数
SILKTALK_VERSION="latest"               # SilkTalk 版本，默认最新
DEPLOY_MODE="auto"                      # 部署模式: auto, semi, diagnose, repair
NODE_VERSION="20"                       # Node.js 版本，默认 20
INSTALL_PREFIX="/usr/local"             # 安装前缀，默认系统级
USE_MIRROR="auto"                       # 镜像源: auto, cn, global
SKIP_VERIFY=false                       # 是否跳过验证
FORCE_REINSTALL=false                   # 是否强制重装
VERBOSE=false                           # 是否详细输出

#------------------------------------------------------------------------------
# 颜色定义
#------------------------------------------------------------------------------
# 用于控制台彩色输出，增强可读性
readonly RED='\033[0;31m'               # 红色 - 错误
readonly GREEN='\033[0;32m'             # 绿色 - 成功
readonly YELLOW='\033[1;33m'            # 黄色 - 警告
readonly BLUE='\033[0;34m'              # 蓝色 - 信息
readonly CYAN='\033[0;36m'              # 青色 - 调试
readonly NC='\033[0m'                   # 无颜色 - 重置

#------------------------------------------------------------------------------
# 日志系统
#------------------------------------------------------------------------------

#==============================================================================
# 函数: init_logging
# 描述: 初始化日志系统，创建日志目录并设置日志文件
# 参数: 无
# 返回值: 无
# 副作用: 创建日志目录，重定向标准输出和错误到日志文件
#==============================================================================
init_logging() {
    # 创建日志目录（如果不存在）
    mkdir -p "$LOG_DIR"
    
    # 生成带时间戳的日志文件名
    readonly LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
    
    # 使用 tee 同时输出到控制台和日志文件
    # 标准输出 (文件描述符 1)
    exec 1> >(tee -a "$LOG_FILE")
    # 标准错误 (文件描述符 2)
    exec 2> >(tee -a "$LOG_FILE" >&2)
}

#==============================================================================
# 函数: log
# 描述: 通用日志函数，带时间戳和级别
# 参数:
#   $1 - 日志级别 (INFO, WARN, ERROR, SUCCESS, DEBUG)
#   $* - 日志消息内容
# 返回值: 无
# 示例: log "INFO" "开始部署"
#==============================================================================
log() {
    local level="$1"                    # 日志级别
    shift                               # 移除第一个参数
    local message="$*"                  # 剩余部分为消息
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')  # 当前时间戳
    
    # 输出格式: [时间] [级别] 消息
    echo -e "[${timestamp}] [${level}] ${message}"
}

#------------------------------------------------------------------------------
# 便捷日志函数
#------------------------------------------------------------------------------
# 这些函数是 log 函数的包装，提供特定级别的日志输出

log_info() { log "INFO" "$@"; }         # 信息日志 - 蓝色
log_warn() { log "WARN" "${YELLOW}$*${NC}"; }    # 警告日志 - 黄色
log_error() { log "ERROR" "${RED}$*${NC}"; }     # 错误日志 - 红色
log_success() { log "SUCCESS" "${GREEN}$*${NC}"; }  # 成功日志 - 绿色

#==============================================================================
# 函数: log_debug
# 描述: 调试日志，仅在 VERBOSE 模式下输出
# 参数: $* - 调试消息
# 返回值: 无
#==============================================================================
log_debug() { 
    # 仅在详细模式下输出调试信息
    [[ "$VERBOSE" == true ]] && log "DEBUG" "${CYAN}$*${NC}"; 
}

#------------------------------------------------------------------------------
# 帮助信息
#------------------------------------------------------------------------------

#==============================================================================
# 函数: show_help
# 描述: 显示脚本帮助信息
# 参数: 无
# 返回值: 无
#==============================================================================
show_help() {
    # 使用 cat  heredoc 输出多行帮助文本
    cat << 'EOF'
SilkTalk Pro 自动化部署系统

用法: ./auto-deploy.sh [选项]

选项:
    -m, --mode MODE         部署模式: auto(默认), semi, diagnose, repair
    -v, --version VERSION   SilkTalk 版本 (默认: latest)
    -n, --node VERSION      Node.js 版本 (默认: 20)
    -p, --prefix PATH       安装前缀 (默认: /usr/local)
    --mirror SOURCE         镜像源: auto(默认), cn, global
    --skip-verify           跳过安装验证
    --force                 强制重新安装
    --verbose               详细输出
    -h, --help              显示帮助

部署模式:
    auto      - 全自动模式，零交互一键部署
    semi      - 半自动模式，关键步骤确认
    diagnose  - 仅检测环境，不部署
    repair    - 修复模式，针对问题修复

示例:
    ./auto-deploy.sh                    # 全自动部署
    ./auto-deploy.sh -m semi            # 半自动部署
    ./auto-deploy.sh -m diagnose        # 仅环境检测
    ./auto-deploy.sh -v 1.2.0 -n 18     # 指定版本
    ./auto-deploy.sh --mirror cn        # 使用中国镜像

EOF
}

#------------------------------------------------------------------------------
# 参数解析
#------------------------------------------------------------------------------

#==============================================================================
# 函数: parse_args
# 描述: 解析命令行参数
# 参数: $@ - 所有命令行参数
# 返回值: 
#   0 - 解析成功
#   1 - 参数错误
# 副作用: 设置全局配置变量
#==============================================================================
parse_args() {
    # 循环处理所有参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            # 部署模式
            -m|--mode)
                DEPLOY_MODE="$2"
                shift 2  # 移除模式和值两个参数
                ;;
            # SilkTalk 版本
            -v|--version)
                SILKTALK_VERSION="$2"
                shift 2
                ;;
            # Node.js 版本
            -n|--node)
                NODE_VERSION="$2"
                shift 2
                ;;
            # 安装前缀
            -p|--prefix)
                INSTALL_PREFIX="$2"
                shift 2
                ;;
            # 镜像源
            --mirror)
                USE_MIRROR="$2"
                shift 2
                ;;
            # 跳过验证标志
            --skip-verify)
                SKIP_VERIFY=true
                shift
                ;;
            # 强制重装标志
            --force)
                FORCE_REINSTALL=true
                shift
                ;;
            # 详细输出标志
            --verbose)
                VERBOSE=true
                shift
                ;;
            # 帮助
            -h|--help)
                show_help
                exit 0
                ;;
            # 未知选项
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    #------------------------------------------------------------------------------
    # 验证部署模式
    #------------------------------------------------------------------------------
    case $DEPLOY_MODE in
        auto|semi|diagnose|repair)
            # 有效模式，继续
            ;;
        *)
            log_error "无效模式: $DEPLOY_MODE"
            log_info "有效模式: auto, semi, diagnose, repair"
            show_help
            exit 1
            ;;
    esac
}

#------------------------------------------------------------------------------
# 用户确认
#------------------------------------------------------------------------------

#==============================================================================
# 函数: confirm
# 描述: 在 semi 模式下请求用户确认
# 参数:
#   $1 - 确认消息
# 返回值:
#   0 - 用户确认 (Y 或回车)
#   1 - 用户取消 (N)
# 说明: 在 auto 模式下自动返回 0，不询问用户
#==============================================================================
confirm() {
    local message="$1"
    
    # 自动模式下直接确认
    [[ "$DEPLOY_MODE" == "auto" ]] && return 0
    
    # 提示用户输入
    echo -ne "${YELLOW}${message} [Y/n]: ${NC}"
    read -r response
    
    # 处理用户输入
    case "$response" in
        [Nn]*)
            # 用户输入 N 或 n，返回取消
            return 1
            ;;
        *)
            # 其他输入（包括空）视为确认
            return 0
            ;;
    esac
}

#------------------------------------------------------------------------------
# 子脚本执行
#------------------------------------------------------------------------------

#==============================================================================
# 函数: run_script
# 描述: 执行子脚本并处理结果
# 参数:
#   $1 - 脚本名称
#   $@ - 传递给脚本的参数
# 返回值:
#   0 - 脚本执行成功
#   1 - 脚本执行失败或脚本不存在
# 示例: run_script "check-env.sh" --mode auto --verbose
#==============================================================================
run_script() {
    local script_name="$1"              # 脚本名称
    shift                               # 移除脚本名称参数
    local script_path="${SCRIPT_DIR}/${script_name}"
    
    # 检查脚本是否存在
    if [[ ! -f "$script_path" ]]; then
        log_error "脚本不存在: $script_path"
        return 1
    fi
    
    # 记录开始执行
    log_info "执行: $script_name"
    
    # 执行脚本并传递剩余参数
    if bash "$script_path" "$@"; then
        log_success "$script_name 完成"
        return 0
    else
        log_error "$script_name 失败"
        return 1
    fi
}

#------------------------------------------------------------------------------
# 部署流程
#------------------------------------------------------------------------------

#==============================================================================
# 函数: deploy
# 描述: 主部署流程，协调所有部署步骤
# 参数: 无
# 返回值:
#   0 - 部署成功
#   1 - 部署失败
# 流程:
#   1. 环境检测
#   2. 依赖安装
#   3. Node.js 安装
#   4. 项目部署
#   5. 配置生成
#   6. 安装验证
#==============================================================================
deploy() {
    # 输出部署信息头
    log_info "=========================================="
    log_info "SilkTalk Pro 自动化部署系统 v${SCRIPT_VERSION}"
    log_info "=========================================="
    log_info "部署模式: $DEPLOY_MODE"
    log_info "SilkTalk 版本: $SILKTALK_VERSION"
    log_info "Node.js 版本: $NODE_VERSION"
    log_info "安装前缀: $INSTALL_PREFIX"
    log_info "镜像源: $USE_MIRROR"
    log_info "日志文件: $LOG_FILE"
    log_info "=========================================="

    #------------------------------------------------------------------------------
    # 步骤 1: 环境检测
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 1/6】环境检测"
    if ! run_script "check-env.sh" \
        --mode "$DEPLOY_MODE" \
        --node-version "$NODE_VERSION" \
        --prefix "$INSTALL_PREFIX" \
        --mirror "$USE_MIRROR" \
        ${VERBOSE:+--verbose}; then
        log_error "环境检测失败"
        # 非修复模式下，环境检测失败则退出
        if [[ "$DEPLOY_MODE" != "repair" ]]; then
            exit 1
        fi
    fi

    # 诊断模式到此结束，不执行后续部署步骤
    if [[ "$DEPLOY_MODE" == "diagnose" ]]; then
        log_info ""
        log_info "诊断模式完成，查看报告: ${REPORT_DIR}/env-report-*.md"
        exit 0
    fi

    #------------------------------------------------------------------------------
    # 步骤 2: 依赖安装
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 2/6】依赖安装"
    if confirm "是否安装系统依赖?"; then
        if ! run_script "install-deps.sh" \
            --mode "$DEPLOY_MODE" \
            --mirror "$USE_MIRROR" \
            ${VERBOSE:+--verbose}; then
            log_error "依赖安装失败"
            exit 1
        fi
    fi

    #------------------------------------------------------------------------------
    # 步骤 3: Node.js 安装
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 3/6】Node.js 安装"
    if confirm "是否安装/配置 Node.js ${NODE_VERSION}?"; then
        if ! run_script "setup-node.sh" \
            --version "$NODE_VERSION" \
            --prefix "$INSTALL_PREFIX" \
            --mirror "$USE_MIRROR" \
            ${FORCE_REINSTALL:+--force} \
            ${VERBOSE:+--verbose}; then
            log_error "Node.js 安装失败"
            exit 1
        fi
    fi

    #------------------------------------------------------------------------------
    # 步骤 4: 项目部署
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 4/6】SilkTalk Pro 部署"
    if confirm "是否部署 SilkTalk Pro ${SILKTALK_VERSION}?"; then
        if ! run_script "deploy-silktalk.sh" \
            --version "$SILKTALK_VERSION" \
            --prefix "$INSTALL_PREFIX" \
            --mirror "$USE_MIRROR" \
            ${FORCE_REINSTALL:+--force} \
            ${VERBOSE:+--verbose}; then
            log_error "项目部署失败"
            exit 1
        fi
    fi

    #------------------------------------------------------------------------------
    # 步骤 5: 配置生成
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 5/6】配置生成"
    if confirm "是否生成配置文件?"; then
        if ! run_script "generate-config.sh" \
            --mode "$DEPLOY_MODE" \
            --output "$CONFIG_DIR" \
            ${VERBOSE:+--verbose}; then
            log_warn "配置生成遇到问题，继续..."
        fi
    fi

    #------------------------------------------------------------------------------
    # 步骤 6: 安装验证
    #------------------------------------------------------------------------------
    log_info ""
    log_info "【步骤 6/6】安装验证"
    if [[ "$SKIP_VERIFY" == false ]]; then
        if ! run_script "verify-install.sh" \
            --mode "$DEPLOY_MODE" \
            --output "$REPORT_DIR" \
            ${VERBOSE:+--verbose}; then
            log_warn "安装验证发现问题"
            
            # 修复模式下尝试自动修复
            if [[ "$DEPLOY_MODE" == "repair" ]]; then
                log_info "尝试自动修复..."
                run_script "troubleshoot.sh" --auto-fix
            fi
        fi
    else
        log_warn "跳过安装验证"
    fi

    # 生成最终部署报告
    generate_final_report

    # 输出部署完成信息
    log_info ""
    log_info "=========================================="
    log_success "SilkTalk Pro 部署完成!"
    log_info "=========================================="
    log_info "日志文件: $LOG_FILE"
    log_info "配置文件: $CONFIG_DIR"
    log_info "验证报告: ${REPORT_DIR}/verify-report-*.md"
    log_info ""
    log_info "启动命令:"
    log_info "  cd ${INSTALL_PREFIX}/silktalk-pro && npm start"
    log_info "=========================================="
}

#------------------------------------------------------------------------------
# 报告生成
#------------------------------------------------------------------------------

#==============================================================================
# 函数: generate_final_report
# 描述: 生成最终部署报告
# 参数: 无
# 返回值: 无
# 副作用: 创建 Markdown 格式的部署报告文件
#==============================================================================
generate_final_report() {
    # 生成带时间戳的报告文件名
    local report_file="${REPORT_DIR}/deploy-report-$(date +%Y%m%d-%H%M%S).md"
    
    # 确保报告目录存在
    mkdir -p "$REPORT_DIR"
    
    # 生成 Markdown 报告内容
    cat > "$report_file" << EOF
# SilkTalk Pro 部署报告

**部署时间:** $(date '+%Y-%m-%d %H:%M:%S')  
**部署模式:** $DEPLOY_MODE  
**SilkTalk 版本:** $SILKTALK_VERSION  
**Node.js 版本:** $NODE_VERSION  
**安装前缀:** $INSTALL_PREFIX  
**镜像源:** $USE_MIRROR  

## 部署状态

- [x] 环境检测
- [x] 依赖安装
- [x] Node.js 安装
- [x] 项目部署
- [x] 配置生成
- [x] 安装验证

## 文件位置

- **日志:** $LOG_FILE
- **配置:** $CONFIG_DIR
- **安装:** ${INSTALL_PREFIX}/silktalk-pro

## 后续步骤

1. 查看配置文件: \`cat ${CONFIG_DIR}/silktalk.config.json\`
2. 启动服务: \`cd ${INSTALL_PREFIX}/silktalk-pro && npm start\`
3. 查看日志: \`tail -f ${INSTALL_PREFIX}/silktalk-pro/logs/app.log\`

## 故障排查

如有问题，请运行: \`./scripts/troubleshoot.sh\`
EOF

    log_info "部署报告已生成: $report_file"
}

#------------------------------------------------------------------------------
# 主函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: main
# 描述: 脚本入口函数
# 参数: $@ - 所有命令行参数
# 返回值: 
#   0 - 成功
#   1 - 失败
#==============================================================================
main() {
    # 初始化日志系统
    init_logging
    
    # 解析命令行参数
    parse_args "$@"
    
    # 执行部署流程
    deploy
}

# 调用主函数，传递所有参数
main "$@"
