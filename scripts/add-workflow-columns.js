/**
 * 为现有表添加流程引擎相关字段
 * 运行: node scripts/add-workflow-columns.js
 */

const { pool } = require('../config/database');

const addWorkflowColumns = async () => {
  let connection;
  try {
    console.log('\n==========================================');
    console.log('开始为现有表添加流程引擎字段...');
    console.log('==========================================\n');

    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功\n');

    // 检查并添加 approval_workflows 表的字段
    console.log('检查 approval_workflows 表...');
    const [workflowColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'approval_workflows' 
       AND COLUMN_NAME IN ('code', 'version')`
    );
    
    const existingWorkflowColumns = workflowColumns.map(c => c.COLUMN_NAME);
    
    if (!existingWorkflowColumns.includes('code')) {
      await connection.execute(
        `ALTER TABLE approval_workflows 
         ADD COLUMN code VARCHAR(50) UNIQUE COMMENT '流程编码' AFTER name`
      );
      console.log('  ✓ 添加 code 字段');
    } else {
      console.log('  ⊙ code 字段已存在');
    }
    
    if (!existingWorkflowColumns.includes('version')) {
      // 检查description字段是否存在，如果不存在则添加到name后面
      const [descCheck] = await connection.execute(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'approval_workflows' 
         AND COLUMN_NAME = 'description'`
      );
      
      const afterColumn = descCheck[0].count > 0 ? 'description' : 'moduleType';
      await connection.execute(
        `ALTER TABLE approval_workflows 
         ADD COLUMN version INT DEFAULT 1 COMMENT '流程版本号' AFTER ${afterColumn}`
      );
      console.log('  ✓ 添加 version 字段');
    } else {
      console.log('  ⊙ version 字段已存在');
    }

    // 检查并添加 approval_records 表的字段
    console.log('\n检查 approval_records 表...');
    const [recordColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'approval_records' 
       AND COLUMN_NAME IN ('instanceId', 'nodeId', 'taskId', 'returnToStepIndex', 'transferToUserId', 'actionType')`
    );
    
    const existingRecordColumns = recordColumns.map(c => c.COLUMN_NAME);
    
    const columnsToAdd = [
      { name: 'instanceId', def: 'INT DEFAULT NULL COMMENT \'流程实例ID\'', after: 'workflowId' },
      { name: 'nodeId', def: 'INT DEFAULT NULL COMMENT \'节点ID\'', after: 'instanceId' },
      { name: 'taskId', def: 'INT DEFAULT NULL COMMENT \'任务ID\'', after: 'nodeId' },
      { name: 'returnToStepIndex', def: 'INT DEFAULT NULL COMMENT \'退回到的步骤索引\'', after: 'stepIndex' },
      { name: 'transferToUserId', def: 'INT DEFAULT NULL COMMENT \'转办给的用户ID\'', after: 'approverId' },
      { name: 'actionType', def: 'ENUM(\'approve\', \'reject\', \'return\', \'transfer\', \'skip\') DEFAULT \'approve\'', after: 'action' }
    ];
    
    for (const col of columnsToAdd) {
      if (!existingRecordColumns.includes(col.name)) {
        await connection.execute(
          `ALTER TABLE approval_records 
           ADD COLUMN ${col.name} ${col.def} AFTER ${col.after}`
        );
        console.log(`  ✓ 添加 ${col.name} 字段`);
      } else {
        console.log(`  ⊙ ${col.name} 字段已存在`);
      }
    }

    // 检查并添加索引
    console.log('\n检查 approval_records 表的索引...');
    const [indexes] = await connection.execute(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'approval_records' 
       AND INDEX_NAME IN ('idx_instance', 'idx_node', 'idx_task')`
    );
    
    const existingIndexes = indexes.map(i => i.INDEX_NAME);
    
    if (!existingIndexes.includes('idx_instance')) {
      await connection.execute('ALTER TABLE approval_records ADD INDEX idx_instance (instanceId)');
      console.log('  ✓ 添加 idx_instance 索引');
    } else {
      console.log('  ⊙ idx_instance 索引已存在');
    }
    
    if (!existingIndexes.includes('idx_node')) {
      await connection.execute('ALTER TABLE approval_records ADD INDEX idx_node (nodeId)');
      console.log('  ✓ 添加 idx_node 索引');
    } else {
      console.log('  ⊙ idx_node 索引已存在');
    }
    
    if (!existingIndexes.includes('idx_task')) {
      await connection.execute('ALTER TABLE approval_records ADD INDEX idx_task (taskId)');
      console.log('  ✓ 添加 idx_task 索引');
    } else {
      console.log('  ⊙ idx_task 索引已存在');
    }

    console.log('\n==========================================');
    console.log('✅ 字段添加完成！');
    console.log('==========================================\n');

  } catch (error) {
    console.error('\n❌ 添加字段失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
    process.exit(0);
  }
};

addWorkflowColumns();

