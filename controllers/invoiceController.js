const Invoice = require('../models/Invoice');
const OperationLog = require('../models/OperationLog');

exports.getInvoices = async (req, res) => {
  try {
    const { contractId, paymentId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (contractId) query.contractId = contractId;
    if (paymentId) query.paymentId = paymentId;
    if (status) query.status = status;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const invoices = await Invoice.find(query);
    const total = await Invoice.countDocuments(query);
    
    res.json({
      success: true,
      data: invoices,
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

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: '发票不存在' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'invoice',
      moduleId: invoice.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建发票: ${invoice.invoiceNumber}`,
      newData: invoice,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body);
    if (!invoice) {
      return res.status(404).json({ success: false, message: '发票不存在' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '发票已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 打印发票
exports.printInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: '发票不存在' });
    }
    // 返回发票数据用于打印
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

