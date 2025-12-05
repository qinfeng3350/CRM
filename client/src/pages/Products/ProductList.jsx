import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Drawer,
  Form,
  Select,
  InputNumber,
  message,
  Tag,
  Popconfirm,
  Card,
  Tabs,
  TreeSelect,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { productService } from '../../services/productService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadProducts();
    loadCategoryTree();
  }, [pagination.page, pagination.limit, searchText, selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.name = searchText;
      if (selectedCategory) params.categoryId = selectedCategory;
      
      const response = await productService.getProducts(params);
      if (response.success) {
        const productsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setProducts(productsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载产品列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载产品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryTree = async () => {
    try {
      const response = await productService.getCategoryTree();
      if (response.success) {
        setCategoryTree(response.data || []);
      }
    } catch (error) {
      console.error('加载分类树失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = async (record) => {
    setEditingProduct(record);
    setDrawerVisible(true);
    
    // 加载产品详情（包含价格）
    try {
      const response = await productService.getProduct(record.id);
      if (response.success) {
        form.setFieldsValue({
          ...response.data,
          specifications: response.data.specifications || {},
          standardPrice: response.data.standardPrice || null,
        });
      } else {
        form.setFieldsValue({
          ...record,
          specifications: record.specifications || {},
          standardPrice: record.standardPrice || null,
        });
      }
    } catch (error) {
      form.setFieldsValue({
        ...record,
        specifications: record.specifications || {},
        standardPrice: record.standardPrice || null,
      });
    }
  };

  const handleDelete = async (id) => {
    try {
      await productService.deleteProduct(id);
      message.success('删除成功');
      loadProducts();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, values);
        message.success('更新成功');
      } else {
        await productService.createProduct(values);
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingProduct(null);
      form.resetFields();
      loadProducts();
    } catch (error) {
      message.error(error.message || (editingProduct ? '更新失败' : '创建失败'));
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => productService.deleteProduct(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadProducts();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      const params = keys.length > 0 ? { ids: keys.join(',') } : {};
      // 这里需要后端API支持，暂时提示
      message.info('导出功能需要后端API支持');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    try {
      // 这里需要后端API支持，暂时提示
      message.info('导入功能需要后端API支持');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleFilterSubmit = (values) => {
    if (values.search) {
      setSearchText(values.search);
    }
    if (values.categoryId) {
      setSelectedCategory(values.categoryId);
    }
    loadProducts();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '产品编码', dataIndex: 'code', key: 'code' },
    { title: '产品名称', dataIndex: 'name', key: 'name' },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (text) => text || '-',
    },
    { title: '品牌', dataIndex: 'brand', key: 'brand' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    {
      title: '标准价格（元）',
      dataIndex: 'standardPrice',
      key: 'standardPrice',
      render: (price) => price ? `¥${parseFloat(price).toFixed(2)}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filterConfig = [
    {
      name: 'search',
      label: '搜索',
      type: 'input',
      placeholder: '请输入产品名称',
    },
    {
      name: 'categoryId',
      label: '产品分类',
      type: 'select',
      options: categoryTree.map(cat => ({
        label: cat.name,
        value: cat.id,
      })),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="搜索产品名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadProducts}
            />
            <TreeSelect
              placeholder="选择分类"
              treeData={categoryTree}
              value={selectedCategory}
              onChange={setSelectedCategory}
              allowClear
              style={{ width: 200 }}
              fieldNames={{ label: 'name', value: 'id', children: 'children' }}
            />
            <Button onClick={loadProducts}>搜索</Button>
            <Button onClick={() => navigate('/products/categories')}>
              产品分类管理
            </Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增产品
          </Button>
        </div>

        <BatchActions
          selectedRowKeys={selectedRowKeys}
          onBatchDelete={handleBatchDelete}
          onExport={handleExport}
          onImport={handleImport}
          onFilter={() => setFilterDrawerVisible(true)}
        />
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, page, limit: pageSize });
          },
        }}
      />

      <Drawer
        title={editingProduct ? '编辑产品' : '新增产品'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingProduct(null);
          form.resetFields();
        }}
        open={drawerVisible}
        width={720}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="code"
            label="产品编码"
            rules={[{ required: true, message: '请输入产品编码' }]}
          >
            <Input placeholder="请输入产品编码" />
          </Form.Item>

          <Form.Item
            name="name"
            label="产品名称"
            rules={[{ required: true, message: '请输入产品名称' }]}
          >
            <Input placeholder="请输入产品名称" />
          </Form.Item>

          <Form.Item name="categoryId" label="产品分类">
            <TreeSelect
              treeData={categoryTree}
              placeholder="请选择分类"
              allowClear
              fieldNames={{ label: 'name', value: 'id', children: 'children' }}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="brand" label="品牌" style={{ flex: 1 }}>
              <Input placeholder="请输入品牌" />
            </Form.Item>
            <Form.Item name="model" label="型号" style={{ flex: 1 }}>
              <Input placeholder="请输入型号" />
            </Form.Item>
            <Form.Item name="unit" label="单位" initialValue="件">
              <Input placeholder="单位" />
            </Form.Item>
          </Space>

          <Form.Item name="standardPrice" label="标准价格（元）">
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入标准价格"
            />
          </Form.Item>

          <Form.Item name="description" label="产品描述">
            <TextArea rows={3} placeholder="请输入产品描述" />
          </Form.Item>

          <Form.Item name="isActive" label="状态" initialValue={true}>
            <Select>
              <Option value={true}>启用</Option>
              <Option value={false}>禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                setEditingProduct(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      <FilterDrawer
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        filters={filterConfig}
        onSubmit={handleFilterSubmit}
        initialValues={{
          search: searchText,
          categoryId: selectedCategory,
        }}
      />
    </Card>
  );
};

export default ProductList;

