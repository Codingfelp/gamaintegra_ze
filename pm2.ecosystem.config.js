module.exports = {
  apps: [
    {
      name: 'ze-v1',
      script: 'puppeteer-wrapper.js',
      args: 'v1.js',
      cwd: '/app/zedelivery-clean',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 999999,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,
      env: {
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
        NODE_ENV: 'production'
      },
      error_file: '/app/logs/ze-v1-error.log',
      out_file: '/app/logs/ze-v1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      kill_timeout: 10000
    },
    {
      name: 'ze-v1-itens',
      script: 'puppeteer-wrapper.js',
      args: 'v1-itens.js',
      cwd: '/app/zedelivery-clean',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 999999,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,
      env: {
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
        NODE_ENV: 'production'
      },
      error_file: '/app/logs/ze-v1-itens-error.log',
      out_file: '/app/logs/ze-v1-itens-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      kill_timeout: 10000
    },
    {
      name: 'ze-bridge',
      script: 'index.js',
      cwd: '/app/bridge',
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      max_restarts: 999999,
      env: {
        NODE_ENV: 'production',
        PORT: 3333
      },
      error_file: '/app/logs/ze-bridge-error.log',
      out_file: '/app/logs/ze-bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'ze-sync',
      script: 'sync-cron.js',
      cwd: '/app/bridge',
      autorestart: true,
      watch: false,
      restart_delay: 60000,
      max_restarts: 999999,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/app/logs/ze-sync-error.log',
      out_file: '/app/logs/ze-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
