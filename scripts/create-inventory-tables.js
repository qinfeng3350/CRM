const { pool } = require('../config/database');

async function createInventoryTables() {
  const connection = await pool.getConnection();
  try {
    console.log('开始创建采购进销存相关表...\n');
    
    // 1. 创建供应商表
    console.log('1. 创建供应商表 (suppliers)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT(11) NOT NULL AUTO_INCREMENT,
        code VARCHAR(50) DEFAULT NULL COMMENT '供应商编码',
        name VARCHAR(200) NOT NULL COMMENT '供应商名称',
        contactName VARCHAR(100) DEFAULT '' COMMENT '联系人姓名',
        contactPhone VARCHAR(50) DEFAULT '' COMMENT '联系电话',
        contactEmail VARCHAR(100) DEFAULT '' COMMENT '联系邮箱',
        address VARCHAR(500) DEFAULT '' COMMENT '地址',
        taxNumber VARCHAR(50) DEFAULT '' COMMENT '税号',
        bankName VARCHAR(200) DEFAULT '' COMMENT '开户银行',
        bankAccount VARCHAR(100) DEFAULT '' COMMENT '银行账号',
        paymentTerms VARCHAR(200) DEFAULT '' COMMENT '付款条件',
        creditLimit DECIMAL(15,2) DEFAULT 0 COMMENT '信用额度',
        status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_code (code),
        KEY idx_name (name(100)),
        KEY idx_status (status),
        KEY idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表'
    `);
    console.log('✅ 供应商表创建成功\n');
    
    // 2. 创建采购单表
    console.log('2. 创建采购单表 (purchase_orders)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderNumber VARCHAR(100) NOT NULL COMMENT '采购单号',
        supplierId INT(11) DEFAULT NULL COMMENT '供应商ID',
        orderDate DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '订单日期',
        expectedDate DATETIME DEFAULT NULL COMMENT '预计到货日期',
        totalAmount DECIMAL(15,2) DEFAULT 0 COMMENT '总金额',
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
        paymentStatus ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid' COMMENT '付款状态',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_orderNumber (orderNumber),
        KEY idx_supplierId (supplierId),
        KEY idx_status (status),
        KEY idx_orderDate (orderDate),
        KEY idx_createdAt (createdAt),
        CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplierId) REFERENCES suppliers (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购单表'
    `);
    console.log('✅ 采购单表创建成功\n');
    
    // 3. 创建采购明细表
    console.log('3. 创建采购明细表 (purchase_order_items)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderId INT(11) NOT NULL COMMENT '采购单ID',
        productId INT(11) NOT NULL COMMENT '产品ID',
        quantity DECIMAL(10,2) DEFAULT 0 COMMENT '数量',
        unitPrice DECIMAL(15,2) DEFAULT 0 COMMENT '单价',
        amount DECIMAL(15,2) DEFAULT 0 COMMENT '金额',
        notes VARCHAR(500) DEFAULT '' COMMENT '备注',
        PRIMARY KEY (id),
        KEY idx_orderId (orderId),
        KEY idx_productId (productId),
        CONSTRAINT fk_purchase_item_order FOREIGN KEY (orderId) REFERENCES purchase_orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_item_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购明细表'
    `);
    console.log('✅ 采购明细表创建成功\n');
    
    // 4. 创建入库单表
    console.log('2. 创建入库单表 (inbound_orders)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inbound_orders (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderNumber VARCHAR(100) NOT NULL COMMENT '入库单号',
        supplierId INT(11) DEFAULT NULL COMMENT '供应商ID',
        orderDate DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '订单日期',
        expectedDate DATETIME DEFAULT NULL COMMENT '预计到货日期',
        totalAmount DECIMAL(15,2) DEFAULT 0 COMMENT '总金额',
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_orderNumber (orderNumber),
        KEY idx_supplierId (supplierId),
        KEY idx_status (status),
        KEY idx_orderDate (orderDate),
        KEY idx_createdAt (createdAt),
        CONSTRAINT fk_inbound_supplier FOREIGN KEY (supplierId) REFERENCES suppliers (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库单表'
    `);
    console.log('✅ 入库单表创建成功\n');
    
    // 5. 创建入库明细表
    console.log('5. 创建入库明细表 (inbound_order_items)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inbound_order_items (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderId INT(11) NOT NULL COMMENT '入库单ID',
        productId INT(11) NOT NULL COMMENT '产品ID',
        quantity DECIMAL(10,2) DEFAULT 0 COMMENT '数量',
        unitPrice DECIMAL(15,2) DEFAULT 0 COMMENT '单价',
        amount DECIMAL(15,2) DEFAULT 0 COMMENT '金额',
        notes VARCHAR(500) DEFAULT '' COMMENT '备注',
        PRIMARY KEY (id),
        KEY idx_orderId (orderId),
        KEY idx_productId (productId),
        CONSTRAINT fk_inbound_item_order FOREIGN KEY (orderId) REFERENCES inbound_orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_inbound_item_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库明细表'
    `);
    console.log('✅ 入库明细表创建成功\n');
    
    // 6. 创建出库单表
    console.log('6. 创建出库单表 (outbound_orders)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS outbound_orders (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderNumber VARCHAR(100) NOT NULL COMMENT '出库单号',
        customerId INT(11) DEFAULT NULL COMMENT '客户ID',
        orderDate DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '订单日期',
        expectedDate DATETIME DEFAULT NULL COMMENT '预计发货日期',
        totalAmount DECIMAL(15,2) DEFAULT 0 COMMENT '总金额',
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '状态',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_orderNumber (orderNumber),
        KEY idx_customerId (customerId),
        KEY idx_status (status),
        KEY idx_orderDate (orderDate),
        KEY idx_createdAt (createdAt),
        CONSTRAINT fk_outbound_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出库单表'
    `);
    console.log('✅ 出库单表创建成功\n');
    
    // 7. 创建出库明细表
    console.log('7. 创建出库明细表 (outbound_order_items)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS outbound_order_items (
        id INT(11) NOT NULL AUTO_INCREMENT,
        orderId INT(11) NOT NULL COMMENT '出库单ID',
        productId INT(11) NOT NULL COMMENT '产品ID',
        quantity DECIMAL(10,2) DEFAULT 0 COMMENT '数量',
        unitPrice DECIMAL(15,2) DEFAULT 0 COMMENT '单价',
        amount DECIMAL(15,2) DEFAULT 0 COMMENT '金额',
        notes VARCHAR(500) DEFAULT '' COMMENT '备注',
        PRIMARY KEY (id),
        KEY idx_orderId (orderId),
        KEY idx_productId (productId),
        CONSTRAINT fk_outbound_item_order FOREIGN KEY (orderId) REFERENCES outbound_orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_outbound_item_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出库明细表'
    `);
    console.log('✅ 出库明细表创建成功\n');
    
    // 8. 创建库存表
    console.log('8. 创建库存表 (inventory)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT(11) NOT NULL AUTO_INCREMENT,
        productId INT(11) NOT NULL COMMENT '产品ID',
        quantity DECIMAL(10,2) DEFAULT 0 COMMENT '库存数量',
        minStock DECIMAL(10,2) DEFAULT 0 COMMENT '最低库存',
        maxStock DECIMAL(10,2) DEFAULT NULL COMMENT '最高库存',
        warehouse VARCHAR(100) DEFAULT '' COMMENT '仓库',
        location VARCHAR(200) DEFAULT '' COMMENT '库位',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_productId (productId),
        KEY idx_quantity (quantity),
        KEY idx_warehouse (warehouse),
        CONSTRAINT fk_inventory_product FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存表'
    `);
    console.log('✅ 库存表创建成功\n');
    
    // 9. 创建收款单表
    console.log('9. 创建收款单表 (receipts)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INT(11) NOT NULL AUTO_INCREMENT,
        receiptNumber VARCHAR(100) NOT NULL COMMENT '收款单号',
        customerId INT(11) DEFAULT NULL COMMENT '客户ID',
        outboundOrderId INT(11) DEFAULT NULL COMMENT '出库单ID',
        receiptDate DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '收款日期',
        amount DECIMAL(15,2) DEFAULT 0 COMMENT '收款金额',
        paymentMethod VARCHAR(50) DEFAULT 'bank_transfer' COMMENT '支付方式',
        bankAccount VARCHAR(100) DEFAULT '' COMMENT '银行账户',
        receiptNote VARCHAR(100) DEFAULT '' COMMENT '收据编号',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_receiptNumber (receiptNumber),
        KEY idx_customerId (customerId),
        KEY idx_outboundOrderId (outboundOrderId),
        KEY idx_receiptDate (receiptDate),
        CONSTRAINT fk_receipt_customer FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE SET NULL,
        CONSTRAINT fk_receipt_outbound FOREIGN KEY (outboundOrderId) REFERENCES outbound_orders (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款单表'
    `);
    console.log('✅ 收款单表创建成功\n');
    
    // 10. 创建付款单表
    console.log('10. 创建付款单表 (payment_records)...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payment_records (
        id INT(11) NOT NULL AUTO_INCREMENT,
        paymentNumber VARCHAR(100) NOT NULL COMMENT '付款单号',
        supplierId INT(11) DEFAULT NULL COMMENT '供应商ID',
        purchaseOrderId INT(11) DEFAULT NULL COMMENT '采购单ID',
        inboundOrderId INT(11) DEFAULT NULL COMMENT '入库单ID',
        paymentDate DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '付款日期',
        amount DECIMAL(15,2) DEFAULT 0 COMMENT '付款金额',
        paymentMethod VARCHAR(50) DEFAULT 'bank_transfer' COMMENT '支付方式',
        bankAccount VARCHAR(100) DEFAULT '' COMMENT '银行账户',
        notes TEXT COMMENT '备注',
        createdBy INT(11) DEFAULT NULL COMMENT '创建人ID',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_paymentNumber (paymentNumber),
        KEY idx_supplierId (supplierId),
        KEY idx_purchaseOrderId (purchaseOrderId),
        KEY idx_inboundOrderId (inboundOrderId),
        KEY idx_paymentDate (paymentDate),
        CONSTRAINT fk_payment_supplier FOREIGN KEY (supplierId) REFERENCES suppliers (id) ON DELETE SET NULL,
        CONSTRAINT fk_payment_purchase FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders (id) ON DELETE SET NULL,
        CONSTRAINT fk_payment_inbound FOREIGN KEY (inboundOrderId) REFERENCES inbound_orders (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款单表'
    `);
    console.log('✅ 付款单表创建成功\n');
    
    console.log('✅ 所有采购进销存相关表创建完成！\n');
    
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createInventoryTables()
    .then(() => {
      console.log('数据库表创建完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库表创建失败:', error);
      process.exit(1);
    });
}

module.exports = createInventoryTables;

