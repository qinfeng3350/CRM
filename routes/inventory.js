const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

const supplierRoles = ['admin', 'sales_manager', 'inventory_manager', 'purchase_manager'];
const purchaseRoles = ['admin', 'inventory_manager', 'purchase_manager'];
const warehouseRoles = ['admin', 'inventory_manager', 'purchase_manager'];
const financeRoles = ['admin', 'finance_manager', 'sales_manager', 'inventory_manager', 'purchase_manager'];

router.use(authenticate);

// 供应商管理
router.get('/suppliers', inventoryController.getSuppliers);
router.get('/suppliers/:id', inventoryController.getSupplier);
router.post('/suppliers', authorize(...supplierRoles), inventoryController.createSupplier);
router.put('/suppliers/:id', authorize(...supplierRoles), inventoryController.updateSupplier);
router.delete('/suppliers/:id', authorize(...supplierRoles), inventoryController.deleteSupplier);

// 采购单管理
router.get('/purchase-orders', inventoryController.getPurchaseOrders);
router.get('/purchase-orders/:id', inventoryController.getPurchaseOrder);
router.post('/purchase-orders', authorize(...purchaseRoles), inventoryController.createPurchaseOrder);
router.put('/purchase-orders/:id', authorize(...purchaseRoles), inventoryController.updatePurchaseOrder);
router.post('/purchase-orders/:id/complete', authorize(...purchaseRoles), inventoryController.completePurchaseOrder);
router.delete('/purchase-orders/:id', authorize(...purchaseRoles), inventoryController.deletePurchaseOrder);

// 入库单管理
router.get('/inbound-orders', inventoryController.getInboundOrders);
router.get('/inbound-orders/:id', inventoryController.getInboundOrder);
router.post('/inbound-orders', authorize(...warehouseRoles), inventoryController.createInboundOrder);
router.put('/inbound-orders/:id', authorize(...warehouseRoles), inventoryController.updateInboundOrder);
router.post('/inbound-orders/:id/complete', authorize(...warehouseRoles), inventoryController.completeInboundOrder);
router.delete('/inbound-orders/:id', authorize(...warehouseRoles), inventoryController.deleteInboundOrder);

// 出库单管理
router.get('/outbound-orders', inventoryController.getOutboundOrders);
router.get('/outbound-orders/:id', inventoryController.getOutboundOrder);
router.post('/outbound-orders', authorize(...warehouseRoles), inventoryController.createOutboundOrder);
router.put('/outbound-orders/:id', authorize(...warehouseRoles), inventoryController.updateOutboundOrder);
router.post('/outbound-orders/:id/complete', authorize(...warehouseRoles), inventoryController.completeOutboundOrder);
router.delete('/outbound-orders/:id', authorize(...warehouseRoles), inventoryController.deleteOutboundOrder);

// 收款单管理
router.get('/receipts', inventoryController.getReceipts);
router.get('/receipts/:id', inventoryController.getReceipt);
router.post('/receipts', authorize(...financeRoles), inventoryController.createReceipt);
router.put('/receipts/:id', authorize(...financeRoles), inventoryController.updateReceipt);
router.delete('/receipts/:id', authorize(...financeRoles), inventoryController.deleteReceipt);

// 付款单管理
router.get('/payment-records', inventoryController.getPaymentRecords);
router.get('/payment-records/:id', inventoryController.getPaymentRecord);
router.post('/payment-records', authorize(...financeRoles), inventoryController.createPaymentRecord);
router.put('/payment-records/:id', authorize(...financeRoles), inventoryController.updatePaymentRecord);
router.delete('/payment-records/:id', authorize(...financeRoles), inventoryController.deletePaymentRecord);

// 统计和分析
router.get('/purchase-details', inventoryController.getPurchaseDetails);
router.get('/sales-details', inventoryController.getSalesDetails);
router.get('/low-stock-products', inventoryController.getLowStockProducts);
router.get('/receivables-stats', inventoryController.getReceivablesStats);
router.get('/payables-stats', inventoryController.getPayablesStats);
router.get('/supplier-reconciliation', inventoryController.getSupplierReconciliation);
router.get('/customer-reconciliation', inventoryController.getCustomerReconciliation);
router.get('/profit-analysis', inventoryController.getProfitAnalysis);
router.get('/sales-profit-analysis', inventoryController.getSalesProfitAnalysis);

// 库存管理
router.get('/inventory', inventoryController.getInventory);
router.get('/inventory/:id', inventoryController.getInventoryItem);
router.put('/inventory/:productId', authorize(...warehouseRoles), inventoryController.updateInventory);

module.exports = router;

