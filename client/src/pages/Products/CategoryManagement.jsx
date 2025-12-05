import { useState, useEffect } from 'react';
import {
  Card,
  Tree,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { productService } from '../../services/productService';

const { TextArea } = Input;

const CategoryManagement = () => {
  const [categoryTree, setCategoryTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadCategoryTree();
  }, []);

  const loadCategoryTree = async () => {
    setLoading(true);
    try {
      const response = await productService.getCategoryTree();
      if (response.success) {
        const tree = convertToTreeData(response.data || []);
        setCategoryTree(tree);
      }
    } catch (error) {
      message.error('加载分类树失败');
    } finally {
      setLoading(false);
    }
  };

  const convertToTreeData = (categories) => {
    return categories.map(cat => ({
      title: (
        <Space>
          <span>{cat.name}</span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(cat)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(cat.id)}
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
      key: cat.id,
      children: cat.children ? convertToTreeData(cat.children) : undefined,
      category: cat,
    }));
  };

  const handleAdd = (parentId = null) => {
    setEditingCategory(null);
    setSelectedParentId(parentId);
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({ parentId: parentId || undefined });
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setSelectedParentId(category.parentId);
    setModalVisible(true);
    form.setFieldsValue({
      ...category,
      parentId: category.parentId || undefined,
    });
  };

  const handleDelete = async (id) => {
    try {
      await productService.deleteCategory(id);
      message.success('删除成功');
      loadCategoryTree();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingCategory) {
        await productService.updateCategory(editingCategory.id, values);
        message.success('更新成功');
      } else {
        await productService.createCategory(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadCategoryTree();
    } catch (error) {
      message.error(error.message || (editingCategory ? '更新失败' : '创建失败'));
    }
  };

  return (
    <Card
      title="产品分类管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
          新增分类
        </Button>
      }
    >
      <Tree
        treeData={categoryTree}
        defaultExpandAll
        loading={loading}
      />

      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>

          <Form.Item name="parentId" label="上级分类">
            <Input
              value={selectedParentId || undefined}
              disabled
              placeholder="根分类"
            />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <Input type="number" />
          </Form.Item>

          <Form.Item name="isActive" label="状态" initialValue={true}>
            <Input disabled value="启用" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CategoryManagement;

