# Dockerfile para Zé Delivery Integrador
# Frontend React + Backend FastAPI + Sync

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
FROM python:3.11-slim

# Instalar Node.js e dependências
RUN apt-get update && apt-get install -y \
    curl \
    supervisor \
    php-cli \
    php-mysql \
    php-curl \
    php-mbstring \
    --no-install-recommends \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend Python
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/

# Bridge/Sync Node.js
COPY bridge/package.json /app/bridge/
WORKDIR /app/bridge
RUN npm install --production
WORKDIR /app
COPY bridge/ /app/bridge/

# Integrador PHP
COPY integrador/ /app/integrador/

# Frontend (build do stage 1)
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Diretórios
RUN mkdir -p /app/logs /var/log/supervisor

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
