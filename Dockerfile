FROM node:22-alpine
RUN apk add --no-cache font-dejavu
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3000
EXPOSE 3000 3001
CMD ["node", "src/server.js"]
