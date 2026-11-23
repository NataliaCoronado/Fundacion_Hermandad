FROM node:22-alpine
RUN apk add --no-cache font-dejavu
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p /app/datos && chown -R node:node /app/datos
ENV PORT=3000
EXPOSE 3000 3001
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT}/ || exit 1
CMD ["node", "src/server.js"]
