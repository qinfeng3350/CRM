const { pool } = require('../config/database');

// 缓存已检查的表结构，避免重复查询
let tableStructureChecked = false;

const DingTalkUser = {
  // 根据钉钉用户ID查找
  async findByDingTalkUserId(dingTalkUserId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM dingtalk_users WHERE dingTalkUserId = ?',
        [dingTalkUserId]
      );
      return rows.length > 0 ? rows[0] : null;
    } finally {
      connection.release();
    }
  },

  // 根据系统用户ID查找
  async findByUserId(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM dingtalk_users WHERE userId = ?',
        [userId]
      );
      return rows.length > 0 ? rows[0] : null;
    } finally {
      connection.release();
    }
  },

  // 检查并修复表结构（如果缺少字段）
  async ensureTableStructure(connection) {
    // 如果已经检查过，跳过（避免重复检查）
    if (tableStructureChecked) {
      return;
    }
    
    try {
      // 获取所有现有字段
      const [existingColumns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'dingtalk_users'
      `);
      
      const existingFieldNames = existingColumns.map(col => col.COLUMN_NAME.toLowerCase());
      
      // 定义所有必需的字段及其定义
      const requiredFields = [
        { name: 'name', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'姓名\'', after: 'userId' },
        { name: 'mobile', def: 'VARCHAR(50) DEFAULT NULL COMMENT \'手机号\'', after: 'name' },
        { name: 'email', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'邮箱\'', after: 'mobile' },
        { name: 'avatar', def: 'VARCHAR(500) DEFAULT NULL COMMENT \'头像URL\'', after: 'email' },
        { name: 'departmentIds', def: 'TEXT DEFAULT NULL COMMENT \'部门ID列表\'', after: 'avatar' },
        { name: 'unionid', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'用户的unionId\'', after: 'updatedAt' },
        { name: 'position', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'职位\'', after: 'unionid' },
        { name: 'jobnumber', def: 'VARCHAR(100) DEFAULT NULL COMMENT \'工号\'', after: 'position' },
        { name: 'hired_date', def: 'BIGINT(20) DEFAULT NULL COMMENT \'入职时间（时间戳）\'', after: 'jobnumber' },
        { name: 'work_place', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'工作地点\'', after: 'hired_date' },
        { name: 'remark', def: 'VARCHAR(500) DEFAULT NULL COMMENT \'备注\'', after: 'work_place' },
        { name: 'manager_userid', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'主管用户ID\'', after: 'remark' },
        { name: 'is_admin', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否管理员\'', after: 'manager_userid' },
        { name: 'is_boss', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否老板\'', after: 'is_admin' },
        { name: 'is_leader_in_depts', def: 'TEXT DEFAULT NULL COMMENT \'是否部门主管（JSON格式）\'', after: 'is_boss' },
        { name: 'order_in_depts', def: 'TEXT DEFAULT NULL COMMENT \'部门排序（JSON格式）\'', after: 'is_leader_in_depts' },
        { name: 'active', def: 'TINYINT(1) DEFAULT 1 COMMENT \'是否激活\'', after: 'order_in_depts' },
        { name: 'real_authed', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否实名认证\'', after: 'active' },
        { name: 'org_email', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'企业邮箱\'', after: 'real_authed' },
        { name: 'org_email_type', def: 'VARCHAR(50) DEFAULT NULL COMMENT \'企业邮箱类型\'', after: 'org_email' },
        { name: 'state_code', def: 'VARCHAR(10) DEFAULT NULL COMMENT \'国家代码\'', after: 'org_email_type' },
        { name: 'telephone', def: 'VARCHAR(50) DEFAULT NULL COMMENT \'座机\'', after: 'state_code' },
        { name: 'extattr', def: 'TEXT DEFAULT NULL COMMENT \'扩展属性（JSON格式）\'', after: 'telephone' },
        { name: 'senior', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否高管\'', after: 'extattr' },
        { name: 'hide_mobile', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否隐藏手机号\'', after: 'senior' },
        { name: 'exclusive_account', def: 'TINYINT(1) DEFAULT 0 COMMENT \'是否专属账号\'', after: 'hide_mobile' },
        { name: 'login_id', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'登录ID\'', after: 'exclusive_account' },
        { name: 'exclusive_account_type', def: 'VARCHAR(50) DEFAULT NULL COMMENT \'专属账号类型\'', after: 'login_id' },
        { name: 'title', def: 'VARCHAR(255) DEFAULT NULL COMMENT \'职位头衔\'', after: 'exclusive_account_type' },
        { name: 'dept_order_list', def: 'TEXT DEFAULT NULL COMMENT \'部门排序列表（JSON格式）\'', after: 'title' },
      ];
      
      let hasChanges = false;
      
      // 检查并添加缺失的字段
      for (const field of requiredFields) {
        if (!existingFieldNames.includes(field.name.toLowerCase())) {
          console.log(`[DingTalkUser] 检测到表缺少 ${field.name} 字段，正在添加...`);
          try {
            await connection.execute(`
              ALTER TABLE dingtalk_users 
              ADD COLUMN ${field.name} ${field.def} ${field.after ? `AFTER ${field.after}` : ''}
            `);
            console.log(`[DingTalkUser] ${field.name} 字段添加成功`);
            hasChanges = true;
          } catch (addError) {
            // 如果是字段已存在的错误，忽略它（可能是在并发情况下）
            if (addError.message && addError.message.includes('Duplicate column name')) {
              console.log(`[DingTalkUser] ${field.name} 字段已存在，跳过`);
            } else {
              console.error(`[DingTalkUser] 添加 ${field.name} 字段失败:`, addError.message);
            }
          }
        }
      }
      
      // 标记为已检查（只有在没有错误或只有"字段已存在"错误时才标记）
      if (!hasChanges || true) {
        tableStructureChecked = true;
      }
    } catch (error) {
      console.error('[DingTalkUser] 检查表结构失败:', error.message);
      // 不抛出错误，继续执行
    }
  },

  // 创建或更新关联
  async upsert(data) {
    const connection = await pool.getConnection();
    try {
      if (!data.dingTalkUserId) {
        throw new Error('dingTalkUserId 是必需的');
      }

      // 确保表结构完整（使用同一个连接）
      await this.ensureTableStructure(connection);

      // 先检查是否已存在相同的dingTalkUserId
      const existing = await this.findByDingTalkUserId(data.dingTalkUserId);
      
      // 如果提供了userId，检查是否已有其他记录使用了相同的userId（避免重复关联）
      if (data.userId && !existing) {
        const existingByUserId = await this.findByUserId(data.userId);
        if (existingByUserId && existingByUserId.dingTalkUserId !== data.dingTalkUserId) {
          console.warn(`用户ID ${data.userId} 已关联到其他钉钉用户 ${existingByUserId.dingTalkUserId}，将更新关联`);
          // 更新现有关联，而不是创建新的
          const updateData = { ...data, dingTalkUserId: existingByUserId.dingTalkUserId };
          return await this.upsert(updateData);
        }
      }
      
      if (existing) {
        // 更新
        const updateFields = [];
        const updateValues = [];
        
        if (data.userId !== undefined) {
          updateFields.push('userId = ?');
          updateValues.push(data.userId);
        }
        if (data.name !== undefined) {
          updateFields.push('name = ?');
          updateValues.push(data.name);
        }
        if (data.mobile !== undefined) {
          updateFields.push('mobile = ?');
          updateValues.push(data.mobile);
        }
        if (data.email !== undefined) {
          updateFields.push('email = ?');
          updateValues.push(data.email);
        }
        if (data.avatar !== undefined) {
          updateFields.push('avatar = ?');
          updateValues.push(data.avatar);
        }
        if (data.departmentIds !== undefined) {
          updateFields.push('departmentIds = ?');
          updateValues.push(JSON.stringify(Array.isArray(data.departmentIds) ? data.departmentIds : []));
        }
        // 新增字段
        if (data.unionid !== undefined) {
          updateFields.push('unionid = ?');
          updateValues.push(data.unionid);
        }
        if (data.position !== undefined) {
          updateFields.push('position = ?');
          updateValues.push(data.position);
        }
        if (data.jobnumber !== undefined) {
          updateFields.push('jobnumber = ?');
          updateValues.push(data.jobnumber);
        }
        if (data.hired_date !== undefined) {
          updateFields.push('hired_date = ?');
          updateValues.push(data.hired_date);
        }
        if (data.work_place !== undefined) {
          updateFields.push('work_place = ?');
          updateValues.push(data.work_place);
        }
        if (data.remark !== undefined) {
          updateFields.push('remark = ?');
          updateValues.push(data.remark);
        }
        if (data.manager_userid !== undefined) {
          updateFields.push('manager_userid = ?');
          updateValues.push(data.manager_userid);
        }
        if (data.is_admin !== undefined) {
          updateFields.push('is_admin = ?');
          updateValues.push(data.is_admin ? 1 : 0);
        }
        if (data.is_boss !== undefined) {
          updateFields.push('is_boss = ?');
          updateValues.push(data.is_boss ? 1 : 0);
        }
        if (data.is_leader_in_depts !== undefined) {
          updateFields.push('is_leader_in_depts = ?');
          updateValues.push(JSON.stringify(data.is_leader_in_depts || {}));
        }
        if (data.order_in_depts !== undefined) {
          updateFields.push('order_in_depts = ?');
          updateValues.push(JSON.stringify(data.order_in_depts || {}));
        }
        if (data.active !== undefined) {
          updateFields.push('active = ?');
          updateValues.push(data.active ? 1 : 0);
        }
        if (data.real_authed !== undefined) {
          updateFields.push('real_authed = ?');
          updateValues.push(data.real_authed ? 1 : 0);
        }
        if (data.org_email !== undefined) {
          updateFields.push('org_email = ?');
          updateValues.push(data.org_email);
        }
        if (data.org_email_type !== undefined) {
          updateFields.push('org_email_type = ?');
          updateValues.push(data.org_email_type);
        }
        if (data.state_code !== undefined) {
          updateFields.push('state_code = ?');
          updateValues.push(data.state_code);
        }
        if (data.telephone !== undefined) {
          updateFields.push('telephone = ?');
          updateValues.push(data.telephone);
        }
        if (data.extattr !== undefined) {
          updateFields.push('extattr = ?');
          updateValues.push(JSON.stringify(data.extattr || {}));
        }
        if (data.senior !== undefined) {
          updateFields.push('senior = ?');
          updateValues.push(data.senior ? 1 : 0);
        }
        if (data.hide_mobile !== undefined) {
          updateFields.push('hide_mobile = ?');
          updateValues.push(data.hide_mobile ? 1 : 0);
        }
        if (data.exclusive_account !== undefined) {
          updateFields.push('exclusive_account = ?');
          updateValues.push(data.exclusive_account ? 1 : 0);
        }
        if (data.login_id !== undefined) {
          updateFields.push('login_id = ?');
          updateValues.push(data.login_id);
        }
        if (data.exclusive_account_type !== undefined) {
          updateFields.push('exclusive_account_type = ?');
          updateValues.push(data.exclusive_account_type);
        }
        if (data.title !== undefined) {
          updateFields.push('title = ?');
          updateValues.push(data.title);
        }
        if (data.dept_order_list !== undefined) {
          updateFields.push('dept_order_list = ?');
          updateValues.push(JSON.stringify(data.dept_order_list || {}));
        }
        // 注意：不更新 'userid'，因为 'dingTalkUserId' 已经存储了钉钉用户ID
        
        if (updateFields.length > 0) {
          updateFields.push('updatedAt = NOW()');
          updateValues.push(data.dingTalkUserId);
          
          await connection.execute(
            `UPDATE dingtalk_users SET ${updateFields.join(', ')} WHERE dingTalkUserId = ?`,
            updateValues
          );
        }
        
        return await this.findByDingTalkUserId(data.dingTalkUserId);
      } else {
        // 创建
        const insertFields = ['dingTalkUserId', 'userId', 'name', 'mobile', 'email', 'avatar', 'departmentIds'];
        const insertValues = [
          data.dingTalkUserId,
          data.userId || null,
          data.name || '',
          data.mobile || '',
          data.email || '',
          data.avatar || '',
          JSON.stringify(Array.isArray(data.departmentIds) ? data.departmentIds : []),
        ];
        
        // 添加可选字段
        // 注意：不包含 'userid'，因为 'dingTalkUserId' 已经存储了钉钉用户ID
        const optionalFields = [
          'unionid', 'position', 'jobnumber', 'hired_date', 'work_place', 'remark',
          'manager_userid', 'is_admin', 'is_boss', 'is_leader_in_depts', 'order_in_depts',
          'active', 'real_authed', 'org_email', 'org_email_type', 'state_code', 'telephone',
          'extattr', 'senior', 'hide_mobile', 'exclusive_account', 'login_id',
          'exclusive_account_type', 'title', 'dept_order_list'
        ];
        
        for (const field of optionalFields) {
          if (data[field] !== undefined) {
            insertFields.push(field);
            if (field === 'is_admin' || field === 'is_boss' || field === 'active' || 
                field === 'real_authed' || field === 'senior' || field === 'hide_mobile' || 
                field === 'exclusive_account') {
              insertValues.push(data[field] ? 1 : 0);
            } else if (field === 'is_leader_in_depts' || field === 'order_in_depts' || 
                       field === 'extattr' || field === 'dept_order_list') {
              insertValues.push(JSON.stringify(data[field] || {}));
            } else {
              insertValues.push(data[field]);
            }
          }
        }
        
        const placeholders = insertFields.map(() => '?').join(', ');
        await connection.execute(
          `INSERT INTO dingtalk_users 
            (${insertFields.join(', ')}, createdAt, updatedAt) 
            VALUES (${placeholders}, NOW(), NOW())`,
          insertValues
        );
        return await this.findByDingTalkUserId(data.dingTalkUserId);
      }
    } catch (error) {
      console.error('DingTalkUser.upsert 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  // 获取所有关联（去重）
  async findAll() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM dingtalk_users ORDER BY createdAt DESC'
      );
      
      // 去重：优先保留最新的记录
      const userMap = new Map();
      rows.forEach(row => {
        const key = row.dingTalkUserId;
        if (!userMap.has(key)) {
          userMap.set(key, row);
        } else {
          // 如果已存在，保留创建时间更晚的记录
          const existing = userMap.get(key);
          if (new Date(row.createdAt) > new Date(existing.createdAt)) {
            userMap.set(key, row);
          }
        }
      });
      
      // 转换为数组并处理departmentIds
      return Array.from(userMap.values()).map(row => {
        let departmentIds = [];
        try {
          if (row.departmentIds) {
            // 尝试解析JSON
            if (typeof row.departmentIds === 'string') {
              departmentIds = JSON.parse(row.departmentIds);
            } else if (Array.isArray(row.departmentIds)) {
              departmentIds = row.departmentIds;
            }
          }
        } catch (parseError) {
          console.warn(`解析用户 ${row.id} 的departmentIds失败:`, parseError.message);
          departmentIds = [];
        }
        
        return {
          ...row,
          departmentIds: Array.isArray(departmentIds) ? departmentIds : [],
        };
      });
    } catch (error) {
      console.error('DingTalkUser.findAll 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },
  
  // 清理重复数据（保留最新的记录）
  async removeDuplicates() {
    const connection = await pool.getConnection();
    try {
      console.log('[removeDuplicates] 开始清理重复的钉钉用户关联...');
      
      // 查找所有重复的dingTalkUserId
      const [duplicates] = await connection.execute(`
        SELECT dingTalkUserId, COUNT(*) as count, GROUP_CONCAT(id ORDER BY createdAt DESC) as ids
        FROM dingtalk_users
        GROUP BY dingTalkUserId
        HAVING count > 1
      `);
      
      let removedCount = 0;
      
      for (const dup of duplicates) {
        const ids = dup.ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        // 保留第一个（最新的），删除其他的
        const keepId = ids[0];
        const removeIds = ids.slice(1);
        
        if (removeIds.length > 0) {
          // 使用参数化查询避免SQL注入
          const placeholders = removeIds.map(() => '?').join(',');
          await connection.execute(
            `DELETE FROM dingtalk_users WHERE id IN (${placeholders})`,
            removeIds
          );
          removedCount += removeIds.length;
          console.log(`[removeDuplicates] 清理了 ${removeIds.length} 条重复记录 (dingTalkUserId: ${dup.dingTalkUserId})`);
        }
      }
      
      console.log(`[removeDuplicates] ✅ 清理完成，共删除 ${removedCount} 条重复记录`);
      return { removed: removedCount };
    } catch (error) {
      console.error('[removeDuplicates] ❌ 清理失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = DingTalkUser;

