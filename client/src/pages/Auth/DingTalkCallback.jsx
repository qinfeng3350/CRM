import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, message } from 'antd';
import { dingTalkService } from '../../services/dingTalkService';

const DingTalkCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('==========================================');
      console.log('🔵 DingTalkCallback 组件加载');
      console.log('当前URL:', window.location.href);
      console.log('URL参数:', Object.fromEntries(searchParams.entries()));
      console.log('==========================================');
      
      const token = searchParams.get('token');
      const error = searchParams.get('error');
      const code = searchParams.get('code'); // 钉钉扫码登录返回的code
      const state = searchParams.get('state');

      console.log('解析的参数:', { token: token ? '存在' : 'null', error, code: code ? code.substring(0, 20) + '...' : 'null', state });

      // 如果已经有token，直接登录
      if (token) {
        console.log('✅ 检测到token，直接登录');
        localStorage.setItem('token', token);
        message.success('钉钉登录成功');
        // 使用replace避免返回按钮回到登录页
        navigate('/dashboard', { replace: true });
        return;
      }

      // 如果有错误，显示错误并跳转
      if (error) {
        console.error('❌ 检测到错误参数:', error);
        message.error(decodeURIComponent(error));
        navigate('/login');
        return;
      }

      // 如果有code（从钉钉回调来的），调用后端处理
      if (code) {
        try {
          console.log('==========================================');
          console.log('🔵 检测到钉钉回调code，开始处理登录...');
          console.log('Code:', code.substring(0, 20) + '...');
          console.log('完整URL参数:', Object.fromEntries(searchParams.entries()));
          console.log('==========================================');
          
          const response = await dingTalkService.loginWithCode(code);
          
          console.log('登录响应:', response);
          
          if (response.success && response.data?.token) {
            localStorage.setItem('token', response.data.token);
            if (response.data.user) {
              localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            message.success('钉钉登录成功');
            // 使用replace避免返回按钮回到登录页
            navigate('/dashboard', { replace: true });
          } else {
            console.error('登录失败，响应:', response);
            message.error(response.message || '登录失败');
            navigate('/login', { replace: true });
          }
        } catch (error) {
          console.error('处理钉钉登录失败:', error);
          console.error('错误详情:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
          message.error(error.response?.data?.message || error.message || '登录失败');
          navigate('/login', { replace: true });
        } finally {
          setLoading(false);
        }
        return;
      }

      // 既没有token也没有code，说明回调有问题
      console.error('❌ 未获取到授权信息');
      console.error('当前URL参数:', Object.fromEntries(searchParams.entries()));
      console.error('完整URL:', window.location.href);
      
      // 检查是否是hash路由的情况（某些情况下参数可能在hash中）
      const hash = window.location.hash;
      if (hash) {
        console.log('检测到hash:', hash);
        const hashParams = new URLSearchParams(hash.substring(1));
        const hashCode = hashParams.get('code');
        if (hashCode) {
          console.log('在hash中找到code，重新处理...');
          navigate(`/auth/dingtalk/callback?code=${hashCode}`, { replace: true });
          return;
        }
      }
      
      message.error('登录失败，未获取到授权信息。请检查：1. 是否已扫码确认 2. 回调URL是否正确配置');
      navigate('/login');
      setLoading(false);
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spin size="large" tip="正在登录..." />
    </div>
  );
};

export default DingTalkCallback;

