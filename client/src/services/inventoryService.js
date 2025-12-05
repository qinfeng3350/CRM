import api from '../utils/api';

const inventoryService = {
  // 供应商管理
  getSuppliers: async (params = {}) => {
    return await api.get('/inventory/suppliers', { params });
  },

  getSupplier: async (id) => {
    return await api.get(`/inventory/suppliers/${id}`);
  },

  createSupplier: async (data) => {
    return await api.post('/inventory/suppliers', data);
  },

  updateSupplier: async (id, data) => {
    return await api.put(`/inventory/suppliers/${id}`, data);
  },

  deleteSupplier: async (id) => {
    return await api.delete(`/inventory/suppliers/${id}`);
  },

  // 采购单管理
  getPurchaseOrders: async (params = {}) => {
    return await api.get('/inventory/purchase-orders', { params });
  },

  getPurchaseOrder: async (id) => {
    return await api.get(`/inventory/purchase-orders/${id}`);
  },

  createPurchaseOrder: async (data) => {
    return await api.post('/inventory/purchase-orders', data);
  },

  updatePurchaseOrder: async (id, data) => {
    return await api.put(`/inventory/purchase-orders/${id}`, data);
  },

  completePurchaseOrder: async (id, createInboundOrder = false) => {
    return await api.post(`/inventory/purchase-orders/${id}/complete`, { createInboundOrder });
  },

  deletePurchaseOrder: async (id) => {
    return await api.delete(`/inventory/purchase-orders/${id}`);
  },

  // 入库单管理
  getInboundOrders: async (params = {}) => {
    return await api.get('/inventory/inbound-orders', { params });
  },

  getInboundOrder: async (id) => {
    return await api.get(`/inventory/inbound-orders/${id}`);
  },

  createInboundOrder: async (data) => {
    return await api.post('/inventory/inbound-orders', data);
  },

  updateInboundOrder: async (id, data) => {
    return await api.put(`/inventory/inbound-orders/${id}`, data);
  },

  completeInboundOrder: async (id) => {
    return await api.post(`/inventory/inbound-orders/${id}/complete`);
  },

  deleteInboundOrder: async (id) => {
    return await api.delete(`/inventory/inbound-orders/${id}`);
  },

  // 出库单管理
  getOutboundOrders: async (params = {}) => {
    return await api.get('/inventory/outbound-orders', { params });
  },

  getOutboundOrder: async (id) => {
    return await api.get(`/inventory/outbound-orders/${id}`);
  },

  createOutboundOrder: async (data) => {
    return await api.post('/inventory/outbound-orders', data);
  },

  updateOutboundOrder: async (id, data) => {
    return await api.put(`/inventory/outbound-orders/${id}`, data);
  },

  completeOutboundOrder: async (id) => {
    return await api.post(`/inventory/outbound-orders/${id}/complete`);
  },

  deleteOutboundOrder: async (id) => {
    return await api.delete(`/inventory/outbound-orders/${id}`);
  },

  // 库存管理
  getInventory: async (params = {}) => {
    return await api.get('/inventory/inventory', { params });
  },

  getInventoryItem: async (id) => {
    return await api.get(`/inventory/inventory/${id}`);
  },

  updateInventory: async (productId, data) => {
    return await api.put(`/inventory/inventory/${productId}`, data);
  },

  // 收款单管理
  getReceipts: async (params = {}) => {
    return await api.get('/inventory/receipts', { params });
  },

  getReceipt: async (id) => {
    return await api.get(`/inventory/receipts/${id}`);
  },

  createReceipt: async (data) => {
    return await api.post('/inventory/receipts', data);
  },

  updateReceipt: async (id, data) => {
    return await api.put(`/inventory/receipts/${id}`, data);
  },

  deleteReceipt: async (id) => {
    return await api.delete(`/inventory/receipts/${id}`);
  },

  // 付款单管理
  getPaymentRecords: async (params = {}) => {
    return await api.get('/inventory/payment-records', { params });
  },

  getPaymentRecord: async (id) => {
    return await api.get(`/inventory/payment-records/${id}`);
  },

  createPaymentRecord: async (data) => {
    return await api.post('/inventory/payment-records', data);
  },

  updatePaymentRecord: async (id, data) => {
    return await api.put(`/inventory/payment-records/${id}`, data);
  },

  deletePaymentRecord: async (id) => {
    return await api.delete(`/inventory/payment-records/${id}`);
  },

  // 统计和分析
  getPurchaseDetails: async (params = {}) => {
    return await api.get('/inventory/purchase-details', { params });
  },

  getSalesDetails: async (params = {}) => {
    return await api.get('/inventory/sales-details', { params });
  },

  getLowStockProducts: async () => {
    return await api.get('/inventory/low-stock-products');
  },

  getReceivablesStats: async (params = {}) => {
    return await api.get('/inventory/receivables-stats', { params });
  },

  getPayablesStats: async (params = {}) => {
    return await api.get('/inventory/payables-stats', { params });
  },

  getSupplierReconciliation: async (params = {}) => {
    return await api.get('/inventory/supplier-reconciliation', { params });
  },

  getCustomerReconciliation: async (params = {}) => {
    return await api.get('/inventory/customer-reconciliation', { params });
  },

  getProfitAnalysis: async (params = {}) => {
    return await api.get('/inventory/profit-analysis', { params });
  },

  getSalesProfitAnalysis: async (params = {}) => {
    return await api.get('/inventory/sales-profit-analysis', { params });
  },
};

export default inventoryService;

