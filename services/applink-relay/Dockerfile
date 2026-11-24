FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY services/applink-relay ./services/applink-relay
RUN pnpm install --frozen-lockfile --filter @rentready/applink-relay... && chown -R node:node /app
USER node
WORKDIR /app/services/applink-relay
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8788) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["pnpm", "start"]
