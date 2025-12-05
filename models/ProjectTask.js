const { pool } = require('../config/database');

const ProjectTask = {
  async findByProjectId(projectId, phaseId = null) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM project_tasks WHERE projectId = ?';
      const params = [projectId];
      
      if (phaseId) {
        sql += ' AND phaseId = ?';
        params.push(phaseId);
      }
      
      sql += ' ORDER BY createdAt ASC';
      
      const [rows] = await connection.execute(sql, params);
      return rows.map(row => ({
        ...row,
        dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies) : [],
        tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
      }));
    } finally {
      connection.release();
    }
  },

  async findByPhaseId(phaseId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM project_tasks WHERE phaseId = ? ORDER BY createdAt ASC',
        [phaseId]
      );
      return rows.map(row => ({
        ...row,
        dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies) : [],
        tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM project_tasks WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        ...row,
        dependencies: row.dependencies ? (typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies) : [],
        tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
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
        throw new Error('任务名称不能为空');
      }

      // 如果没有指定 taskNumber，自动生成
      if (!data.taskNumber) {
        const [countRows] = await connection.execute(
          'SELECT COUNT(*) as count FROM project_tasks WHERE projectId = ?',
          [data.projectId]
        );
        const count = countRows[0].count;
        data.taskNumber = `TASK-${data.projectId}-${count + 1}`;
      }

      const sql = `INSERT INTO project_tasks (projectId, phaseId, taskNumber, name, description, status, priority, progress, startDate, expectedEndDate, actualEndDate, estimatedHours, actualHours, assigneeId, dependencies, tags, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.projectId,
        data.phaseId || null,
        data.taskNumber,
        data.name,
        data.description || null,
        data.status || 'todo',
        data.priority || 'medium',
        data.progress || 0,
        data.startDate ? (data.startDate.includes(' ') ? data.startDate : `${data.startDate} 00:00:00`) : null,
        data.expectedEndDate ? (data.expectedEndDate.includes(' ') ? data.expectedEndDate : `${data.expectedEndDate} 00:00:00`) : null,
        data.actualEndDate ? (data.actualEndDate.includes(' ') ? data.actualEndDate : `${data.actualEndDate} 00:00:00`) : null,
        data.estimatedHours || 0,
        data.actualHours || 0,
        data.assigneeId || null,
        JSON.stringify(data.dependencies || []),
        JSON.stringify(data.tags || []),
        data.createdBy || null,
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('ProjectTask.create 错误:', error);
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
        if (key === 'dependencies' || key === 'tags') {
          if (typeof data[key] === 'object') {
            fields.push(`${key} = ?`);
            params.push(JSON.stringify(data[key]));
          }
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
      
      await connection.execute(`UPDATE project_tasks SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM project_tasks WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },
};

module.exports = ProjectTask;

