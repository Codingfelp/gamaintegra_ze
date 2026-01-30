// PM2 Ecosystem Configuration - Gamatauri Zé Delivery
// Todos os serviços rodam 24/7 com auto-restart

module.exports = {
  apps: [
    {
      name: 'ze-v1',
      script: 'puppeteer-wrapper.js',
      args: 'v1.js',
      cwd: '/app/zedelivery-clean',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 10000,
      max_restarts: 100,
      env: {
        NODE_ENV: 'production',
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium'
      },
      out_file: '/app/logs/ze-v1-out.log',
      error_file: '/app/logs/ze-v1-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'ze-v1-itens',
      script: 'puppeteer-wrapper.js',
      args: 'v1-itens.js',
      cwd: '/app/zedelivery-clean',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 10000,
      max_restarts: 100,
      env: {
        NODE_ENV: 'production',
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium'
      },
      out_file: '/app/logs/ze-v1-itens-out.log',
      error_file: '/app/logs/ze-v1-itens-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'ze-sync',
      script: 'sync-cron.js',
      cwd: '/app/bridge',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      out_file: '/app/logs/ze-sync-out.log',
      error_file: '/app/logs/ze-sync-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
