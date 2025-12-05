import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  message,
  Space,
  Divider,
  Alert,
  Spin,
  Table,
  Tag,
  Modal,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { dingTalkService } from '../../services/dingTalkService';

const DingTalkIntegration = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null);
  const [cleanModalVisible, setCleanModalVisible] = useState(false);
  const [secretStatus, setSecretStatus] = useState({
    hasAppKey: false,
    hasAppSecret: false,
    hasQrLoginAppKey: false,
    hasQrLoginAppSecret: false,
  });
  const cardInstanceEnabled = Form.useWatch('cardInstanceEnabled', form);

  useEffect(() => {
    loadConfig();
    loadUsers();
    loadStreamStatus();
    
    // 定时刷新Stream状态
    const interval = setInterval(loadStreamStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await dingTalkService.getConfig();
      if (response.success) {
        setConfig(response.data);
        if (response.data) {
          form.setFieldsValue({
            appKey: response.data.appKey === '***' ? '' : response.data.appKey,
            appSecret: response.data.appSecret === '***' ? '' : response.data.appSecret,
            qrLoginAppKey: response.data.qrLoginAppKey === '***' ? '' : response.data.qrLoginAppKey,
            qrLoginAppSecret: response.data.qrLoginAppSecret === '***' ? '' : response.data.qrLoginAppSecret,
            agentId: response.data.agentId,
            corpId: response.data.corpId,
            enabled: response.data.enabled,
            todoSyncEnabled: response.data.todoSyncEnabled !== undefined ? response.data.todoSyncEnabled : true,
            dingtalkApprovalEnabled: response.data.dingtalkApprovalEnabled !== undefined ? response.data.dingtalkApprovalEnabled : false,
            approvalProcessCode: response.data.approvalProcessCode || '',
            callbackUrl: response.data.callbackUrl || `${window.location.origin}/auth/dingtalk/callback`,
            cardInstanceEnabled: response.data.cardInstanceEnabled !== undefined ? response.data.cardInstanceEnabled : false,
            cardTemplateId: response.data.cardTemplateId || '',
            cardRouteKey: response.data.cardRouteKey || '',
          });

          setSecretStatus({
            hasAppKey: !!response.data.appKey,
            hasAppSecret: !!response.data.appSecret,
            hasQrLoginAppKey: !!response.data.qrLoginAppKey,
            hasQrLoginAppSecret: !!response.data.qrLoginAppSecret,
          });
        }
      }
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await dingTalkService.getDingTalkUsers();
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('加载用户关联失败:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCleanDuplicates = () => {
    console.log('[handleCleanDuplicates] 函数被调用');
    setCleanModalVisible(true);
  };

  const handleConfirmClean = async () => {
    console.log('[Modal] 用户确认清理');
    setCleanModalVisible(false);
    setUsersLoading(true);
    
    // 显示加载提示
    const hideLoading = message.loading('正在清理重复数据...', 0);
    
    try {
      console.log('[handleConfirmClean] 开始调用API...');
      console.log('[handleConfirmClean] API URL: /dingtalk/users/clean-duplicates');
      
      const response = await dingTalkService.cleanDuplicateUsers();
      
      console.log('[handleConfirmClean] API响应:', response);
      console.log('[handleConfirmClean] 响应类型:', typeof response);
      console.log('[handleConfirmClean] response.success:', response?.success);
      
      hideLoading();
      
      if (response && response.success) {
        const successMsg = response.message || `已清理 ${response.data?.removed || 0} 条重复记录`;
        message.success(successMsg, 3);
        // 重新加载列表
        await loadUsers();
      } else {
        message.error(response?.message || '清理失败，请查看控制台日志', 5);
      }
    } catch (error) {
      hideLoading();
      console.error('[handleConfirmClean] API调用错误:', error);
      console.error('[handleConfirmClean] 错误详情:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: error.config,
      });
      
      let errorMessage = '清理失败';
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = '未授权，请重新登录';
        } else if (error.response.status === 403) {
          errorMessage = '权限不足，需要管理员权限';
        } else if (error.response.status === 500) {
          errorMessage = error.response.data?.message || '服务器错误，请查看后端日志';
        } else {
          errorMessage = error.response.data?.message || error.message || '清理失败';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage, 5);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadStreamStatus = async () => {
    try {
      const response = await dingTalkService.getStreamStatus();
      if (response.success) {
        setStreamStatus(response.data);
      } else {
        // 如果API返回失败，设置默认状态
        setStreamStatus({ connected: false });
      }
    } catch (error) {
      console.error('加载Stream状态失败:', error);
      // 即使API失败，也设置默认状态，避免显示为空
      setStreamStatus({ connected: false });
    }
  };

  const handleRestartStream = async () => {
    try {
      const response = await dingTalkService.restartStream();
      if (response.success) {
        message.success('Stream连接已重启');
        loadStreamStatus();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '重启失败');
    }
  };

  const buildConfigPayload = (values) => {
    const payload = { ...values };
    const secretFields = ['appKey', 'appSecret', 'qrLoginAppKey', 'qrLoginAppSecret'];
    const isEmpty = (value) =>
      value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

    secretFields.forEach((field) => {
      if (isEmpty(payload[field])) {
        delete payload[field];
      } else if (typeof payload[field] === 'string') {
        payload[field] = payload[field].trim();
      }
    });

    const trimFields = ['agentId', 'corpId', 'callbackUrl', 'cardTemplateId', 'cardRouteKey', 'frontendUrl', 'serverUrl'];
    trimFields.forEach((field) => {
      if (typeof payload[field] === 'string') {
        payload[field] = payload[field].trim();
        if (payload[field] === '') {
          delete payload[field];
        }
      }
    });

    return payload;
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const payload = buildConfigPayload(values);
      const response = await dingTalkService.updateConfig(payload);
      if (response.success) {
        message.success('配置已保存');
        await loadConfig();
        // 如果启用了配置，重新加载Stream状态
        if (values.enabled) {
          loadStreamStatus();
        }
      }
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      const response = await dingTalkService.testConfig();
      if (response.success) {
        message.success('配置测试成功');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '配置测试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncContacts = async () => {
    // 检查配置是否启用
    if (!config || !config.enabled) {
      message.warning('请先启用钉钉集成配置');
      return;
    }

    // 直接执行同步，不显示确认对话框（因为用户已经确认要同步）
    setSyncing(true);
    try {
      console.log('开始同步通讯录...');
      message.loading({ content: '正在同步通讯录，请稍候...', key: 'syncing', duration: 0 });
      
      const response = await dingTalkService.syncContacts();
      console.log('同步响应:', response);
      
      message.destroy('syncing');
      
      if (response.success) {
        const data = response.data || {};
        const msg = response.message || `同步完成：共${data.total || 0}人，新增${data.created || 0}人，更新${data.updated || 0}人`;
        message.success(msg);
        
        // 如果有错误，显示警告
        if (data.errors && data.errors.length > 0) {
          message.warning(`部分用户同步失败：${data.errors.length}个`);
          console.warn('同步错误:', data.errors);
        }
        
        // 刷新用户列表
        await loadUsers();
      } else {
        message.error(response.message || '同步失败');
      }
    } catch (error) {
      console.error('同步通讯录错误:', error);
      message.destroy('syncing');
      
      const errorMsg = error.response?.data?.message || error.message || '同步失败';
      message.error(errorMsg);
      
      // 显示详细错误信息
      if (error.response?.data) {
        console.error('错误详情:', error.response.data);
      }
      
      // 如果是权限错误，给出提示
      if (error.response?.status === 401) {
        message.error('登录已过期，请重新登录');
      } else if (error.response?.status === 403) {
        message.error('权限不足，需要管理员权限');
      }
    } finally {
      setSyncing(false);
    }
  };

  const userColumns = [
    {
      title: '钉钉用户ID',
      dataIndex: 'dingTalkUserId',
      key: 'dingTalkUserId',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '手机号',
      dataIndex: 'mobile',
      key: 'mobile',
    },
    {
      title: '系统用户ID',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId) => userId ? <Tag color="green">{userId}</Tag> : <Tag color="red">未关联</Tag>,
    },
    {
      title: '关联时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="钉钉集成配置" loading={loading}>
        <Alert
          message="钉钉集成说明"
          description={
            <div>
              <p><strong>企业内部应用配置（用于免登和通讯录同步）：</strong></p>
              <p>1. 在钉钉开放平台创建&quot;企业内部应用&quot;，获取 AppKey 和 AppSecret</p>
              <p>2. 配置回调地址：{window.location.origin}/api/dingtalk/callback</p>
              <p>3. 启用配置后，用户在钉钉客户端内可以使用免登登录</p>
              <p>4. 同步通讯录可以将钉钉用户导入系统</p>
              <p style={{ marginTop: 12 }}><strong>扫码登录应用配置（用于网页扫码登录）：</strong></p>
              <p>1. 在钉钉开放平台创建&quot;扫码登录应用&quot;，获取 AppKey 和 AppSecret</p>
              <p>2. 配置回调地址：{window.location.origin}/auth/dingtalk/callback</p>
              <p>3. 配置后，用户在普通浏览器中可以使用扫码登录</p>
              <p style={{ marginTop: 8, color: '#ff4d4f' }}>
                ⚠️ 注意：企业内部应用的AppKey不能用于扫码登录，必须单独创建&quot;扫码登录应用&quot;
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            enabled: false,
            callbackUrl: `${window.location.origin}/auth/dingtalk/callback`,
            cardInstanceEnabled: false,
          }}
        >
          <Form.Item
            name="appKey"
            label="AppKey"
            rules={[{ required: false, message: '请输入AppKey' }]}
            extra={secretStatus.hasAppKey ? '已配置，若无需修改请留空' : undefined}
          >
            <Input placeholder="钉钉应用AppKey" allowClear />
          </Form.Item>

          <Form.Item
            name="appSecret"
            label="AppSecret"
            rules={[{ required: false, message: '请输入AppSecret' }]}
            extra={secretStatus.hasAppSecret ? '已配置，若无需修改请留空' : undefined}
          >
            <Input.Password placeholder="钉钉应用AppSecret" />
          </Form.Item>

          <Divider orientation="left">扫码登录应用配置（可选）</Divider>
          <Alert
            message="扫码登录应用配置说明"
            description="如果需要在普通浏览器中使用扫码登录，请单独创建&quot;扫码登录应用&quot;并配置以下信息。如果不配置，扫码登录功能将不可用。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="qrLoginAppKey"
            label="扫码登录应用AppKey"
            tooltip="在钉钉开放平台创建&quot;扫码登录应用&quot;后获取的AppKey"
            extra={secretStatus.hasQrLoginAppKey ? '已配置，若无需修改请留空' : undefined}
          >
            <Input placeholder="扫码登录应用的AppKey（可选）" />
          </Form.Item>
          <Form.Item
            name="qrLoginAppSecret"
            label="扫码登录应用AppSecret"
            tooltip="在钉钉开放平台创建&quot;扫码登录应用&quot;后获取的AppSecret"
            extra={secretStatus.hasQrLoginAppSecret ? '已配置，若无需修改请留空' : undefined}
          >
            <Input.Password placeholder="扫码登录应用的AppSecret（可选）" />
          </Form.Item>

          <Divider orientation="left">其他配置</Divider>
          <Form.Item name="agentId" label="AgentId">
            <Input placeholder="应用AgentId（可选）" />
          </Form.Item>

          <Form.Item name="corpId" label="CorpId">
            <Input placeholder="企业CorpId（可选）" />
          </Form.Item>

          <Form.Item name="callbackUrl" label="回调地址">
            <Input placeholder="OAuth回调地址" />
          </Form.Item>

          <Form.Item name="enabled" valuePropName="checked" label="启用钉钉集成">
            <Switch />
          </Form.Item>

          <Form.Item 
            name="todoSyncEnabled" 
            valuePropName="checked" 
            label="启用待办同步到钉钉"
            tooltip="关闭后，审批流程将不再自动同步待办任务到钉钉。建议在启用钉钉审批后关闭此功能。"
          >
            <Switch />
          </Form.Item>

          <Form.Item 
            name="dingtalkApprovalEnabled" 
            valuePropName="checked" 
            label="启用钉钉审批（三方流程对接钉钉OA）"
            tooltip={
              <div>
                <p>启用后，审批流程将使用钉钉OA审批系统</p>
                <p style={{ marginTop: 8 }}><strong>重要：</strong></p>
                <p>• 系统会自动读取您在"流程设计器"中配置的审批流程和字段</p>
                <p>• 您只需在钉钉中创建一个通用模板，系统会自动处理所有模块类型</p>
                <p>• 需要开通 process_instance_write、process_instance_read、process_instance_callback 权限</p>
                <p>• 启用后建议关闭待办同步功能</p>
              </div>
            }
            extra={
              <div style={{ marginTop: 4, fontSize: 12, color: '#1890ff' }}>
                💡 系统已优化：直接使用您在本系统中的流程定义和字段，无需在钉钉中重复配置
              </div>
            }
          >
            <Switch />
          </Form.Item>

          <Form.Item 
            name="approvalProcessCode" 
            label="审批模板编码（processCode）"
            tooltip={
              <div>
                <p>在钉钉开放平台创建审批模板后获取的模板编码</p>
                <p style={{ marginTop: 8, color: '#1890ff' }}>
                  <strong>提示：</strong>系统已优化为使用通用模板，只需创建一个包含所有字段的模板即可处理所有模块类型（合同、商机、报价单等）
                </p>
                <p style={{ marginTop: 8 }}>
                  <a 
                    href="https://open.dingtalk.com/document/development/use-the-three-party-process-to-interface-with-the-dingtalk-oa" 
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    查看钉钉官方文档 →
                  </a>
                </p>
              </div>
            }
            extra={
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                <p>• 系统会自动读取您在本系统中的流程定义和字段</p>
                <p>• 运行 <code>node scripts/generate-dingtalk-template-config.js</code> 可生成模板配置说明</p>
                <p>• 字段名称必须与系统代码中的字段名完全一致</p>
                <Button
                  type="link"
                  size="small"
                  onClick={async () => {
                    try {
                      const hide = message.loading('正在读取系统流程定义和字段配置...', 0);
                      const response = await dingTalkService.generateTemplateConfig();
                      hide();
                      
                      if (response.success) {
                        const { workflows, summary } = response.data;
                        
                        // 显示详细的配置信息
                        Modal.info({
                          title: '📋 钉钉模板配置说明（系统自动生成）',
                          width: 900,
                          content: (
                            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                              <Alert
                                message="系统已自动读取您的流程定义和字段配置"
                                description={
                                  <div>
                                    <p>✅ 共找到 <strong>{summary.totalWorkflows}</strong> 个启用的流程定义</p>
                                    <p>💡 系统会自动使用这些流程定义，您只需在钉钉中创建一个通用模板即可</p>
                                  </div>
                                }
                                type="success"
                                showIcon
                                style={{ marginBottom: 16 }}
                              />
                              
                              {workflows.length > 0 && (
                                <>
                                  <Divider orientation="left">您的流程定义</Divider>
                                  {workflows.map((wf, idx) => (
                                    <div key={wf.workflowId} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                                      <h4 style={{ marginBottom: 8 }}>
                                        {idx + 1}. {wf.workflowName} ({wf.moduleType})
                                      </h4>
                                      {wf.description && <p style={{ color: '#666', marginBottom: 8 }}>{wf.description}</p>}
                                      
                                      <div style={{ marginTop: 8 }}>
                                        <strong>审批节点：</strong>
                                        {wf.processDesign.steps.length > 0 ? (
                                          <ul style={{ marginTop: 4 }}>
                                            {wf.processDesign.steps.map((step, sIdx) => (
                                              <li key={sIdx}>
                                                节点 {step.step}：{step.name} ({step.approvalMode})
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <span style={{ color: '#999' }}>暂无审批节点</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              <Divider orientation="left">通用模板字段配置</Divider>
                              <div>
                                <p><strong>✅ 必填字段（必须在钉钉模板中添加）：</strong></p>
                                <ul>
                                  {summary.commonFields.required.map(field => (
                                    <li key={field}><code>{field}</code> - 多行文本</li>
                                  ))}
                                </ul>
                                
                                <p style={{ marginTop: 12 }}><strong>📝 可选字段（建议添加，系统会自动填充）：</strong></p>
                                <ul>
                                  {summary.commonFields.optional.map(field => (
                                    <li key={field}><code>{field}</code></li>
                                  ))}
                                </ul>
                                
                                <Alert
                                  message={summary.commonFields.note}
                                  type="info"
                                  showIcon
                                  style={{ marginTop: 12 }}
                                />
                              </div>
                              
                              <Divider orientation="left">配置步骤</Divider>
                              <ol style={{ paddingLeft: 20 }}>
                                {summary.instructions.map((step, index) => (
                                  <li key={index} style={{ marginBottom: 8 }}>{step}</li>
                                ))}
                              </ol>
                              
                              <Divider />
                              <Alert
                                message="重要提示"
                                description={
                                  <div>
                                    <p>1. 字段名称必须与系统代码中的字段名<strong>完全一致</strong>（区分大小写）</p>
                                    <p>2. 系统会根据模块类型自动填充对应的字段值</p>
                                    <p>3. 审批流程会使用您在"流程设计器"中配置的审批节点和审批人</p>
                                    <p>4. 只需创建一个通用模板，即可处理所有模块类型（合同、商机、报价单等）</p>
                                  </div>
                                }
                                type="warning"
                                showIcon
                              />
                            </div>
                          ),
                          okText: '我知道了'
                        });
                      }
                    } catch (error) {
                      message.error('生成配置失败：' + error.message);
                    }
                  }}
                >
                  查看系统流程配置 →
                </Button>
              </div>
            }
            rules={[
              {
                validator: (_, value) => {
                  const formValues = form.getFieldsValue();
                  if (formValues.dingtalkApprovalEnabled && !value) {
                    return Promise.reject(new Error('启用钉钉审批后，必须配置审批模板编码'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input 
              placeholder="请输入审批模板编码（如：PROC-80ADFE6C-0329-4E7E-B11E-0BE8024D1ADF）" 
              disabled={!form.getFieldValue('dingtalkApprovalEnabled')}
            />
          </Form.Item>

          <Divider orientation="left">工作通知与互动卡片</Divider>
          <Alert
            message="工作通知推送说明"
            description="启用后，系统会同时发送传统工作通知（ActionCard）和新版互动卡片。互动卡片需要您在钉钉卡片中心创建模板并获取模板ID。"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="cardInstanceEnabled"
            valuePropName="checked"
            label="启用互动卡片推送"
            tooltip="启用后，审批待办会通过钉钉互动卡片推送到'工作通知·墨枫科技'中。"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="cardTemplateId"
            label="卡片模板ID"
            tooltip="在钉钉卡片中心创建模板后获得的 cardTemplateId。"
            rules={[
              {
                validator: (_, value) => {
                  if (cardInstanceEnabled && !value) {
                    return Promise.reject(new Error('启用互动卡片后必须配置模板ID'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="请输入卡片模板ID" disabled={!cardInstanceEnabled} />
          </Form.Item>
          <Form.Item
            name="cardRouteKey"
            label="卡片回调RouteKey"
            tooltip="在钉钉卡片中心配置的回调RouteKey，用于接收互动卡片按钮点击事件。"
          >
            <Input placeholder="请输入回调RouteKey（可选）" disabled={!cardInstanceEnabled} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存配置
              </Button>
              <Button onClick={handleTest} loading={loading}>
                测试配置
              </Button>
              <Button
                type="default"
                icon={<SyncOutlined />}
                onClick={() => {
                  console.log('点击同步通讯录按钮');
                  console.log('当前配置:', config);
                  handleSyncContacts();
                }}
                loading={syncing}
                disabled={!config || !config.enabled}
                title={!config || !config.enabled ? '请先启用钉钉集成配置' : '同步钉钉通讯录到系统'}
              >
                同步通讯录
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* Stream连接状态 */}
        {config?.enabled && (
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Stream连接状态</div>
                <div>
                  {streamStatus?.connected ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      已连接
                    </Tag>
                  ) : streamStatus === null ? (
                    <Tag color="default" icon={<SyncOutlined spin />}>
                      检查中...
                    </Tag>
                  ) : (
                    <Tag color="red" icon={<CloseCircleOutlined />}>
                      未连接
                    </Tag>
                  )}
                </div>
                {streamStatus && !streamStatus.connected && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    提示：Stream服务需要服务器运行才能连接。请确保服务器已启动。
                  </div>
                )}
              </div>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRestartStream}
              >
                重启连接
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="钉钉用户关联"
        style={{ marginTop: 24 }}
        extra={
          <Space>
            <Button 
              danger
              icon={<LinkOutlined />} 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Button] 清理重复数据按钮被点击');
                handleCleanDuplicates();
              }}
              loading={usersLoading}
            >
              清理重复数据
            </Button>
            <Button icon={<SyncOutlined />} onClick={loadUsers}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={userColumns}
          dataSource={users}
          rowKey="id"
          loading={usersLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 清理重复数据确认对话框 */}
      <Modal
        title="确认清理重复数据"
        open={cleanModalVisible}
        onOk={handleConfirmClean}
        onCancel={() => {
          console.log('[Modal] 用户取消清理');
          setCleanModalVisible(false);
        }}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={520}
        maskClosable={false}
        zIndex={2000}
      >
        <p>此操作将删除重复的钉钉用户关联记录，仅保留最新的记录。</p>
        <p style={{ color: '#ff4d4f', marginTop: 8 }}>是否继续？</p>
      </Modal>
    </div>
  );
};

export default DingTalkIntegration;