const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductPrices,
  createProductPrice,
  updateProductPrice,
  deleteProductPrice,
  getCustomerProductPrice
} = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// 产品分类
router.get('/categories/tree', getCategoryTree);
router.get('/categories', getCategories);
router.post('/categories', authorize('admin', 'sales_manager'), createCategory);
router.put('/categories/:id', authorize('admin', 'sales_manager'), updateCategory);
router.delete('/categories/:id', authorize('admin', 'sales_manager'), deleteCategory);

// 产品
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('admin', 'sales_manager'), createProduct);
router.put('/:id', authorize('admin', 'sales_manager'), updateProduct);
router.delete('/:id', authorize('admin', 'sales_manager'), deleteProduct);

// 产品价格
router.get('/:productId/prices', getProductPrices);
router.post('/:productId/prices', authorize('admin', 'sales_manager'), createProductPrice);
router.put('/prices/:id', authorize('admin', 'sales_manager'), updateProductPrice);
router.delete('/prices/:id', authorize('admin', 'sales_manager'), deleteProductPrice);
router.get('/:productId/customer/:customerId/price', getCustomerProductPrice);

module.exports = router;

