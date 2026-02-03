# Dockerfile para Zé Delivery Integrador - COMPLETO
# Frontend React + Backend FastAPI + Scrapers Node.js

# ============================================
# STAGE 1: Build do Frontend React
# ============================================
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copiar arquivos de dependências
COPY frontend/package.json frontend/yarn.lock ./

# Instalar dependências
RUN yarn install --frozen-lockfile

# Copiar código fonte do frontend
COPY frontend/ .

# Build do frontend (gera pasta /app/frontend/build)
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

# ============================================
# STAGE 2: Runtime Final
# ============================================
FROM node:18-slim

# Instalar Python, PHP e dependências do sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    php-cli \
    php-mysql \
    php-curl \
    php-mbstring \
    chromium \
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
    xdg-utils \
    supervisor \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# ============================================
# Backend Python (FastAPI)
# ============================================
COPY backend/requirements.txt /app/backend/
RUN pip3 install --no-cache-dir --break-system-packages -r /app/backend/requirements.txt

COPY backend/ /app/backend/

# ============================================
# Scrapers Node.js
# ============================================
COPY package*.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

COPY zedelivery-clean/ /app/zedelivery-clean/
COPY integrador/ /app/integrador/
COPY bridge/ /app/bridge/

# ============================================
# Frontend Build (do stage anterior)
# ============================================
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# ============================================
# Configurações
# ============================================
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Criar diretórios necessários
RUN mkdir -p /app/logs /var/log/supervisor

# Permissões
RUN chmod -R 755 /app

# Porta dinâmica do Railway
EXPOSE 8080

# Iniciar supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
