import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Drawer,
  Modal,
  Form,
  Select,
  message,
  Tag,
  Popconfirm,
  Card,
  Tabs,
} from 'antd';

const { TextArea } = Input;
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { customerService } from '../../services/customerService';
import CustomerForm from './CustomerForm';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';

const CustomerList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [updatingStatusRecord, setUpdatingStatusRecord] = useState(null);
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();

  useEffect(() => {
    loadCustomers();
  }, [pagination.page, pagination.limit, searchText, filterStatus]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.search = searchText;
      let response;
      if (filterStatus !== 'all') {
        if (filterStatus === 'public') {
          response = await customerService.getPublicCustomers(params);
        } else if (filterStatus === 'private') {
          response = await customerService.getPrivateCustomers(params);
        }
      } else {
        response = await customerService.getCustomers(params);
      }
      
      if (response.success) {
        const customersList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setCustomers(customersList);
        setPagination({ 
          ...pagination, 
          total: response.pagination?.total || 0 
        });
      } else {
        message.error(response.message || '加载客户列表失败');
      }
    } catch (error) {
      message.error('加载客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingCustomer(record);
    setDrawerVisible(true);
    form.setFieldsValue(record);
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => customerService.deleteCustomer(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadCustomers();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      // 这里调用导出API，如果keys为空则导出全部
      const params = keys.length > 0 ? { ids: keys.join(',') } : {};
      const response = await customerService.exportCustomers(params);
      // 创建下载链接
      const blob = new Blob([response.data || response], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `客户列表_${new Date().getTime()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error(error.response?.data?.message || '导出失败');
    }
  };

  const handleImport = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await customerService.importCustomers(formData);
      loadCustomers();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleFilterSubmit = (values) => {
    // 处理筛选条件
    if (values.search) {
      setSearchText(values.search);
    }
    if (values.status) {
      setFilterStatus(values.status);
    }
    loadCustomers();
  };

  const handleDelete = async (id) => {
    try {
      await customerService.deleteCustomer(id);
      message.success('删除成功');
      loadCustomers();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleClaim = async (id) => {
    try {
      await customerService.claimCustomer(id);
      message.success('认领成功');
      loadCustomers();
    } catch (error) {
      message.error('认领失败');
    }
  };

  const handleReturn = async (id) => {
    try {
      await customerService.returnToPublic(id);
      message.success('退回公海成功');
      loadCustomers();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleUpdateStatus = (record) => {
    setUpdatingStatusRecord(record);
    setStatusModalVisible(true);
    statusForm.setFieldsValue({ status: record.status });
  };

  const handleStatusSubmit = async (values) => {
    try {
      await customerService.updateStatus(updatingStatusRecord.id, values.status, values.reason);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      loadCustomers();
    } catch (error) {
      message.error(error.message || '状态更新失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.id, values);
        message.success('更新成功');
      } else {
        await customerService.createCustomer(values);
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingCustomer(null);
      form.resetFields();
      loadCustomers();
    } catch (error) {
      message.error(editingCustomer ? '更新失败' : '创建失败');
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
    onSelectAll: (selected, selectedRows, changeRows) => {
      console.log('全选:', selected, selectedRows, changeRows);
    },
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '公司', dataIndex: 'company', key: 'company' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '客户池',
      dataIndex: 'poolType',
      key: 'poolType',
      render: (text) => (
        <Tag color={text === 'public' ? 'blue' : 'green'}>
          {text === 'public' ? '公海' : '私海'}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (text) => {
        const colors = {
          potential: 'orange',
          intention: 'blue',
          customer: 'green',
          lost: 'red',
        };
        const labels = {
          potential: '潜在',
          intention: '意向',
          customer: '客户',
          lost: '流失',
        };
        return <Tag color={colors[text]}>{labels[text] || text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/customers/${record.id}`)}
          >
            查看详情
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.poolType === 'public' && (
            <Button type="link" size="small" onClick={() => handleClaim(record.id)}>
              认领
            </Button>
          )}
          {record.poolType === 'private' && (
            <Button type="link" size="small" onClick={() => handleReturn(record.id)}>
              退回
            </Button>
          )}
          <Button type="link" size="small" onClick={() => handleUpdateStatus(record)}>
            更新状态
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
      placeholder: '请输入客户姓名/公司/电话',
    },
    {
      name: 'status',
      label: '客户池',
      type: 'select',
      options: [
        { label: '全部', value: 'all' },
        { label: '公海', value: 'public' },
        { label: '私海', value: 'private' },
      ],
    },
  ];

  return (
    <div>
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
                placeholder="搜索客户（姓名/公司/电话）"
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={loadCustomers}
                allowClear
              />
              <Button onClick={loadCustomers}>搜索</Button>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
              新增客户
            </Button>
          </div>

          <BatchActions
            selectedRowKeys={selectedRowKeys}
            onBatchDelete={handleBatchDelete}
            onExport={handleExport}
            onImport={handleImport}
            onFilter={() => setFilterDrawerVisible(true)}
          />

          <Tabs
            activeKey={filterStatus}
            onChange={setFilterStatus}
            style={{ marginBottom: 16 }}
            items={[
              { key: 'all', label: '全部客户' },
              { key: 'public', label: '公海客户' },
              { key: 'private', label: '私海客户' },
            ]}
          />
        </div>

        <Table
          columns={columns}
          dataSource={customers}
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
      </Card>

      <Drawer
        title={editingCustomer ? '编辑客户' : '新增客户'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingCustomer(null);
          form.resetFields();
        }}
        open={drawerVisible}
        width={720}
        destroyOnClose
      >
        <CustomerForm
          form={form}
          onSubmit={handleSubmit}
          onCancel={() => {
            setDrawerVisible(false);
            setEditingCustomer(null);
            form.resetFields();
          }}
          initialValues={editingCustomer}
        />
      </Drawer>

      <FilterDrawer
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        filters={filterConfig}
        onSubmit={handleFilterSubmit}
        initialValues={{
          search: searchText,
          status: filterStatus,
        }}
      />

      <Modal
        title="更新客户状态"
        open={statusModalVisible}
        onOk={() => statusForm.submit()}
        onCancel={() => {
          setStatusModalVisible(false);
          setUpdatingStatusRecord(null);
        }}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleStatusSubmit}>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="potential">潜在</Select.Option>
              <Select.Option value="intention">意向</Select.Option>
              <Select.Option value="customer">客户</Select.Option>
              <Select.Option value="lost">流失</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="原因">
            <TextArea rows={3} placeholder="请输入状态更新原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerList;


