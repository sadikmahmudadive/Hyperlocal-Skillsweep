# Multi-stage Dockerfile for Hyperlocal SkillSwap (Next.js)
FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the app
COPY . .
RUN npm run build

# Production image, copy files from build stage
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Next.js build output and required files
COPY --from=deps /app/.next ./.next
COPY --from=deps /app/public ./public
COPY --from=deps /app/next.config.js ./next.config.js
COPY --from=deps /app/tailwind.config.js ./tailwind.config.js
COPY --from=deps /app/postcss.config.js ./postcss.config.js
COPY --from=deps /app/jsconfig.json ./jsconfig.json

# Expose port and define start command
EXPOSE 3000
CMD ["npm", "run", "start"]
