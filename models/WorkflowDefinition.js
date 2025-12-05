const { pool } = require('../config/database');

const WorkflowDefinition = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM workflow_definitions WHERE 1=1';
      const params = [];
      
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.isActive !== undefined) {
        sql += ' AND isActive = ?';
        params.push(query.isActive);
      }
      if (query.code) {
        sql += ' AND code = ?';
        params.push(query.code);
      }
      
      sql += ' ORDER BY priority DESC, createdAt DESC';
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      if (query.skip) {
        sql += ' OFFSET ?';
        params.push(parseInt(query.skip));
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM workflow_definitions WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async findByCode(code) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM workflow_definitions WHERE code = ? AND isActive = TRUE', [code]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO workflow_definitions 
        (name, code, moduleType, description, version, isActive, priority, startNodeId, createdBy) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.code,
        data.moduleType,
        data.description || '',
        data.version || 1,
        data.isActive !== undefined ? data.isActive : true,
        data.priority || 0,
        data.startNodeId || null,
        data.createdBy || null
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== 'id' && data[key] !== undefined) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE workflow_definitions SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM workflow_definitions WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 查找匹配的流程（根据模块类型和条件）
  async findMatchingWorkflow(moduleType, data = {}) {
    const connection = await pool.getConnection();
    try {
      // 获取该模块类型的所有启用流程，按优先级排序
      const [workflows] = await connection.execute(
        'SELECT * FROM workflow_definitions WHERE moduleType = ? AND isActive = TRUE ORDER BY priority DESC',
        [moduleType]
      );

      // 检查每个流程的触发条件
      for (const workflow of workflows) {
        // 获取流程的触发条件规则
        const [rules] = await connection.execute(
          'SELECT * FROM workflow_condition_rules WHERE workflowId = ? AND routeId IS NULL ORDER BY sortOrder',
          [workflow.id]
        );

        // 如果没有条件规则，默认匹配
        if (rules.length === 0) {
          return workflow;
        }

        // 检查所有条件规则是否满足
        let matches = true;
        let lastLogicOperator = 'and';

        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          const ruleResult = await this.evaluateConditionRule(rule, data);

          if (i === 0) {
            matches = ruleResult;
          } else {
            if (lastLogicOperator === 'and') {
              matches = matches && ruleResult;
            } else {
              matches = matches || ruleResult;
            }
          }

          lastLogicOperator = rule.logicOperator || 'and';
        }

        if (matches) {
          return workflow;
        }
      }

      return null;
    } finally {
      connection.release();
    }
  },

  // 评估条件规则
  async evaluateConditionRule(rule, data) {
    const fieldValue = data[rule.fieldName];
    
    if (rule.ruleType === 'expression' && rule.expression) {
      // 执行表达式（需要安全处理，避免代码注入）
      try {
        // 这里可以使用安全的表达式求值库，如 expr-eval
        // 简化处理：只支持简单的字段比较
        return this.evaluateSimpleExpression(rule.expression, data);
      } catch (error) {
        console.error('表达式求值失败:', error);
        return false;
      }
    }

    // 字段比较
    if (rule.fieldName && rule.operator) {
      return this.compareField(fieldValue, rule.operator, rule.fieldValue);
    }

    return false;
  },

  // 简单的表达式求值（仅支持基本比较）
  evaluateSimpleExpression(expression, data) {
    // 替换表达式中的变量
    let expr = expression;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      expr = expr.replace(regex, value);
    }

    // 简单的表达式求值（注意：生产环境应使用安全的表达式求值库）
    try {
      // 这里简化处理，实际应该使用安全的表达式求值库
      return eval(expr); // 注意：生产环境不应使用eval，应使用安全的库如expr-eval
    } catch (error) {
      console.error('表达式求值错误:', error);
      return false;
    }
  },

  // 字段比较
  compareField(fieldValue, operator, ruleValue) {
    if (fieldValue === undefined || fieldValue === null) {
      if (operator === 'is_null') return true;
      if (operator === 'is_not_null') return false;
      return false;
    }

    // 处理字段值：如果是数字字符串，转换为数字；否则保持原样
    let fieldVal = fieldValue;
    if (typeof fieldValue === 'string' && /^-?\d+(\.\d+)?$/.test(fieldValue.trim())) {
      fieldVal = parseFloat(fieldValue);
    } else if (typeof fieldValue === 'number') {
      fieldVal = fieldValue;
    } else {
      fieldVal = fieldValue;
    }
    
    // 处理比较值：如果是字符串，尝试解析为 JSON；否则直接使用
    let ruleVal = ruleValue;
    if (typeof ruleValue === 'string') {
      // 尝试解析为 JSON（可能是数组或对象）
      try {
        ruleVal = JSON.parse(ruleValue);
      } catch (e) {
        // 如果不是有效的 JSON，检查是否是数字字符串
        if (/^-?\d+(\.\d+)?$/.test(ruleValue.trim())) {
          ruleVal = parseFloat(ruleValue);
        } else {
          // 保持为字符串
          ruleVal = ruleValue;
        }
      }
    }
    
    const compareVal = Array.isArray(ruleVal) ? ruleVal[0] : ruleVal;
    const compareVal2 = Array.isArray(ruleVal) && ruleVal.length > 1 ? ruleVal[1] : null;

    switch (operator) {
      case 'eq':
        return fieldVal == compareVal;
      case 'ne':
        return fieldVal != compareVal;
      case 'gt':
        return parseFloat(fieldVal) > parseFloat(compareVal);
      case 'gte':
        return parseFloat(fieldVal) >= parseFloat(compareVal);
      case 'lt':
        return parseFloat(fieldVal) < parseFloat(compareVal);
      case 'lte':
        return parseFloat(fieldVal) <= parseFloat(compareVal);
      case 'in':
        return Array.isArray(ruleVal) && ruleVal.includes(fieldVal);
      case 'not_in':
        return Array.isArray(ruleVal) && !ruleVal.includes(fieldVal);
      case 'contains':
        return String(fieldVal).includes(String(compareVal));
      case 'not_contains':
        return !String(fieldVal).includes(String(compareVal));
      case 'between':
        return parseFloat(fieldVal) >= parseFloat(compareVal) && 
               parseFloat(fieldVal) <= parseFloat(compareVal2);
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return false;
    }
  }
};

module.exports = WorkflowDefinition;

