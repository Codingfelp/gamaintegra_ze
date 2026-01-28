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
      env: {
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
        NODE_ENV: 'production'
      },
      error_file: '/app/logs/ze-v1-error.log',
      out_file: '/app/logs/ze-v1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    },
    {
      name: 'ze-v1-itens',
      script: 'puppeteer-wrapper.js',
      args: 'v1-itens.js',
      cwd: '/app/zedelivery-clean',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
        NODE_ENV: 'production'
      },
      error_file: '/app/logs/ze-v1-itens-error.log',
      out_file: '/app/logs/ze-v1-itens-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    },
    {
      name: 'ze-bridge',
      script: 'index.js',
      cwd: '/app/bridge',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3333
      },
      error_file: '/app/logs/ze-bridge-error.log',
      out_file: '/app/logs/ze-bridge-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
