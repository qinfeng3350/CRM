import { Card, Typography, Tag, Divider, Space, Button, message } from 'antd';
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Title, Paragraph, Text, Code } = Typography;

const ApiDocumentation = () => {
  const [copied, setCopied] = useState({});

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [key]: true });
    message.success('已复制到剪贴板');
    setTimeout(() => {
      setCopied({ ...copied, [key]: false });
    }, 2000);
  };

  const apiBaseUrl = `${window.location.protocol}//${window.location.host}/api`;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>API 接口文档</Title>
        <Paragraph>
          <Text strong>基础URL：</Text>
          <Code>{apiBaseUrl}</Code>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(apiBaseUrl, 'baseUrl')}
          >
            复制
          </Button>
        </Paragraph>
        <Paragraph>
          <Text>数据格式：JSON | 认证方式：Bearer Token (JWT) | 字符编码：UTF-8</Text>
        </Paragraph>

        <Divider />

        <Title level={3}>认证说明</Title>
        <Paragraph>
          大部分接口需要在请求头中携带认证令牌：
          <Code block>
            {`Authorization: Bearer <your_token>`}
          </Code>
        </Paragraph>

        <Title level={3}>通用响应格式</Title>
        <Paragraph>
          <Text strong>成功响应：</Text>
          <Code block>
            {`{
  "success": true,
  "data": { ... }
}`}
          </Code>
        </Paragraph>
        <Paragraph>
          <Text strong>错误响应：</Text>
          <Code block>
            {`{
  "success": false,
  "message": "错误信息"
}`}
          </Code>
        </Paragraph>

        <Divider />

        <Title level={3}>接口列表</Title>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 认证模块 */}
          <Card size="small" title={<Title level={4}>1. 认证模块 (/api/auth)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/auth/register</Text>
                <Text type="secondary"> - 用户注册</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/auth/login</Text>
                <Text type="secondary"> - 用户登录</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/auth/profile</Text>
                <Text type="secondary"> - 获取个人信息</Text>
              </div>
              <div>
                <Tag color="orange">PUT</Tag>
                <Text strong>/api/auth/profile</Text>
                <Text type="secondary"> - 更新个人信息</Text>
              </div>
            </Space>
          </Card>

          {/* 客户管理 */}
          <Card size="small" title={<Title level={4}>2. 客户管理 (/api/customers)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/customers</Text>
                <Text type="secondary"> - 获取客户列表（支持分页和筛选）</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/customers/:id</Text>
                <Text type="secondary"> - 获取单个客户</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/customers</Text>
                <Text type="secondary"> - 创建客户</Text>
              </div>
              <div>
                <Tag color="orange">PUT</Tag>
                <Text strong>/api/customers/:id</Text>
                <Text type="secondary"> - 更新客户</Text>
              </div>
              <div>
                <Tag color="red">DELETE</Tag>
                <Text strong>/api/customers/:id</Text>
                <Text type="secondary"> - 删除客户</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/customers/:id/claim</Text>
                <Text type="secondary"> - 认领客户（公海→私海）</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/customers/:id/return</Text>
                <Text type="secondary"> - 退回公海</Text>
              </div>
            </Space>
          </Card>

          {/* 项目管理 */}
          <Card size="small" title={<Title level={4}>3. 项目管理 (/api/projects)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/projects</Text>
                <Text type="secondary"> - 获取项目列表</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/projects/dashboard/stats</Text>
                <Text type="secondary"> - 获取项目数据大屏统计</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/projects/:id</Text>
                <Text type="secondary"> - 获取单个项目</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/projects</Text>
                <Text type="secondary"> - 创建项目</Text>
              </div>
              <div>
                <Tag color="orange">PUT</Tag>
                <Text strong>/api/projects/:id</Text>
                <Text type="secondary"> - 更新项目</Text>
              </div>
              <div>
                <Tag color="red">DELETE</Tag>
                <Text strong>/api/projects/:id</Text>
                <Text type="secondary"> - 删除项目</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/projects/:id/progress</Text>
                <Text type="secondary"> - 更新项目进度</Text>
              </div>
            </Space>
          </Card>

          {/* 合同管理 */}
          <Card size="small" title={<Title level={4}>4. 合同管理 (/api/contracts)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/contracts</Text>
                <Text type="secondary"> - 获取合同列表</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/contracts/stats</Text>
                <Text type="secondary"> - 获取合同统计</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/contracts/:id</Text>
                <Text type="secondary"> - 获取单个合同</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/contracts</Text>
                <Text type="secondary"> - 创建合同</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/contracts/:id/approve</Text>
                <Text type="secondary"> - 审批合同</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/contracts/:id/sign</Text>
                <Text type="secondary"> - 签订合同</Text>
              </div>
            </Space>
          </Card>

          {/* 商机管理 */}
          <Card size="small" title={<Title level={4}>5. 商机管理 (/api/opportunities)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/opportunities</Text>
                <Text type="secondary"> - 获取商机列表</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/opportunities/funnel</Text>
                <Text type="secondary"> - 获取销售漏斗</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/opportunities</Text>
                <Text type="secondary"> - 创建商机</Text>
              </div>
              <div>
                <Tag color="blue">POST</Tag>
                <Text strong>/api/opportunities/:id/transfer</Text>
                <Text type="secondary"> - 转移商机</Text>
              </div>
            </Space>
          </Card>

          {/* 数据分析 */}
          <Card size="small" title={<Title level={4}>6. 数据分析 (/api/analytics)</Title>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/analytics/sales</Text>
                <Text type="secondary"> - 获取销售分析</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/analytics/customers</Text>
                <Text type="secondary"> - 获取客户分析</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/analytics/opportunities</Text>
                <Text type="secondary"> - 获取商机分析</Text>
              </div>
              <div>
                <Tag color="green">GET</Tag>
                <Text strong>/api/analytics/contracts</Text>
                <Text type="secondary"> - 获取合同分析</Text>
              </div>
            </Space>
          </Card>
        </Space>

        <Divider />

        <Title level={3}>状态码说明</Title>
        <Space direction="vertical" size="small">
          <div><Tag color="green">200</Tag> 请求成功</div>
          <div><Tag color="blue">201</Tag> 创建成功</div>
          <div><Tag color="orange">400</Tag> 请求参数错误</div>
          <div><Tag color="red">401</Tag> 未认证或认证失败</div>
          <div><Tag color="red">403</Tag> 权限不足</div>
          <div><Tag color="red">404</Tag> 资源不存在</div>
          <div><Tag color="red">500</Tag> 服务器内部错误</div>
        </Space>

        <Divider />

        <Title level={3}>用户角色说明</Title>
        <Space direction="vertical" size="small">
          <div><Tag color="red">admin</Tag> 管理员，拥有所有权限</div>
          <div><Tag color="orange">sales_manager</Tag> 销售经理，可以管理销售团队和数据</div>
          <div><Tag color="blue">sales</Tag> 销售人员，只能访问自己的数据</div>
          <div><Tag color="cyan">service</Tag> 服务人员，处理客户服务工单</div>
          <div><Tag color="purple">marketing</Tag> 市场人员，管理线索和市场活动</div>
        </Space>

        <Divider />

        <Title level={3}>注意事项</Title>
        <Space direction="vertical" size="small">
          <Text>1. 所有日期时间字段使用 ISO 8601 格式 (例如: 2024-01-01T00:00:00.000Z)</Text>
          <Text>2. 金额字段使用数字类型，单位为元</Text>
          <Text>3. 分页参数 page 从 1 开始</Text>
          <Text>4. 删除操作需要谨慎，某些数据可能有关联关系</Text>
          <Text>5. 详细API文档请参考 API_DOCUMENTATION.md 文件</Text>
        </Space>

        <Divider />

        <Title level={3}>技术支持</Title>
        <Card size="small">
          <Space direction="vertical" size="small">
            <Text><Text strong>技术支持：</Text>墨枫</Text>
            <Text><Text strong>QQ：</Text>1731813927</Text>
            <Text type="secondary">如有技术问题或API使用疑问，请联系技术支持。</Text>
          </Space>
        </Card>
      </Card>
    </div>
  );
};

export default ApiDocumentation;

