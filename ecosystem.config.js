// PM2 配置文件
// 在宝塔面板 PM2 管理器中可以直接使用此配置
require('dotenv').config();

module.exports = {
  apps: [{
    name: 'crm-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PORT: process.env.PORT || 3000,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || 3306,
      DB_NAME: process.env.DB_NAME || 'crm',
      DB_USER: process.env.DB_USER || 'crm',
      DB_PASSWORD: process.env.DB_PASSWORD || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
      FRONTEND_URL: process.env.FRONTEND_URL || 'https://crm.yunshangdingchuang.cn',
      API_BASE_URL: process.env.API_BASE_URL || 'https://crm.yunshangdingchuang.cn/api',
      SERVER_URL: process.env.SERVER_URL || 'https://crm.yunshangdingchuang.cn'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};

