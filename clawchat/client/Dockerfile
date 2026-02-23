FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY client.js ./

USER node

CMD ["node", "client.js"]