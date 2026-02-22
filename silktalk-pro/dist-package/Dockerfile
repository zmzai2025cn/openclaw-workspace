FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S silktalk && \
    adduser -S silktalk -u 1001

# Create data directory
RUN mkdir -p /data && chown -R silktalk:silktalk /data

USER silktalk

# Expose ports
EXPOSE 4001 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/cli/index.js status || exit 1

# Start command
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["start", "--port", "4001", "--ws-port", "8080"]
