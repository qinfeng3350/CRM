const mysql = require('mysql2/promise');

async function addContractFields() {
  const connection = await mysql.createConnection({
    host: '39.106.142.253',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123',
  });

  try {
    console.log('开始添加合同字段...');

    // 检查字段是否存在，如果不存在则添加
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'crm' 
      AND TABLE_NAME = 'contracts' 
      AND COLUMN_NAME IN ('contractType', 'signers', 'signatures')
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // 添加合同类型字段
    if (!existingColumns.includes('contractType')) {
      await connection.execute(`
        ALTER TABLE contracts 
        ADD COLUMN contractType VARCHAR(50) DEFAULT NULL COMMENT '合同类型：sales/service/purchase/lease/cooperation/other'
      `);
      console.log('✅ 已添加 contractType 字段');
    } else {
      console.log('⏭️  contractType 字段已存在，跳过...');
    }

    // 添加签署人字段（JSON格式，存储多个签署人ID）
    if (!existingColumns.includes('signers')) {
      await connection.execute(`
        ALTER TABLE contracts 
        ADD COLUMN signers TEXT DEFAULT NULL COMMENT '签署人ID列表（JSON数组）'
      `);
      console.log('✅ 已添加 signers 字段');
    } else {
      console.log('⏭️  signers 字段已存在，跳过...');
    }

    // 添加签名字段（JSON格式，存储签名信息：{userId: xxx, signature: 'base64或URL', signedAt: 'xxx'}）
    if (!existingColumns.includes('signatures')) {
      await connection.execute(`
        ALTER TABLE contracts 
        ADD COLUMN signatures TEXT DEFAULT NULL COMMENT '签名信息（JSON数组）'
      `);
      console.log('✅ 已添加 signatures 字段');
    } else {
      console.log('⏭️  signatures 字段已存在，跳过...');
    }

    console.log('✅ 合同字段添加完成！');
  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addContractFields()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  });

