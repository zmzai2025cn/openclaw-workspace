FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY dist ./dist

# 创建数据目录
RUN mkdir -p /app/data

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 暴露健康检查端口
EXPOSE 8080

# 启动命令
CMD ["node", "dist/index.js"]
