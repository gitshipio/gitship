
FROM node:20-bookworm AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json ./
RUN yarn install


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.


# Create dummy env for build
ARG NEXT_PUBLIC_GITHUB_APP_NAME
RUN echo "AUTH_SECRET=dummy" > .env && \
    echo "AUTH_GITHUB_ID=dummy" >> .env && \
    echo "AUTH_GITHUB_SECRET=dummy" >> .env && \
    echo "GITHUB_WEBHOOK_SECRET=dummy" >> .env && \
    echo "NEXT_PUBLIC_GITHUB_APP_NAME=$NEXT_PUBLIC_GITHUB_APP_NAME" >> .env

RUN yarn build

# Remove dummy env
RUN rm .env

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl openssh-client ca-certificates && rm -rf /var/lib/apt/lists/*

# Install runtime dependencies for WebSocket handler
RUN npm install ws @kubernetes/client-node --omit=dev --no-save

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

ENV PORT=3000
# set hostname to 0.0.0.0 for container access
ENV HOSTNAME="0.0.0.0"

# Use existing node user
# Re-create .next directory with correct permissions
RUN mkdir .next && chown node:node .next

COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Copy WebSocket server and its handler
COPY --from=builder --chown=node:node /app/ws-server.js ./ws-server.js

USER node

EXPOSE 3000

# Start both Next.js and WebSocket server
CMD ["sh", "-c", "node ws-server.js & node server.js"]
