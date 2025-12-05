import { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Tag, message, Card } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';

const InventoryList = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [pagination.page, pagination.limit, searchText]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (searchText) params.productName = searchText;
      
      const response = await inventoryService.getInventory(params);
      if (response.success) {
        setInventory(Array.isArray(response.data) ? response.data : (response.data?.data || []));
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      }
    } catch (error) {
      message.error('加载库存失败');
    } finally {
      setLoading(false);
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

  const columns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '产品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '单位', dataIndex: 'productUnit', key: 'productUnit' },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q) => parseFloat(q || 0).toFixed(2),
    },
    {
      title: '最低库存',
      dataIndex: 'minStock',
      key: 'minStock',
      render: (m) => parseFloat(m || 0).toFixed(2),
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      render: (_, record) => {
        const qty = parseFloat(record.quantity || 0);
        const min = parseFloat(record.minStock || 0);
        if (qty <= min) {
          return <Tag color="red">库存不足</Tag>;
        }
        return <Tag color="green">正常</Tag>;
      },
    },
    { title: '仓库', dataIndex: 'warehouse', key: 'warehouse' },
    { title: '库位', dataIndex: 'location', key: 'location' },
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
              onPressEnter={loadInventory}
            />
            <Button onClick={loadInventory}>搜索</Button>
          </Space>
        </div>

        <BatchActions
          selectedRowKeys={selectedRowKeys}
          onExport={handleExport}
          onImport={handleImport}
          onFilter={() => setFilterDrawerVisible(true)}
        />
      </div>

      <Table
        columns={columns}
        dataSource={inventory}
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

      <FilterDrawer
        visible={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        onFilter={(values) => {
          if (values.search) {
            setSearchText(values.search);
          }
          loadInventory();
        }}
        config={[
          {
            name: 'search',
            label: '搜索',
            type: 'input',
            placeholder: '请输入产品名称',
          },
          {
            name: 'lowStock',
            label: '库存状态',
            type: 'select',
            options: [
              { label: '全部', value: '' },
              { label: '库存不足', value: 'true' },
              { label: '正常', value: 'false' },
            ],
          },
        ]}
      />
    </Card>
  );
};

export default InventoryList;

