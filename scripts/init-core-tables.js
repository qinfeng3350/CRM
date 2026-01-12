const { pool } = require('../config/database');

async function initCoreTables() {
  const connection = await pool.getConnection();
  try {
    console.log('开始创建核心业务表...');

    // 1. 用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT(11) NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(200) NOT NULL,
        password VARCHAR(200) NOT NULL,
        name VARCHAR(200) DEFAULT '',
        role VARCHAR(50) DEFAULT 'sales',
        department VARCHAR(200) DEFAULT '',
        level INT(11) DEFAULT 1,
        phone VARCHAR(50) DEFAULT '',
        status ENUM('active','inactive') DEFAULT 'active',
        permissions TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_email (email(191)),
        UNIQUE KEY uk_username (username(100)),
        KEY idx_role (role),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表'
    `);
    console.log('✓ users 表已创建');

    // 2. 部门表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        parentId INT(11) DEFAULT NULL,
        description VARCHAR(500) DEFAULT '',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_name (name(191)),
        KEY idx_parentId (parentId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表'
    `);
    console.log('✓ departments 表已创建');

    // 3. 客户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        company VARCHAR(200) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(200) DEFAULT '',
        address VARCHAR(500) DEFAULT '',
        poolType ENUM('public','private') DEFAULT 'public',
        ownerId INT(11) DEFAULT NULL,
        source VARCHAR(100) DEFAULT '',
        category ENUM('potential','intent','signed','lost') DEFAULT 'potential',
        tags TEXT,
        industry VARCHAR(100) DEFAULT '',
        scale ENUM('small','medium','large') DEFAULT 'small',
        description TEXT,
        lastContactAt DATETIME DEFAULT NULL,
        createdBy INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_owner (ownerId),
        KEY idx_category (category),
        KEY idx_poolType (poolType),
        KEY idx_name (name(100))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表'
    `);
    console.log('✓ customers 表已创建');

    // 4. 联系人表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT(11) NOT NULL AUTO_INCREMENT,
        customerId INT(11) NOT NULL,
        name VARCHAR(200) NOT NULL,
        position VARCHAR(200) DEFAULT '',
        department VARCHAR(200) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        mobile VARCHAR(50) DEFAULT '',
        email VARCHAR(200) DEFAULT '',
        wechat VARCHAR(100) DEFAULT '',
        qq VARCHAR(20) DEFAULT '',
        address VARCHAR(500) DEFAULT '',
        isPrimary TINYINT(1) DEFAULT 0,
        birthday DATE DEFAULT NULL,
        gender ENUM('male','female','unknown') DEFAULT 'unknown',
        notes TEXT,
        createdBy INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_customerId (customerId),
        CONSTRAINT fk_contacts_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联系人表'
    `);
    console.log('✓ contacts 表已创建');

    // 5. 产品相关
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id INT(11) NOT NULL AUTO_INCREMENT,
        name VARCHAR(200) NOT NULL,
        description VARCHAR(500) DEFAULT '',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_name (name(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品分类'
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT(11) NOT NULL AUTO_INCREMENT,
        code VARCHAR(100) DEFAULT NULL,
        name VARCHAR(200) NOT NULL,
        categoryId INT(11) DEFAULT NULL,
        unit VARCHAR(50) DEFAULT '',
        price DECIMAL(15,2) DEFAULT 0,
        specs VARCHAR(500) DEFAULT '',
        description TEXT,
        status ENUM('active','inactive') DEFAULT 'active',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_code (code),
        KEY idx_categoryId (categoryId),
        CONSTRAINT fk_products_category FOREIGN KEY (categoryId) REFERENCES product_categories (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表'
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_prices (
        id INT(11) NOT NULL AUTO_INCREMENT,
        productId INT(11) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'CNY',
        effectiveDate DATETIME DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_productId (productId),
        CONSTRAINT fk_product_prices_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品价格'
    `);
    console.log('✓ 产品相关表已创建');

    // 6. 商机相关
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id INT(11) NOT NULL AUTO_INCREMENT,
        customerId INT(11) NOT NULL,
        name VARCHAR(200) NOT NULL,
        amount DECIMAL(15,2) DEFAULT 0,
        status ENUM('new','negotiating','won','lost') DEFAULT 'new',
        ownerId INT(11) DEFAULT NULL,
        probability INT(11) DEFAULT 0,
        expectedCloseDate DATETIME DEFAULT NULL,
        actualCloseDate DATETIME DEFAULT NULL,
        description TEXT,
        source VARCHAR(100) DEFAULT '',
        products TEXT,
        transferHistory TEXT,
        lastTransferAt DATETIME DEFAULT NULL,
        lastFollowUpAt DATETIME DEFAULT NULL,
        nextFollowUpAt DATETIME DEFAULT NULL,
        createdBy INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_customerId (customerId),
        KEY idx_ownerId (ownerId),
        KEY idx_status (status),
        CONSTRAINT fk_opportunities_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商机表'
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS opportunity_products (
        id INT(11) NOT NULL AUTO_INCREMENT,
        opportunityId INT(11) NOT NULL,
        productId INT(11) NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        unitPrice DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_opportunityId (opportunityId),
        KEY idx_productId (productId),
        CONSTRAINT fk_opp_prod_opportunity FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE,
        CONSTRAINT fk_opp_prod_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商机产品表'
    `);
    console.log('✓ 商机相关表已创建');

    // 7. 合同相关
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contracts (
        id INT(11) NOT NULL AUTO_INCREMENT,
        contractNumber VARCHAR(100) NOT NULL,
        customerId INT(11) NOT NULL,
        opportunityId INT(11) DEFAULT NULL,
        totalAmount DECIMAL(15,2) DEFAULT 0,
        status ENUM('draft','signed','completed','cancelled') DEFAULT 'draft',
        signedAt DATETIME DEFAULT NULL,
        createdBy INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_contractNumber (contractNumber),
        KEY idx_customerId (customerId),
        KEY idx_opportunityId (opportunityId),
        CONSTRAINT fk_contracts_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE,
        CONSTRAINT fk_contracts_opportunity FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同表'
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contract_products (
        id INT(11) NOT NULL AUTO_INCREMENT,
        contractId INT(11) NOT NULL,
        productId INT(11) NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        unitPrice DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_contractId (contractId),
        KEY idx_productId (productId),
        CONSTRAINT fk_contract_prod_contract FOREIGN KEY (contractId) REFERENCES contracts (id) ON DELETE CASCADE,
        CONSTRAINT fk_contract_prod_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同产品表'
    `);
    console.log('✓ 合同相关表已创建');

    // 8. 报价单相关
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotations (
        id INT(11) NOT NULL AUTO_INCREMENT,
        quotationNumber VARCHAR(100) NOT NULL,
        customerId INT(11) NOT NULL,
        totalAmount DECIMAL(15,2) DEFAULT 0,
        status ENUM('draft','sent','accepted','rejected') DEFAULT 'draft',
        createdBy INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_quotationNumber (quotationNumber),
        KEY idx_customerId (customerId),
        CONSTRAINT fk_quotations_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价单表'
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id INT(11) NOT NULL AUTO_INCREMENT,
        quotationId INT(11) NOT NULL,
        productId INT(11) NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        unitPrice DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        PRIMARY KEY (id),
        KEY idx_quotationId (quotationId),
        KEY idx_productId (productId),
        CONSTRAINT fk_quotation_items_quotation FOREIGN KEY (quotationId) REFERENCES quotations (id) ON DELETE CASCADE,
        CONSTRAINT fk_quotation_items_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价项表'
    `);
    console.log('✓ 报价相关表已创建');

    // 9. 跟进记录
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id INT(11) NOT NULL AUTO_INCREMENT,
        type ENUM('customer','opportunity','contract') NOT NULL,
        relatedId INT(11) NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        followUpType VARCHAR(100) DEFAULT 'note',
        userId INT(11) DEFAULT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_type_related (type, relatedId),
        KEY idx_userId (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跟进记录'
    `);
    console.log('✓ 跟进记录表已创建');

    // 10. 操作日志
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT(11) NOT NULL AUTO_INCREMENT,
        moduleType VARCHAR(100) NOT NULL,
        moduleId INT(11) DEFAULT NULL,
        action VARCHAR(100) NOT NULL,
        userId INT(11) DEFAULT NULL,
        userName VARCHAR(200) DEFAULT '',
        description TEXT,
        oldData TEXT,
        newData TEXT,
        ipAddress VARCHAR(100) DEFAULT '',
        userAgent VARCHAR(500) DEFAULT '',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_module (moduleType, moduleId),
        KEY idx_userId (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志'
    `);
    console.log('✓ 操作日志表已创建');

    console.log('✅ 核心业务表创建完成');
  } catch (error) {
    console.error('❌ 创建核心表失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  initCoreTables()
    .then(() => {
      console.log('数据库核心表初始化完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('数据库核心表初始化失败:', err);
      process.exit(1);
    });
}

module.exports = initCoreTables;
