#!/bin/bash
# Wrapper para executar v1.js com configurações corretas para ambiente root/container

export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
export PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

cd /app/zedelivery-clean
exec node v1.js "$@"
