const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderItem = require('../models/PurchaseOrderItem');
const InboundOrder = require('../models/InboundOrder');
const InboundOrderItem = require('../models/InboundOrderItem');
const OutboundOrder = require('../models/OutboundOrder');
const OutboundOrderItem = require('../models/OutboundOrderItem');
const Inventory = require('../models/Inventory');
const Receipt = require('../models/Receipt');
const PaymentRecord = require('../models/PaymentRecord');
const Product = require('../models/Product');
const OperationLog = require('../models/OperationLog');
const { pool } = require('../config/database');

// ==================== 供应商管理 ====================

// 获取供应商列表
exports.getSuppliers = async (req, res) => {
  try {
    const { name, code, contact, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (name) query.name = name;
    if (code) query.code = code;
    if (contact) query.contact = contact;
    if (status !== undefined) query.status = status;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [suppliers, total] = await Promise.all([
      Supplier.find(query),
      Supplier.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个供应商
exports.getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: '供应商不存在' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建供应商
exports.createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create({
      ...req.body,
      createdBy: req.user.id
    });
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'supplier',
      moduleId: supplier.id,
      description: `创建供应商：${supplier.name}`
    });
    
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新供应商
exports.updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body);
    if (!supplier) {
      return res.status(404).json({ success: false, message: '供应商不存在' });
    }
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'supplier',
      moduleId: supplier.id,
      description: `更新供应商：${supplier.name}`
    });
    
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除供应商
exports.deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: '供应商不存在' });
    }
    
    await Supplier.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'supplier',
      moduleId: req.params.id,
      description: `删除供应商：${supplier.name}`
    });
    
    res.json({ success: true, message: '供应商已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 采购单管理 ====================

// 获取采购单列表
exports.getPurchaseOrders = async (req, res) => {
  try {
    const { orderNumber, supplierId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (orderNumber) query.orderNumber = orderNumber;
    if (supplierId) query.supplierId = supplierId;
    if (status) query.status = status;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query),
      PurchaseOrder.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个采购单（包含明细）
exports.getPurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '采购单不存在' });
    }
    
    const items = await PurchaseOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...order, items } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建采购单
exports.createPurchaseOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 生成订单号
    const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 计算总金额
    const totalAmount = req.body.items?.reduce((sum, item) => {
      const amount = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + amount;
    }, 0) || 0;
    
    // 创建采购单
    const order = await PurchaseOrder.create({
      orderNumber,
      supplierId: req.body.supplierId,
      orderDate: req.body.orderDate || new Date(),
      expectedDate: req.body.expectedDate,
      totalAmount,
      status: req.body.status || 'pending',
      paymentStatus: req.body.paymentStatus || 'unpaid',
      notes: req.body.notes,
      createdBy: req.user.id
    });
    
    // 创建采购明细
    if (req.body.items && req.body.items.length > 0) {
      const items = req.body.items.map(item => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      
      await PurchaseOrderItem.createBatch(items);
    }
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'purchase_order',
      moduleId: order.id,
      description: `创建采购单：${order.orderNumber}`
    });
    
    const orderWithItems = await PurchaseOrder.findById(order.id);
    const items = await PurchaseOrderItem.findByOrderId(order.id);
    
    res.status(201).json({ success: true, data: { ...orderWithItems, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 更新采购单
exports.updatePurchaseOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '采购单不存在' });
    }
    
    // 如果状态是已完成，不允许修改
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的采购单不能修改' });
    }
    
    // 更新采购单
    const updateData = { ...req.body };
    if (updateData.items) {
      // 重新计算总金额
      updateData.totalAmount = updateData.items.reduce((sum, item) => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + amount;
      }, 0);
      
      // 删除旧明细，创建新明细
      await PurchaseOrderItem.deleteByOrderId(req.params.id);
      const items = updateData.items.map(item => ({
        orderId: parseInt(req.params.id),
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      await PurchaseOrderItem.createBatch(items);
      
      delete updateData.items;
    }
    
    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(req.params.id, updateData);
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'purchase_order',
      moduleId: req.params.id,
      description: `更新采购单：${updatedOrder.orderNumber}`
    });
    
    const items = await PurchaseOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...updatedOrder, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 完成采购单（可自动创建入库单）
exports.completePurchaseOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '采购单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '采购单已完成' });
    }
    
    // 更新采购单状态
    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status: 'completed' });
    
    // 如果请求自动创建入库单
    if (req.body.createInboundOrder) {
      const InboundOrder = require('../models/InboundOrder');
      const InboundOrderItem = require('../models/InboundOrderItem');
      
      // 获取采购明细
      const purchaseItems = await PurchaseOrderItem.findByOrderId(req.params.id);
      
      // 创建入库单
      const inboundOrderNumber = `IN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const inboundOrder = await InboundOrder.create({
        orderNumber: inboundOrderNumber,
        supplierId: order.supplierId,
        orderDate: new Date(),
        totalAmount: order.totalAmount,
        status: 'completed',
        notes: `由采购单 ${order.orderNumber} 自动生成`,
        createdBy: req.user.id
      });
      
      // 创建入库明细并更新库存
      const Inventory = require('../models/Inventory');
      for (const item of purchaseItems) {
        await InboundOrderItem.create({
          orderId: inboundOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          notes: item.notes
        });
        
        // 更新库存
        await Inventory.increase(item.productId, item.quantity);
      }
      
      await connection.commit();
      
      res.json({ 
        success: true, 
        data: updatedOrder,
        inboundOrder: inboundOrder
      });
    } else {
      await connection.commit();
      res.json({ success: true, data: updatedOrder });
    }
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'complete',
      module: 'purchase_order',
      moduleId: req.params.id,
      description: `完成采购单：${updatedOrder.orderNumber}`
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 删除采购单
exports.deletePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '采购单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的采购单不能删除' });
    }
    
    await PurchaseOrderItem.deleteByOrderId(req.params.id);
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'purchase_order',
      moduleId: req.params.id,
      description: `删除采购单：${order.orderNumber}`
    });
    
    res.json({ success: true, message: '采购单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 入库单管理 ====================

// 获取入库单列表
exports.getInboundOrders = async (req, res) => {
  try {
    const { orderNumber, supplierId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (orderNumber) query.orderNumber = orderNumber;
    if (supplierId) query.supplierId = supplierId;
    if (status) query.status = status;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      InboundOrder.find(query),
      InboundOrder.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个入库单（包含明细）
exports.getInboundOrder = async (req, res) => {
  try {
    const order = await InboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '入库单不存在' });
    }
    
    const items = await InboundOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...order, items } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建入库单
exports.createInboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 生成订单号
    const orderNumber = `IN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 计算总金额
    const totalAmount = req.body.items?.reduce((sum, item) => {
      const amount = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + amount;
    }, 0) || 0;
    
    // 创建入库单
    const order = await InboundOrder.create({
      orderNumber,
      supplierId: req.body.supplierId,
      orderDate: req.body.orderDate || new Date(),
      expectedDate: req.body.expectedDate,
      totalAmount,
      status: req.body.status || 'pending',
      notes: req.body.notes,
      createdBy: req.user.id
    });
    
    // 创建入库明细
    if (req.body.items && req.body.items.length > 0) {
      const items = req.body.items.map(item => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      
      await InboundOrderItem.createBatch(items);
    }
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'inbound_order',
      moduleId: order.id,
      description: `创建入库单：${order.orderNumber}`
    });
    
    const orderWithItems = await InboundOrder.findById(order.id);
    const items = await InboundOrderItem.findByOrderId(order.id);
    
    res.status(201).json({ success: true, data: { ...orderWithItems, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 更新入库单
exports.updateInboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await InboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '入库单不存在' });
    }
    
    // 如果状态是已完成，不允许修改
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的入库单不能修改' });
    }
    
    // 更新入库单
    const updateData = { ...req.body };
    if (updateData.items) {
      // 重新计算总金额
      updateData.totalAmount = updateData.items.reduce((sum, item) => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + amount;
      }, 0);
      
      // 删除旧明细，创建新明细
      await InboundOrderItem.deleteByOrderId(req.params.id);
      const items = updateData.items.map(item => ({
        orderId: parseInt(req.params.id),
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      await InboundOrderItem.createBatch(items);
      
      delete updateData.items;
    }
    
    const updatedOrder = await InboundOrder.findByIdAndUpdate(req.params.id, updateData);
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'inbound_order',
      moduleId: req.params.id,
      description: `更新入库单：${updatedOrder.orderNumber}`
    });
    
    const items = await InboundOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...updatedOrder, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 完成入库单（更新库存）
exports.completeInboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await InboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '入库单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '入库单已完成' });
    }
    
    // 获取入库明细
    const items = await InboundOrderItem.findByOrderId(req.params.id);
    
    // 更新库存
    for (const item of items) {
      await Inventory.increase(item.productId, item.quantity);
    }
    
    // 更新入库单状态
    const updatedOrder = await InboundOrder.findByIdAndUpdate(req.params.id, { status: 'completed' });
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'complete',
      module: 'inbound_order',
      moduleId: req.params.id,
      description: `完成入库单：${updatedOrder.orderNumber}`
    });
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 删除入库单
exports.deleteInboundOrder = async (req, res) => {
  try {
    const order = await InboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '入库单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的入库单不能删除' });
    }
    
    await InboundOrderItem.deleteByOrderId(req.params.id);
    await InboundOrder.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'inbound_order',
      moduleId: req.params.id,
      description: `删除入库单：${order.orderNumber}`
    });
    
    res.json({ success: true, message: '入库单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 出库单管理 ====================

// 获取出库单列表
exports.getOutboundOrders = async (req, res) => {
  try {
    const { orderNumber, customerId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (orderNumber) query.orderNumber = orderNumber;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [orders, total] = await Promise.all([
      OutboundOrder.find(query),
      OutboundOrder.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个出库单（包含明细）
exports.getOutboundOrder = async (req, res) => {
  try {
    const order = await OutboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '出库单不存在' });
    }
    
    const items = await OutboundOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...order, items } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建出库单
exports.createOutboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 生成订单号
    const orderNumber = `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // 计算总金额
    const totalAmount = req.body.items?.reduce((sum, item) => {
      const amount = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + amount;
    }, 0) || 0;
    
    // 检查库存是否充足
    if (req.body.items && req.body.items.length > 0) {
      for (const item of req.body.items) {
        const inventory = await Inventory.findByProductId(item.productId);
        if (!inventory || (inventory.quantity || 0) < (item.quantity || 0)) {
          await connection.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `产品库存不足：${item.productName || item.productId}` 
          });
        }
      }
    }
    
    // 创建出库单
    const order = await OutboundOrder.create({
      orderNumber,
      customerId: req.body.customerId,
      orderDate: req.body.orderDate || new Date(),
      expectedDate: req.body.expectedDate,
      totalAmount,
      status: req.body.status || 'pending',
      notes: req.body.notes,
      createdBy: req.user.id
    });
    
    // 创建出库明细
    if (req.body.items && req.body.items.length > 0) {
      const items = req.body.items.map(item => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      
      await OutboundOrderItem.createBatch(items);
    }
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'outbound_order',
      moduleId: order.id,
      description: `创建出库单：${order.orderNumber}`
    });
    
    const orderWithItems = await OutboundOrder.findById(order.id);
    const items = await OutboundOrderItem.findByOrderId(order.id);
    
    res.status(201).json({ success: true, data: { ...orderWithItems, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 更新出库单
exports.updateOutboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await OutboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '出库单不存在' });
    }
    
    // 如果状态是已完成，不允许修改
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的出库单不能修改' });
    }
    
    // 更新出库单
    const updateData = { ...req.body };
    if (updateData.items) {
      // 重新计算总金额
      updateData.totalAmount = updateData.items.reduce((sum, item) => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0);
        return sum + amount;
      }, 0);
      
      // 删除旧明细，创建新明细
      await OutboundOrderItem.deleteByOrderId(req.params.id);
      const items = updateData.items.map(item => ({
        orderId: parseInt(req.params.id),
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (item.quantity || 0) * (item.unitPrice || 0),
        notes: item.notes
      }));
      await OutboundOrderItem.createBatch(items);
      
      delete updateData.items;
    }
    
    const updatedOrder = await OutboundOrder.findByIdAndUpdate(req.params.id, updateData);
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'outbound_order',
      moduleId: req.params.id,
      description: `更新出库单：${updatedOrder.orderNumber}`
    });
    
    const items = await OutboundOrderItem.findByOrderId(req.params.id);
    res.json({ success: true, data: { ...updatedOrder, items } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 完成出库单（更新库存）
exports.completeOutboundOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const order = await OutboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '出库单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '出库单已完成' });
    }
    
    // 获取出库明细
    const items = await OutboundOrderItem.findByOrderId(req.params.id);
    
    // 检查库存并更新
    for (const item of items) {
      const inventory = await Inventory.findByProductId(item.productId);
      if (!inventory || (inventory.quantity || 0) < (item.quantity || 0)) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `产品库存不足：${item.productName || item.productId}` 
        });
      }
      await Inventory.decrease(item.productId, item.quantity);
    }
    
    // 更新出库单状态
    const updatedOrder = await OutboundOrder.findByIdAndUpdate(req.params.id, { status: 'completed' });
    
    await connection.commit();
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'complete',
      module: 'outbound_order',
      moduleId: req.params.id,
      description: `完成出库单：${updatedOrder.orderNumber}`
    });
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// 删除出库单
exports.deleteOutboundOrder = async (req, res) => {
  try {
    const order = await OutboundOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '出库单不存在' });
    }
    
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: '已完成的出库单不能删除' });
    }
    
    await OutboundOrderItem.deleteByOrderId(req.params.id);
    await OutboundOrder.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'outbound_order',
      moduleId: req.params.id,
      description: `删除出库单：${order.orderNumber}`
    });
    
    res.json({ success: true, message: '出库单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 收款单管理 ====================

// 获取收款单列表
exports.getReceipts = async (req, res) => {
  try {
    const { receiptNumber, customerId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (receiptNumber) query.receiptNumber = receiptNumber;
    if (customerId) query.customerId = customerId;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [receipts, total] = await Promise.all([
      Receipt.find(query),
      Receipt.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: receipts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个收款单
exports.getReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: '收款单不存在' });
    }
    res.json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建收款单
exports.createReceipt = async (req, res) => {
  try {
    const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const receipt = await Receipt.create({
      receiptNumber,
      ...req.body,
      createdBy: req.user.id
    });
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'receipt',
      moduleId: receipt.id,
      description: `创建收款单：${receipt.receiptNumber}`
    });
    
    res.status(201).json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新收款单
exports.updateReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndUpdate(req.params.id, req.body);
    if (!receipt) {
      return res.status(404).json({ success: false, message: '收款单不存在' });
    }
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'receipt',
      moduleId: req.params.id,
      description: `更新收款单：${receipt.receiptNumber}`
    });
    
    res.json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除收款单
exports.deleteReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: '收款单不存在' });
    }
    
    await Receipt.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'receipt',
      moduleId: req.params.id,
      description: `删除收款单：${receipt.receiptNumber}`
    });
    
    res.json({ success: true, message: '收款单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 付款单管理 ====================

// 获取付款单列表
exports.getPaymentRecords = async (req, res) => {
  try {
    const { paymentNumber, supplierId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (paymentNumber) query.paymentNumber = paymentNumber;
    if (supplierId) query.supplierId = supplierId;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [payments, total] = await Promise.all([
      PaymentRecord.find(query),
      PaymentRecord.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个付款单
exports.getPaymentRecord = async (req, res) => {
  try {
    const payment = await PaymentRecord.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: '付款单不存在' });
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建付款单
exports.createPaymentRecord = async (req, res) => {
  try {
    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const payment = await PaymentRecord.create({
      paymentNumber,
      ...req.body,
      createdBy: req.user.id
    });
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'create',
      module: 'payment_record',
      moduleId: payment.id,
      description: `创建付款单：${payment.paymentNumber}`
    });
    
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新付款单
exports.updatePaymentRecord = async (req, res) => {
  try {
    const payment = await PaymentRecord.findByIdAndUpdate(req.params.id, req.body);
    if (!payment) {
      return res.status(404).json({ success: false, message: '付款单不存在' });
    }
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'payment_record',
      moduleId: req.params.id,
      description: `更新付款单：${payment.paymentNumber}`
    });
    
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除付款单
exports.deletePaymentRecord = async (req, res) => {
  try {
    const payment = await PaymentRecord.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: '付款单不存在' });
    }
    
    await PaymentRecord.findByIdAndDelete(req.params.id);
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'delete',
      module: 'payment_record',
      moduleId: req.params.id,
      description: `删除付款单：${payment.paymentNumber}`
    });
    
    res.json({ success: true, message: '付款单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 统计和分析 ====================

// 获取进货明细
exports.getPurchaseDetails = async (req, res) => {
  try {
    const { startDate, endDate, supplierId, productId, page = 1, limit = 20 } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT poi.*, po.orderNumber, po.orderDate, po.status as orderStatus, 
                        s.name as supplierName, p.name as productName, p.code as productCode, p.unit as productUnit 
                 FROM purchase_order_items poi 
                 LEFT JOIN purchase_orders po ON poi.orderId = po.id 
                 LEFT JOIN suppliers s ON po.supplierId = s.id 
                 LEFT JOIN products p ON poi.productId = p.id 
                 WHERE 1=1`;
      const params = [];
      
      if (startDate) {
        sql += ' AND po.orderDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND po.orderDate <= ?';
        params.push(endDate);
      }
      if (supplierId) {
        sql += ' AND po.supplierId = ?';
        params.push(supplierId);
      }
      if (productId) {
        sql += ' AND poi.productId = ?';
        params.push(productId);
      }
      
      sql += ' ORDER BY po.orderDate DESC, poi.id ASC';
      
      const limitNum = parseInt(limit);
      const offset = (parseInt(page) - 1) * limitNum;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
      
      const [rows] = await connection.execute(sql, params);
      
      // 获取总数
      let countSql = `SELECT COUNT(*) as count 
                      FROM purchase_order_items poi 
                      LEFT JOIN purchase_orders po ON poi.orderId = po.id 
                      WHERE 1=1`;
      const countParams = [];
      if (startDate) {
        countSql += ' AND po.orderDate >= ?';
        countParams.push(startDate);
      }
      if (endDate) {
        countSql += ' AND po.orderDate <= ?';
        countParams.push(endDate);
      }
      if (supplierId) {
        countSql += ' AND po.supplierId = ?';
        countParams.push(supplierId);
      }
      if (productId) {
        countSql += ' AND poi.productId = ?';
        countParams.push(productId);
      }
      const [countRows] = await connection.execute(countSql, countParams);
      const total = countRows[0].count;
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售明细
exports.getSalesDetails = async (req, res) => {
  try {
    const { startDate, endDate, customerId, productId, page = 1, limit = 20 } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT ooi.*, oo.orderNumber, oo.orderDate, oo.status as orderStatus, 
                        c.name as customerName, p.name as productName, p.code as productCode, p.unit as productUnit 
                 FROM outbound_order_items ooi 
                 LEFT JOIN outbound_orders oo ON ooi.orderId = oo.id 
                 LEFT JOIN customers c ON oo.customerId = c.id 
                 LEFT JOIN products p ON ooi.productId = p.id 
                 WHERE 1=1`;
      const params = [];
      
      if (startDate) {
        sql += ' AND oo.orderDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND oo.orderDate <= ?';
        params.push(endDate);
      }
      if (customerId) {
        sql += ' AND oo.customerId = ?';
        params.push(customerId);
      }
      if (productId) {
        sql += ' AND ooi.productId = ?';
        params.push(productId);
      }
      
      sql += ' ORDER BY oo.orderDate DESC, ooi.id ASC';
      
      const limitNum = parseInt(limit);
      const offset = (parseInt(page) - 1) * limitNum;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
      
      const [rows] = await connection.execute(sql, params);
      
      // 获取总数
      let countSql = `SELECT COUNT(*) as count 
                      FROM outbound_order_items ooi 
                      LEFT JOIN outbound_orders oo ON ooi.orderId = oo.id 
                      WHERE 1=1`;
      const countParams = [];
      if (startDate) {
        countSql += ' AND oo.orderDate >= ?';
        countParams.push(startDate);
      }
      if (endDate) {
        countSql += ' AND oo.orderDate <= ?';
        countParams.push(endDate);
      }
      if (customerId) {
        countSql += ' AND oo.customerId = ?';
        countParams.push(customerId);
      }
      if (productId) {
        countSql += ' AND ooi.productId = ?';
        countParams.push(productId);
      }
      const [countRows] = await connection.execute(countSql, countParams);
      const total = countRows[0].count;
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取需进货物品统计（库存不足）
exports.getLowStockProducts = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT i.*, p.name as productName, p.code as productCode, p.unit as productUnit, 
                pc.name as categoryName 
         FROM inventory i 
         LEFT JOIN products p ON i.productId = p.id 
         LEFT JOIN product_categories pc ON p.categoryId = pc.id 
         WHERE i.quantity <= i.minStock 
         ORDER BY (i.quantity - i.minStock) ASC`
      );
      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取应收统计
exports.getReceivablesStats = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT c.id, c.name as customerName, 
                        SUM(oo.totalAmount) as totalAmount,
                        COALESCE(SUM(r.amount), 0) as receivedAmount,
                        (SUM(oo.totalAmount) - COALESCE(SUM(r.amount), 0)) as receivableAmount
                 FROM outbound_orders oo 
                 LEFT JOIN customers c ON oo.customerId = c.id 
                 LEFT JOIN receipts r ON r.outboundOrderId = oo.id 
                 WHERE oo.status = 'completed'`;
      const params = [];
      
      if (customerId) {
        sql += ' AND oo.customerId = ?';
        params.push(customerId);
      }
      if (startDate) {
        sql += ' AND oo.orderDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND oo.orderDate <= ?';
        params.push(endDate);
      }
      
      sql += ' GROUP BY c.id, c.name HAVING receivableAmount > 0 ORDER BY receivableAmount DESC';
      
      const [rows] = await connection.execute(sql, params);
      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取应付统计
exports.getPayablesStats = async (req, res) => {
  try {
    const { supplierId, startDate, endDate } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT s.id, s.name as supplierName, 
                        SUM(po.totalAmount) as totalAmount,
                        COALESCE(SUM(pr.amount), 0) as paidAmount,
                        (SUM(po.totalAmount) - COALESCE(SUM(pr.amount), 0)) as payableAmount
                 FROM purchase_orders po 
                 LEFT JOIN suppliers s ON po.supplierId = s.id 
                 LEFT JOIN payment_records pr ON pr.purchaseOrderId = po.id 
                 WHERE po.status = 'completed'`;
      const params = [];
      
      if (supplierId) {
        sql += ' AND po.supplierId = ?';
        params.push(supplierId);
      }
      if (startDate) {
        sql += ' AND po.orderDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND po.orderDate <= ?';
        params.push(endDate);
      }
      
      sql += ' GROUP BY s.id, s.name HAVING payableAmount > 0 ORDER BY payableAmount DESC';
      
      const [rows] = await connection.execute(sql, params);
      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取供应商对账
exports.getSupplierReconciliation = async (req, res) => {
  try {
    const { supplierId, startDate, endDate } = req.query;
    const connection = await pool.getConnection();
    try {
      // 采购单
      let purchaseSql = `SELECT po.*, s.name as supplierName 
                         FROM purchase_orders po 
                         LEFT JOIN suppliers s ON po.supplierId = s.id 
                         WHERE 1=1`;
      const purchaseParams = [];
      
      if (supplierId) {
        purchaseSql += ' AND po.supplierId = ?';
        purchaseParams.push(supplierId);
      }
      if (startDate) {
        purchaseSql += ' AND po.orderDate >= ?';
        purchaseParams.push(startDate);
      }
      if (endDate) {
        purchaseSql += ' AND po.orderDate <= ?';
        purchaseParams.push(endDate);
      }
      purchaseSql += ' ORDER BY po.orderDate DESC';
      
      const [purchaseOrders] = await connection.execute(purchaseSql, purchaseParams);
      
      // 付款记录
      let paymentSql = `SELECT pr.*, s.name as supplierName 
                        FROM payment_records pr 
                        LEFT JOIN suppliers s ON pr.supplierId = s.id 
                        WHERE 1=1`;
      const paymentParams = [];
      
      if (supplierId) {
        paymentSql += ' AND pr.supplierId = ?';
        paymentParams.push(supplierId);
      }
      if (startDate) {
        paymentSql += ' AND pr.paymentDate >= ?';
        paymentParams.push(startDate);
      }
      if (endDate) {
        paymentSql += ' AND pr.paymentDate <= ?';
        paymentParams.push(endDate);
      }
      paymentSql += ' ORDER BY pr.paymentDate DESC';
      
      const [payments] = await connection.execute(paymentSql, paymentParams);
      
      res.json({
        success: true,
        data: {
          purchaseOrders,
          payments,
          summary: {
            totalPurchase: purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount || 0), 0),
            totalPaid: payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
            balance: purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount || 0), 0) - 
                     payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取客户对账
exports.getCustomerReconciliation = async (req, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const connection = await pool.getConnection();
    try {
      // 出库单
      let outboundSql = `SELECT oo.*, c.name as customerName 
                         FROM outbound_orders oo 
                         LEFT JOIN customers c ON oo.customerId = c.id 
                         WHERE 1=1`;
      const outboundParams = [];
      
      if (customerId) {
        outboundSql += ' AND oo.customerId = ?';
        outboundParams.push(customerId);
      }
      if (startDate) {
        outboundSql += ' AND oo.orderDate >= ?';
        outboundParams.push(startDate);
      }
      if (endDate) {
        outboundSql += ' AND oo.orderDate <= ?';
        outboundParams.push(endDate);
      }
      outboundSql += ' ORDER BY oo.orderDate DESC';
      
      const [outboundOrders] = await connection.execute(outboundSql, outboundParams);
      
      // 收款记录
      let receiptSql = `SELECT r.*, c.name as customerName 
                        FROM receipts r 
                        LEFT JOIN customers c ON r.customerId = c.id 
                        WHERE 1=1`;
      const receiptParams = [];
      
      if (customerId) {
        receiptSql += ' AND r.customerId = ?';
        receiptParams.push(customerId);
      }
      if (startDate) {
        receiptSql += ' AND r.receiptDate >= ?';
        receiptParams.push(startDate);
      }
      if (endDate) {
        receiptSql += ' AND r.receiptDate <= ?';
        receiptParams.push(endDate);
      }
      receiptSql += ' ORDER BY r.receiptDate DESC';
      
      const [receipts] = await connection.execute(receiptSql, receiptParams);
      
      res.json({
        success: true,
        data: {
          outboundOrders,
          receipts,
          summary: {
            totalSales: outboundOrders.reduce((sum, oo) => sum + parseFloat(oo.totalAmount || 0), 0),
            totalReceived: receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0),
            balance: outboundOrders.reduce((sum, oo) => sum + parseFloat(oo.totalAmount || 0), 0) - 
                     receipts.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0)
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取收支利润分析
exports.getProfitAnalysis = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const connection = await pool.getConnection();
    try {
      // 收入（收款）
      let incomeSql = `SELECT SUM(amount) as totalIncome 
                       FROM receipts 
                       WHERE 1=1`;
      const incomeParams = [];
      if (startDate) {
        incomeSql += ' AND receiptDate >= ?';
        incomeParams.push(startDate);
      }
      if (endDate) {
        incomeSql += ' AND receiptDate <= ?';
        incomeParams.push(endDate);
      }
      const [incomeRows] = await connection.execute(incomeSql, incomeParams);
      const totalIncome = parseFloat(incomeRows[0].totalIncome || 0);
      
      // 支出（付款）
      let expenseSql = `SELECT SUM(amount) as totalExpense 
                        FROM payment_records 
                        WHERE 1=1`;
      const expenseParams = [];
      if (startDate) {
        expenseSql += ' AND paymentDate >= ?';
        expenseParams.push(startDate);
      }
      if (endDate) {
        expenseSql += ' AND paymentDate <= ?';
        expenseParams.push(endDate);
      }
      const [expenseRows] = await connection.execute(expenseSql, expenseParams);
      const totalExpense = parseFloat(expenseRows[0].totalExpense || 0);
      
      // 利润
      const profit = totalIncome - totalExpense;
      
      res.json({
        success: true,
        data: {
          totalIncome,
          totalExpense,
          profit,
          profitRate: totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(2) : 0
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取销售利润分析
exports.getSalesProfitAnalysis = async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT p.id, p.name as productName, p.code as productCode,
                        SUM(ooi.quantity) as totalQuantity,
                        SUM(ooi.amount) as totalSalesAmount,
                        SUM(poi.quantity) as totalPurchaseQuantity,
                        SUM(poi.amount) as totalPurchaseAmount,
                        (SUM(ooi.amount) - SUM(poi.amount)) as profit
                 FROM outbound_order_items ooi 
                 LEFT JOIN outbound_orders oo ON ooi.orderId = oo.id 
                 LEFT JOIN products p ON ooi.productId = p.id 
                 LEFT JOIN purchase_order_items poi ON poi.productId = p.id 
                 LEFT JOIN purchase_orders po ON poi.orderId = po.id 
                 WHERE oo.status = 'completed' AND po.status = 'completed'`;
      const params = [];
      
      if (startDate) {
        sql += ' AND oo.orderDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        sql += ' AND oo.orderDate <= ?';
        params.push(endDate);
      }
      if (productId) {
        sql += ' AND p.id = ?';
        params.push(productId);
      }
      
      sql += ' GROUP BY p.id, p.name, p.code ORDER BY profit DESC';
      
      const [rows] = await connection.execute(sql, params);
      res.json({ success: true, data: rows });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== 库存管理 ====================

// 获取库存列表
exports.getInventory = async (req, res) => {
  try {
    const { productId, productCode, productName, lowStock, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (productId) query.productId = productId;
    if (productCode) query.productCode = productCode;
    if (productName) query.productName = productName;
    if (lowStock !== undefined) query.lowStock = lowStock === 'true';
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [inventory, total] = await Promise.all([
      Inventory.find(query),
      Inventory.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: inventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个库存
exports.getInventoryItem = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({ success: false, message: '库存记录不存在' });
    }
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新库存
exports.updateInventory = async (req, res) => {
  try {
    const inventory = await Inventory.upsert({
      productId: req.params.productId || req.body.productId,
      quantity: req.body.quantity,
      minStock: req.body.minStock,
      maxStock: req.body.maxStock,
      warehouse: req.body.warehouse,
      location: req.body.location
    });
    
    await OperationLog.create({
      userId: req.user.id,
      action: 'update',
      module: 'inventory',
      moduleId: inventory.id,
      description: `更新库存：产品ID ${inventory.productId}`
    });
    
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

