const Project = require('../models/Project');
const ProjectLog = require('../models/ProjectLog');
const ProjectPhase = require('../models/ProjectPhase');
const ProjectTask = require('../models/ProjectTask');
const OperationLog = require('../models/OperationLog');

// 获取项目列表
exports.getProjects = async (req, res) => {
  try {
    const { status, ownerId, customerId, search, page = 1, limit = 20 } = req.query;
    const query = {};

    // 权限控制：普通用户只能看到自己负责或参与的项目
    if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
      // 使用 userId 查询该用户作为负责人或团队成员的项目
      query.userId = req.user.id;
    } else if (ownerId) {
      query.ownerId = ownerId;
    }

    if (status) query.status = status;
    if (customerId) query.customerId = customerId;
    if (search) query.search = search;

    query.page = parseInt(page);
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);

    const projects = await Project.find(query);
    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      data: projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取项目列表错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个项目
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 加载项目日志（如果失败不影响项目信息返回）
    let logs = [];
    try {
      logs = await ProjectLog.findByProjectId(project.id, { limit: 50 });
    } catch (logError) {
      console.error('加载项目日志失败:', logError);
      // 不阻止项目信息返回，只记录错误
    }

    res.json({
      success: true,
      data: {
        ...project,
        logs
      }
    });
  } catch (error) {
    console.error('获取项目详情错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建项目
exports.createProject = async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      createdBy: req.user.id,
      ownerId: req.body.ownerId || req.user.id,
    };

    const project = await Project.create(projectData);

    // 记录操作日志（如果 OperationLog 可用）
    try {
      await OperationLog.create({
        moduleType: 'project',
        moduleId: project.id,
        action: 'create',
        description: `创建项目: ${project.name}`,
        userId: req.user.id,
        ipAddress: req.ip || req.connection.remoteAddress
      });
    } catch (logError) {
      console.error('记录操作日志失败:', logError);
      // 不阻止项目创建，只记录错误
    }

    // 创建初始日志（如果 ProjectLog 可用）
    try {
      await ProjectLog.create({
        projectId: project.id,
        logType: 'info',
        title: '项目已创建',
        content: `项目 ${project.projectNumber} 已创建`,
        createdBy: req.user.id
      });
    } catch (logError) {
      console.error('创建项目日志失败:', logError);
      // 不阻止项目创建，只记录错误
    }

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('创建项目错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新项目
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 记录操作日志（如果失败不影响更新操作）
    try {
      await OperationLog.create({
        moduleType: 'project',
        moduleId: project.id,
        action: 'update',
        description: `更新项目: ${project.name}`,
        userId: req.user.id,
        ipAddress: req.ip || req.connection.remoteAddress
      });
    } catch (logError) {
      console.error('记录操作日志失败:', logError);
      // 不阻止项目更新，只记录错误
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('更新项目错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除项目
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await Project.findByIdAndDelete(req.params.id);

    // 记录操作日志（如果失败不影响删除操作）
    try {
      await OperationLog.create({
        moduleType: 'project',
        moduleId: project.id,
        action: 'delete',
        description: `删除项目: ${project.name}`,
        userId: req.user.id,
        ipAddress: req.ip || req.connection.remoteAddress
      });
    } catch (logError) {
      console.error('记录操作日志失败:', logError);
      // 不阻止项目删除，只记录错误
    }

    res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    console.error('删除项目错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新项目进度
exports.updateProgress = async (req, res) => {
  try {
    const { progress } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await Project.findByIdAndUpdate(req.params.id, { progress });

    // 创建进度日志
    await ProjectLog.create({
      projectId: project.id,
      logType: 'progress',
      title: '进度更新',
      content: `项目进度更新为 ${progress}%`,
      createdBy: req.user.id
    });

    res.json({ success: true, data: await Project.findById(req.params.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加项目日志
exports.addLog = async (req, res) => {
  try {
    // 验证项目是否存在
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const logData = {
      ...req.body,
      projectId: parseInt(req.params.id),
      createdBy: req.user.id,
    };

    // 验证必填字段
    if (!logData.title) {
      return res.status(400).json({ success: false, message: '日志标题不能为空' });
    }

    const log = await ProjectLog.create(logData);

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    console.error('添加项目日志错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取项目日志
exports.getLogs = async (req, res) => {
  try {
    const { logType, phaseId, taskId, limit = 50 } = req.query;
    const logs = await ProjectLog.findByProjectId(req.params.id, {
      logType,
      phaseId,
      taskId,
      limit: parseInt(limit)
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 项目阶段（板块）管理 ==========

// 获取项目阶段列表
exports.getPhases = async (req, res) => {
  try {
    const phases = await ProjectPhase.findByProjectId(req.params.id);
    res.json({ success: true, data: phases });
  } catch (error) {
    console.error('获取项目阶段错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建项目阶段
exports.createPhase = async (req, res) => {
  try {
    const phaseData = {
      ...req.body,
      projectId: parseInt(req.params.id),
    };
    const phase = await ProjectPhase.create(phaseData);
    res.status(201).json({ success: true, data: phase });
  } catch (error) {
    console.error('创建项目阶段错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新项目阶段
exports.updatePhase = async (req, res) => {
  try {
    const phase = await ProjectPhase.findByIdAndUpdate(req.params.phaseId, req.body);
    if (!phase) {
      return res.status(404).json({ success: false, message: '阶段不存在' });
    }
    res.json({ success: true, data: phase });
  } catch (error) {
    console.error('更新项目阶段错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除项目阶段
exports.deletePhase = async (req, res) => {
  try {
    await ProjectPhase.findByIdAndDelete(req.params.phaseId);
    res.json({ success: true, message: '阶段已删除' });
  } catch (error) {
    console.error('删除项目阶段错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 项目任务管理 ==========

// 获取项目任务列表
exports.getTasks = async (req, res) => {
  try {
    const { phaseId } = req.query;
    const tasks = await ProjectTask.findByProjectId(req.params.id, phaseId || null);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取项目任务错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建项目任务
exports.createTask = async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      projectId: parseInt(req.params.id),
      createdBy: req.user.id,
    };
    const task = await ProjectTask.create(taskData);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('创建项目任务错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新项目任务
exports.updateTask = async (req, res) => {
  try {
    const task = await ProjectTask.findByIdAndUpdate(req.params.taskId, req.body);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('更新项目任务错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除项目任务
exports.deleteTask = async (req, res) => {
  try {
    await ProjectTask.findByIdAndDelete(req.params.taskId);
    res.json({ success: true, message: '任务已删除' });
  } catch (error) {
    console.error('删除项目任务错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 项目甘特图 ==========

exports.getProjectGantt = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    const phases = await ProjectPhase.findByProjectId(projectId);
    const tasks = await ProjectTask.findByProjectId(projectId);

    const toDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const formatISO = (date) => (date ? new Date(date).toISOString() : null);

    const collectDates = (items, keys) =>
      items
        .map((item) => {
          for (const key of keys) {
            const date = toDate(item[key]);
            if (date) return date;
          }
          return null;
        })
        .filter(Boolean);

    const getBoundary = (dates, type = 'min') => {
      if (!dates.length) return null;
      const timestamps = dates.map((d) => d.getTime());
      const boundary = type === 'min' ? Math.min(...timestamps) : Math.max(...timestamps);
      return new Date(boundary);
    };

    const taskStartDates = collectDates(tasks, ['startDate', 'expectedEndDate', 'actualEndDate']);
    const taskEndDates = collectDates(tasks, ['expectedEndDate', 'actualEndDate', 'startDate']);
    const phaseStartDates = collectDates(phases, ['startDate', 'expectedEndDate', 'actualEndDate']);
    const phaseEndDates = collectDates(phases, ['expectedEndDate', 'actualEndDate', 'startDate']);

    const projectStart =
      toDate(project.startDate) ||
      getBoundary([...phaseStartDates, ...taskStartDates], 'min') ||
      new Date();

    const projectEnd =
      toDate(project.expectedEndDate) ||
      toDate(project.actualEndDate) ||
      getBoundary([...phaseEndDates, ...taskEndDates], 'max') ||
      projectStart;

    const rows = [];
    const defaultDuration = 24 * 60 * 60 * 1000; // 1 day

    const ensureStart = (candidate) => candidate || projectStart;
    const ensureEnd = (start, end) => {
      if (end) return end;
      if (start) return new Date(start.getTime() + defaultDuration);
      return new Date(projectEnd.getTime());
    };

    rows.push({
      id: `project-${project.id}`,
      type: 'project',
      name: project.name,
      parentId: null,
      startDate: formatISO(ensureStart(toDate(project.startDate))),
      endDate: formatISO(ensureEnd(toDate(project.startDate), toDate(project.expectedEndDate) || toDate(project.actualEndDate) || projectEnd)),
      progress: project.progress || 0,
      status: project.status,
    });

    const taskGroup = tasks.reduce((acc, task) => {
      const key = task.phaseId ? String(task.phaseId) : 'unassigned';
      acc[key] = acc[key] || [];
      acc[key].push(task);
      return acc;
    }, {});

    phases.forEach((phase) => {
      const relatedTasks = taskGroup[String(phase.id)] || [];
      const phaseStart =
        toDate(phase.startDate) ||
        getBoundary(collectDates(relatedTasks, ['startDate', 'expectedEndDate', 'actualEndDate']), 'min') ||
        projectStart;
      const phaseEnd =
        toDate(phase.expectedEndDate) ||
        toDate(phase.actualEndDate) ||
        getBoundary(collectDates(relatedTasks, ['expectedEndDate', 'actualEndDate', 'startDate']), 'max') ||
        phaseStart ||
        projectEnd;

      rows.push({
        id: `phase-${phase.id}`,
        type: 'phase',
        parentId: `project-${project.id}`,
        name: phase.name,
        startDate: formatISO(ensureStart(phaseStart)),
        endDate: formatISO(ensureEnd(phaseStart, phaseEnd)),
        progress: phase.progress || 0,
        status: phase.status,
      });
    });

    tasks.forEach((task) => {
      const taskStart = ensureStart(toDate(task.startDate));
      const taskEnd = ensureEnd(taskStart, toDate(task.expectedEndDate) || toDate(task.actualEndDate));

      rows.push({
        id: `task-${task.id}`,
        type: 'task',
        parentId: task.phaseId ? `phase-${task.phaseId}` : `project-${project.id}`,
        name: task.name,
        startDate: formatISO(taskStart),
        endDate: formatISO(taskEnd),
        progress: task.progress || 0,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
      });
    });

    const links = [];
    tasks.forEach((task) => {
      if (Array.isArray(task.dependencies)) {
        task.dependencies.forEach((depId) => {
          if (depId) {
            links.push({
              id: `link-${task.id}-${depId}`,
              source: `task-${depId}`,
              target: `task-${task.id}`,
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          progress: project.progress || 0,
          startDate: formatISO(projectStart),
          endDate: formatISO(projectEnd),
        },
        summary: {
          phases: phases.length,
          tasks: tasks.length,
          completedTasks: tasks.filter((t) => t.status === 'completed').length,
          inProgressTasks: tasks.filter((t) => t.status === 'in_progress').length,
        },
        rows,
        links,
      },
    });
  } catch (error) {
    console.error('获取项目甘特图数据错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 项目数据统计 ==========

// 获取项目统计数据（用于数据大屏）
exports.getProjectStats = async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    // 获取阶段数据
    const phases = await ProjectPhase.findByProjectId(projectId);
    
    // 获取任务数据
    const tasks = await ProjectTask.findByProjectId(projectId);
    
    // 计算统计数据
    const phaseStats = {
      total: phases.length,
      notStarted: phases.filter(p => p.status === 'not_started').length,
      inProgress: phases.filter(p => p.status === 'in_progress').length,
      completed: phases.filter(p => p.status === 'completed').length,
      blocked: phases.filter(p => p.status === 'blocked').length,
    };

    const taskStats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };

    // 计算阶段平均进度
    const avgPhaseProgress = phases.length > 0
      ? Math.round(phases.reduce((sum, p) => sum + (p.progress || 0), 0) / phases.length)
      : 0;

    // 计算任务平均进度
    const avgTaskProgress = tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
      : 0;

    // 获取项目日志
    const logs = await ProjectLog.findByProjectId(projectId, { limit: 100 });

    res.json({
      success: true,
      data: {
        project,
        phases,
        tasks,
        phaseStats,
        taskStats,
        avgPhaseProgress,
        avgTaskProgress,
        recentLogs: logs.slice(0, 10),
      }
    });
  } catch (error) {
    console.error('获取项目统计数据错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取所有项目统计数据（用于数据大屏）
exports.getAllProjectsDashboard = async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const Contract = require('../models/Contract');
    const connection = await pool.getConnection();

    try {
      // 权限控制：普通用户只能看到自己负责的项目
      let queryCondition = '';
      const params = [];
      
      if (req.user.role !== 'admin' && req.user.role !== 'sales_manager') {
        queryCondition = ' WHERE (ownerId = ? OR (teamMembers IS NOT NULL AND teamMembers != "" AND JSON_VALID(teamMembers) = 1 AND JSON_CONTAINS(teamMembers, ?)))';
        const userIdStr = JSON.stringify(req.user.id);
        params.push(req.user.id, userIdStr);
      }

      // 按状态统计项目数量
      const statusStats = {};
      const statuses = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
      
      for (const status of statuses) {
        let sql = `SELECT COUNT(*) as count FROM projects WHERE status = ?`;
        const statusParams = [status];
        
        if (queryCondition) {
          sql += ` AND (ownerId = ? OR (teamMembers IS NOT NULL AND teamMembers != "" AND JSON_VALID(teamMembers) = 1 AND JSON_CONTAINS(teamMembers, ?)))`;
          statusParams.push(req.user.id, JSON.stringify(req.user.id));
        }
        
        const [rows] = await connection.execute(sql, statusParams);
        statusStats[status] = rows[0].count;
      }

      // 获取所有项目列表（用于计算其他统计数据）
      let projectsSql = 'SELECT * FROM projects';
      let projectsParams = [];
      
      if (queryCondition) {
        projectsSql += queryCondition;
        projectsParams = [...params];
      }
      
      const [projects] = await connection.execute(projectsSql, projectsParams);

      // 计算总项目数
      const totalProjects = projects.length;

      // 计算平均进度
      const avgProgress = projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
        : 0;

      // 获取待签订的项目（关联合同状态为draft或pending的项目）
      let pendingContractSql = `
        SELECT p.*, c.status as contractStatus, c.amount as contractAmount 
        FROM projects p
        LEFT JOIN contracts c ON p.contractId = c.id
        WHERE (c.status IN ('draft', 'pending') OR (p.contractId IS NOT NULL AND c.id IS NULL))
      `;
      
      let pendingParams = [];
      if (queryCondition) {
        pendingContractSql += ` AND (p.ownerId = ? OR (p.teamMembers IS NOT NULL AND p.teamMembers != "" AND JSON_VALID(p.teamMembers) = 1 AND JSON_CONTAINS(p.teamMembers, ?)))`;
        const userIdStr = JSON.stringify(req.user.id);
        pendingParams.push(req.user.id, userIdStr);
      }
      
      const [pendingProjects] = await connection.execute(pendingContractSql, pendingParams);

      // 计算签订金额（关联合同状态为signed或executing的项目）
      let signedAmountSql = `
        SELECT COALESCE(SUM(c.amount), 0) as totalAmount
        FROM projects p
        INNER JOIN contracts c ON p.contractId = c.id
        WHERE c.status IN ('signed', 'executing', 'completed')
      `;
      
      let signedAmountParams = [];
      if (queryCondition) {
        signedAmountSql += ` AND (p.ownerId = ? OR (p.teamMembers IS NOT NULL AND p.teamMembers != "" AND JSON_VALID(p.teamMembers) = 1 AND JSON_CONTAINS(p.teamMembers, ?)))`;
        const userIdStr = JSON.stringify(req.user.id);
        signedAmountParams.push(req.user.id, userIdStr);
      }
      
      const [amountRows] = await connection.execute(signedAmountSql, signedAmountParams);
      const totalSignedAmount = amountRows[0]?.totalAmount || 0;

      // 按进度区间统计
      const progressRanges = [
        { label: '0-20%', min: 0, max: 20 },
        { label: '21-40%', min: 21, max: 40 },
        { label: '41-60%', min: 41, max: 60 },
        { label: '61-80%', min: 61, max: 80 },
        { label: '81-100%', min: 81, max: 100 },
      ];
      
      const progressDistribution = progressRanges.map(range => ({
        range: range.label,
        count: projects.filter(p => {
          const progress = p.progress || 0;
          return progress >= range.min && progress <= range.max;
        }).length
      }));

      // 按优先级统计
      const priorityStats = {};
      const priorities = ['low', 'medium', 'high', 'urgent'];
      
      for (const priority of priorities) {
        priorityStats[priority] = projects.filter(p => p.priority === priority).length;
      }

      // 获取最近的项目列表（按更新时间）
      const recentProjects = projects
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress || 0,
          priority: p.priority,
          updatedAt: p.updatedAt || p.createdAt
        }));

      // 项目人员排行榜（按负责的项目数量）
      const User = require('../models/User');
      const userProjectCounts = {};
      
      projects.forEach(project => {
        const ownerId = project.ownerId;
        if (ownerId) {
          userProjectCounts[ownerId] = (userProjectCounts[ownerId] || 0) + 1;
        }
      });

      // 获取用户信息并排序
      const userRanking = [];
      for (const [userId, count] of Object.entries(userProjectCounts)) {
        try {
          const user = await User.findById(parseInt(userId));
          if (user) {
            // 计算该用户负责的项目总金额
            const userProjects = projects.filter(p => p.ownerId === parseInt(userId));
            let totalAmount = 0;
            
            for (const p of userProjects) {
              if (p.contractId) {
                try {
                  const contract = await Contract.findById(p.contractId);
                  if (contract && contract.amount) {
                    totalAmount += parseFloat(contract.amount) || 0;
                  }
                } catch (err) {
                  // 忽略单个合同查询错误
                }
              }
            }
            
            userRanking.push({
              userId: parseInt(userId),
              name: user.name || '未知',
              projectCount: count,
              totalAmount: totalAmount,
            });
          }
        } catch (err) {
          console.error(`获取用户 ${userId} 信息失败:`, err);
        }
      }

      // 按项目数量排序
      userRanking.sort((a, b) => b.projectCount - a.projectCount);

      res.json({
        success: true,
        data: {
          // 项目状态统计
          statusStats: {
            planning: statusStats.planning || 0,           // 预期项目
            inProgress: statusStats.in_progress || 0,       // 进行中的项目
            onHold: statusStats.on_hold || 0,
            completed: statusStats.completed || 0,          // 已完结的项目
            cancelled: statusStats.cancelled || 0,
            total: totalProjects,
          },
          // 待签订的项目
          pendingSigned: pendingProjects.length,
          pendingProjects: pendingProjects.map(p => ({
            id: p.id,
            name: p.name,
            contractStatus: p.contractStatus,
            contractAmount: p.contractAmount || 0
          })),
          // 签订金额
          totalSignedAmount: parseFloat(totalSignedAmount),
          // 进度统计
          avgProgress,
          progressDistribution,
          // 优先级统计
          priorityStats,
          // 最近更新的项目
          recentProjects,
          // 项目人员排行榜
          userRanking: userRanking.slice(0, 10),
          // 更新时间
          lastUpdate: new Date().toISOString()
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('获取项目数据大屏统计错误:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

