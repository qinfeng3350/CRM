const { pool } = require('../config/database');

const ProjectLog = {
  async findByProjectId(projectId, query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM project_logs WHERE projectId = ?';
      const params = [projectId];
      
      if (query.logType) {
        sql += ' AND logType = ?';
        params.push(query.logType);
      }
      if (query.phaseId) {
        sql += ' AND phaseId = ?';
        params.push(query.phaseId);
      }
      if (query.taskId) {
        sql += ' AND taskId = ?';
        params.push(query.taskId);
      }
      
      sql += ' ORDER BY createdAt DESC';
      
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows.map(row => {
        try {
          return {
            ...row,
            attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
          };
        } catch (e) {
          return {
            ...row,
            attachments: [],
          };
        }
      });
    } catch (error) {
      console.error('ProjectLog.findByProjectId 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      // 验证必填字段
      if (!data.projectId) {
        throw new Error('项目ID不能为空');
      }
      if (!data.title) {
        throw new Error('日志标题不能为空');
      }
      if (!data.createdBy) {
        throw new Error('创建人ID不能为空');
      }

      const sql = `INSERT INTO project_logs (projectId, phaseId, taskId, logType, title, content, attachments, createdBy, createdAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
      const params = [
        data.projectId,
        data.phaseId || null,
        data.taskId || null,
        data.logType || 'info',
        data.title,
        data.content || null,
        JSON.stringify(data.attachments || []),
        data.createdBy,
      ];
      const [result] = await connection.execute(sql, params);
      const [rows] = await connection.execute('SELECT * FROM project_logs WHERE id = ?', [result.insertId]);
      if (rows.length === 0) {
        throw new Error('创建日志失败');
      }
      const row = rows[0];
      try {
        return {
          ...row,
          attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : [],
        };
      } catch (parseError) {
        return {
          ...row,
          attachments: [],
        };
      }
    } catch (error) {
      console.error('ProjectLog.create 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },
};

module.exports = ProjectLog;

