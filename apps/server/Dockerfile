# Production API image (NestJS)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json apps/server/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
COPY packages/config/package.json packages/config/
COPY packages/utils/package.json packages/utils/
RUN pnpm install --frozen-lockfile --filter @lumea/server...

FROM deps AS build
COPY apps/server apps/server
COPY packages packages
COPY scripts scripts
RUN pnpm --filter @lumea/types build \
  && pnpm --filter @lumea/utils build \
  && pnpm --filter @lumea/validation build \
  && pnpm --filter @lumea/server prisma:generate \
  && pnpm --filter @lumea/server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S lumea && adduser -S lumea -G lumea
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=build /app/apps/server/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
USER lumea
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health/live || exit 1
CMD ["node", "dist/main.js"]
