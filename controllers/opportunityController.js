const Opportunity = require('../models/Opportunity');
const Customer = require('../models/Customer');
const TransferRule = require('../models/TransferRule');
const OpportunityProduct = require('../models/OpportunityProduct');
const FollowUp = require('../models/FollowUp');
const OperationLog = require('../models/OperationLog');
const moment = require('moment');

// 获取商机列表
exports.getOpportunities = async (req, res) => {
  try {
    const { status, ownerId, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    } else if (ownerId) {
      query.ownerId = ownerId;
    }

    if (status) query.status = status;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const opportunities = await Opportunity.find(query);
    const total = await Opportunity.countDocuments(query);

    res.json({
      success: true,
      data: opportunities,
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

// 获取单个商机
exports.getOpportunity = async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: '商机不存在' });
    }

    // 获取关联的产品
    const products = await OpportunityProduct.findByOpportunityId(opportunity.id);
    opportunity.products = products;
    
    // 重新计算金额
    let totalAmount = 0;
    products.forEach(p => {
      totalAmount += parseFloat(p.amount || 0);
    });
    if (totalAmount > 0 && opportunity.amount !== totalAmount) {
      opportunity.amount = totalAmount;
    }

    res.json({ success: true, data: opportunity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建商机
exports.createOpportunity = async (req, res) => {
  try {
    const { products, ...opportunityData } = req.body;
    
    // 计算总金额
    let totalAmount = 0;
    if (products && products.length > 0) {
      products.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
    }
    
    const opportunity = await Opportunity.create({
      ...opportunityData,
      amount: totalAmount || opportunityData.amount || 0,
      ownerId: opportunityData.ownerId || req.user.id,
      createdBy: req.user.id
    });
    
    // 创建产品关联
    if (products && products.length > 0) {
      const opportunityProducts = products.map(item => ({
        ...item,
        opportunityId: opportunity.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      }));
      await OpportunityProduct.createBatch(opportunityProducts);
    }
    
    // 如果客户在公海，自动领取到私海
    const customer = await Customer.findById(opportunity.customerId);
    if (customer && customer.poolType === 'public') {
      await Customer.findByIdAndUpdate(customer.id, {
        poolType: 'private',
        ownerId: opportunity.ownerId
      });
    }
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'opportunity',
      moduleId: opportunity.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建商机: ${opportunity.name}`,
      newData: opportunity,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // 创建跟进记录
    await FollowUp.create({
      type: 'opportunity',
      relatedId: opportunity.id,
      title: '商机已创建',
      content: `创建了商机: ${opportunity.name}`,
      followUpType: 'note',
      userId: req.user.id
    });

    const opportunityWithProducts = await Opportunity.findById(opportunity.id);
    const productsList = await OpportunityProduct.findByOpportunityId(opportunity.id);
    opportunityWithProducts.products = productsList;

    res.status(201).json({ success: true, data: opportunityWithProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新商机
exports.updateOpportunity = async (req, res) => {
  try {
    const { products, ...opportunityData } = req.body;
    const oldOpportunity = await Opportunity.findById(req.params.id);
    
    if (!oldOpportunity) {
      return res.status(404).json({ success: false, message: '商机不存在' });
    }
    
    // 如果更新了产品，重新计算金额
    if (products && products.length > 0) {
      let totalAmount = 0;
      products.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
      opportunityData.amount = totalAmount;
      
      // 更新产品关联
      const opportunityProducts = products.map(item => ({
        ...item,
        opportunityId: req.params.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      }));
      await OpportunityProduct.createBatch(opportunityProducts);
    }
    
    const opportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      { ...opportunityData, updatedAt: new Date() }
    );
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'opportunity',
      moduleId: opportunity.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新商机: ${opportunity.name}`,
      oldData: oldOpportunity,
      newData: opportunity,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    const opportunityWithProducts = await Opportunity.findById(opportunity.id);
    const productsList = await OpportunityProduct.findByOpportunityId(opportunity.id);
    opportunityWithProducts.products = productsList;

    res.json({ success: true, data: opportunityWithProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除商机
exports.deleteOpportunity = async (req, res) => {
  try {
    const opportunity = await Opportunity.findByIdAndDelete(req.params.id);
    if (!opportunity) {
      return res.status(404).json({ success: false, message: '商机不存在' });
    }
    res.json({ success: true, message: '商机已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 商机流转
exports.transferOpportunity = async (req, res) => {
  try {
    const { toOwnerId, reason } = req.body;
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: '商机不存在' });
    }

    // 处理流转历史（JSON字段）
    let transferHistory = [];
    if (opportunity.transferHistory) {
      try {
        transferHistory = typeof opportunity.transferHistory === 'string' 
          ? JSON.parse(opportunity.transferHistory) 
          : opportunity.transferHistory;
      } catch (e) {
        transferHistory = [];
      }
    }

    // 记录流转历史
    transferHistory.push({
      fromOwnerId: opportunity.ownerId,
      toOwnerId: toOwnerId,
      fromStatus: opportunity.status,
      toStatus: opportunity.status,
      reason: reason || '',
      transferredBy: req.user.id,
      transferredAt: new Date().toISOString()
    });

    const updatedOpportunity = await Opportunity.findByIdAndUpdate(
      req.params.id,
      {
        ownerId: toOwnerId,
        lastTransferAt: new Date(),
        transferHistory: JSON.stringify(transferHistory),
        updatedAt: new Date()
      }
    );

    res.json({ 
      success: true, 
      data: await Opportunity.findById(req.params.id), 
      message: '商机流转成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新商机状态
exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const opportunity = await Opportunity.findById(req.params.id);

    if (!opportunity) {
      return res.status(404).json({ success: false, message: '商机不存在' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    // 如果成交，记录成交日期
    if (status === 'won') {
      updateData.actualCloseDate = new Date();
    }

    // 如果丢失或退回，可能需要退回公海
    if (status === 'lost' || status === 'returned') {
      const customer = await Customer.findById(opportunity.customerId);
      if (customer) {
        await Customer.findByIdAndUpdate(customer.id, {
          poolType: 'public',
          ownerId: null
        });
      }
    }

    await Opportunity.findByIdAndUpdate(req.params.id, updateData);

    res.json({ 
      success: true, 
      data: await Opportunity.findById(req.params.id), 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售漏斗
exports.getFunnel = async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    const funnel = {
      new: await Opportunity.countDocuments({ ...query, status: 'new' }),
      contacted: await Opportunity.countDocuments({ ...query, status: 'contacted' }),
      qualified: await Opportunity.countDocuments({ ...query, status: 'qualified' }),
      proposal: await Opportunity.countDocuments({ ...query, status: 'proposal' }),
      negotiation: await Opportunity.countDocuments({ ...query, status: 'negotiation' }),
      won: await Opportunity.countDocuments({ ...query, status: 'won' }),
      lost: await Opportunity.countDocuments({ ...query, status: 'lost' })
    };

    // 计算总金额 - 使用MySQL查询
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT SUM(amount) as totalAmount FROM opportunities WHERE status != ?';
      const params = ['lost'];
      
      if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
        sql += ' AND ownerId = ?';
        params.push(req.user.id);
      }
      
      const [rows] = await connection.execute(sql, params);
      funnel.totalAmount = rows[0]?.totalAmount || 0;
    } finally {
      connection.release();
    }

    res.json({
      success: true,
      data: funnel
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 检查自动流转规则
exports.checkAutoTransfer = async (req, res) => {
  try {
    const rules = await TransferRule.find({ enabled: true, autoTransfer: true });
    const now = new Date();
    let transferredCount = 0;

    for (const rule of rules) {
      const query = { status: rule.fromStatus };
      
      if (rule.daysThreshold) {
        const thresholdDate = moment().subtract(rule.daysThreshold, 'days').toDate();
        // MySQL查询需要调整
        query.lastFollowUpAt = { $lt: thresholdDate };
      }

      const opportunities = await Opportunity.find(query);
      
      for (const opp of opportunities) {
        if (rule.returnToPublic) {
          // 退回公海
          const customer = await Customer.findById(opp.customerId);
          if (customer) {
            await Customer.findByIdAndUpdate(customer.id, {
              poolType: 'public',
              ownerId: null
            });
          }
        }

        await Opportunity.findByIdAndUpdate(opp.id, {
          status: rule.toStatus,
          updatedAt: new Date()
        });
        transferredCount++;
      }
    }

    res.json({
      success: true,
      message: `自动流转完成，共处理 ${transferredCount} 个商机`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
