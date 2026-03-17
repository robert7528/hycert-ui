FROM oven/bun:1-alpine AS deps

WORKDIR /app
COPY hyui-kit/ ./hyui-kit/
COPY package.json bun.lock* ./
# CI: hyui-kit is in ./hyui-kit (checked out by workflow)
# Local: file:../hyui-kit — adjust path for Docker context
RUN sed -i 's|file:../hyui-kit|file:./hyui-kit|' package.json && \
    (bun install --frozen-lockfile || bun install)

FROM node:20-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN node node_modules/.bin/next build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
