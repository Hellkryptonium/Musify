# Dockerfile for Musify Backend (Node.js + mediasoup)
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000 40000-49999/udp 40000-49999/tcp

ENV NODE_ENV=production

CMD ["node", "index.js"]
