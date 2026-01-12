/**
 * 数据大屏模型
 * 用于存储大屏配置和数据源关联
 */

const { pool } = require('../config/database');
console.log('[Models] Dashboard.js loaded (uses pool.execute)');

class Dashboard {
  // 创建大屏
  static async create(dashboardData) {
    const sql = `
      INSERT INTO dashboards (
        name, description, icon, config, dataSource, 
        chartType, refreshInterval, isActive, createdBy, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      dashboardData.name,
      dashboardData.description || '',
      dashboardData.icon || 'dashboard',
      dashboardData.config ? JSON.stringify(dashboardData.config) : '{}',
      dashboardData.dataSource || 'projects',
      dashboardData.chartType || 'pie,bar,radar',
      dashboardData.refreshInterval || 10000,
      dashboardData.isActive !== false ? 1 : 0,
      dashboardData.createdBy || 0,
    ];

    try {
      const [result] = await pool.execute(sql, values);
      return { id: result.insertId, ...dashboardData };
    } catch (error) {
      throw new Error(`创建大屏失败: ${error.message}`);
    }
  }

  // 获取所有大屏
  static async getAll() {
    const sql = `
      SELECT * FROM dashboards 
      WHERE isActive = 1 
      ORDER BY createdAt DESC
    `;

    try {
      const [rows] = await pool.execute(sql);
      return rows.map(row => ({
        ...row,
        config: row.config ? JSON.parse(row.config) : {},
      }));
    } catch (error) {
      throw new Error(`获取大屏列表失败: ${error.message}`);
    }
  }

  // 根据 ID 获取大屏
  static async getById(id) {
    const sql = `SELECT * FROM dashboards WHERE id = ? AND isActive = 1`;

    try {
      const [rows] = await pool.execute(sql, [id]);
      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        ...row,
        config: row.config ? JSON.parse(row.config) : {},
      };
    } catch (error) {
      throw new Error(`获取大屏详情失败: ${error.message}`);
    }
  }

  // 更新大屏
  static async update(id, dashboardData) {
    const sql = `
      UPDATE dashboards SET
        name = ?,
        description = ?,
        icon = ?,
        config = ?,
        dataSource = ?,
        chartType = ?,
        refreshInterval = ?,
        isActive = ?,
        updatedAt = NOW()
      WHERE id = ?
    `;

    const values = [
      dashboardData.name,
      dashboardData.description || '',
      dashboardData.icon || 'dashboard',
      dashboardData.config ? JSON.stringify(dashboardData.config) : '{}',
      dashboardData.dataSource || 'projects',
      dashboardData.chartType || 'pie,bar,radar',
      dashboardData.refreshInterval || 10000,
      dashboardData.isActive !== false ? 1 : 0,
      id,
    ];

    try {
      const [result] = await pool.execute(sql, values);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`更新大屏失败: ${error.message}`);
    }
  }

  // 删除大屏（软删除）
  static async delete(id) {
    const sql = `UPDATE dashboards SET isActive = 0, updatedAt = NOW() WHERE id = ?`;

    try {
      const [result] = await pool.execute(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`删除大屏失败: ${error.message}`);
    }
  }

  // 按数据源获取大屏
  static async getByDataSource(dataSource) {
    const sql = `
      SELECT * FROM dashboards 
      WHERE dataSource = ? AND isActive = 1 
      ORDER BY createdAt DESC
    `;

    try {
      const [rows] = await pool.execute(sql, [dataSource]);
      return rows.map(row => ({
        ...row,
        config: row.config ? JSON.parse(row.config) : {},
      }));
    } catch (error) {
      throw new Error(`获取数据源大屏失败: ${error.message}`);
    }
  }

  // 获取仪表板统计
  static async getStats() {
    const sql = `
      SELECT 
        COUNT(*) as total,
        dataSource,
        COUNT(DISTINCT dataSource) as sourceCount
      FROM dashboards 
      WHERE isActive = 1
      GROUP BY dataSource
    `;

    try {
      const [rows] = await pool.execute(sql);
      return rows;
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }
}

module.exports = Dashboard;
