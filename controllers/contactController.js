const Contact = require('../models/Contact');
const OperationLog = require('../models/OperationLog');

// 获取联系人列表
exports.getContacts = async (req, res) => {
  try {
    const { customerId, isPrimary } = req.query;
    const query = {};
    
    if (customerId) query.customerId = customerId;
    if (isPrimary !== undefined) query.isPrimary = isPrimary === 'true';
    
    const contacts = await Contact.find(query);
    res.json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个联系人
exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: '联系人不存在' });
    }
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建联系人
exports.createContact = async (req, res) => {
  try {
    const contact = await Contact.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contact',
      moduleId: contact.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建联系人: ${contact.name}`,
      newData: contact,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新联系人
exports.updateContact = async (req, res) => {
  try {
    const oldContact = await Contact.findById(req.params.id);
    if (!oldContact) {
      return res.status(404).json({ success: false, message: '联系人不存在' });
    }
    
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contact',
      moduleId: contact.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新联系人: ${contact.name}`,
      oldData: oldContact,
      newData: contact,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除联系人
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: '联系人不存在' });
    }
    
    await Contact.findByIdAndDelete(req.params.id);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'contact',
      moduleId: contact.id,
      action: 'delete',
      userId: req.user.id,
      userName: req.user.name,
      description: `删除联系人: ${contact.name}`,
      oldData: contact,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, message: '联系人已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

