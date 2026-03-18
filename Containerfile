FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY hyui-kit/ ./hyui-kit/
COPY package.json bun.lock* ./
RUN sed -i 's|file:../hyui-kit|file:./hyui-kit|' package.json && \
    (bun install --frozen-lockfile || bun install)
COPY . .
RUN bun run build

FROM nginx:alpine AS runner
COPY deployment/nginx-static.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
