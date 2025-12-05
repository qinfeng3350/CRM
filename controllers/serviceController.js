const Ticket = require('../models/Ticket');
const Customer = require('../models/Customer');
const Activity = require('../models/Activity');

// 获取工单列表
exports.getTickets = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.$or = [
        { ownerId: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await Ticket.find(query);
    const total = await Ticket.countDocuments(query);

    res.json({
      success: true,
      data: tickets,
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

// 获取单个工单
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建工单
exports.createTicket = async (req, res) => {
  try {
    // 生成工单编号
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    let ticketNumber;
    try {
      const [rows] = await connection.execute('SELECT COUNT(*) as count FROM tickets');
      const count = rows[0].count;
      ticketNumber = `TICKET-${Date.now()}-${count + 1}`;
    } finally {
      connection.release();
    }

    // 处理历史记录
    const history = [{
      action: 'created',
      userId: req.user.id,
      comment: '工单已创建',
      timestamp: new Date().toISOString()
    }];

    const ticketData = {
      ...req.body,
      ticketNumber,
      createdBy: req.user.id,
      status: 'new',
      history: JSON.stringify(history)
    };

    const ticket = await Ticket.create(ticketData);
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新工单
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    // 处理历史记录
    let history = [];
    if (ticket.history) {
      try {
        history = typeof ticket.history === 'string' 
          ? JSON.parse(ticket.history) 
          : ticket.history;
      } catch (e) {
        history = [];
      }
    }

    history.push({
      action: 'updated',
      userId: req.user.id,
      comment: req.body.comment || '工单已更新',
      timestamp: new Date().toISOString()
    });

    const updateData = {
      ...req.body,
      history: JSON.stringify(history),
      updatedAt: new Date()
    };
    delete updateData.comment; // 移除临时字段

    await Ticket.findByIdAndUpdate(req.params.id, updateData);
    const updatedTicket = await Ticket.findById(req.params.id);

    res.json({ success: true, data: updatedTicket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除工单
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }
    res.json({ success: true, message: '工单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 分配工单
exports.assignTicket = async (req, res) => {
  try {
    const { ownerId } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    // 处理历史记录
    let history = [];
    if (ticket.history) {
      try {
        history = typeof ticket.history === 'string' 
          ? JSON.parse(ticket.history) 
          : ticket.history;
      } catch (e) {
        history = [];
      }
    }

    history.push({
      action: 'assigned',
      userId: req.user.id,
      comment: `工单已分配给用户ID: ${ownerId}`,
      timestamp: new Date().toISOString()
    });

    await Ticket.findByIdAndUpdate(req.params.id, {
      ownerId: ownerId,
      status: 'assigned',
      history: JSON.stringify(history),
      updatedAt: new Date()
    });

    res.json({ 
      success: true, 
      data: await Ticket.findById(req.params.id), 
      message: '工单已分配' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 解决工单
exports.resolveTicket = async (req, res) => {
  try {
    const { solution } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    // 处理历史记录
    let history = [];
    if (ticket.history) {
      try {
        history = typeof ticket.history === 'string' 
          ? JSON.parse(ticket.history) 
          : ticket.history;
      } catch (e) {
        history = [];
      }
    }

    history.push({
      action: 'resolved',
      userId: req.user.id,
      comment: solution || '工单已解决',
      timestamp: new Date().toISOString()
    });

    await Ticket.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      solution: solution || ticket.solution,
      resolvedAt: new Date(),
      history: JSON.stringify(history),
      updatedAt: new Date()
    });

    res.json({ 
      success: true, 
      data: await Ticket.findById(req.params.id), 
      message: '工单已解决' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 评价工单
exports.rateTicket = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    if (ticket.status !== 'resolved') {
      return res.status(400).json({ success: false, message: '工单尚未解决，无法评价' });
    }

    const satisfaction = {
      rating: rating,
      comment: comment || '',
      ratedAt: new Date().toISOString()
    };

    await Ticket.findByIdAndUpdate(req.params.id, {
      satisfaction: JSON.stringify(satisfaction),
      status: 'closed',
      updatedAt: new Date()
    });

    res.json({ 
      success: true, 
      data: await Ticket.findById(req.params.id), 
      message: '评价已提交' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取服务统计
exports.getServiceStats = async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      query.$or = [
        { ownerId: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const stats = {
      total: await Ticket.countDocuments(query),
      new: await Ticket.countDocuments({ ...query, status: 'new' }),
      assigned: await Ticket.countDocuments({ ...query, status: 'assigned' }),
      inProgress: await Ticket.countDocuments({ ...query, status: 'in_progress' }),
      resolved: await Ticket.countDocuments({ ...query, status: 'resolved' }),
      closed: await Ticket.countDocuments({ ...query, status: 'closed' })
    };

    // 计算平均满意度 - 使用MySQL查询
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT AVG(JSON_EXTRACT(satisfaction, '$.rating')) as avgRating 
                 FROM tickets 
                 WHERE satisfaction IS NOT NULL AND JSON_EXTRACT(satisfaction, '$.rating') IS NOT NULL`;
      const params = [];
      
      if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
        sql += ' AND (ownerId = ? OR createdBy = ?)';
        params.push(req.user.id, req.user.id);
      }
      
      const [rows] = await connection.execute(sql, params);
      stats.avgSatisfaction = rows[0]?.avgRating ? parseFloat(rows[0].avgRating).toFixed(2) : 0;
    } catch (error) {
      // 如果JSON函数不支持，使用简单方法
      const allTickets = await Ticket.find(query);
      const ticketsWithRating = allTickets.filter(t => {
        if (!t.satisfaction) return false;
        try {
          const sat = typeof t.satisfaction === 'string' ? JSON.parse(t.satisfaction) : t.satisfaction;
          return sat && sat.rating;
        } catch {
          return false;
        }
      });
      
      if (ticketsWithRating.length > 0) {
        const totalRating = ticketsWithRating.reduce((sum, t) => {
          const sat = typeof t.satisfaction === 'string' ? JSON.parse(t.satisfaction) : t.satisfaction;
          return sum + (sat.rating || 0);
        }, 0);
        stats.avgSatisfaction = (totalRating / ticketsWithRating.length).toFixed(2);
      } else {
        stats.avgSatisfaction = 0;
      }
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

// 更新工单状态
exports.updateStatus = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    // 处理历史记录
    let history = [];
    if (ticket.history) {
      try {
        history = typeof ticket.history === 'string' 
          ? JSON.parse(ticket.history) 
          : ticket.history;
      } catch (e) {
        history = [];
      }
    }

    history.push({
      action: 'status_changed',
      userId: req.user.id,
      comment: comment || `状态变更为：${status}`,
      timestamp: new Date().toISOString()
    });

    const updateData = {
      status: status,
      history: JSON.stringify(history),
      updatedAt: new Date()
    };

    // 如果状态变为已解决，记录解决日期
    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    // 如果状态变为已关闭，记录关闭日期
    if (status === 'closed') {
      updateData.closedAt = new Date();
    }

    await Ticket.findByIdAndUpdate(req.params.id, updateData);
    const updatedTicket = await Ticket.findById(req.params.id);

    res.json({ 
      success: true, 
      data: updatedTicket, 
      message: '状态更新成功' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
