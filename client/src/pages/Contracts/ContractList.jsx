import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Drawer,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Modal,
  message,
  Tag,
  Popconfirm,
  Card,
  Upload,
  Image,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { contractService } from '../../services/contractService';
import { customerService } from '../../services/customerService';
import { approvalService } from '../../services/approvalService';
import { productService } from '../../services/productService';
import { userService } from '../../services/userService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import SignaturePad from '../../components/Common/SignaturePad';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const ContractList = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSelectValue, setProductSelectValue] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [signatureList, setSignatureList] = useState([]);
  const [signaturePadVisible, setSignaturePadVisible] = useState(false);
  const [currentSignerId, setCurrentSignerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadContracts();
    loadCustomers();
    loadProducts();
    loadUsers();
  }, [pagination.page, pagination.limit, searchText, filterStatus]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.search = searchText;
      if (filterStatus) params.status = filterStatus;
      
      const response = await contractService.getContracts(params);
      console.log('合同列表响应:', response); // 调试用
      if (response.success) {
        // 后端返回格式: { success: true, data: [...], pagination: {...} }
        const contractsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setContracts(contractsList);
        setPagination({ 
          ...pagination, 
          total: response.pagination?.total || 0 
        });
      } else {
        message.error(response.message || '加载合同列表失败');
      }
    } catch (error) {
      console.error('加载合同列表错误:', error);
      message.error(error.message || '加载合同列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers({ page: 1, limit: 1000 });
      if (response.success) {
        setCustomers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载客户列表失败');
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productService.getProducts({ limit: 1000, isActive: true });
      if (response.success) {
        setProducts(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userService.getUsers({ limit: 1000 });
      if (response.success) {
        setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const handleAdd = async () => {
    setEditingContract(null);
    setSelectedProducts([]);
    setProductSelectValue([]);
    setFileList([]);
    setSignatureList([]);
    
    // 生成合同编号：HT-YYYYMMDD-HHmmss-随机数（确保唯一性）
    const today = dayjs();
    const dateStr = today.format('YYYYMMDD');
    const timeStr = today.format('HHmmss');
    const randomStr = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const contractNumber = `HT-${dateStr}-${timeStr}-${randomStr}`;
    
    // 设置默认日期
    const todayDate = dayjs();
    const endDate = todayDate.add(1, 'month'); // 加一个月
    
    setDrawerVisible(true);
    form.resetFields();
    
    // 设置表单默认值
    form.setFieldsValue({
      contractNumber: contractNumber,
      signDate: todayDate,
      startDate: todayDate,
      endDate: endDate,
      contractType: 'sales',
      status: 'draft',
    });
  };

  const handleEdit = async (record) => {
    try {
      // 重新加载完整的合同数据（包括产品）
      const response = await contractService.getContract(record.id);
      if (response.success) {
        const fullContract = response.data;
        setEditingContract(fullContract);
        // 设置产品数据，确保包含所有必要字段
        const products = (fullContract.products || []).map(p => ({
          productId: p.productId || p.id,
          productName: p.productName || p.name,
          quantity: p.quantity || 1,
          unitPrice: p.unitPrice || 0,
          discount: p.discount || 0,
          amount: p.amount || 0,
        }));
        setSelectedProducts(products);
        setProductSelectValue([]);
        
        // 处理附件
        const attachments = fullContract.attachments ? (typeof fullContract.attachments === 'string' ? JSON.parse(fullContract.attachments) : fullContract.attachments) : [];
        setFileList(attachments.map((att, index) => ({
          uid: `-${index}`,
          name: att.name || att.filename || `附件${index + 1}`,
          status: 'done',
          url: att.url || att.path,
        })));
        
        // 处理签名
        const signatures = fullContract.signatures ? (typeof fullContract.signatures === 'string' ? JSON.parse(fullContract.signatures) : fullContract.signatures) : [];
        setSignatureList(signatures);
        
        // 处理签署人
        const signers = fullContract.signers ? (typeof fullContract.signers === 'string' ? JSON.parse(fullContract.signers) : fullContract.signers) : [];
        
        setDrawerVisible(true);
        form.setFieldsValue({
          ...fullContract,
          signDate: fullContract.signDate ? dayjs(fullContract.signDate) : null,
          startDate: fullContract.startDate ? dayjs(fullContract.startDate) : null,
          endDate: fullContract.endDate ? dayjs(fullContract.endDate) : null,
          contractType: fullContract.contractType || 'sales',
          signers: signers,
        });
      } else {
        message.error('加载合同详情失败');
      }
    } catch (error) {
      message.error('加载合同详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await contractService.deleteContract(id);
      message.success('删除成功');
      loadContracts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalWorkflowInfo, setApprovalWorkflowInfo] = useState(null);
  const [pendingContractId, setPendingContractId] = useState(null);
  
  // 获取审批流程信息
  const loadApprovalWorkflow = async (contractId) => {
    try {
      // 获取合同信息
      const contractResponse = await contractService.getContract(contractId);
      if (!contractResponse.success) {
        message.error('获取合同信息失败');
        return;
      }
      const contract = contractResponse.data;
      
      // 尝试获取旧流程定义（兼容旧系统）
      try {
        const workflowResponse = await approvalService.getWorkflows({ 
          moduleType: 'contract',
          limit: 1 
        });
        
        if (workflowResponse.success && workflowResponse.data && workflowResponse.data.length > 0) {
          const workflow = workflowResponse.data[0];
          setApprovalWorkflowInfo({
            workflow,
            contract,
          });
          setPendingContractId(contractId);
          setApprovalModalVisible(true);
          return;
        }
      } catch (oldWorkflowError) {
        console.log('获取旧流程信息失败:', oldWorkflowError);
      }
      
      // 如果没有流程定义，直接提交
      await doSubmitApproval(contractId);
    } catch (error) {
      console.error('获取审批流程信息失败:', error);
      // 出错时直接提交
      await doSubmitApproval(contractId);
    }
  };

  // 实际提交审批
  const doSubmitApproval = async (id) => {
    setSubmittingApproval(true);
    try {
      // 先更新合同状态为pending
      await contractService.updateContract(id, { status: 'pending' });
      // 启动审批流程
      const response = await approvalService.startApproval({
        moduleType: 'contract',
        moduleId: id,
      });
      
      if (response.success) {
        message.success(response.message || '已提交审批');
        loadContracts();
      } else {
        message.error(response.message || '提交审批失败');
      }
    } catch (error) {
      console.error('提交审批失败:', error);
      message.error(error.response?.data?.message || error.message || '提交审批失败');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleSubmitApproval = async (id) => {
    // 防止重复提交
    if (submittingApproval) {
      message.warning('正在提交审批，请勿重复操作');
      return;
    }
    
    // 先加载审批流程信息，显示确认弹窗
    await loadApprovalWorkflow(id);
  };

  // 确认提交审批
  const handleConfirmApproval = async () => {
    if (!pendingContractId) return;
    setApprovalModalVisible(false);
    await doSubmitApproval(pendingContractId);
    setPendingContractId(null);
    setApprovalWorkflowInfo(null);
  };

  const handleSubmit = async (values) => {
    try {
      // 计算总金额
      let totalAmount = 0;
      selectedProducts.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
      
      // 处理附件上传
      const attachments = fileList.map(file => ({
        name: file.name,
        url: file.url || file.response?.url || file.response?.data?.url,
        path: file.path || file.response?.path || file.response?.data?.path,
        size: file.size,
        type: file.type,
      }));
      
      const data = {
        ...values,
        amount: totalAmount || values.amount || 0,
        signDate: values.signDate ? values.signDate.format('YYYY-MM-DD') : null,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
        products: selectedProducts,
        contractType: values.contractType || 'sales',
        signers: values.signers || [],
        attachments: attachments,
        signatures: signatureList,
      };
      if (editingContract) {
        await contractService.updateContract(editingContract.id, data);
        message.success('更新成功');
      } else {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        await contractService.createContract({
          ...data,
          ownerId: user.id,
        });
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingContract(null);
      setSelectedProducts([]);
      setProductSelectValue([]);
      setFileList([]);
      setSignatureList([]);
      form.resetFields();
      loadContracts();
    } catch (error) {
      message.error(error.message || (editingContract ? '更新失败' : '创建失败'));
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => contractService.deleteContract(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadContracts();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      const params = keys.length > 0 ? { ids: keys.join(',') } : {};
      // 这里需要后端API支持
      message.info('导出功能需要后端API支持');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    try {
      // 这里需要后端API支持
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
    loadContracts();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const handleAddProduct = async (productIds, customerId) => {
    // 支持多选，productIds 可能是数组或单个值
    const ids = Array.isArray(productIds) ? productIds : [productIds];
    
    for (const productId of ids) {
      // 检查是否已存在
      if (selectedProducts.find(p => p.productId === productId)) {
        continue; // 跳过已存在的产品
      }
      
      const product = products.find(p => p.id === productId);
      if (!product) continue;
      
      // 获取产品价格
      let unitPrice = 0;
      try {
        if (customerId) {
          const priceResponse = await productService.getCustomerProductPrice(productId, customerId);
          if (priceResponse.success && priceResponse.data) {
            unitPrice = parseFloat(priceResponse.data.price || 0);
          }
        }
        if (!unitPrice) {
          const pricesResponse = await productService.getProductPrices(productId, { customerId: null, isActive: true });
          if (pricesResponse.success && pricesResponse.data && pricesResponse.data.length > 0) {
            unitPrice = parseFloat(pricesResponse.data[0].price || 0);
          }
        }
      } catch (error) {
        console.error('获取产品价格失败:', error);
      }
      
      const newProduct = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: unitPrice,
        discount: 0,
        amount: unitPrice,
        description: ''
      };
      
      setSelectedProducts(prev => [...prev, newProduct]);
    }
  };

  const handleRemoveProduct = (index) => {
    const newProducts = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(newProducts);
  };

  const calculateAmount = (quantity, unitPrice, discount) => {
    return (quantity || 0) * (unitPrice || 0) * (1 - (discount || 0) / 100);
  };

  const handleUpdateProduct = (index, field, value) => {
    const newProducts = [...selectedProducts];
    // 确保行存在
    if (!newProducts[index]) {
      newProducts[index] = {
        productId: null,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        amount: 0,
      };
    }
    newProducts[index][field] = value;
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const item = newProducts[index];
      item.amount = calculateAmount(item.quantity || 0, item.unitPrice || 0, item.discount || 0);
    }
    setSelectedProducts(newProducts);
  };

  const handleAddProductRow = () => {
    const newProduct = {
      productId: null,
      productName: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      amount: 0,
    };
    setSelectedProducts([...selectedProducts, newProduct]);
  };

  const statusOptions = [
    { value: 'draft', label: '草稿', color: 'default' },
    { value: 'pending', label: '待审批', color: 'orange' },
    { value: 'approved', label: '已审批', color: 'blue' },
    { value: 'signed', label: '已签署', color: 'green' },
    { value: 'executing', label: '执行中', color: 'cyan' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'terminated', label: '已终止', color: 'red' },
    { value: 'rejected', label: '已拒绝', color: 'red' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '合同编号', dataIndex: 'contractNumber', key: 'contractNumber' },
    { title: '合同标题', dataIndex: 'title', key: 'title' },
    {
      title: '客户',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (id) => {
        const customer = customers.find((c) => c.id === id);
        return customer?.name || id;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
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
      title: '签署日期',
      dataIndex: 'signDate',
      key: 'signDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
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
            onClick={() => navigate(`/contracts/${record.id}`)}
          >
            查看详情
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleSubmitApproval(record.id)}
              loading={submittingApproval}
              disabled={submittingApproval}
            >
              提交审批
            </Button>
          )}
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
      placeholder: '请输入合同编号/标题',
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
                placeholder="搜索合同编号/标题"
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={loadContracts}
                allowClear
              />
              <Button onClick={loadContracts}>搜索</Button>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
              新增合同
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
          dataSource={contracts}
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
        title={editingContract ? '编辑合同' : '新增合同'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingContract(null);
          setSelectedProducts([]);
          setProductSelectValue([]);
          setFileList([]);
          setSignatureList([]);
          form.resetFields();
        }}
        open={drawerVisible}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="contractNumber"
            label="合同编号"
            rules={[{ required: true, message: '请输入合同编号' }]}
          >
            <Input placeholder="合同编号将自动生成" />
          </Form.Item>

          <Form.Item
            name="title"
            label="合同标题"
            rules={[{ required: true, message: '请输入合同标题' }]}
          >
            <Input placeholder="请输入合同标题" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" showSearch filterOption={(input, option) =>
              (option?.children?.toString() || '').toLowerCase().includes(input.toLowerCase())
            }>
              {customers.map((customer) => (
                <Select.Option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.company}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="contractType"
            label="合同类型"
            rules={[{ required: true, message: '请选择合同类型' }]}
            initialValue="sales"
          >
            <Select placeholder="请选择合同类型">
              <Select.Option value="sales">销售合同</Select.Option>
              <Select.Option value="service">服务合同</Select.Option>
              <Select.Option value="purchase">采购合同</Select.Option>
              <Select.Option value="lease">租赁合同</Select.Option>
              <Select.Option value="cooperation">合作协议</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="signers"
            label="签署人"
            rules={[{ required: true, message: '请选择签署人' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择签署人（可多选）"
              showSearch
              filterOption={(input, option) =>
                (option?.children?.toString() || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name} {user.email ? `(${user.email})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="产品明细">
            <div style={{ marginBottom: 8 }}>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddProductRow}
                style={{ width: '100%' }}
              >
                添加产品行
              </Button>
            </div>
            <Table
              size="small"
              dataSource={selectedProducts.length > 0 ? selectedProducts : [{ productId: null, quantity: 1, unitPrice: 0, discount: 0, amount: 0 }]}
              rowKey={(record, index) => record.productId || `new-${index}`}
              pagination={false}
              columns={[
                {
                  title: '产品名称',
                  dataIndex: 'productId',
                  key: 'productName',
                  width: 200,
                  render: (productId, record, index) => {
                    // 确保 record 存在
                    const currentRecord = record || {};
                    return (
                      <Select
                        showSearch
                        placeholder="请选择产品"
                        style={{ width: '100%' }}
                        value={productId || undefined}
                        onChange={async (value) => {
                          const product = products.find(p => p.id === value);
                          if (product) {
                            const customerId = form.getFieldValue('customerId');
                            const updatedProducts = [...selectedProducts];
                            
                            // 确保当前行存在
                            if (!updatedProducts[index]) {
                              updatedProducts[index] = {
                                productId: null,
                                productName: '',
                                quantity: 1,
                                unitPrice: 0,
                                discount: 0,
                                amount: 0,
                              };
                            }
                            
                            // 先初始化产品信息，单价设为0，等待获取实际价格
                            updatedProducts[index] = {
                              ...updatedProducts[index],
                              productId: product.id,
                              productName: product.name,
                              quantity: updatedProducts[index].quantity || 1,
                              discount: updatedProducts[index].discount || 0,
                              unitPrice: 0, // 初始化为0，等待获取实际价格
                            };
                            
                            // 获取产品价格（优先客户价格，否则标准价格）
                            let finalPrice = 0;
                            
                            if (customerId && product.id) {
                              try {
                                // 先尝试获取客户专属价格
                                const priceRes = await productService.getCustomerProductPrice(product.id, customerId);
                                if (priceRes.success && priceRes.data) {
                                  // priceRes.data 可能是价格对象，包含 price 字段
                                  const priceValue = priceRes.data.price || priceRes.data;
                                  if (priceValue && typeof priceValue === 'number') {
                                    finalPrice = priceValue;
                                  } else if (priceValue && typeof priceValue === 'string') {
                                    finalPrice = parseFloat(priceValue) || 0;
                                  }
                                }
                                
                                // 如果客户价格不存在或为0，尝试获取标准价格
                                if (!finalPrice) {
                                  const pricesRes = await productService.getProductPrices(product.id, { customerId: null, isActive: true });
                                  if (pricesRes.success && pricesRes.data && Array.isArray(pricesRes.data) && pricesRes.data.length > 0) {
                                    // 找到标准价格（customerId为null的）
                                    const standardPrice = pricesRes.data.find(p => !p.customerId) || pricesRes.data[0];
                                    if (standardPrice && standardPrice.price) {
                                      finalPrice = parseFloat(standardPrice.price) || 0;
                                    }
                                  }
                                }
                              } catch (error) {
                                console.error('获取产品价格失败:', error);
                                finalPrice = 0; // 获取失败，使用0
                              }
                            } else {
                              // 没有客户，获取标准价格
                              try {
                                const pricesRes = await productService.getProductPrices(product.id, { customerId: null, isActive: true });
                                if (pricesRes.success && pricesRes.data && Array.isArray(pricesRes.data) && pricesRes.data.length > 0) {
                                  const standardPrice = pricesRes.data.find(p => !p.customerId) || pricesRes.data[0];
                                  if (standardPrice && standardPrice.price) {
                                    finalPrice = parseFloat(standardPrice.price) || 0;
                                  }
                                }
                              } catch (error) {
                                console.error('获取产品价格失败:', error);
                                finalPrice = 0; // 获取失败，使用0
                              }
                            }
                            
                            // 更新单价（只使用实际获取到的价格，不填充错误数据）
                            updatedProducts[index].unitPrice = finalPrice;
                            
                            // 计算金额
                            updatedProducts[index].amount = calculateAmount(
                              updatedProducts[index].quantity || 1,
                              updatedProducts[index].unitPrice || 0,
                              updatedProducts[index].discount || 0
                            );
                            
                            setSelectedProducts(updatedProducts);
                          }
                        }}
                        filterOption={(input, option) =>
                          (option?.children?.toString() || '').toLowerCase().indexOf(input.toLowerCase()) >= 0
                        }
                        notFoundContent="暂无产品"
                      >
                        {products.map(product => (
                          <Select.Option key={product.id} value={product.id}>
                            {product.name} ({product.code})
                          </Select.Option>
                        ))}
                      </Select>
                    );
                  },
                },
                {
                  title: '数量',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 100,
                  render: (qty, record, index) => {
                    const currentRecord = record || {};
                    return (
                      <InputNumber
                        min={0}
                        value={currentRecord.quantity || 1}
                        onChange={(value) => handleUpdateProduct(index, 'quantity', value)}
                        style={{ width: '100%' }}
                      />
                    );
                  },
                },
                {
                  title: '单价',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 120,
                  render: (price, record, index) => {
                    const currentRecord = record || {};
                    return (
                      <InputNumber
                        min={0}
                        precision={2}
                        value={currentRecord.unitPrice || 0}
                        onChange={(value) => handleUpdateProduct(index, 'unitPrice', value)}
                        style={{ width: '100%' }}
                      />
                    );
                  },
                },
                {
                  title: '折扣(%)',
                  dataIndex: 'discount',
                  key: 'discount',
                  width: 100,
                  render: (discount, record, index) => {
                    const currentRecord = record || {};
                    return (
                      <InputNumber
                        min={0}
                        max={100}
                        value={currentRecord.discount || 0}
                        onChange={(value) => handleUpdateProduct(index, 'discount', value)}
                        style={{ width: '100%' }}
                      />
                    );
                  },
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  render: (amount) => `¥${amount?.toLocaleString() || 0}`,
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 80,
                  render: (_, record, index) => (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => handleRemoveProduct(index)}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <strong>
                合计: ¥{selectedProducts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString()}
              </strong>
            </div>
          </Form.Item>

          <Form.Item
            name="amount"
            label="总金额（自动计算）"
          >
            <InputNumber
              style={{ width: '100%' }}
              value={selectedProducts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)}
              disabled
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item name="status" label="状态" initialValue="draft">
            <Select>
              {statusOptions.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item 
            name="signDate" 
            label="签署日期"
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            name="startDate" 
            label="开始日期"
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item 
            name="endDate" 
            label="结束日期"
            initialValue={dayjs().add(1, 'month')}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="content" label="合同内容">
            <Input.TextArea rows={4} placeholder="请输入合同内容" />
          </Form.Item>

          <Form.Item label="合同附件">
            <Upload
              fileList={fileList}
              onChange={({ fileList: newFileList }) => {
                setFileList(newFileList);
              }}
              beforeUpload={() => false}
              multiple
            >
              <Button icon={<UploadOutlined />}>上传附件</Button>
            </Upload>
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              支持上传PDF、Word、Excel、图片等格式文件
            </div>
          </Form.Item>

          <Form.Item label="签名">
            <div style={{ marginBottom: 8 }}>
              <Space>
                <Button 
                  type="primary"
                  onClick={() => {
                    const signers = form.getFieldValue('signers') || [];
                    if (signers.length === 0) {
                      message.warning('请先选择签署人');
                      return;
                    }
                    // 如果只有一个签署人，直接使用；否则让用户选择
                    if (signers.length === 1) {
                      setCurrentSignerId(signers[0]);
                      setSignaturePadVisible(true);
                    } else {
                      // 显示选择签署人的弹窗
                      let selectedSignerId = null;
                      Modal.confirm({
                        title: '选择签署人',
                        content: (
                          <div style={{ marginTop: 16 }}>
                            <Select
                              placeholder="请选择要签名的签署人"
                              style={{ width: '100%' }}
                              onChange={(value) => {
                                selectedSignerId = value;
                              }}
                            >
                              {signers.map((signerId) => {
                                const signer = users.find(u => u.id === signerId);
                                return (
                                  <Select.Option key={signerId} value={signerId}>
                                    {signer ? `${signer.name}${signer.email ? ` (${signer.email})` : ''}` : `用户${signerId}`}
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </div>
                        ),
                        onOk: () => {
                          if (!selectedSignerId) {
                            message.warning('请选择签署人');
                            return Promise.reject();
                          }
                          setCurrentSignerId(selectedSignerId);
                          setSignaturePadVisible(true);
                        },
                        okText: '确定',
                        cancelText: '取消',
                      });
                    }
                  }}
                >
                  在线签名
                </Button>
                <Upload
                  accept="image/*"
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const signers = form.getFieldValue('signers') || [];
                      if (signers.length === 0) {
                        message.warning('请先选择签署人');
                        return;
                      }
                      // 默认使用第一个签署人
                      const userId = signers[0];
                      const newSignature = {
                        userId: userId,
                        signature: e.target.result, // base64
                        signedAt: new Date().toISOString(),
                      };
                      setSignatureList([...signatureList, newSignature]);
                    };
                    reader.readAsDataURL(file);
                    return false; // 阻止自动上传
                  }}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>上传签名图片</Button>
                </Upload>
              </Space>
            </div>
            {signatureList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {signatureList.map((sig, index) => {
                  const signer = users.find(u => u.id === sig.userId);
                  return (
                    <div key={index} style={{ position: 'relative', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
                      <Image
                        src={sig.signature}
                        alt="签名"
                        width={120}
                        height={80}
                        style={{ objectFit: 'contain' }}
                      />
                      <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center', maxWidth: 120 }}>
                        {signer ? `${signer.name}${signer.email ? `\n(${signer.email})` : ''}` : `用户${sig.userId}`}
                      </div>
                      {sig.signedAt && (
                        <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 4 }}>
                          {new Date(sig.signedAt).toLocaleString()}
                        </div>
                      )}
                      <Button
                        type="text"
                        danger
                        size="small"
                        onClick={() => {
                          setSignatureList(signatureList.filter((_, i) => i !== index));
                        }}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                      >
                        删除
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              支持在线手写签名或上传签名图片（PNG、JPG等格式）
            </div>
          </Form.Item>

          <SignaturePad
            visible={signaturePadVisible}
            title="电子签名"
            onSave={(signatureData) => {
              if (currentSignerId) {
                const newSignature = {
                  userId: currentSignerId,
                  signature: signatureData,
                  signedAt: new Date().toISOString(),
                };
                // 检查是否已存在该用户的签名
                const existingIndex = signatureList.findIndex(sig => sig.userId === currentSignerId);
                if (existingIndex >= 0) {
                  // 替换现有签名
                  const updated = [...signatureList];
                  updated[existingIndex] = newSignature;
                  setSignatureList(updated);
                } else {
                  // 添加新签名
                  setSignatureList([...signatureList, newSignature]);
                }
                message.success('签名已保存');
              }
              setSignaturePadVisible(false);
              setCurrentSignerId(null);
            }}
            onCancel={() => {
              setSignaturePadVisible(false);
              setCurrentSignerId(null);
            }}
          />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                setEditingContract(null);
                setSelectedProducts([]);
                setProductSelectValue([]);
                setFileList([]);
                setSignatureList([]);
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

        {/* 审批流程确认弹窗 */}
        <Modal
          title="提交"
          open={approvalModalVisible}
          onCancel={() => {
            setApprovalModalVisible(false);
            setPendingContractId(null);
            setApprovalWorkflowInfo(null);
          }}
          onOk={handleConfirmApproval}
          okText="确定"
          cancelText="取消"
          width={480}
          confirmLoading={submittingApproval}
          style={{ top: 100 }}
        >
          {approvalWorkflowInfo && (
            <div>
              <div style={{ 
                marginBottom: 20, 
                fontSize: 15, 
                fontWeight: 600, 
                color: '#262626',
                paddingBottom: 12,
                borderBottom: '1px solid #f0f0f0'
              }}>
                审批流程
              </div>
              <div style={{ marginBottom: 16 }}>
                {approvalWorkflowInfo.workflow.steps && approvalWorkflowInfo.workflow.steps.length > 0 ? (
                  <div>
                    {approvalWorkflowInfo.workflow.steps.map((step, index) => {
                      const approvers = step.approvers || [];
                      const approverNames = approvers.map(approverId => {
                        const approver = users.find(u => u.id === approverId);
                        return approver ? approver.name : `用户${approverId}`;
                      }).join('、') || '待指定';
                      
                      return (
                        <div key={index} style={{ marginBottom: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 0 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 16 }}>
                              <div style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: index === 0 ? '#1890ff' : '#d9d9d9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: 14,
                                fontWeight: 600,
                                flexShrink: 0
                              }}>
                                {index === 0 ? '提' : index + 1}
                              </div>
                              {index < approvalWorkflowInfo.workflow.steps.length - 1 && (
                                <div style={{
                                  width: 2,
                                  height: 24,
                                  background: '#e8e8e8',
                                  marginTop: 4,
                                  marginBottom: 4
                                }} />
                              )}
                            </div>
                            <div style={{ flex: 1, paddingTop: 4 }}>
                              <div style={{ fontSize: 14, color: '#262626', marginBottom: 6, fontWeight: 500 }}>
                                {step.name || (index === 0 ? '提交申请' : `审批节点 ${index + 1}`)}
                              </div>
                              <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                                审批人: {approverNames}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ 
                    color: '#8c8c8c', 
                    fontSize: 13,
                    textAlign: 'center',
                    padding: '20px 0'
                  }}>
                    暂无审批流程配置，将使用默认流程
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
    </div>
  );
};

export default ContractList;

