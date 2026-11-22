FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY services/applink-relay ./services/applink-relay
RUN pnpm install --frozen-lockfile --filter @rentready/applink-relay...
WORKDIR /app/services/applink-relay
EXPOSE 8788
CMD ["pnpm", "start"]
