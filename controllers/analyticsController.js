const Customer = require('../models/Customer');
const Opportunity = require('../models/Opportunity');
const Contract = require('../models/Contract');
const Ticket = require('../models/Ticket');
const moment = require('moment');

// 销售分析
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 销售趋势
    const opportunities = await Opportunity.find(query);
    const contracts = await Contract.find(query);

    // 按时间分组统计
    const salesTrend = {};
    opportunities.forEach(opp => {
      const date = moment(opp.createdAt).format('YYYY-MM-DD');
      if (!salesTrend[date]) {
        salesTrend[date] = { count: 0, amount: 0 };
      }
      salesTrend[date].count++;
      salesTrend[date].amount += opp.amount;
    });

    // 销售漏斗
    const funnel = {
      new: await Opportunity.countDocuments({ ...query, status: 'new' }),
      contacted: await Opportunity.countDocuments({ ...query, status: 'contacted' }),
      qualified: await Opportunity.countDocuments({ ...query, status: 'qualified' }),
      proposal: await Opportunity.countDocuments({ ...query, status: 'proposal' }),
      negotiation: await Opportunity.countDocuments({ ...query, status: 'negotiation' }),
      won: await Opportunity.countDocuments({ ...query, status: 'won' }),
      lost: await Opportunity.countDocuments({ ...query, status: 'lost' })
    };

    // 转化率
    const total = opportunities.length;
    const won = funnel.won;
    const conversionRate = total > 0 ? (won / total * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        salesTrend: Object.entries(salesTrend).map(([date, data]) => ({
          date,
          ...data
        })),
        funnel,
        conversionRate: parseFloat(conversionRate),
        totalAmount: opportunities.reduce((sum, o) => sum + o.amount, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 客户分析
exports.getCustomerAnalytics = async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    // 客户分布
    const distribution = {
      potential: await Customer.countDocuments({ ...query, category: 'potential' }),
      intention: await Customer.countDocuments({ ...query, category: 'intention' }),
      customer: await Customer.countDocuments({ ...query, category: 'customer' }),
      lost: await Customer.countDocuments({ ...query, category: 'lost' })
    };

    // 客户来源分析
    const customers = await Customer.find(query);
    const sourceAnalysis = {};
    customers.forEach(c => {
      const source = c.source || 'unknown';
      sourceAnalysis[source] = (sourceAnalysis[source] || 0) + 1;
    });

    // 客户价值分析（RFM模型简化版）
    const now = new Date();
    const customerValue = customers.map(c => {
      const daysSinceLastContact = c.lastContactAt 
        ? (now - new Date(c.lastContactAt)) / (1000 * 60 * 60 * 24)
        : 999;
      
      // 获取客户关联的合同金额
      return Contract.find({ customerId: c.id })
        .then(contracts => {
          const totalValue = contracts.reduce((sum, ct) => sum + ct.amount, 0);
          return {
            customerId: c.id,
            name: c.name,
            company: c.company,
            totalValue,
            daysSinceLastContact,
            value: totalValue > 100000 ? 'high' : totalValue > 50000 ? 'medium' : 'low'
          };
        });
    });

    const valueAnalysis = await Promise.all(customerValue);

    res.json({
      success: true,
      data: {
        distribution,
        sourceAnalysis,
        valueAnalysis: valueAnalysis.slice(0, 20) // 返回前20个
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 商机分析
exports.getOpportunityAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const opportunities = await Opportunity.find(query)
      .populate('customerId', 'name company');

    // 按状态统计金额
    const statusAmount = {};
    opportunities.forEach(opp => {
      statusAmount[opp.status] = (statusAmount[opp.status] || 0) + opp.amount;
    });

    // 平均成交周期
    const wonOpportunities = opportunities.filter(o => o.status === 'won' && o.actualCloseDate);
    const avgCycle = wonOpportunities.length > 0
      ? wonOpportunities.reduce((sum, o) => {
          const cycle = (new Date(o.actualCloseDate) - new Date(o.createdAt)) / (1000 * 60 * 60 * 24);
          return sum + cycle;
        }, 0) / wonOpportunities.length
      : 0;

    res.json({
      success: true,
      data: {
        total: opportunities.length,
        totalAmount: opportunities.reduce((sum, o) => sum + o.amount, 0),
        statusAmount,
        avgCycle: avgCycle.toFixed(1),
        topOpportunities: opportunities
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 合同分析
exports.getContractAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const contracts = await Contract.find(query);

    // 按状态统计
    const statusStats = {};
    contracts.forEach(ct => {
      statusStats[ct.status] = (statusStats[ct.status] || 0) + 1;
    });

    // 合同金额统计
    const totalAmount = contracts.reduce((sum, c) => sum + c.amount, 0);
    const signedAmount = contracts
      .filter(c => ['signed', 'executing', 'completed'].includes(c.status))
      .reduce((sum, c) => sum + c.amount, 0);

    // 即将到期的合同
    const now = new Date();
    const upcomingExpiry = contracts.filter(c => {
      if (!c.endDate) return false;
      const daysUntilExpiry = (new Date(c.endDate) - now) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    });

    res.json({
      success: true,
      data: {
        total: contracts.length,
        statusStats,
        totalAmount,
        signedAmount,
        upcomingExpiry: upcomingExpiry.length,
        contracts: upcomingExpiry.slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 自定义报表
exports.getCustomReport = async (req, res) => {
  try {
    const { type, fields, filters, groupBy } = req.body;

    // 这里可以根据type动态查询不同的模型
    let Model;
    switch (type) {
      case 'customer':
        Model = Customer;
        break;
      case 'opportunity':
        Model = Opportunity;
        break;
      case 'contract':
        Model = Contract;
        break;
      default:
        return res.status(400).json({ success: false, message: '无效的报表类型' });
    }

    const query = filters || {};
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.ownerId = req.user.id;
    }

    const data = await Model.find(query).select(fields || '').limit(1000);

    res.json({
      success: true,
      data: {
        type,
        count: data.length,
        records: data
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 导出报表
exports.exportReport = async (req, res) => {
  try {
    const { type, format = 'json' } = req.body;

    // 这里可以实现CSV、Excel等格式的导出
    // 简化版本只返回JSON
    res.json({
      success: true,
      message: '导出功能开发中，当前仅支持JSON格式',
      format
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

