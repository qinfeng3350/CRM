const User = require('../models/User');
const Activity = require('../models/Activity');
const Opportunity = require('../models/Opportunity');
const Contract = require('../models/Contract');
const Customer = require('../models/Customer');

// 获取销售团队
exports.getSalesTeam = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      // 只能看自己
      const user = await User.findById(req.user.id);
      if (user) {
        delete user.password;
        return res.json({ success: true, data: [user] });
      }
      return res.json({ success: true, data: [] });
    }

    // 管理员和销售经理可以看所有销售
    const allUsers = await User.find({});
    const team = allUsers
      .filter(u => (u.role === 'sales' || u.role === 'sales_manager') && u.status === 'active')
      .map(u => {
        const user = { ...u };
        delete user.password;
        return user;
      });
    
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个销售人员
exports.getSalesPerson = async (req, res) => {
  try {
    const salesPerson = await User.findById(req.params.id);
    if (!salesPerson) {
      return res.status(404).json({ success: false, message: '销售人员不存在' });
    }
    delete salesPerson.password;
    res.json({ success: true, data: salesPerson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建销售人员
exports.createSalesPerson = async (req, res) => {
  try {
    const salesData = {
      ...req.body,
      role: 'sales',
      status: 'active'
    };
    const salesPerson = await User.create(salesData);
    delete salesPerson.password;
    res.status(201).json({ success: true, data: salesPerson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新销售人员
exports.updateSalesPerson = async (req, res) => {
  try {
    const salesPerson = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() }
    );
    
    if (!salesPerson) {
      return res.status(404).json({ success: false, message: '销售人员不存在' });
    }
    const updated = await User.findById(req.params.id);
    delete updated.password;
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除销售人员
exports.deleteSalesPerson = async (req, res) => {
  try {
    const salesPerson = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive', updatedAt: new Date() }
    );
    if (!salesPerson) {
      return res.status(404).json({ success: false, message: '销售人员不存在' });
    }
    res.json({ success: true, message: '销售人员已禁用' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售业绩
exports.getSalesPerformance = async (req, res) => {
  try {
    const { salesId, startDate, endDate } = req.query;
    const userId = parseInt(salesId) || req.user.id;

    // 只能查看自己的业绩，除非是管理员
    if (userId !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'sales_manager') {
      return res.status(403).json({ success: false, message: '无权查看他人业绩' });
    }

    // 获取商机
    let oppQuery = { ownerId: userId };
    if (startDate || endDate) {
      // MySQL日期查询需要调整
    }
    const opportunities = await Opportunity.find(oppQuery);
    const wonOpportunities = opportunities.filter(o => o.status === 'won');
    
    // 获取合同
    let contractQuery = { ownerId: userId };
    const contracts = await Contract.find(contractQuery);
    const signedContracts = contracts.filter(c => 
      c.status === 'signed' || c.status === 'executing' || c.status === 'completed'
    );

    // 获取客户
    const customers = await Customer.find({ ownerId: userId });

    const performance = {
      opportunities: {
        total: opportunities.length,
        won: wonOpportunities.length,
        totalAmount: opportunities.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0),
        wonAmount: wonOpportunities.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0)
      },
      contracts: {
        total: contracts.length,
        signed: signedContracts.length,
        totalAmount: contracts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0),
        signedAmount: signedContracts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)
      },
      customers: {
        total: customers.length,
        new: customers.filter(c => {
          if (!c.createdAt) return false;
          const created = new Date(c.createdAt);
          const now = new Date();
          return (now - created) / (1000 * 60 * 60 * 24) <= 30;
        }).length
      },
      conversionRate: opportunities.length > 0 
        ? (wonOpportunities.length / opportunities.length * 100).toFixed(2) 
        : 0
    };

    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售活动
exports.getSalesActivities = async (req, res) => {
  try {
    const { type, customerId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (customerId) query.customerId = parseInt(customerId);

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const activities = await Activity.find(query);
    const total = await Activity.countDocuments(query);

    res.json({
      success: true,
      data: activities,
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

// 创建活动
exports.createActivity = async (req, res) => {
  try {
    const activityData = {
      ...req.body,
      userId: req.user.id
    };
    const activity = await Activity.create(activityData);
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新活动
exports.updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    // 检查权限
    if (activity.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权修改此活动' });
    }

    const updated = await Activity.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() }
    );

    res.json({ success: true, data: await Activity.findById(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售任务
exports.getSalesTasks = async (req, res) => {
  try {
    const { status = 'planned' } = req.query;
    const tasks = await Activity.find({
      userId: req.user.id,
      type: 'task',
      status: status
    });

    // 按开始时间排序
    tasks.sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB;
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售排行榜
exports.getSalesRanking = async (req, res) => {
  try {
    const { period = 'month' } = req.query; // month, quarter, year
    const now = new Date();
    let startDate;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const allUsers = await User.find({});
    const salesPeople = allUsers.filter(u => u.role === 'sales' && u.status === 'active');

    const ranking = await Promise.all(
      salesPeople.map(async (sales) => {
        const contracts = await Contract.find({
          ownerId: sales.id
        });

        // 过滤已签署的合同和日期范围
        const signedContracts = contracts.filter(c => {
          const isSigned = c.status === 'signed' || c.status === 'executing' || c.status === 'completed';
          if (!isSigned) return false;
          if (c.createdAt) {
            const created = new Date(c.createdAt);
            return created >= startDate;
          }
          return false;
        });

        const totalAmount = signedContracts.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
        const count = signedContracts.length;

        return {
          salesId: sales.id,
          name: sales.name,
          email: sales.email,
          department: sales.department,
          contractCount: count,
          totalAmount: totalAmount
        };
      })
    );

    ranking.sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({ success: true, data: ranking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
