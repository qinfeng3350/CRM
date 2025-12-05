/**
 * 字段权限过滤工具
 * 根据流程节点的字段权限配置，过滤模块数据
 */

/**
 * 根据字段权限过滤数据
 * @param {Object} data - 原始数据
 * @param {Object} fieldPermissions - 字段权限配置 { fieldName: { visible, editable, required } }
 * @param {String} mode - 'view' 查看模式 或 'edit' 编辑模式
 * @returns {Object} 过滤后的数据
 */
function filterDataByPermissions(data, fieldPermissions = {}, mode = 'view') {
  if (!data || !fieldPermissions) {
    return data;
  }

  const filtered = {};
  
  // 遍历所有字段
  Object.keys(data).forEach(fieldName => {
    const permission = fieldPermissions[fieldName];
    
    // 如果没有配置权限，默认可见
    if (!permission) {
      filtered[fieldName] = data[fieldName];
      return;
    }

    // 在查看模式下，只返回可见的字段
    if (mode === 'view') {
      if (permission.visible !== false) {
        filtered[fieldName] = data[fieldName];
      }
    } 
    // 在编辑模式下，只返回可编辑的字段
    else if (mode === 'edit') {
      if (permission.editable === true) {
        filtered[fieldName] = data[fieldName];
      }
    }
  });

  return filtered;
}

/**
 * 获取字段的可见性状态
 * @param {String} fieldName - 字段名
 * @param {Object} fieldPermissions - 字段权限配置
 * @returns {Object} { visible, editable, required }
 */
function getFieldPermission(fieldName, fieldPermissions = {}) {
  const permission = fieldPermissions[fieldName];
  return {
    visible: permission?.visible !== false, // 默认可见
    editable: permission?.editable === true, // 默认不可编辑
    required: permission?.required === true, // 默认不必填
  };
}

/**
 * 检查字段是否可见
 */
function isFieldVisible(fieldName, fieldPermissions = {}) {
  const permission = fieldPermissions[fieldName];
  return permission?.visible !== false;
}

/**
 * 检查字段是否可编辑
 */
function isFieldEditable(fieldName, fieldPermissions = {}) {
  const permission = fieldPermissions[fieldName];
  return permission?.editable === true;
}

/**
 * 检查字段是否必填
 */
function isFieldRequired(fieldName, fieldPermissions = {}) {
  const permission = fieldPermissions[fieldName];
  return permission?.required === true;
}

module.exports = {
  filterDataByPermissions,
  getFieldPermission,
  isFieldVisible,
  isFieldEditable,
  isFieldRequired,
};

