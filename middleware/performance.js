// API性能监控中间件
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl } = req;
    
    // 只记录慢请求（超过1秒）
    if (duration > 1000) {
      console.warn(`[性能警告] ${method} ${originalUrl} 耗时: ${duration}ms`);
    }
    
    // 记录所有请求（用于调试）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${method} ${originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
};

module.exports = performanceMonitor;

