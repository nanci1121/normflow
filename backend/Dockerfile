FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma/ prisma/
RUN npx prisma generate

COPY src/ src/
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

COPY --from=builder /app/dist dist/
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json ./

USER app

EXPOSE 3000

CMD ["node", "dist/server.js"]
