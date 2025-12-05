const PaymentPlan = require('../models/PaymentPlan');
const Payment = require('../models/Payment');
const Contract = require('../models/Contract');
const OperationLog = require('../models/OperationLog');

// 回款计划
exports.getPaymentPlans = async (req, res) => {
  try {
    const { contractId, status } = req.query;
    const query = {};
    if (contractId) query.contractId = contractId;
    if (status) query.status = status;
    
    const plans = await PaymentPlan.find(query);
    res.json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.create({
      ...req.body,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePaymentPlan = async (req, res) => {
  try {
    const plan = await PaymentPlan.findByIdAndUpdate(req.params.id, req.body);
    if (!plan) {
      return res.status(404).json({ success: false, message: '回款计划不存在' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePaymentPlan = async (req, res) => {
  try {
    await PaymentPlan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '回款计划已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 回款记录
exports.getPayments = async (req, res) => {
  try {
    const { contractId, planId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (contractId) query.contractId = contractId;
    if (planId) query.planId = planId;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const payments = await Payment.find(query);
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: payments,
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

exports.createPayment = async (req, res) => {
  try {
    const payment = await Payment.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'payment',
      moduleId: payment.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建回款记录: ${payment.paymentNumber}`,
      newData: payment,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body);
    if (!payment) {
      return res.status(404).json({ success: false, message: '回款记录不存在' });
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '回款记录已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 财务统计
exports.getFinancialSummary = async (req, res) => {
  try {
    const { contractId } = req.query;
    
    if (contractId) {
      const contract = await Contract.findById(contractId);
      if (!contract) {
        return res.status(404).json({ success: false, message: '合同不存在' });
      }
      
      const plans = await PaymentPlan.find({ contractId });
      const payments = await Payment.find({ contractId });
      
      const plannedAmount = plans.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const receivedAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const outstandingAmount = parseFloat(contract.amount || 0) - receivedAmount;
      
      res.json({
        success: true,
        data: {
          contractAmount: contract.amount || 0,
          plannedAmount,
          receivedAmount,
          outstandingAmount,
          plans: plans.length,
          payments: payments.length
        }
      });
    } else {
      // 全局统计
      const contracts = await Contract.find({});
      const allPlans = await PaymentPlan.find({});
      const allPayments = await Payment.find({});
      
      const totalContractAmount = contracts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const totalPlannedAmount = allPlans.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalReceivedAmount = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      
      res.json({
        success: true,
        data: {
          totalContractAmount,
          totalPlannedAmount,
          totalReceivedAmount,
          totalOutstandingAmount: totalContractAmount - totalReceivedAmount,
          contractsCount: contracts.length,
          plansCount: allPlans.length,
          paymentsCount: allPayments.length
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

