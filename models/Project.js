const { pool } = require('../config/database');

const Project = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM projects WHERE 1=1';
      const params = [];
      
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      
      // 如果同时有 ownerId 和 userId，优先使用 userId 的逻辑（查询负责人或团队成员）
      if (query.userId) {
        // 查询该用户作为负责人或团队成员的项目
        sql += ' AND (ownerId = ? OR (teamMembers IS NOT NULL AND JSON_CONTAINS(teamMembers, ?)))';
        const userIdStr = JSON.stringify(query.userId);
        params.push(query.userId, userIdStr);
      } else if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.search) {
        sql += ' AND (name LIKE ? OR projectNumber LIKE ?)';
        const searchTerm = `%${query.search}%`;
        params.push(searchTerm, searchTerm);
      }
      
      sql += ' ORDER BY createdAt DESC';
      
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      if (query.skip) {
        sql += ' OFFSET ?';
        params.push(parseInt(query.skip));
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows.map(row => {
        try {
          return {
            ...row,
            teamMembers: row.teamMembers ? (typeof row.teamMembers === 'string' ? JSON.parse(row.teamMembers) : row.teamMembers) : [],
            tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
            attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
          };
        } catch (e) {
          // 如果 JSON 解析失败，返回空数组
          return {
            ...row,
            teamMembers: [],
            tags: [],
            attachments: [],
          };
        }
      });
    } catch (error) {
      console.error('Project.find 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM projects WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      const row = rows[0];
      
      // 安全地解析 JSON 字段
      const parseJsonField = (field) => {
        if (!field || field === '') return [];
        if (typeof field === 'object') return field;
        try {
          const parsed = JSON.parse(field);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn(`解析 JSON 字段失败 (${field}):`, e.message);
          return [];
        }
      };
      
      return {
        ...row,
        teamMembers: parseJsonField(row.teamMembers),
        tags: parseJsonField(row.tags),
        attachments: parseJsonField(row.attachments),
      };
    } catch (error) {
      console.error('Project.findById 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      if (!data.projectNumber) {
        const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM projects');
        const count = countRows[0].count;
        data.projectNumber = `PROJ-${Date.now()}-${count + 1}`;
      }
      
      // 确保必填字段存在
      if (!data.name) {
        throw new Error('项目名称不能为空');
      }
      
      const sql = `INSERT INTO projects (projectNumber, name, description, customerId, opportunityId, contractId, status, priority, progress, startDate, expectedEndDate, budget, ownerId, teamMembers, tags, attachments, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.projectNumber,
        data.name,
        data.description || null,
        data.customerId || null,
        data.opportunityId || null,
        data.contractId || null,
        data.status || 'planning',
        data.priority || 'medium',
        data.progress !== undefined && data.progress !== null ? parseInt(data.progress) : 0,
        data.startDate ? (data.startDate.includes(' ') ? data.startDate : `${data.startDate} 00:00:00`) : null,
        data.expectedEndDate ? (data.expectedEndDate.includes(' ') ? data.expectedEndDate : `${data.expectedEndDate} 00:00:00`) : null,
        data.budget !== undefined && data.budget !== null ? parseFloat(data.budget) : 0,
        data.ownerId || null,
        JSON.stringify(data.teamMembers || []),
        JSON.stringify(data.tags || []),
        JSON.stringify(data.attachments || []),
        data.createdBy || null,
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('创建项目失败:', error);
      throw error;
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
        if (key === 'teamMembers' || key === 'tags' || key === 'attachments') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key === 'startDate' || key === 'expectedEndDate' || key === 'actualEndDate') {
          fields.push(`${key} = ?`);
          params.push(data[key] ? `${data[key]} 00:00:00` : null);
        } else if (key !== 'id' && key !== '_id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM projects WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM projects WHERE 1=1';
      const params = [];
      
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      
      // 如果同时有 ownerId 和 userId，优先使用 userId 的逻辑（查询负责人或团队成员）
      if (query.userId) {
        // 查询该用户作为负责人或团队成员的项目
        sql += ' AND (ownerId = ? OR (teamMembers IS NOT NULL AND JSON_CONTAINS(teamMembers, ?)))';
        const userIdStr = JSON.stringify(query.userId);
        params.push(query.userId, userIdStr);
      } else if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.search) {
        sql += ' AND (name LIKE ? OR projectNumber LIKE ?)';
        const searchTerm = `%${query.search}%`;
        params.push(searchTerm, searchTerm);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } catch (error) {
      console.error('Project.countDocuments 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = Project;

