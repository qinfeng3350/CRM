// Vercel Serverless Function - 将所有请求代理到 Express 应用
// 设置 Vercel 环境变量，防止 server.js 启动独立服务器
process.env.VERCEL = 'true';

const app = require('../server.js');

// 导出为 Vercel serverless function handler
module.exports = async (req, res) => {
  return app(req, res);
};

