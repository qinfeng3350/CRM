import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Select, Row, Col, Space, AutoComplete, Spin } from 'antd';
import { customerService } from '../../services/customerService';

const { Option } = Select;
const { TextArea } = Input;

const CustomerForm = ({ form, onSubmit, onCancel, initialValues }) => {
  const [companyOptions, setCompanyOptions] = useState([]);
  const [companySearching, setCompanySearching] = useState(false);
  const [companySearchValue, setCompanySearchValue] = useState('');
  const searchTimerRef = useRef(null);

  // 搜索公司名称（直接调用后端API）
  const searchCompanies = async (keyword) => {
    if (!keyword || keyword.trim().length === 0) {
      setCompanyOptions([]);
      setCompanySearching(false);
      return;
    }

    const keywordTrimmed = keyword.trim();
    
    try {
      setCompanySearching(true);
      
      // 先尝试从本地缓存获取
      const cachedCompanies = localStorage.getItem('company_cache');
      let cachedOptions = [];
      if (cachedCompanies) {
        try {
          const cache = JSON.parse(cachedCompanies);
          const matched = cache.filter(c => c.includes(keywordTrimmed));
          cachedOptions = matched.slice(0, 5).map(company => ({
            value: company,
            label: company
          }));
        } catch (e) {
          // 忽略缓存错误
        }
      }

      // 调用后端API搜索
      try {
        const response = await customerService.searchCompanies(keywordTrimmed);
        console.log('企业查询API响应:', response);
        console.log('响应数据详情:', {
          success: response?.success,
          dataType: Array.isArray(response?.data) ? 'array' : typeof response?.data,
          dataLength: Array.isArray(response?.data) ? response.data.length : 'N/A',
          firstItem: Array.isArray(response?.data) && response.data.length > 0 ? response.data[0] : null
        });
        
        let apiOptions = [];
        if (response && response.success && response.data && Array.isArray(response.data)) {
          console.log('开始处理API数据，共', response.data.length, '条');
          apiOptions = response.data.map((company, index) => {
            const companyName = company.name || company.companyName || company.enterpriseName || company.entName || String(company);
            console.log(`处理第${index + 1}条:`, { company, companyName });
            return {
              value: companyName,
              label: companyName,
              extra: company.address ? `地址: ${company.address}` : undefined
            };
          }).filter(item => {
            const hasValue = item.value && item.value.trim().length > 0;
            if (!hasValue) {
              console.log('过滤掉无效项:', item);
            }
            return hasValue;
          });
          console.log('处理后的选项数量:', apiOptions.length);
        } else {
          console.log('API响应格式不正确:', {
            hasResponse: !!response,
            hasSuccess: !!response?.success,
            hasData: !!response?.data,
            isArray: Array.isArray(response?.data)
          });
        }

        // 合并缓存和API结果，去重
        const allOptions = [...cachedOptions];
        apiOptions.forEach(opt => {
          if (!allOptions.find(o => o.value === opt.value)) {
            allOptions.push(opt);
          }
        });

        setCompanyOptions(allOptions.slice(0, 20));
        
        // 保存到缓存
        if (apiOptions.length > 0) {
          const cache = cachedCompanies ? JSON.parse(cachedCompanies) : [];
          apiOptions.forEach(opt => {
            if (!cache.includes(opt.value)) {
              cache.push(opt.value);
            }
          });
          if (cache.length > 100) {
            cache.splice(0, cache.length - 100);
          }
          localStorage.setItem('company_cache', JSON.stringify(cache));
        }
      } catch (apiError) {
        console.error('企业查询API调用失败:', apiError);
        // API失败时，至少显示缓存的结果
        setCompanyOptions(cachedOptions);
      }
    } catch (error) {
      console.error('搜索公司名称失败:', error);
      setCompanyOptions([]);
    } finally {
      setCompanySearching(false);
    }
  };

  // 防抖搜索
  const handleCompanySearch = (value) => {
    setCompanySearchValue(value);
    
    // 清除之前的定时器
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    if (!value || value.trim().length === 0) {
      setCompanyOptions([]);
      setCompanySearching(false);
      return;
    }
    
    // 如果输入长度>=2，立即搜索；否则延迟200ms
    if (value.trim().length >= 2) {
      searchCompanies(value.trim());
    } else {
      searchTimerRef.current = setTimeout(() => {
        if (value.trim().length >= 1) {
          searchCompanies(value.trim());
        }
      }, 200);
    }
  };

  const handleCompanySelect = (value) => {
    form.setFieldsValue({ company: value });
    setCompanySearchValue(value);
    
    // 保存到缓存
    try {
      const cachedCompanies = localStorage.getItem('company_cache');
      let cache = cachedCompanies ? JSON.parse(cachedCompanies) : [];
      if (!cache.includes(value)) {
        cache.push(value);
        if (cache.length > 100) {
          cache.splice(0, cache.length - 100);
        }
        localStorage.setItem('company_cache', JSON.stringify(cache));
      }
    } catch (e) {
      // 忽略缓存错误
    }
  };

  // 初始化时，如果有初始值，设置搜索值
  useEffect(() => {
    if (initialValues?.company) {
      setCompanySearchValue(initialValues.company);
    }
    
    // 清理定时器
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [initialValues]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={initialValues}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="company" label="公司">
            <AutoComplete
              value={companySearchValue}
              options={companyOptions}
              onSearch={handleCompanySearch}
              onSelect={handleCompanySelect}
              onChange={(value) => {
                setCompanySearchValue(value);
                form.setFieldsValue({ company: value });
              }}
              placeholder="输入公司名称关键词自动搜索（输入2个字符以上立即搜索）"
              notFoundContent={
                companySearching 
                  ? <Spin size="small" /> 
                  : (companySearchValue && companyOptions.length === 0 
                      ? '未找到匹配的企业，请手动输入' 
                      : null)
              }
              filterOption={false}
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入电话" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="address" label="地址">
        <Input placeholder="请输入地址" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="poolType" label="客户池类型" initialValue="public">
            <Select>
              <Option value="public">公海</Option>
              <Option value="private">私海</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="category" label="客户分类" initialValue="potential">
            <Select>
              <Option value="potential">潜在</Option>
              <Option value="intention">意向</Option>
              <Option value="customer">客户</Option>
              <Option value="lost">流失</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="industry" label="行业">
            <Input placeholder="请输入行业" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="scale" label="规模" initialValue="small">
            <Select>
              <Option value="small">小型</Option>
              <Option value="medium">中型</Option>
              <Option value="large">大型</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="source" label="来源">
        <Input placeholder="请输入客户来源" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <TextArea rows={4} placeholder="请输入客户描述" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default CustomerForm;
