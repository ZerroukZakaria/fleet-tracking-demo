FROM node:22-slim
WORKDIR /app

# Dependencies first, so this layer is cached until a package.json changes.
# Every workspace's package.json is needed for `npm ci` to match the lockfile.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY services/publisher/package.json services/publisher/
COPY services/ingest/package.json services/ingest/
RUN npm ci

COPY packages packages
COPY services services

# Which service this image runs: "publisher" or "ingest"
ARG SERVICE
ENV SERVICE=${SERVICE}

USER node
# exec makes tsx PID 1 so it receives docker's stop signal directly
CMD ["sh", "-c", "exec ./node_modules/.bin/tsx services/$SERVICE/src/index.ts"]