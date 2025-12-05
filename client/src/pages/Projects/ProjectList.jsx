import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Drawer,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Progress,
  message,
  Tag,
  Popconfirm,
  Card,
  Tabs,
  Timeline,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import { customerService } from '../../services/customerService';
import { userService } from '../../services/userService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const ProjectList = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectLogs, setProjectLogs] = useState([]);
  const [form] = Form.useForm();
  const [logForm] = Form.useForm();

  useEffect(() => {
    loadProjects();
    loadCustomers();
    loadUsers();
  }, [pagination.page, pagination.limit, searchText, filterStatus]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.search = searchText;
      if (filterStatus) params.status = filterStatus;
      
      const response = await projectService.getProjects(params);
      if (response.success) {
        const projectsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setProjects(projectsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0,
        });
      }
    } catch (error) {
      message.error('加载项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers({ limit: 1000 });
      if (response.success) {
        setCustomers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载客户列表失败');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userService.getUsers({ limit: 1000 });
      if (response.success) {
        setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载用户列表失败');
    }
  };

  const loadProjectLogs = async (projectId) => {
    try {
      const response = await projectService.getLogs(projectId, { limit: 50 });
      if (response.success) {
        setProjectLogs(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('加载项目日志失败');
    }
  };

  const handleAdd = () => {
    setEditingProject(null);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = async (record) => {
    try {
      const response = await projectService.getProject(record.id);
      if (response.success) {
        setEditingProject(response.data);
        setDrawerVisible(true);
        form.setFieldsValue({
          ...response.data,
          startDate: response.data.startDate ? dayjs(response.data.startDate) : null,
          expectedEndDate: response.data.expectedEndDate ? dayjs(response.data.expectedEndDate) : null,
        });
      }
    } catch (error) {
      message.error('加载项目详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await projectService.deleteProject(id);
      message.success('删除成功');
      loadProjects();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleViewDetail = (record) => {
    navigate(`/projects/${record.id}`);
  };

  const handleAddLog = (record) => {
    setSelectedProject(record);
    setLogModalVisible(true);
    logForm.resetFields();
  };

  const handleLogSubmit = async (values) => {
    try {
      await projectService.addLog(selectedProject.id, values);
      message.success('日志添加成功');
      setLogModalVisible(false);
      if (detailModalVisible) {
        loadProjectLogs(selectedProject.id);
      }
      loadProjects();
    } catch (error) {
      message.error('添加日志失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        expectedEndDate: values.expectedEndDate ? values.expectedEndDate.format('YYYY-MM-DD') : null,
        // 确保数值字段正确
        progress: values.progress !== undefined && values.progress !== null ? parseInt(values.progress) : 0,
        budget: values.budget !== undefined && values.budget !== null ? parseFloat(values.budget) : 0,
        // 清理未定义的字段
        customerId: values.customerId || null,
        ownerId: values.ownerId || null,
      };
      if (editingProject) {
        await projectService.updateProject(editingProject.id, data);
        message.success('更新成功');
      } else {
        await projectService.createProject(data);
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingProject(null);
      form.resetFields();
      loadProjects();
    } catch (error) {
      console.error('提交失败:', error);
      message.error(error.response?.data?.message || error.message || (editingProject ? '更新失败' : '创建失败'));
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => projectService.deleteProject(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadProjects();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      const params = keys.length > 0 ? { ids: keys.join(',') } : {};
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

  const handleFilterSubmit = (values) => {
    if (values.search) {
      setSearchText(values.search);
    }
    if (values.status) {
      setFilterStatus(values.status);
    }
    loadProjects();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const handleUpdateProgress = async (projectId, progress) => {
    try {
      await projectService.updateProgress(projectId, progress);
      message.success('进度更新成功');
      loadProjects();
    } catch (error) {
      message.error('进度更新失败');
    }
  };

  const statusOptions = [
    { value: 'planning', label: '规划中', color: 'blue' },
    { value: 'in_progress', label: '进行中', color: 'processing' },
    { value: 'on_hold', label: '暂停', color: 'warning' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'cancelled', label: '已取消', color: 'error' },
  ];

  const priorityOptions = [
    { value: 'low', label: '低', color: 'default' },
    { value: 'medium', label: '中', color: 'blue' },
    { value: 'high', label: '高', color: 'orange' },
    { value: 'urgent', label: '紧急', color: 'red' },
  ];

  const columns = [
    { title: '项目编号', dataIndex: 'projectNumber', key: 'projectNumber' },
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    {
      title: '客户',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (id) => {
        const customer = customers.find((c) => c.id === id);
        return customer?.name || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const option = statusOptions.find((s) => s.value === status);
        return <Tag color={option?.color}>{option?.label || status}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const option = priorityOptions.find((p) => p.value === priority);
        return <Tag color={option?.color}>{option?.label || priority}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => <Progress percent={progress || 0} size="small" />,
    },
    {
      title: '负责人',
      dataIndex: 'ownerId',
      key: 'ownerId',
      render: (id) => {
        const user = users.find((u) => u.id === id);
        return user?.name || '-';
      },
    },
    {
      title: '预期结束日期',
      dataIndex: 'expectedEndDate',
      key: 'expectedEndDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            查看详情
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleAddLog(record)}>
            添加日志
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
      placeholder: '请输入项目名称',
    },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      options: statusOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
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
              placeholder="搜索项目名称"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={loadProjects}
              allowClear
            />
            <Button onClick={loadProjects}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增项目
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
        dataSource={projects}
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

      {/* 新增/编辑项目Drawer */}
      <Drawer
        title={editingProject ? '编辑项目' : '新增项目'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingProject(null);
          form.resetFields();
        }}
        open={drawerVisible}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="customerId" label="关联客户">
            <Select placeholder="请选择客户" allowClear showSearch>
              {customers.map((customer) => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.company}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="planning">
            <Select>
              {statusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              {priorityOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="progress" label="进度(%)" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expectedEndDate" label="预期结束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="budget" label="预算">
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item name="ownerId" label="项目负责人">
            <Select placeholder="请选择负责人" allowClear>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                setEditingProject(null);
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
          status: filterStatus,
        }}
      />

      {/* 项目详情Modal */}
      <Modal
        title="项目详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedProject && (
          <Tabs
            items={[
              {
                key: 'info',
                label: '基本信息',
                children: (
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="项目编号">{selectedProject.projectNumber}</Descriptions.Item>
                    <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {statusOptions.find((s) => s.value === selectedProject.status)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="优先级">
                      {priorityOptions.find((p) => p.value === selectedProject.priority)?.label}
                    </Descriptions.Item>
                    <Descriptions.Item label="进度" span={2}>
                      <Progress percent={selectedProject.progress || 0} />
                    </Descriptions.Item>
                    <Descriptions.Item label="开始日期">
                      {selectedProject.startDate ? dayjs(selectedProject.startDate).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="预期结束日期">
                      {selectedProject.expectedEndDate
                        ? dayjs(selectedProject.expectedEndDate).format('YYYY-MM-DD')
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="预算">¥{selectedProject.budget?.toLocaleString() || 0}</Descriptions.Item>
                    <Descriptions.Item label="实际成本">¥{selectedProject.actualCost?.toLocaleString() || 0}</Descriptions.Item>
                    <Descriptions.Item label="项目描述" span={2}>
                      {selectedProject.description || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'logs',
                label: '项目日志',
                children: (
                  <div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddLog(selectedProject)}
                      style={{ marginBottom: 16 }}
                    >
                      添加日志
                    </Button>
                    <Timeline>
                      {projectLogs.map((log) => (
                        <Timeline.Item key={log.id} color={log.logType === 'issue' ? 'red' : 'blue'}>
                          <div>
                            <strong>{log.title}</strong>
                            <div style={{ color: '#666', marginTop: 4 }}>{log.content}</div>
                            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                              {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                            </div>
                          </div>
                        </Timeline.Item>
                      ))}
                      {projectLogs.length === 0 && <div>暂无日志</div>}
                    </Timeline>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* 添加日志Modal */}
      <Modal
        title="添加项目日志"
        open={logModalVisible}
        onOk={() => logForm.submit()}
        onCancel={() => {
          setLogModalVisible(false);
          setSelectedProject(null);
        }}
      >
        <Form form={logForm} layout="vertical" onFinish={handleLogSubmit}>
          <Form.Item name="logType" label="日志类型" initialValue="info">
            <Select>
              <Option value="info">信息</Option>
              <Option value="progress">进度</Option>
              <Option value="issue">问题</Option>
              <Option value="milestone">里程碑</Option>
              <Option value="change">变更</Option>
              <Option value="comment">评论</Option>
            </Select>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProjectList;

