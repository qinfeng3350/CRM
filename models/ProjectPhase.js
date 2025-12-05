const { pool } = require('../config/database');

const ProjectPhase = {
  async findByProjectId(projectId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM project_phases WHERE projectId = ? ORDER BY phaseNumber ASC',
        [projectId]
      );
      return rows.map(row => ({
        ...row,
        dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies) : [],
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM project_phases WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        ...row,
        dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies) : [],
      };
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      if (!data.projectId) {
        throw new Error('项目ID不能为空');
      }
      if (!data.name) {
        throw new Error('阶段名称不能为空');
      }

      // 如果没有指定 phaseNumber，自动获取下一个序号
      if (!data.phaseNumber) {
        const [countRows] = await connection.execute(
          'SELECT MAX(phaseNumber) as maxNum FROM project_phases WHERE projectId = ?',
          [data.projectId]
        );
        data.phaseNumber = (countRows[0].maxNum || 0) + 1;
      }

      const sql = `INSERT INTO project_phases (projectId, phaseNumber, name, description, status, progress, startDate, expectedEndDate, actualEndDate, budget, actualCost, ownerId, dependencies, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.projectId,
        data.phaseNumber,
        data.name,
        data.description || null,
        data.status || 'not_started',
        data.progress || 0,
        data.startDate ? (data.startDate.includes(' ') ? data.startDate : `${data.startDate} 00:00:00`) : null,
        data.expectedEndDate ? (data.expectedEndDate.includes(' ') ? data.expectedEndDate : `${data.expectedEndDate} 00:00:00`) : null,
        data.actualEndDate ? (data.actualEndDate.includes(' ') ? data.actualEndDate : `${data.actualEndDate} 00:00:00`) : null,
        data.budget || 0,
        data.actualCost || 0,
        data.ownerId || null,
        JSON.stringify(data.dependencies || []),
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('ProjectPhase.create 错误:', error);
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
        if (key === 'dependencies' && typeof data[key] === 'object') {
          fields.push('dependencies = ?');
          params.push(JSON.stringify(data[key]));
        } else if (key === 'startDate' || key === 'expectedEndDate' || key === 'actualEndDate') {
          fields.push(`${key} = ?`);
          params.push(data[key] ? (data[key].includes(' ') ? data[key] : `${data[key]} 00:00:00`) : null);
        } else if (key !== 'id' && key !== '_id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE project_phases SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM project_phases WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },
};

module.exports = ProjectPhase;

