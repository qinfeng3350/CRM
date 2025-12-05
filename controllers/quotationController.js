const Quotation = require('../models/Quotation');
const QuotationItem = require('../models/QuotationItem');
const Product = require('../models/Product');
const ProductPrice = require('../models/ProductPrice');
const OperationLog = require('../models/OperationLog');
const FollowUp = require('../models/FollowUp');

// 获取报价单列表
exports.getQuotations = async (req, res) => {
  try {
    const { opportunityId, customerId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (opportunityId) query.opportunityId = opportunityId;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    
    // 权限控制
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const quotations = await Quotation.find(query);
    const total = await Quotation.countDocuments(query);
    
    // 获取每个报价单的明细
    const quotationsWithItems = await Promise.all(quotations.map(async (q) => {
      const items = await QuotationItem.findByQuotationId(q.id);
      return { ...q, items };
    }));
    
    res.json({
      success: true,
      data: quotationsWithItems,
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

// 获取单个报价单
exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    const items = await QuotationItem.findByQuotationId(quotation.id);
    quotation.items = items;
    
    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建报价单
exports.createQuotation = async (req, res) => {
  try {
    const { items, ...quotationData } = req.body;
    
    // 计算总金额
    let totalAmount = 0;
    if (items && items.length > 0) {
      items.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
    }
    
    // 应用折扣和税率
    if (quotationData.discount) {
      totalAmount = totalAmount * (1 - quotationData.discount / 100);
    }
    if (quotationData.taxRate) {
      totalAmount = totalAmount * (1 + quotationData.taxRate / 100);
    }
    
    const quotation = await Quotation.create({
      ...quotationData,
      totalAmount,
      ownerId: quotationData.ownerId || req.user.id,
      createdBy: req.user.id
    });
    
    // 创建报价单明细
    if (items && items.length > 0) {
      const quotationItems = items.map((item, index) => ({
        ...item,
        quotationId: quotation.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100),
        sortOrder: index
      }));
      await QuotationItem.createBatch(quotationItems);
    }
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'quotation',
      moduleId: quotation.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建报价单: ${quotation.quotationNumber}`,
      newData: quotation,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    const quotationWithItems = await Quotation.findById(quotation.id);
    const itemsList = await QuotationItem.findByQuotationId(quotation.id);
    quotationWithItems.items = itemsList;
    
    res.status(201).json({ success: true, data: quotationWithItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新报价单
exports.updateQuotation = async (req, res) => {
  try {
    const { items, ...quotationData } = req.body;
    const oldQuotation = await Quotation.findById(req.params.id);
    
    if (!oldQuotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    // 如果更新了明细，重新计算总金额
    if (items && items.length > 0) {
      let totalAmount = 0;
      items.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
      
      if (quotationData.discount) {
        totalAmount = totalAmount * (1 - quotationData.discount / 100);
      }
      if (quotationData.taxRate) {
        totalAmount = totalAmount * (1 + quotationData.taxRate / 100);
      }
      
      quotationData.totalAmount = totalAmount;
      
      // 更新明细
      const quotationItems = items.map((item, index) => ({
        ...item,
        quotationId: req.params.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100),
        sortOrder: index
      }));
      await QuotationItem.createBatch(quotationItems);
    }
    
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, quotationData);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'quotation',
      moduleId: quotation.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新报价单: ${quotation.quotationNumber}`,
      oldData: oldQuotation,
      newData: quotation,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    const quotationWithItems = await Quotation.findById(quotation.id);
    const itemsList = await QuotationItem.findByQuotationId(quotation.id);
    quotationWithItems.items = itemsList;
    
    res.json({ success: true, data: quotationWithItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除报价单
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    await Quotation.findByIdAndDelete(req.params.id);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'quotation',
      moduleId: quotation.id,
      action: 'delete',
      userId: req.user.id,
      userName: req.user.name,
      description: `删除报价单: ${quotation.quotationNumber}`,
      oldData: quotation,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, message: '报价单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 发送报价单
exports.sendQuotation = async (req, res) => {
  try {
    // 先查找报价单
    const quotation = await Quotation.findById(req.params.id);
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    // 更新状态（不包含sentAt字段，因为表中没有该字段）
    const updatedQuotation = await Quotation.findByIdAndUpdate(req.params.id, {
      status: 'sent'
    });
    
    // 创建跟进记录（使用try-catch包裹，避免跟进记录创建失败影响主流程）
    try {
      await FollowUp.create({
        type: 'quotation',
        relatedId: quotation.id,
        title: '报价单已发送',
        content: `报价单 ${quotation.quotationNumber} 已发送给客户`,
        followUpType: 'email',
        userId: req.user.id
      });
    } catch (followUpError) {
      // 记录跟进记录创建失败，但不影响发送操作
      console.error('创建跟进记录失败:', followUpError);
    }
    
    res.json({ success: true, data: updatedQuotation, message: '报价单已发送' });
  } catch (error) {
    console.error('发送报价单错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新报价单状态
exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    // 如果状态变为已发送，记录发送日期
    if (status === 'sent') {
      updateData.sentDate = new Date();
    }

    // 如果状态变为已接受，记录接受日期
    if (status === 'accepted') {
      updateData.acceptedDate = new Date();
    }

    // 如果状态变为已拒绝，记录拒绝日期和原因
    if (status === 'rejected') {
      updateData.rejectedDate = new Date();
      if (reason) {
        updateData.rejectionReason = reason;
      }
    }

    await Quotation.findByIdAndUpdate(req.params.id, updateData);

    // 记录操作日志
    await OperationLog.create({
      moduleType: 'quotation',
      moduleId: quotation.id,
      action: 'update_status',
      description: `报价单状态更新为：${status}${reason ? '，原因：' + reason : ''}`,
      userId: req.user.id,
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: await Quotation.findById(req.params.id), 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

