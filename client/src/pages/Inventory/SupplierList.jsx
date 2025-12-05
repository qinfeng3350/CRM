import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Drawer,
  Form,
  InputNumber,
  Select,
  message,
  Tag,
  Popconfirm,
  Card,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';

const { TextArea } = Input;
const { Option } = Select;

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSuppliers();
  }, [pagination.page, pagination.limit, searchText]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.name = searchText;
      
      const response = await inventoryService.getSuppliers(params);
      if (response.success) {
        const suppliersList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setSuppliers(suppliersList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载供应商列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载供应商列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingSupplier(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = async (record) => {
    setEditingSupplier(record);
    setDrawerVisible(true);
    form.setFieldsValue(record);
  };

  const handleDelete = async (id) => {
    try {
      const response = await inventoryService.deleteSupplier(id);
      if (response.success) {
        message.success('删除成功');
        loadSuppliers();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => inventoryService.deleteSupplier(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadSuppliers();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      message.info('导出功能需要后端API支持');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    try {
      message.info('导入功能需要后端API支持');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingSupplier) {
        const response = await inventoryService.updateSupplier(editingSupplier.id, values);
        if (response.success) {
          message.success('更新成功');
          setDrawerVisible(false);
          loadSuppliers();
        } else {
          message.error(response.message || '更新失败');
        }
      } else {
        const response = await inventoryService.createSupplier(values);
        if (response.success) {
          message.success('创建成功');
          setDrawerVisible(false);
          loadSuppliers();
        } else {
          message.error(response.message || '创建失败');
        }
      }
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '供应商名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      key: 'contactName',
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个供应商吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
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
              placeholder="搜索供应商名称"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadSuppliers}
            />
            <Button onClick={loadSuppliers}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增供应商
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
        dataSource={suppliers}
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
        title={editingSupplier ? '编辑供应商' : '新增供应商'}
        width={600}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>
              确定
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="供应商编码"
          >
            <Input placeholder="请输入供应商编码" />
          </Form.Item>
          <Form.Item
            name="name"
            label="供应商名称"
            rules={[{ required: true, message: '请输入供应商名称' }]}
          >
            <Input placeholder="请输入供应商名称" />
          </Form.Item>
          <Form.Item
            name="contactName"
            label="联系人"
          >
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item
            name="contactEmail"
            label="联系邮箱"
          >
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>
          <Form.Item
            name="address"
            label="地址"
          >
            <TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>
          <Form.Item
            name="taxNumber"
            label="税号"
          >
            <Input placeholder="请输入税号" />
          </Form.Item>
          <Form.Item
            name="bankName"
            label="开户银行"
          >
            <Input placeholder="请输入开户银行" />
          </Form.Item>
          <Form.Item
            name="bankAccount"
            label="银行账号"
          >
            <Input placeholder="请输入银行账号" />
          </Form.Item>
          <Form.Item
            name="creditLimit"
            label="信用额度"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入信用额度"
              min={0}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            initialValue="active"
          >
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Drawer>

      <FilterDrawer
        visible={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        onFilter={(values) => {
          if (values.search) {
            setSearchText(values.search);
          }
          loadSuppliers();
        }}
        config={[
          {
            name: 'search',
            label: '搜索',
            type: 'input',
            placeholder: '请输入供应商名称',
          },
          {
            name: 'status',
            label: '状态',
            type: 'select',
            options: [
              { label: '启用', value: 'active' },
              { label: '停用', value: 'inactive' },
            ],
          },
        ]}
      />
    </Card>
  );
};

export default SupplierList;

