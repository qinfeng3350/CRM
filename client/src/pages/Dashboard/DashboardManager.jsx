/**
 * 数据大屏管理页面
 * 支持新建、编辑、删除大屏配置
 */

import React, { useState, useEffect } from 'react';
import { Button, Table, Space, Modal, Form, Input, Select, InputNumber, Checkbox, Card, Spin, Empty, message, Popconfirm, Tag, Tooltip, Divider } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import './DashboardManager.css';

const DashboardManager = () => {
  const [dashboards, setDashboards] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [chartTypes, setChartTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // 加载数据
  useEffect(() => {
    loadDashboards();
    loadDataSources();
    loadChartTypes();
  }, []);

  // 加载大屏列表
  const loadDashboards = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/dashboards');
      setDashboards(response.data.data || []);
    } catch (error) {
      console.error('加载大屏列表失败:', error);
      message.error('加载大屏列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载数据源列表
  const loadDataSources = async () => {
    try {
      const response = await axios.get('/api/dashboards/config/dataSources');
      setDataSources(response.data.data || []);
    } catch (error) {
      console.error('加载数据源失败:', error);
    }
  };

  // 加载图表类型
  const loadChartTypes = async () => {
    try {
      const response = await axios.get('/api/dashboards/config/chartTypes');
      setChartTypes(response.data.data || []);
    } catch (error) {
      console.error('加载图表类型失败:', error);
    }
  };

  // 打开新建/编辑模态框
  const handleOpenModal = async (dashboard = null) => {
    if (dashboard) {
      setEditingId(dashboard.id);
      form.setFieldsValue({
        name: dashboard.name,
        description: dashboard.description,
        icon: dashboard.icon,
        dataSource: dashboard.dataSource,
        chartType: dashboard.chartType ? dashboard.chartType.split(',') : [],
        refreshInterval: dashboard.refreshInterval / 1000, // 转换为秒
        isActive: dashboard.isActive,
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingId(null);
    form.resetFields();
  };

  // 保存大屏
  const handleSaveDashboard = async (values) => {
    try {
      const data = {
        ...values,
        chartType: values.chartType ? values.chartType.join(',') : '',
        refreshInterval: values.refreshInterval * 1000, // 转换为毫秒
        config: {
          fields: [],
          filters: [],
          layout: 'grid',
        },
      };

      if (editingId) {
        // 更新
        await axios.put(`/api/dashboards/${editingId}`, data);
        message.success('大屏更新成功');
      } else {
        // 创建
        await axios.post('/api/dashboards', data);
        message.success('大屏创建成功');
      }

      handleCloseModal();
      loadDashboards();
    } catch (error) {
      console.error('保存大屏失败:', error);
      message.error(error.response?.data?.message || '保存大屏失败');
    }
  };

  // 删除大屏
  const handleDeleteDashboard = async (id) => {
    try {
      await axios.delete(`/api/dashboards/${id}`);
      message.success('大屏删除成功');
      loadDashboards();
    } catch (error) {
      console.error('删除大屏失败:', error);
      message.error('删除大屏失败');
    }
  };

  // 复制大屏
  const handleCopyDashboard = async (dashboard) => {
    try {
      const newData = {
        ...dashboard,
        name: `${dashboard.name} (副本)`,
        id: undefined,
      };
      delete newData.id;
      delete newData.createdAt;
      delete newData.updatedAt;

      await axios.post('/api/dashboards', newData);
      message.success('大屏复制成功');
      loadDashboards();
    } catch (error) {
      console.error('复制大屏失败:', error);
      message.error('复制大屏失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '大屏名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text, record) => (
        <Tooltip title={record.description}>
          <div className="dashboard-name">{text}</div>
        </Tooltip>
      ),
    },
    {
      title: '数据源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 120,
      render: (text) => {
        const source = dataSources.find(s => s.key === text);
        return <Tag color="blue">{source?.name || text}</Tag>;
      },
    },
    {
      title: '图表类型',
      dataIndex: 'chartType',
      key: 'chartType',
      width: 200,
      render: (text) => (
        <Space size="small">
          {text
            ? text.split(',').map(type => {
                const chart = chartTypes.find(c => c.key === type);
                return <Tag key={type}>{chart?.label || type}</Tag>;
              })
            : '-'}
        </Space>
      ),
    },
    {
      title: '刷新频率',
      dataIndex: 'refreshInterval',
      key: 'refreshInterval',
      width: 100,
      render: (text) => `${text / 1000}s`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (text) => (
        <Tag color={text ? 'green' : 'red'}>{text ? '已启用' : '已禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看大屏">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => window.open(`/dashboard/${record.id}`, '_blank')}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyDashboard(record)}
            />
          </Tooltip>
          <Popconfirm
            title="删除大屏"
            description="确定要删除这个大屏吗？"
            onConfirm={() => handleDeleteDashboard(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="dashboard-manager">
      <Card>
        <div className="dashboard-manager-header">
          <div>
            <h2>数据大屏管理</h2>
            <p>创建和管理可视化数据大屏，支持多种数据源和图表类型</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlusCircleOutlined />}
            onClick={() => handleOpenModal()}
          >
            新建大屏
          </Button>
        </div>
      </Card>

      <Divider />

      <Spin spinning={loading}>
        {dashboards.length > 0 ? (
          <Table
            columns={columns}
            dataSource={dashboards}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个大屏`,
            }}
            scroll={{ x: 1200 }}
          />
        ) : (
          <Empty
            description="暂无大屏"
            style={{ marginTop: 60, marginBottom: 60 }}
          >
            <Button
              type="primary"
              size="large"
              icon={<PlusCircleOutlined />}
              onClick={() => handleOpenModal()}
            >
              新建大屏
            </Button>
          </Empty>
        )}
      </Spin>

      {/* 新建/编辑大屏模态框 */}
      <Modal
        title={editingId ? '编辑大屏' : '新建大屏'}
        visible={modalVisible}
        onCancel={handleCloseModal}
        width={800}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveDashboard}
          initialValues={{
            refreshInterval: 10,
            chartType: [],
          }}
        >
          <Form.Item
            label="大屏名称"
            name="name"
            rules={[{ required: true, message: '请输入大屏名称' }]}
          >
            <Input placeholder="e.g. 项目管理大屏" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea
              rows={3}
              placeholder="输入大屏描述信息"
            />
          </Form.Item>

          <Form.Item
            label="数据源"
            name="dataSource"
            rules={[{ required: true, message: '请选择数据源' }]}
          >
            <Select placeholder="选择数据源">
              {dataSources.map(source => (
                <Select.Option key={source.key} value={source.key}>
                  {source.name} - {source.description}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="图表类型"
            name="chartType"
            rules={[{ required: true, message: '至少选择一个图表类型' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择图表类型 (可多选)"
            >
              {chartTypes.map(chart => (
                <Select.Option key={chart.key} value={chart.key}>
                  {chart.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="刷新频率（秒）"
            name="refreshInterval"
            rules={[{ required: true, message: '请输入刷新频率' }]}
          >
            <InputNumber
              min={1}
              max={300}
              step={1}
              style={{ width: '100%' }}
              placeholder="输入秒数"
            />
          </Form.Item>

          <Form.Item
            label="图标"
            name="icon"
          >
            <Input placeholder="输入图标名称" />
          </Form.Item>

          <Form.Item
            name="isActive"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox>启用此大屏</Checkbox>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingId ? '更新' : '创建'}
              </Button>
              <Button onClick={handleCloseModal}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardManager;
