import api from '../utils/api';

export const productService = {
  // 产品分类
  getCategories: (params) => api.get('/products/categories', { params }),
  getCategoryTree: () => api.get('/products/categories/tree'),
  createCategory: (data) => api.post('/products/categories', data),
  updateCategory: (id, data) => api.put(`/products/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/products/categories/${id}`),

  // 产品
  getProducts: (params) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),

  // 产品价格
  getProductPrices: (productId, params) => api.get(`/products/${productId}/prices`, { params }),
  createProductPrice: (productId, data) => api.post(`/products/${productId}/prices`, data),
  updateProductPrice: (id, data) => api.put(`/products/prices/${id}`, data),
  deleteProductPrice: (id) => api.delete(`/products/prices/${id}`),
  getCustomerProductPrice: (productId, customerId) => api.get(`/products/${productId}/customer/${customerId}/price`),
};

