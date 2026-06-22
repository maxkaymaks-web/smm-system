FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs lib.mjs ./
COPY public ./public
EXPOSE 4020
CMD ["node", "server.mjs"]
