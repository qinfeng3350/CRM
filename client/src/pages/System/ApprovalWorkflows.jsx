import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Card,
  Switch,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { approvalService } from '../../services/approvalService';

const { Option } = Select;
const { TextArea } = Input;

const ApprovalWorkflows = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await approvalService.getWorkflows({ page: 1, limit: 100 });
      if (response.success) {
        const workflowsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setWorkflows(workflowsList);
      } else {
        message.error(response.message || '加载审批流程失败');
      }
    } catch (error) {
      message.error(error.message || '加载审批流程失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingWorkflow(null);
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      steps: [{ type: 'role', value: '', priority: 'medium' }],
      isActive: true,
    });
  };

  const handleEdit = (record) => {
    setEditingWorkflow(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      conditions: record.conditions || {},
    });
  };

  const handleDelete = async (id) => {
    try {
      await approvalService.deleteWorkflow(id);
      message.success('删除成功');
      loadWorkflows();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingWorkflow) {
        await approvalService.updateWorkflow(editingWorkflow.id, values);
        message.success('更新成功');
      } else {
        await approvalService.createWorkflow(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadWorkflows();
    } catch (error) {
      message.error(error.message || (editingWorkflow ? '更新失败' : '创建失败'));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '流程名称', dataIndex: 'name', key: 'name' },
    {
      title: '模块类型',
      dataIndex: 'moduleType',
      key: 'moduleType',
      render: (type) => {
        const labels = {
          contract: '合同',
          opportunity: '商机',
          expense: '费用',
        };
        return <Tag>{labels[type] || type}</Tag>;
      },
    },
    {
      title: '审批步骤',
      dataIndex: 'steps',
      key: 'steps',
      render: (steps) => `${steps?.length || 0} 步`,
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
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此审批流程吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增审批流程
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingWorkflow ? '编辑审批流程' : '新增审批流程'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
          >
            <Input placeholder="例如：合同审批流程" />
          </Form.Item>

          <Form.Item
            name="moduleType"
            label="模块类型"
            rules={[{ required: true, message: '请选择模块类型' }]}
          >
            <Select placeholder="请选择模块类型">
              <Option value="contract">合同</Option>
              <Option value="opportunity">商机</Option>
              <Option value="expense">费用</Option>
            </Select>
          </Form.Item>

          <Form.Item label="触发条件">
            <Form.Item name={['conditions', 'minAmount']} label="最小金额" style={{ marginBottom: 8 }}>
              <InputNumber
                placeholder="最小金额"
                style={{ width: '100%' }}
                min={0}
                formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/¥\s?|(,*)/g, '')}
              />
            </Form.Item>
            <Form.Item name={['conditions', 'maxAmount']} label="最大金额" style={{ marginBottom: 8 }}>
              <InputNumber
                placeholder="最大金额"
                style={{ width: '100%' }}
                min={0}
                formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/¥\s?|(,*)/g, '')}
              />
            </Form.Item>
          </Form.Item>

          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <div key={field.key} style={{ border: '1px solid #d9d9d9', padding: 16, marginBottom: 16, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong>步骤 {index + 1}</strong>
                      {fields.length > 1 && (
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      )}
                    </div>
                    <Form.Item
                      name={[field.name, 'type']}
                      label="审批人类型"
                      rules={[{ required: true }]}
                    >
                      <Select>
                        <Option value="role">角色</Option>
                        <Option value="user">用户</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'value']}
                      label="审批人"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="角色名称或用户ID（多个用逗号分隔）" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'priority']}
                      label="优先级"
                    >
                      <Select>
                        <Option value="low">低</Option>
                        <Option value="medium">中</Option>
                        <Option value="high">高</Option>
                        <Option value="urgent">紧急</Option>
                      </Select>
                    </Form.Item>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block>
                  添加审批步骤
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item
            name="priority"
            label="流程优先级"
          >
            <InputNumber min={0} placeholder="数字越大优先级越高" />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="是否启用"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ApprovalWorkflows;

