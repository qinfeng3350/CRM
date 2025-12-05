import { Drawer, Form, Button, Space, Input, Select, DatePicker } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * 通用筛选抽屉组件
 * @param {Object} props
 * @param {Boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Array} props.filters - 筛选字段配置
 * @param {Function} props.onSubmit - 提交回调
 * @param {Object} props.initialValues - 初始值
 */
const FilterDrawer = ({
  open,
  onClose,
  filters = [],
  onSubmit,
  initialValues = {},
}) => {
  const [form] = Form.useForm();

  const handleSubmit = (values) => {
    // 处理日期范围
    const processedValues = { ...values };
    filters.forEach((filter) => {
      if (filter.type === 'dateRange' && values[filter.name]) {
        processedValues[filter.name] = [
          values[filter.name][0]?.format('YYYY-MM-DD'),
          values[filter.name][1]?.format('YYYY-MM-DD'),
        ];
      }
    });
    if (onSubmit) {
      onSubmit(processedValues);
    }
    onClose();
  };

  const handleReset = () => {
    form.resetFields();
    const emptyValues = {};
    filters.forEach((filter) => {
      emptyValues[filter.name] = undefined;
    });
    if (onSubmit) {
      onSubmit(emptyValues);
    }
  };

  return (
    <Drawer
      title="筛选条件"
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
      extra={
        <Space>
          <Button onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button type="primary" onClick={() => form.submit()} icon={<SearchOutlined />}>
            查询
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={initialValues}
      >
        {filters.map((filter) => {
          switch (filter.type) {
            case 'input':
              return (
                <Form.Item key={filter.name} name={filter.name} label={filter.label}>
                  <Input placeholder={filter.placeholder || `请输入${filter.label}`} />
                </Form.Item>
              );
            case 'select':
              return (
                <Form.Item key={filter.name} name={filter.name} label={filter.label}>
                  <Select placeholder={filter.placeholder || `请选择${filter.label}`} allowClear>
                    {filter.options?.map((option) => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              );
            case 'dateRange':
              return (
                <Form.Item key={filter.name} name={filter.name} label={filter.label}>
                  <RangePicker style={{ width: '100%' }} />
                </Form.Item>
              );
            default:
              return null;
          }
        })}
      </Form>
    </Drawer>
  );
};

export default FilterDrawer;

