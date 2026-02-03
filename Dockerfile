# Dockerfile para Zé Delivery Integrador
# Frontend React + Backend FastAPI + Scrapers Node.js

# ============================================
# STAGE 1: Build do Frontend React
# ============================================
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ .
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ============================================
# STAGE 2: Runtime
# ============================================
FROM node:18-bookworm-slim

# Instalar dependências
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    php-cli \
    php-mysql \
    php-curl \
    php-mbstring \
    supervisor \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer usa Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Backend Python
COPY backend/requirements.txt /app/backend/
RUN pip3 install --no-cache-dir --break-system-packages -r /app/backend/requirements.txt
COPY backend/ /app/backend/

# Scrapers Node.js (usa npm, não yarn)
COPY zedelivery-clean/package.json zedelivery-clean/package-lock.json /app/zedelivery-clean/
WORKDIR /app/zedelivery-clean
RUN npm ci --production
WORKDIR /app
COPY zedelivery-clean/ /app/zedelivery-clean/

# Bridge/Sync
COPY bridge/package.json /app/bridge/
WORKDIR /app/bridge
RUN npm install --production
WORKDIR /app
COPY bridge/ /app/bridge/

# Integrador PHP
COPY integrador/ /app/integrador/

# Frontend (build)
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /app/logs /var/log/supervisor
RUN chmod -R 755 /app

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
