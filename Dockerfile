# Dockerfile para Zé Delivery Integrador
# Suporta: Node.js, PHP, Puppeteer (headless Chrome)

FROM node:18-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    php-fpm \
    php-mysql \
    php-curl \
    php-json \
    php-mbstring \
    chromium \
    chromium-sandbox \
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
    curl \
    wget \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar o Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json ./
COPY yarn.lock ./

# Instalar dependências Node.js
RUN yarn install --production --frozen-lockfile

# Copiar código da aplicação
COPY . .

# Copiar configuração do supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Criar diretórios necessários
RUN mkdir -p /app/logs /var/log/supervisor

# Dar permissões
RUN chmod -R 755 /app

# Expor porta (se necessário para health check)
EXPOSE 8080

# Iniciar supervisor (gerencia todos os processos)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
