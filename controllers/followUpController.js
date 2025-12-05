const FollowUp = require('../models/FollowUp');
const OperationLog = require('../models/OperationLog');

// 获取跟进记录列表
exports.getFollowUps = async (req, res) => {
  try {
    const { type, relatedId, followUpType, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (type) query.type = type;
    if (relatedId) query.relatedId = relatedId;
    if (followUpType) query.followUpType = followUpType;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const followUps = await FollowUp.find(query);
    const total = followUps.length; // 简化处理
    
    res.json({
      success: true,
      data: followUps,
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

// 创建跟进记录
exports.createFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.create({
      ...req.body,
      userId: req.user.id
    });
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: req.body.type,
      moduleId: req.body.relatedId,
      action: 'follow_up',
      userId: req.user.id,
      userName: req.user.name,
      description: `添加跟进记录: ${followUp.title}`,
      newData: followUp,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({ success: true, data: followUp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新跟进记录
exports.updateFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndUpdate(req.params.id, req.body);
    if (!followUp) {
      return res.status(404).json({ success: false, message: '跟进记录不存在' });
    }
    res.json({ success: true, data: followUp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除跟进记录
exports.deleteFollowUp = async (req, res) => {
  try {
    await FollowUp.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '跟进记录已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

