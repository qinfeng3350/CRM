const Contract = require('../models/Contract');
const Opportunity = require('../models/Opportunity');
const Customer = require('../models/Customer');
const ContractProduct = require('../models/ContractProduct');
const FollowUp = require('../models/FollowUp');
const OperationLog = require('../models/OperationLog');

// 获取合同列表
exports.getContracts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    if (status) query.status = status;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const contracts = await Contract.find(query);
    const total = await Contract.countDocuments(query);

    // 为每个合同加载产品数据
    const contractsWithProducts = await Promise.all(contracts.map(async (contract) => {
      const products = await ContractProduct.findByContractId(contract.id);
      return {
        ...contract,
        products: products
      };
    }));

    res.json({
      success: true,
      data: contractsWithProducts,
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

// 获取单个合同
exports.getContract = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }

    // 获取关联的产品
    const products = await ContractProduct.findByContractId(contract.id);
    contract.products = products;
    
    // 重新计算金额
    let totalAmount = 0;
    products.forEach(p => {
      totalAmount += parseFloat(p.amount || 0);
    });
    if (totalAmount > 0 && contract.amount !== totalAmount) {
      contract.amount = totalAmount;
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建合同（通常从成交的商机生成）
exports.createContract = async (req, res) => {
  try {
    const { products, ...contractData } = req.body;
    
    // 计算总金额
    let totalAmount = 0;
    if (products && products.length > 0) {
      products.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
    }
    
    const contract = {
      ...contractData,
      amount: totalAmount || contractData.amount || 0,
      ownerId: contractData.ownerId || req.user.id,
      createdBy: req.user.id
    };

    // 如果从商机生成，关联商机和产品
    if (contract.opportunityId) {
      const opportunity = await Opportunity.findById(contract.opportunityId);
      if (opportunity) {
        contract.customerId = opportunity.customerId;
        contract.amount = contract.amount || opportunity.amount;
        
        // 从商机复制产品
        if (!products || products.length === 0) {
          const oppProducts = await OpportunityProduct.findByOpportunityId(opportunity.id);
          if (oppProducts.length > 0) {
            products = oppProducts.map(p => ({
              productId: p.productId,
              productName: p.productName,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              discount: p.discount,
              amount: p.amount,
              description: p.description
            }));
            // 重新计算金额
            totalAmount = 0;
            productsToAdd.forEach(item => {
              totalAmount += parseFloat(item.amount || 0);
            });
            contract.amount = totalAmount;
          }
        }
      }
    }

    // 生成合同编号
    if (!contract.contractNumber) {
      const count = await Contract.countDocuments({});
      contract.contractNumber = `CONTRACT-${Date.now()}-${count + 1}`;
    }

    const createdContract = await Contract.create(contract);
    
    // 创建产品关联
    const productsToCreate = products || productsToAdd;
    if (productsToCreate && productsToCreate.length > 0) {
      const contractProducts = productsToCreate.map(item => ({
        ...item,
        contractId: createdContract.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      }));
      await ContractProduct.createBatch(contractProducts);
    }
    
    // 如果状态是pending，自动启动审批流程
    if (contract.status === 'pending') {
      try {
        const approvalController = require('./approvalController');
        // 创建一个模拟的 res 对象
        let approvalResponse = null;
        const mockRes = {
          json: (data) => { approvalResponse = data; },
          status: (code) => ({
            json: (data) => { approvalResponse = data; }
          })
        };
        
        await approvalController.startApproval({
          body: { moduleType: 'contract', moduleId: createdContract.id },
          user: req.user
        }, mockRes);
        
        if (approvalResponse && !approvalResponse.success) {
          console.warn('启动审批流程失败:', approvalResponse.message);
          // 如果审批流程启动失败，将状态改回 draft
          await Contract.findByIdAndUpdate(createdContract.id, { status: 'draft' });
        }
      } catch (e) {
        console.error('启动审批流程失败:', e.message);
        // 如果审批流程启动失败，将状态改回 draft
        await Contract.findByIdAndUpdate(createdContract.id, { status: 'draft' });
      }
    }
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contract',
      moduleId: createdContract.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建合同: ${createdContract.contractNumber}`,
      newData: createdContract,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // 创建跟进记录
    await FollowUp.create({
      type: 'contract',
      relatedId: createdContract.id,
      title: '合同已创建',
      content: `创建了合同: ${createdContract.contractNumber}`,
      followUpType: 'note',
      userId: req.user.id
    });
    
    const contractWithProducts = await Contract.findById(createdContract.id);
    const productsList = await ContractProduct.findByContractId(createdContract.id);
    contractWithProducts.products = productsList;
    
    res.status(201).json({ success: true, data: contractWithProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新合同
exports.updateContract = async (req, res) => {
  try {
    const { products, ...contractData } = req.body;
    const oldContract = await Contract.findById(req.params.id);
    
    if (!oldContract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    // 如果更新了产品，重新计算金额
    if (products && products.length > 0) {
      let totalAmount = 0;
      products.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
      contractData.amount = totalAmount;
      
      // 更新产品关联
      const contractProducts = products.map(item => ({
        ...item,
        contractId: req.params.id,
        amount: (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
      }));
      await ContractProduct.createBatch(contractProducts);
    }
    
    const contract = await Contract.findByIdAndUpdate(
      req.params.id,
      { ...contractData, updatedAt: new Date() }
    );
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contract',
      moduleId: contract.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新合同: ${contract.contractNumber}`,
      oldData: oldContract,
      newData: contract,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    const contractWithProducts = await Contract.findById(contract.id);
    const productsList = await ContractProduct.findByContractId(contract.id);
    contractWithProducts.products = productsList;

    res.json({ success: true, data: contractWithProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除合同
exports.deleteContract = async (req, res) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    res.json({ success: true, message: '合同已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 审批合同
exports.approveContract = async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approve' or 'reject'
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }

    // 处理审批历史（JSON字段）
    let approvalHistory = [];
    if (contract.approvalHistory) {
      try {
        approvalHistory = typeof contract.approvalHistory === 'string' 
          ? JSON.parse(contract.approvalHistory) 
          : contract.approvalHistory;
      } catch (e) {
        approvalHistory = [];
      }
    }

    approvalHistory.push({
      approverId: req.user.id,
      action: action,
      comment: comment || '',
      approvedAt: new Date().toISOString()
    });

    const newStatus = action === 'approve' ? 'approved' : 'draft';

    const updatedContract = await Contract.findByIdAndUpdate(
      req.params.id,
      {
        status: newStatus,
        approvalHistory: JSON.stringify(approvalHistory),
        updatedAt: new Date()
      }
    );

    res.json({ 
      success: true, 
      data: await Contract.findById(req.params.id), 
      message: `合同${action === 'approve' ? '已批准' : '已驳回'}` 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 签订合同
exports.signContract = async (req, res) => {
  try {
    const { signDate } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }

    if (contract.status !== 'approved') {
      return res.status(400).json({ success: false, message: '合同尚未批准，无法签订' });
    }

    const updatedContract = await Contract.findByIdAndUpdate(
      req.params.id,
      {
        status: 'signed',
        signDate: signDate ? new Date(signDate) : new Date(),
        updatedAt: new Date()
      }
    );

    res.json({ 
      success: true, 
      data: await Contract.findById(req.params.id), 
      message: '合同签订成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取合同统计
exports.getContractStats = async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    const stats = {
      total: await Contract.countDocuments(query),
      draft: await Contract.countDocuments({ ...query, status: 'draft' }),
      pending: await Contract.countDocuments({ ...query, status: 'pending' }),
      approved: await Contract.countDocuments({ ...query, status: 'approved' }),
      signed: await Contract.countDocuments({ ...query, status: 'signed' }),
      executing: await Contract.countDocuments({ ...query, status: 'executing' }),
      completed: await Contract.countDocuments({ ...query, status: 'completed' })
    };

    // 计算总金额 - 使用MySQL查询
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT SUM(amount) as totalAmount FROM contracts WHERE 1=1';
      const params = [];
      
      if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
        sql += ' AND ownerId = ?';
        params.push(req.user.id);
      }
      
      const [rows] = await connection.execute(sql, params);
      stats.totalAmount = rows[0]?.totalAmount || 0;
    } finally {
      connection.release();
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新合同状态
exports.updateStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const contract = await Contract.findById(req.params.id);

    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    // 如果状态变为已签订，记录签订日期
    if (status === 'signed') {
      updateData.signDate = new Date();
    }

    // 如果状态变为已生效，记录生效日期
    if (status === 'active') {
      updateData.startDate = new Date();
    }

    await Contract.findByIdAndUpdate(req.params.id, updateData);

    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contract',
      moduleId: contract.id,
      action: 'update_status',
      description: `合同状态更新为：${status}${reason ? '，原因：' + reason : ''}`,
      userId: req.user.id,
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      data: await Contract.findById(req.params.id), 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
