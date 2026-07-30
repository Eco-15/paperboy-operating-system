# Paperboy OS — Cloud Run image (Next.js standalone output).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The app has grown; next build needs more than Node's ~2GB default heap.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations travel with the image so we can run them against Cloud SQL.
COPY --from=builder /app/drizzle ./drizzle
USER nextjs
# Cloud Run sends traffic to $PORT (default 8080).
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
