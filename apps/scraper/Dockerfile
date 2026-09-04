FROM node:22-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-core \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/scraper/package.json apps/scraper/
COPY packages/shared/package.json packages/shared/

RUN npm ci

COPY packages/shared packages/shared
COPY apps/scraper apps/scraper

WORKDIR /app/apps/scraper
EXPOSE 3102

CMD ["npx", "tsx", "src/worker.ts"]
