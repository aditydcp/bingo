FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server.js .

RUN mkdir -p data uploads

EXPOSE 3001
CMD ["node", "server.js"]
