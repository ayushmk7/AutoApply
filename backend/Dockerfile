# Phase 19 — API + worker image (Node 20, TeX, Playwright Chromium deps).
FROM mcr.microsoft.com/playwright:v1.50.0-noble

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/backend/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
COPY templates /workspace/backend/templates

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/server.js"]
