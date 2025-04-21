# Build stage
FROM node:23-alpine AS base

WORKDIR /app

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN mkdir -p /pnpm
RUN corepack enable
RUN corepack prepare pnpm@9.15.2 --activate 
RUN pnpm install -g pnpm
RUN pnpm install turbo --global

FROM base AS builder

WORKDIR /app
COPY . .

# Copy package files
RUN turbo prune --scope=@mcp-servers/add-demo-sse --docker 

FROM base AS installer

WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Build the project
COPY --from=builder /app/out/full/ .
COPY tsconfig.json ./tsconfig.json
RUN pnpm turbo run build --filter=@mcp-servers/add-demo-sse...

FROM base AS runner

WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy the built application and all its dependencies
COPY --from=installer --chown=nextjs:nodejs /app/packages/add-demo-sse/dist ./packages/add-demo-sse/dist
COPY --from=installer --chown=nextjs:nodejs /app/packages/add-demo-sse/package.json ./packages/add-demo-sse/package.json
COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nextjs:nodejs /app/packages ./packages

# Set up the correct working directory and environment
WORKDIR /app/packages/add-demo-sse
ENV NODE_PATH=/app/node_modules

# Set the entry point
ENTRYPOINT ["node", "dist/index.js"] 