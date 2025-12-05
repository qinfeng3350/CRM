const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');

// 获取线索列表
exports.getLeads = async (req, res) => {
  try {
    const { status, source, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.$or = [
        { ownerId: req.user.id },
        { ownerId: null }
      ];
    }

    if (status) query.status = status;
    if (source) query.source = source;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const leads = await Lead.find(query);
    const total = await Lead.countDocuments(query);
    
    // 批量加载用户信息（避免N+1查询）
    const User = require('../models/User');
    const ownerIds = [...new Set(leads.map(lead => lead.ownerId).filter(Boolean))];
    const ownerMap = new Map();
    
    if (ownerIds.length > 0) {
      try {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const placeholders = ownerIds.map(() => '?').join(',');
          const [userRows] = await connection.execute(
            `SELECT id, name, email FROM users WHERE id IN (${placeholders})`,
            ownerIds
          );
          userRows.forEach(user => {
            ownerMap.set(user.id, { id: user.id, name: user.name, email: user.email });
          });
        } finally {
          connection.release();
        }
      } catch (userError) {
        console.error('批量加载用户信息失败:', userError.message);
      }
    }
    
    // 关联用户信息
    const leadsWithOwner = leads.map(lead => ({
      ...lead,
      ownerId: lead.ownerId ? (ownerMap.get(lead.ownerId) || null) : null
    }));

    res.json({
      success: true,
      data: leadsWithOwner,
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

// 获取单个线索
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: '线索不存在' });
    }
    
    // 手动关联用户信息
    if (lead.ownerId) {
      const User = require('../models/User');
      const owner = await User.findById(lead.ownerId);
      lead.ownerId = owner ? { id: owner.id, name: owner.name, email: owner.email } : null;
    }
    
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建线索
exports.createLead = async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      ownerId: req.body.ownerId || null
    };
    const lead = await Lead.create(leadData);
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新线索
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body);

    if (!lead) {
      return res.status(404).json({ success: false, message: '线索不存在' });
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除线索
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: '线索不存在' });
    }
    res.json({ success: true, message: '线索已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新线索状态
exports.updateLeadStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: '线索不存在' });
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    // 如果状态变为已转化，记录转化日期
    if (status === 'converted') {
      updateData.convertedDate = new Date();
    }

    await Lead.findByIdAndUpdate(req.params.id, updateData);

    res.json({ 
      success: true, 
      data: await Lead.findById(req.params.id), 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 转化线索为客户或商机
exports.convertLead = async (req, res) => {
  try {
    const { convertTo } = req.body; // 'customer' or 'opportunity'
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: '线索不存在' });
    }

    if (lead.convertedToCustomer || lead.convertedToOpportunity) {
      return res.status(400).json({ success: false, message: '线索已转化' });
    }

    if (convertTo === 'customer') {
      // 转化为客户
      const customer = await Customer.create({
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        poolType: 'private',
        ownerId: lead.ownerId || req.user.id,
        category: 'potential',
        createdBy: req.user.id
      });

      await Lead.findByIdAndUpdate(lead.id, {
        convertedToCustomer: true,
        convertedAt: new Date(),
        status: 'converted'
      });

      res.json({ success: true, data: { customer, lead }, message: '线索已转化为客户' });
    } else if (convertTo === 'opportunity') {
      // 先创建客户，再创建商机
      let customer = await Customer.findOne({ email: lead.email });
      if (!customer) {
        customer = await Customer.create({
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          poolType: 'private',
          ownerId: lead.ownerId || req.user.id,
          category: 'intention',
          createdBy: req.user.id
        });
      }

      const opportunity = await Opportunity.create({
        customerId: customer.id,
        name: `来自线索: ${lead.name}`,
        amount: 0,
        status: 'new',
        ownerId: lead.ownerId || req.user.id,
        source: lead.source,
        createdBy: req.user.id
      });

      await Lead.findByIdAndUpdate(lead.id, {
        convertedToOpportunity: true,
        convertedAt: new Date(),
        status: 'converted'
      });

      res.json({ success: true, data: { customer, opportunity, lead }, message: '线索已转化为商机' });
    } else {
      return res.status(400).json({ success: false, message: '无效的转化类型' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取市场活动列表
exports.getCampaigns = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const campaigns = await Campaign.find(query);
    const total = await Campaign.countDocuments(query);
    
    // 手动关联用户信息
    const User = require('../models/User');
    const campaignsWithCreator = await Promise.all(campaigns.map(async (campaign) => {
      if (campaign.createdBy) {
        const creator = await User.findById(campaign.createdBy);
        return {
          ...campaign,
          createdBy: creator ? { id: creator.id, name: creator.name, email: creator.email } : null
        };
      }
      return campaign;
    }));

    res.json({
      success: true,
      data: campaignsWithCreator,
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

// 获取单个市场活动
exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    
    // 手动关联用户信息
    if (campaign.createdBy) {
      const User = require('../models/User');
      const creator = await User.findById(campaign.createdBy);
      campaign.createdBy = creator ? { id: creator.id, name: creator.name, email: creator.email } : null;
    }
    
    // 手动关联参与者客户信息
    if (campaign.participants && Array.isArray(campaign.participants)) {
      const Customer = require('../models/Customer');
      const participants = typeof campaign.participants === 'string' 
        ? JSON.parse(campaign.participants) 
        : campaign.participants;
      
      campaign.participants = await Promise.all(participants.map(async (p) => {
        if (p.customerId) {
          const customer = await Customer.findById(p.customerId);
          return {
            ...p,
            customerId: customer ? { id: customer.id, name: customer.name, company: customer.company } : null
          };
        }
        return p;
      }));
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建市场活动
exports.createCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user.id
    };
    const campaign = await Campaign.create(campaignData);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新市场活动
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body);

    if (!campaign) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除市场活动
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    res.json({ success: true, message: '活动已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取活动统计
exports.getCampaignStats = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    // 计算ROI
    const revenue = campaign.leadsGenerated * 1000; // 假设每个线索平均价值1000
    const roi = campaign.budget > 0 
      ? ((revenue - campaign.actualCost) / campaign.budget * 100).toFixed(2)
      : 0;

    const stats = {
      participants: campaign.participants.length,
      leadsGenerated: campaign.leadsGenerated,
      conversionRate: campaign.conversionRate,
      budget: campaign.budget,
      actualCost: campaign.actualCost,
      roi: roi
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

