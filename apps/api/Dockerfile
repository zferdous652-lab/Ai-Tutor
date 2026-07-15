# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace apps/api --include-workspace-root

COPY apps/api apps/api
RUN npm run build --workspace apps/api
RUN npm prune --omit=dev --workspace apps/api --include-workspace-root

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
# fontconfig/fonts-dejavu-core: @napi-rs/canvas (used for PDF page -> image rendering ahead of
# vision-model captioning) needs system fonts for reliable text rendering.
# python3/pip/venv: apps/api/scripts/pdf_to_markdown.py (pdfplumber) does the actual PDF text
# extraction — moved off a JS/pdf.js-based library after it hung indefinitely on a real course
# PDF in production. See docs/MVP_PLAN.md.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl fontconfig fonts-dejavu-core python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY apps/api/scripts apps/api/scripts
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r apps/api/scripts/requirements.txt
ENV PATH="/opt/venv/bin:${PATH}"

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
