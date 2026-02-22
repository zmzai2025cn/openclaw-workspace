# 多平台 Dockerfile
# 支持 Node.js 18/20/22 在 Linux 环境下的测试

# ============================================
# 基础镜像 - Node.js 18
# ============================================
FROM node:18-alpine AS base-node18
WORKDIR /app
RUN apk add --no-cache git python3 make g++

# ============================================
# 基础镜像 - Node.js 20
# ============================================
FROM node:20-alpine AS base-node20
WORKDIR /app
RUN apk add --no-cache git python3 make g++

# ============================================
# 基础镜像 - Node.js 22
# ============================================
FROM node:22-alpine AS base-node22
WORKDIR /app
WORKDIR /app
RUN apk add --no-cache git python3 make g++

# ============================================
# 依赖安装阶段
# ============================================
FROM base-node20 AS dependencies
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# ============================================
# 构建阶段
# ============================================
FROM dependencies AS builder
WORKDIR /app

# 复制源代码
COPY . .

# 构建
RUN npm run build

# ============================================
# 生产镜像
# ============================================
FROM node:20-alpine AS production
WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache ca-certificates

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 只安装生产依赖
RUN npm ci --only=production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S silktalk -u 1001

# 切换用户
USER silktalk

# 暴露端口
EXPOSE 4001 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# 启动命令
CMD ["node", "dist/cli/index.js", "start"]

# ============================================
# 测试镜像
# ============================================
FROM base-node20 AS test
WORKDIR /app

# 安装测试依赖
RUN apk add --no-cache \
    curl \
    iputils \
    iptables \
    iproute2 \
    net-tools

# 复制依赖和源码
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# 构建
RUN npm run build

# 默认运行测试
CMD ["npm", "test"]

# ============================================
# 混沌测试镜像
# ============================================
FROM base-node20 AS chaos-test
WORKDIR /app

# 安装混沌工程工具
RUN apk add --no-cache \
    curl \
    iputils \
    iptables \
    iproute2 \
    net-tools \
    stress-ng \
    tcpdump

# 复制依赖和源码
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# 构建
RUN npm run build

# 默认运行混沌测试
CMD ["npm", "run", "test:chaos"]

# ============================================
# 性能测试镜像
# ============================================
FROM base-node20 AS perf-test
WORKDIR /app

# 安装性能测试工具
RUN apk add --no-cache \
    curl \
    htop \
    sysstat

# 复制依赖和源码
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# 构建
RUN npm run build

# 默认运行性能测试
CMD ["npm", "run", "test:performance"]
