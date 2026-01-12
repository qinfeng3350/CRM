/**
 * 初始化数据大屏表
 * 用于创建存储大屏配置的数据库表
 */

const db = require('../config/database');

const initDashboardsTable = async () => {
  try {
    console.log('正在初始化数据大屏表...');

    const sql = `
      CREATE TABLE IF NOT EXISTS dashboards (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL COMMENT '大屏名称',
        description TEXT COMMENT '大屏描述',
        icon VARCHAR(100) COMMENT '大屏图标',
        config LONGTEXT COMMENT '大屏配置 (JSON格式)',
        dataSource VARCHAR(100) NOT NULL COMMENT '数据源 (projects, sales, inventory, custom)',
        chartType VARCHAR(255) COMMENT '图表类型 (逗号分隔: pie, bar, line, radar, scatter, gauge, table, card)',
        refreshInterval INT DEFAULT 10000 COMMENT '刷新间隔 (毫秒)',
        isActive TINYINT DEFAULT 1 COMMENT '是否启用',
        createdBy INT COMMENT '创建人ID',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        KEY idx_dataSource (dataSource),
        KEY idx_isActive (isActive),
        KEY idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await db.execute(sql);
    console.log('✅ 数据大屏表初始化成功');

    // 插入示例数据
    const exampleSql = `
      INSERT INTO dashboards (
        name, description, icon, config, dataSource, 
        chartType, refreshInterval, isActive, createdBy
      ) VALUES 
      (
        '项目管理大屏',
        '展示项目的状态、进度、优先级等关键指标',
        'project',
        '{"fields": ["totalProjects", "statusStats", "progressDistribution"], "filters": [], "layout": "grid"}',
        'projects',
        'pie,bar,radar,table',
        10000,
        1,
        0
      )
    `;

    try {
      await db.execute(exampleSql);
      console.log('✅ 插入示例数据成功');
    } catch (error) {
      // 如果插入失败，可能是因为数据已经存在
      if (error.code !== 'ER_DUP_ENTRY') {
        console.warn('⚠️  插入示例数据失败 (可能已存在):', error.message);
      }
    }
  } catch (error) {
    console.error('❌ 初始化数据大屏表失败:', error);
    throw error;
  }
};

module.exports = {
  initDashboardsTable,
};
