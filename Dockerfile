# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the app
RUN yarn build

# ---- Production Stage ----
FROM node:20-alpine AS production
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV TZ=UTC

# Pass commit hash from build args
ARG COMMIT_HASH
ENV COMMIT_HASH=${COMMIT_HASH}

# Copy only necessary files from build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json /app/yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production --ignore-scripts

# Create a non-root user and use it
RUN addgroup -g 1001 appgroup && adduser -D -u 1001 -G appgroup appuser
USER appuser

# Expose application port (customize if needed)
EXPOSE 3000

# Healthcheck for orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/actuator/liveness || exit 1

# Start the app
CMD ["node", "--require", "./dist/otel.bootstrap.js", "dist/main.js"]
