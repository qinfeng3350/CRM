const Department = require('../models/Department');
const User = require('../models/User');
const OperationLog = require('../models/OperationLog');
const { cache, flushByPrefix } = require('../utils/cache');

const buildCacheKey = ({ parentId, isActive, includeMemberCount }) => {
  return [
    'departments',
    parentId ?? 'all',
    isActive ?? 'all',
    includeMemberCount ? 'withCount' : 'noCount',
  ].join(':');
};

// 获取部门列表
exports.getDepartments = async (req, res) => {
  const startTime = Date.now();
  try {
    const { parentId, isActive, includeMemberCount, disableCache } = req.query;
    const query = {};
    if (parentId !== undefined) query.parentId = parentId === 'null' ? null : parseInt(parentId, 10);
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (includeMemberCount !== undefined) {
      query.includeMemberCount = includeMemberCount === 'true';
    }

    const cacheKey = buildCacheKey({ parentId, isActive, includeMemberCount });
    const shouldUseCache = disableCache !== 'true';
    if (shouldUseCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('[getDepartments] 命中缓存');
        return res.json({ success: true, data: cached, cache: true });
      }
    }

    console.log('[getDepartments] 开始查询部门列表...');
    const departments = await Department.find(query);
    const queryTime = Date.now() - startTime;
    console.log(
      `[getDepartments] 查询完成，耗时: ${queryTime}ms，返回 ${departments.length} 个部门`,
    );

    if (shouldUseCache) {
      cache.set(cacheKey, departments);
    }

    res.json({ success: true, data: departments, cache: false });
  } catch (error) {
    const queryTime = Date.now() - startTime;
    console.error(`[getDepartments] 查询失败，耗时: ${queryTime}ms`, error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取部门树
exports.getDepartmentTree = async (req, res) => {
  try {
    const tree = await Department.getTree();
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个部门
exports.getDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: '部门不存在' });
    }
    
    // 获取部门成员
    const members = await User.find({ departmentId: department.id });
    department.members = members;
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建部门
exports.createDepartment = async (req, res) => {
  try {
    const department = await Department.create(req.body);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'department',
      moduleId: department.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建部门: ${department.name}`,
      newData: department,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    flushByPrefix('departments');
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新部门
exports.updateDepartment = async (req, res) => {
  try {
    const oldDepartment = await Department.findById(req.params.id);
    if (!oldDepartment) {
      return res.status(404).json({ success: false, message: '部门不存在' });
    }
    
    const department = await Department.findByIdAndUpdate(req.params.id, req.body);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'department',
      moduleId: department.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新部门: ${department.name}`,
      oldData: oldDepartment,
      newData: department,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    flushByPrefix('departments');
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除部门
exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ success: false, message: '部门不存在' });
    }
    
    await Department.findByIdAndDelete(req.params.id);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'department',
      moduleId: department.id,
      action: 'delete',
      userId: req.user.id,
      userName: req.user.name,
      description: `删除部门: ${department.name}`,
      oldData: department,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    flushByPrefix('departments');
    res.json({ success: true, message: '部门已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

