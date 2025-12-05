const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 验证JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    const user = await User.findById(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: '用户不存在或已被禁用' });
    }

    // 移除密码字段
    delete user.password;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '无效的认证令牌' });
  }
};

// 权限检查中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未认证' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    
    next();
  };
};

// 数据权限检查（只能访问自己的数据或团队数据）
const checkDataAccess = (model, field = 'ownerId') => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      // 管理员和销售经理可以访问所有数据
      if (user.role === 'admin' || user.role === 'sales_manager') {
        return next();
      }
      
      // 普通销售只能访问自己的数据
      if (req.params.id) {
        const resource = await model.findById(req.params.id);
        if (!resource) {
          return res.status(404).json({ success: false, message: '资源不存在' });
        }
        
        // 如果资源没有ownerId字段，或者ownerId为空，允许访问（可能是系统创建的数据）
        // 或者如果用户是创建者，也允许访问
        const ownerId = resource[field];
        const createdBy = resource.createdBy;
        
        // 如果用户不是owner也不是创建者，检查是否有待办关联
        if (ownerId && ownerId !== user.id && createdBy && createdBy !== user.id) {
          // 检查是否通过待办关联（待办分配给当前用户）
          // 通过检查路由路径判断是否是合同
          if (req.path.includes('/contracts/') || req.originalUrl.includes('/contracts/')) {
            try {
              const Todo = require('../models/Todo');
              const todos = await Todo.find({ 
                moduleType: 'contract', 
                moduleId: parseInt(req.params.id),
                assigneeId: user.id 
              });
              if (todos && todos.length > 0) {
                // 有分配给当前用户的待办，允许查看
                return next();
              }
            } catch (todoError) {
              console.error('检查待办关联失败:', todoError);
            }
          }
          
          return res.status(403).json({ success: false, message: '无权访问此资源' });
        }
      }
      
      next();
    } catch (error) {
      console.error('权限检查错误:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };
};

module.exports = { authenticate, authorize, checkDataAccess };

