const Role = require('../models/Role');
const User = require('../models/User');
const TransferRule = require('../models/TransferRule');

// 获取角色列表
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find();
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建角色
exports.createRole = async (req, res) => {
  try {
    const role = await Role.create(req.body);
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新角色
exports.updateRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body);

    if (!role) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }

    res.json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除角色
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ success: false, message: '角色不存在' });
    }
    res.json({ success: true, message: '角色已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取用户列表 - 优化为数据库层面分页
exports.getUsers = async (req, res) => {
  const startTime = Date.now();
  const { pool } = require('../config/database');
  const connection = await pool.getConnection();
  
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    console.log('[getUsers] 开始查询用户列表（数据库分页）...', { role, status, page: pageNum, limit: limitNum });
    
    // 构建WHERE条件
    const conditions = [];
    const params = [];
    
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    
    // 先查询总数（不包含密码字段）
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    
    // 查询分页数据（不包含密码字段）
    const [users] = await connection.execute(
      `SELECT id, username, email, name, role, department, level, phone, status, permissions, createdAt, updatedAt, managerId, departmentId 
       FROM users ${whereClause} 
       ORDER BY id DESC 
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const queryTime = Date.now() - startTime;
    console.log(`[getUsers] 查询完成，耗时: ${queryTime}ms，总数: ${total}，返回 ${users.length} 条`);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[getUsers] 查询失败，耗时: ${totalTime}ms`, error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 更新用户角色
exports.updateUserRole = async (req, res) => {
  try {
    const { role, permissions } = req.body;
    const updateData = { role };
    if (permissions) {
      updateData.permissions = permissions;
    }
    
    const user = await User.findByIdAndUpdate(req.params.id, updateData);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 移除密码字段
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新用户信息
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 移除密码字段
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取系统配置（简化版，实际应该存储在数据库或配置文件中）
exports.getSystemConfig = async (req, res) => {
  try {
    // 这里可以从数据库读取配置
    const config = {
      customerPoolRules: {
        maxPrivateCustomers: 100, // 每个销售最多拥有的私海客户数
        autoReturnDays: 30 // 超过30天未跟进自动退回公海
      },
      opportunityRules: {
        autoTransferEnabled: true,
        defaultProbability: 50
      },
      contractRules: {
        requireApproval: true,
        minAmountForApproval: 100000
      }
    };

    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新系统配置
exports.updateSystemConfig = async (req, res) => {
  try {
    // 这里应该保存到数据库
    res.json({ success: true, message: '配置已更新', data: req.body });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取流转规则列表
exports.getTransferRules = async (req, res) => {
  try {
    const rules = await TransferRule.find({});
    // 解析JSON字段
    const rulesWithParsed = rules.map(rule => ({
      ...rule,
      conditions: rule.conditions ? (typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions) : {},
    }));
    res.json({ success: true, data: rulesWithParsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建流转规则
exports.createTransferRule = async (req, res) => {
  try {
    const rule = await TransferRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新流转规则
exports.updateTransferRule = async (req, res) => {
  try {
    const rule = await TransferRule.findByIdAndUpdate(req.params.id, req.body);

    if (!rule) {
      return res.status(404).json({ success: false, message: '规则不存在' });
    }

    // 解析JSON字段
    const ruleWithParsed = {
      ...rule,
      conditions: rule.conditions ? (typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions) : {},
    };

    res.json({ success: true, data: ruleWithParsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除流转规则
exports.deleteTransferRule = async (req, res) => {
  try {
    const rule = await TransferRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: '规则不存在' });
    }
    res.json({ success: true, message: '规则已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

