# Dockerfile para Zé Delivery Integrador - COMPLETO
# Frontend React + Backend FastAPI + Scrapers Node.js com Puppeteer

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
# STAGE 2: Runtime com Python + Node + Chromium
# ============================================
FROM node:18-slim

# Instalar dependências do sistema incluindo Chromium para Puppeteer
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    php-cli \
    php-mysql \
    php-curl \
    php-mbstring \
    supervisor \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    wget \
    gnupg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instalar Google Chrome Stable (mais confiável que Chromium)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar o Chrome instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

WORKDIR /app

# ============================================
# Backend Python (FastAPI)
# ============================================
COPY backend/requirements.txt /app/backend/
RUN pip3 install --no-cache-dir --break-system-packages -r /app/backend/requirements.txt

COPY backend/ /app/backend/

# ============================================
# Zedelivery-clean (Scrapers)
# ============================================
COPY zedelivery-clean/package.json zedelivery-clean/yarn.lock /app/zedelivery-clean/
WORKDIR /app/zedelivery-clean
RUN yarn install --production --frozen-lockfile
WORKDIR /app

COPY zedelivery-clean/ /app/zedelivery-clean/

# ============================================
# Bridge (Sync para Lovable)
# ============================================
COPY bridge/package.json bridge/yarn.lock* /app/bridge/
WORKDIR /app/bridge
RUN yarn install --production --frozen-lockfile || npm install --production
WORKDIR /app

COPY bridge/ /app/bridge/

# ============================================
# Integrador PHP
# ============================================
COPY integrador/ /app/integrador/

# ============================================
# Frontend Build (do stage anterior)
# ============================================
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# ============================================
# Configuração do Supervisor
# ============================================
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Criar diretórios necessários
RUN mkdir -p /app/logs /var/log/supervisor

# Permissões
RUN chmod -R 755 /app

# Railway usa PORT dinamicamente
EXPOSE 8080

# Iniciar supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
