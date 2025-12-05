const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');
const Contact = require('../models/Contact');
const FollowUp = require('../models/FollowUp');
const OperationLog = require('../models/OperationLog');

// 获取客户列表
exports.getCustomers = async (req, res) => {
  try {
    const { poolType, category, page = 1, limit = 20, search } = req.query;
    const query = {};

    // 根据用户角色设置数据权限
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.$or = [
        { ownerId: req.user.id },
        { poolType: 'public' }
      ];
    }

    if (poolType) query.poolType = poolType;
    if (category) query.category = category;
    if (search) {
      query.search = search;
    }

    query.limit = limit * 1;
    query.skip = (page - 1) * limit;
    const customers = await Customer.find(query);

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: customers,
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

// 获取公海客户
exports.getPublicCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const customers = await Customer.find({ 
      poolType: 'public',
      limit: limit * 1,
      skip: (page - 1) * limit
    });

    const total = await Customer.countDocuments({ poolType: 'public' });

    res.json({
      success: true,
      data: customers,
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

// 获取私海客户
exports.getPrivateCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { poolType: 'private' };

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    query.limit = limit * 1;
    query.skip = (page - 1) * limit;
    const customers = await Customer.find(query);

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: customers,
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

// 获取单个客户
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }

    // 并行获取关联数据（提高性能）
    const [opportunities, contacts, followUps] = await Promise.all([
      Opportunity.find({ customerId: customer.id, limit: 50 }), // 限制数量
      Contact.find({ customerId: customer.id, limit: 50 }), // 限制数量
      FollowUp.find({ type: 'customer', relatedId: customer.id, limit: 10 })
    ]);

    res.json({
      success: true,
      data: {
        ...customer,
        opportunities,
        contacts,
        followUps
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建客户
exports.createCustomer = async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      createdBy: req.user.id,
      poolType: req.body.poolType || 'public',
      ownerId: req.body.ownerId || null
    };

    const customer = await Customer.create(customerData);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'customer',
      moduleId: customer.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建客户: ${customer.name}`,
      newData: customer,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // 创建跟进记录
    await FollowUp.create({
      type: 'customer',
      relatedId: customer.id,
      title: '客户已创建',
      content: `创建了客户: ${customer.name}`,
      followUpType: 'note',
      userId: req.user.id
    });
    
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新客户
exports.updateCustomer = async (req, res) => {
  try {
    const oldCustomer = await Customer.findById(req.params.id);
    
    if (!oldCustomer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }
    
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() }
    );
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'customer',
      moduleId: customer.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新客户: ${customer.name}`,
      oldData: oldCustomer,
      newData: customer,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除客户
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }
    
    await Customer.findByIdAndDelete(req.params.id);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'customer',
      moduleId: customer.id,
      action: 'delete',
      userId: req.user.id,
      userName: req.user.name,
      description: `删除客户: ${customer.name}`,
      oldData: customer,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, message: '客户已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 领取客户（从公海到私海）
exports.claimCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }

    if (customer.poolType !== 'public') {
      return res.status(400).json({ success: false, message: '客户不在公海' });
    }

    if (customer.ownerId && customer.ownerId.toString() !== req.user.id.toString()) {
      return res.status(400).json({ success: false, message: '客户已被其他销售领取' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(customer.id, {
      poolType: 'private',
      ownerId: req.user.id,
      updatedAt: new Date()
    });

    res.json({ success: true, data: updatedCustomer, message: '客户领取成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 退回公海
exports.returnToPublic = async (req, res) => {
  try {
    const { reason } = req.body;
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }

    // 只有客户的所有者或管理员可以退回
    if (customer.ownerId && 
        customer.ownerId.toString() !== req.user.id.toString() && 
        req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权操作此客户' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(customer.id, {
      poolType: 'public',
      ownerId: null,
      updatedAt: new Date()
    });

    res.json({ success: true, data: updatedCustomer, message: '客户已退回公海' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新客户状态
exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: '客户不存在' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    await Customer.findByIdAndUpdate(req.params.id, updateData);

    // 记录操作日志
    await OperationLog.create({
      moduleType: 'customer',
      moduleId: customer.id,
      action: 'update_status',
      description: `客户状态更新为：${status}${reason ? '，原因：' + reason : ''}`,
      userId: req.user.id,
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: await Customer.findById(req.params.id), 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

