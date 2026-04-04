# Node 20 + Playwright browsers + LaTeX (pdflatex) for parity with docs/03_BACKEND_PRD.md.
# Keep the Playwright base image tag aligned with the `playwright` dependency in package.json.
FROM mcr.microsoft.com/playwright:v1.50.0-noble AS builder

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    texlive-latex-extra \
    texlive-fonts-recommended \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.50.0-noble

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    texlive-latex-extra \
    texlive-fonts-recommended \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/server.js"]
