const Todo = require('../models/Todo');
const Contract = require('../models/Contract');
const Opportunity = require('../models/Opportunity');

// 获取我的待办列表
exports.getMyTodos = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = {
      assigneeId: req.user.id
    };
    
    if (status) {
      // 如果指定了status，使用指定的status
      if (status === 'pending') {
        // 待处理标签页：只显示pending状态
        query.status = 'pending';
      } else if (status === 'in_progress') {
        // 进行中标签页：只显示in_progress状态
        query.status = 'in_progress';
      } else if (status === 'completed') {
        // 已完成标签页，只显示已完成的
        query.status = 'completed';
      } else if (status === 'cancelled') {
        // 已取消标签页，只显示已取消的
        query.status = 'cancelled';
      } else {
        query.status = status;
      }
    } else {
      // 如果没有指定status（比如"全部"标签页），默认只显示待处理的（不包括已取消和已完成的）
      query.status = ['pending', 'in_progress'];
    }
    
    if (type) query.type = type;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const todos = await Todo.find(query);
    const total = await Todo.countDocuments(query);
    
    // 获取关联的模块信息
    const todosWithDetails = await Promise.all(todos.map(async (todo) => {
      let moduleData = null;
      try {
        if (todo.moduleType === 'contract') {
          moduleData = await Contract.findById(todo.moduleId);
        } else if (todo.moduleType === 'opportunity') {
          moduleData = await Opportunity.findById(todo.moduleId);
        }
      } catch (e) {
        console.error('获取模块信息失败:', e);
      }
      
      return {
        ...todo,
        moduleData
      };
    }));
    
    res.json({
      success: true,
      data: todosWithDetails,
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

// 获取单个待办详情
exports.getTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findById(id);
    
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    
    // 检查权限：只有待办的分配人才能查看
    if (todo.assigneeId !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权查看此待办' });
    }
    
    // 获取关联的模块信息
    let moduleData = null;
    try {
      if (todo.moduleType === 'contract' || todo.moduleType === 'contracts') {
        const Contract = require('../models/Contract');
        moduleData = await Contract.findById(todo.moduleId);
      } else if (todo.moduleType === 'opportunity' || todo.moduleType === 'opportunities') {
        const Opportunity = require('../models/Opportunity');
        moduleData = await Opportunity.findById(todo.moduleId);
      }
    } catch (e) {
      console.error('获取模块信息失败:', e);
    }
    
    res.json({
      success: true,
      data: {
        ...todo,
        moduleData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取待办统计
exports.getTodoStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const pending = await Todo.countDocuments({ assigneeId: userId, status: 'pending' });
    const inProgress = await Todo.countDocuments({ assigneeId: userId, status: 'in_progress' });
    const completed = await Todo.countDocuments({ assigneeId: userId, status: 'completed' });
    const urgent = await Todo.countDocuments({ assigneeId: userId, status: 'pending', priority: 'urgent' });
    
    res.json({
      success: true,
      data: {
        pending,
        inProgress,
        completed,
        urgent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 完成待办
exports.completeTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    const todo = await Todo.findById(id);
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    
    if (todo.assigneeId !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权操作此待办' });
    }
    
    // 如果待办已同步到钉钉，同步更新钉钉待办状态
    if (todo.metadata?.dingTalkSynced && todo.metadata?.dingTalkRecordId) {
      try {
        const DingTalkUser = require('../models/DingTalkUser');
        const dingTalkService = require('../services/dingTalkService');
        
        const dingTalkUser = await DingTalkUser.findByUserId(todo.assigneeId);
        if (dingTalkUser) {
          await dingTalkService.completeTodo(
            todo.metadata.dingTalkRecordId,
            dingTalkUser.dingTalkUserId
          );
          console.log(`待办 ${id} 已在钉钉中标记为完成`);
        }
      } catch (syncError) {
        console.error('同步钉钉待办完成状态失败:', syncError.message);
        // 不阻止待办完成，只记录错误
      }
    }
    
    const updatedTodo = await Todo.findByIdAndUpdate(id, {
      status: 'completed',
      completedAt: new Date(),
      metadata: {
        ...(todo.metadata || {}),
        comment: comment || '',
        dingTalkCompleted: todo.metadata?.dingTalkSynced ? true : undefined,
      }
    });
    
    res.json({
      success: true,
      data: updatedTodo,
      message: '待办已完成'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新待办状态
exports.updateTodoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const todo = await Todo.findById(id);
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    
    if (todo.assigneeId !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权操作此待办' });
    }
    
    const updateData = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const updatedTodo = await Todo.findByIdAndUpdate(id, updateData);
    
    res.json({
      success: true,
      data: updatedTodo,
      message: '状态已更新'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

