import { Modal, Form, Select, Input, message } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

const StatusUpdateModal = ({ 
  visible, 
  onCancel, 
  onSubmit, 
  currentStatus, 
  statusOptions = [],
  title = '更新状态',
  showReason = true 
}) => {
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
      form.resetFields();
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '操作失败');
    }
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
    >
      <Form form={form} layout="vertical" initialValues={{ status: currentStatus }}>
        <Form.Item
          name="status"
          label="状态"
          rules={[{ required: true, message: '请选择状态' }]}
        >
          <Select>
            {statusOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
        {showReason && (
          <Form.Item name="reason" label="原因">
            <TextArea rows={3} placeholder="请输入状态更新原因（可选）" />
          </Form.Item>
        )}
        {!showReason && (
          <Form.Item name="comment" label="备注">
            <TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default StatusUpdateModal;

