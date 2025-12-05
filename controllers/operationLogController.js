const OperationLog = require('../models/OperationLog');

// 获取操作日志
exports.getLogs = async (req, res) => {
  try {
    const { moduleType, moduleId, userId, action, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (moduleType) query.moduleType = moduleType;
    if (moduleId) query.moduleId = moduleId;
    if (userId) query.userId = userId;
    if (action) query.action = action;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const logs = await OperationLog.find(query);
    const total = logs.length; // 简化处理
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

