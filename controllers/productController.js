const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const ProductPrice = require('../models/ProductPrice');
const OperationLog = require('../models/OperationLog');

// 产品分类管理
exports.getCategories = async (req, res) => {
  try {
    const { parentId, isActive } = req.query;
    const query = {};
    if (parentId !== undefined) query.parentId = parentId === 'null' ? null : parseInt(parentId);
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const categories = await ProductCategory.find(query);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCategoryTree = async (req, res) => {
  try {
    const tree = await ProductCategory.getTree();
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await ProductCategory.create({
      ...req.body,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await ProductCategory.findByIdAndUpdate(req.params.id, req.body);
    if (!category) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await ProductCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '分类已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 产品管理
exports.getProducts = async (req, res) => {
  try {
    const { categoryId, code, name, isActive, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (categoryId) query.categoryId = categoryId;
    if (code) query.code = code;
    if (name) query.name = name;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 并行执行查询和计数（提高性能）
    const [products, total] = await Promise.all([
      Product.find(query),
      Product.countDocuments(query)
    ]);
    
    // 批量加载标准价格（避免N+1查询）
    if (products.length > 0) {
      const productIds = products.map(p => p.id);
      try {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          // 批量查询所有产品的标准价格
          const placeholders = productIds.map(() => '?').join(',');
          const [priceRows] = await connection.execute(
            `SELECT productId, price FROM product_prices 
             WHERE productId IN (${placeholders}) AND customerId IS NULL`,
            productIds
          );
          
          // 创建价格映射
          const priceMap = new Map();
          priceRows.forEach(row => {
            priceMap.set(row.productId, row.price);
          });
          
          // 为每个产品设置标准价格
          products.forEach(product => {
            product.standardPrice = priceMap.get(product.id) || null;
          });
        } finally {
          connection.release();
        }
      } catch (priceError) {
        console.error('批量加载产品价格失败:', priceError.message);
        // 如果批量查询失败，设置为null，不影响主流程
        products.forEach(product => {
          product.standardPrice = null;
        });
      }
    }
    
    res.json({
      success: true,
      data: products,
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

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    
    // 获取价格信息
    const prices = await ProductPrice.find({ productId: product.id, isActive: true });
    product.prices = prices;
    
    // 获取标准价格
    const standardPrice = await ProductPrice.getPriceForCustomer(product.id, null);
    product.standardPrice = standardPrice ? standardPrice.price : null;
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { standardPrice, ...productData } = req.body;
    
    const product = await Product.create({
      ...productData,
      createdBy: req.user.id
    });
    
    // 如果提供了标准价格，创建价格记录
    if (standardPrice !== undefined && standardPrice !== null && standardPrice !== '') {
      // 先检查是否已存在标准价格
      const existingPrice = await ProductPrice.find({ 
        productId: product.id, 
        customerId: null 
      });
      
      if (existingPrice.length > 0) {
        // 更新现有价格
        await ProductPrice.findByIdAndUpdate(existingPrice[0].id, {
          price: parseFloat(standardPrice),
          isActive: true
        });
      } else {
        // 创建新价格
        await ProductPrice.create({
          productId: product.id,
          customerId: null, // 标准价格
          price: parseFloat(standardPrice),
          currency: 'CNY',
          isActive: true,
          createdBy: req.user.id
        });
      }
    }
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'product',
      moduleId: product.id,
      action: 'create',
      userId: req.user.id,
      userName: req.user.name,
      description: `创建产品: ${product.name}`,
      newData: product,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const oldProduct = await Product.findById(req.params.id);
    if (!oldProduct) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    
    const { standardPrice, ...productData } = req.body;
    
    const product = await Product.findByIdAndUpdate(req.params.id, productData);
    
    // 如果提供了标准价格，创建或更新价格记录
    if (standardPrice !== undefined && standardPrice !== null && standardPrice !== '') {
      // 先检查是否已存在标准价格
      const existingPrices = await ProductPrice.find({ 
        productId: product.id, 
        customerId: null 
      });
      
      if (existingPrices.length > 0) {
        // 更新现有价格
        await ProductPrice.findByIdAndUpdate(existingPrices[0].id, {
          price: parseFloat(standardPrice),
          isActive: true
        });
      } else {
        // 创建新价格
        await ProductPrice.create({
          productId: product.id,
          customerId: null, // 标准价格
          price: parseFloat(standardPrice),
          currency: 'CNY',
          isActive: true,
          createdBy: req.user.id
        });
      }
    } else if (standardPrice === '' || standardPrice === null) {
      // 如果价格为空，停用所有标准价格
      const existingPrices = await ProductPrice.find({ 
        productId: product.id, 
        customerId: null 
      });
      for (const price of existingPrices) {
        await ProductPrice.findByIdAndUpdate(price.id, { isActive: false });
      }
    }
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'product',
      moduleId: product.id,
      action: 'update',
      userId: req.user.id,
      userName: req.user.name,
      description: `更新产品: ${product.name}`,
      oldData: oldProduct,
      newData: product,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: '产品不存在' });
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    // 记录操作日志
    await OperationLog.create({
      moduleType: 'product',
      moduleId: product.id,
      action: 'delete',
      userId: req.user.id,
      userName: req.user.name,
      description: `删除产品: ${product.name}`,
      oldData: product,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({ success: true, message: '产品已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 产品价格管理
exports.getProductPrices = async (req, res) => {
  try {
    const { productId, customerId } = req.query;
    const query = {};
    if (productId) query.productId = productId;
    if (customerId !== undefined) query.customerId = customerId === 'null' ? null : customerId;
    
    const prices = await ProductPrice.find(query);
    res.json({ success: true, data: prices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createProductPrice = async (req, res) => {
  try {
    const price = await ProductPrice.create({
      ...req.body,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProductPrice = async (req, res) => {
  try {
    const price = await ProductPrice.findByIdAndUpdate(req.params.id, req.body);
    if (!price) {
      return res.status(404).json({ success: false, message: '价格不存在' });
    }
    res.json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteProductPrice = async (req, res) => {
  try {
    await ProductPrice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '价格已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取客户产品价格
exports.getCustomerProductPrice = async (req, res) => {
  try {
    const { productId, customerId } = req.params;
    const price = await ProductPrice.getPriceForCustomer(productId, customerId);
    res.json({ success: true, data: price });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

