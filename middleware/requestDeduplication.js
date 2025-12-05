// 请求去重中间件（防止重复请求）
const pendingRequests = new Map();

const requestDeduplication = (req, res, next) => {
  // 只对GET请求进行去重
  if (req.method !== 'GET') {
    return next();
  }
  
  // 生成请求唯一标识
  const requestKey = `${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;
  
  // 检查是否有相同的请求正在处理
  if (pendingRequests.has(requestKey)) {
    // 如果有，等待该请求完成
    return pendingRequests.get(requestKey).then(
      (result) => {
        res.json(result);
      },
      (error) => {
        res.status(error.status || 500).json({
          success: false,
          message: error.message || '请求失败'
        });
      }
    );
  }
  
  // 创建新的请求Promise
  const requestPromise = new Promise((resolve, reject) => {
    // 保存原始res.json和res.status方法
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    
    // 重写res.json以捕获响应
    res.json = function(data) {
      pendingRequests.delete(requestKey);
      originalJson(data);
      resolve(data);
    };
    
    // 重写res.status以处理错误
    res.status = function(code) {
      if (code >= 400) {
        pendingRequests.delete(requestKey);
        reject({ status: code, message: '请求失败' });
      }
      return originalStatus(code);
    };
    
    // 继续处理请求
    next();
  });
  
  // 保存请求Promise
  pendingRequests.set(requestKey, requestPromise);
  
  // 设置超时清理（30秒后自动清理）
  setTimeout(() => {
    if (pendingRequests.has(requestKey)) {
      pendingRequests.delete(requestKey);
    }
  }, 30000);
};

module.exports = requestDeduplication;

