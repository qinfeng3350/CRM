import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spin, message, Typography, Button } from 'antd';
import { QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
import { dingTalkService } from '../../services/dingTalkService';
import './DingTalkQRLogin.css';

const { Title, Text } = Typography;

/**
 * 钉钉扫码登录页面
 * 使用钉钉官方SDK生成二维码
 */
const DingTalkQRLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [inDingTalkClient, setInDingTalkClient] = useState(false);

  // 检测是否在钉钉客户端内
  // 注意：只要User-Agent包含DingTalk就认为在钉钉客户端内
  // JSAPI可能还没加载，但应该在免登登录页面等待JSAPI加载
  const isInDingTalkClient = () => {
    const userAgent = window.navigator.userAgent;
    // 检查User-Agent中是否明确包含DingTalk（钉钉客户端内）
    const hasDingTalkUserAgent = /DingTalk/i.test(userAgent);
    // 检查window.dd是否存在且可用（钉钉JSAPI已加载）
    const hasDingTalkJSAPI = typeof window.dd !== 'undefined' && window.dd && typeof window.dd.ready === 'function';
    
    console.log('钉钉环境检测:', {
      userAgent,
      hasDingTalkUserAgent,
      hasDingTalkJSAPI,
      windowDd: typeof window.dd
    });
    
    // 只要User-Agent包含DingTalk就认为在钉钉客户端内
    // JSAPI可能还没加载，但应该在免登登录页面等待JSAPI加载
    return hasDingTalkUserAgent;
  };

  // 检测是否在钉钉客户端内
  // 注意：即使在钉钉客户端内，用户也可能想使用扫码登录（比如想用其他账号登录）
  // 所以不要自动跳转，让用户自己选择
  useEffect(() => {
    console.log('检测钉钉环境...');
    console.log('User-Agent:', window.navigator.userAgent);
    console.log('window.dd:', typeof window.dd);
    
    // 检测是否在钉钉客户端内（用于显示提示信息，但不自动跳转）
    const userAgent = window.navigator.userAgent;
    const hasDingTalkUserAgent = /DingTalk/i.test(userAgent);
    const hasDd = typeof window.dd !== 'undefined' && window.dd && typeof window.dd.ready === 'function';
    
    if (hasDingTalkUserAgent || hasDd) {
      console.log('✅ 检测到在钉钉客户端内，但允许使用扫码登录');
      setInDingTalkClient(true);
      // 不自动跳转，让用户自己选择使用免登还是扫码登录
      // 如果用户想使用免登，可以在登录页面自动处理
    } else {
      console.log('✅ 不在钉钉客户端内，使用扫码登录（网页端扫码后，授权确认在手机端完成）');
      setInDingTalkClient(false);
    }
    
    // 继续加载扫码登录配置和生成二维码（不因为检测到钉钉环境而中断）
  }, [navigate]);

  // 初始化钉钉扫码登录
  const initDingLogin = async (retryCount = 0) => {
    const maxRetries = 2;
    try {
      console.log(`开始初始化钉钉扫码登录... (尝试 ${retryCount + 1}/${maxRetries + 1})`);
      
      // 获取配置（使用公开接口，不需要认证）
      console.log('正在获取钉钉扫码登录配置...');
      const configResponse = await dingTalkService.getQRLoginConfig();
      console.log('配置响应:', configResponse);
      
      if (!configResponse || !configResponse.success || !configResponse.data) {
        const errorMsg = configResponse?.message || '无法获取钉钉配置';
        console.error('获取配置失败:', errorMsg);
        
        // 如果是超时错误且还有重试次数，自动重试
        if (retryCount < maxRetries && (errorMsg.includes('timeout') || errorMsg.includes('超时'))) {
          console.log(`配置获取超时，${2}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return initDingLogin(retryCount + 1);
        }
        
        throw new Error(errorMsg);
      }
      
      const dingConfig = configResponse.data;
      console.log('获取到配置:', dingConfig);
      
      if (!dingConfig.enabled) {
        throw new Error('钉钉配置未启用，请联系管理员');
      }

      // 接口已经返回了clientId（优先使用扫码登录应用的AppKey，否则使用企业内部应用的AppKey）
      const clientId = dingConfig.clientId;
      if (!clientId) {
        throw new Error('钉钉AppKey未配置，请在系统管理 -> 钉钉集成中配置');
      }

      console.log('使用AppKey:', clientId.substring(0, 10) + '...');
      // 保存配置到state，包括frontendUrl（如果存在）
      const configToSet = { 
        ...dingConfig, 
        clientId,
        frontendUrl: dingConfig.frontendUrl || null
      };
      setConfig(configToSet);
      console.log('✅ 配置已保存到state:', configToSet);

      // 等待DTFrameLogin加载和DOM元素准备好
      console.log('检查DTFrameLogin SDK是否已加载...');
      
      // 检查容器元素是否存在
      const checkContainer = () => {
        const container = document.getElementById('dingtalk_qr_container');
        return !!container;
      };
      
      const tryRender = () => {
        if (!checkContainer()) {
          console.error('❌ 容器元素仍未准备好');
          setError('二维码容器未准备好，请刷新页面重试');
          setLoading(false);
          return;
        }
        
        if (window.DTFrameLogin) {
          console.log('✅ DTFrameLogin已加载，容器元素已准备好，开始渲染二维码');
          // 直接传递配置对象，避免依赖state更新
          renderQRCode(clientId, dingConfig.corpId, configToSet);
        } else {
          console.log('⏳ DTFrameLogin未加载，等待加载...');
          // 如果SDK未加载，等待加载
          let retryCount = 0;
          const checkInterval = setInterval(() => {
            if (window.DTFrameLogin && checkContainer()) {
              console.log('✅ DTFrameLogin已加载，容器元素已准备好，开始渲染二维码');
              clearInterval(checkInterval);
              // 直接传递配置对象，避免依赖state更新
              renderQRCode(clientId, dingConfig.corpId, configToSet);
            } else {
              retryCount++;
              if (retryCount > 50) { // 5秒超时
                clearInterval(checkInterval);
                console.error('❌ DTFrameLogin加载超时或容器元素未准备好');
                setError('钉钉登录SDK加载失败，请刷新页面重试');
                setLoading(false);
              }
            }
          }, 100);
        }
      };
      
      // 如果容器元素还没准备好，等待一下
      if (!checkContainer()) {
        console.log('⏳ 等待容器元素准备...');
        setTimeout(() => {
          tryRender();
        }, 200);
      } else {
        tryRender();
      }
    } catch (error) {
      console.error('❌ 初始化钉钉登录失败:', error);
      console.error('错误详情:', {
        message: error.message,
        response: error.response,
        stack: error.stack,
      });
      
      // 如果是超时错误且还有重试次数，自动重试
      const isTimeout = error.message?.includes('timeout') || 
                       error.message?.includes('超时') ||
                       error.code === 'ECONNABORTED';
      
      if (isTimeout && retryCount < maxRetries) {
        console.log(`请求超时，${2}秒后自动重试... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return initDingLogin(retryCount + 1);
      }
      
      // 提供更友好的错误信息
      let errorMessage = error.message || '初始化失败';
      if (isTimeout) {
        errorMessage = '获取配置超时，请检查网络连接或稍后重试';
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.message || errorMessage;
      } else if (error.response?.status >= 500) {
        errorMessage = '服务器错误，请稍后重试';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  // 渲染二维码
  const renderQRCode = (clientId, corpId, configParam = null) => {
    // 优先使用传入的配置参数，如果没有则使用state中的config
    const effectiveConfig = configParam || config;
    
    console.log('==========================================');
    console.log('🚀 renderQRCode 函数开始执行');
    console.log('   参数:', { clientId: clientId?.substring(0, 10) + '...', corpId });
    console.log('   传入的 config:', configParam);
    console.log('   state 中的 config:', config);
    console.log('   使用的有效 config:', effectiveConfig);
    console.log('   当前 window.location.origin:', window.location.origin);
    console.log('==========================================');
    
    // 检查容器元素是否存在（使用固定ID）
    const qrContainer = document.getElementById('dingtalk_qr_container');
    if (!qrContainer) {
      console.error('❌ 未找到二维码容器元素 (dingtalk_qr_container)');
      setError('二维码容器未准备好，请刷新页面重试');
      setLoading(false);
      return;
    }

    // 注意：不要直接操作innerHTML，因为React会管理这个DOM
    // DTFrameLogin会在容器内创建iframe，我们只需要确保容器是空的
    // 使用React的方式来清空：通过设置loading状态，React会自动更新DOM
    console.log('✅ 二维码容器已找到');

    // 确定回调地址
    // 如果使用生产构建，前后端都通过后端服务器提供，应该使用当前地址（后端地址）
    // 如果使用开发服务器，可以使用配置的前端地址
    const currentOrigin = window.location.origin;
    let redirectUri = `${currentOrigin}/auth/dingtalk/callback`;
    
    // 判断是否使用生产构建（通过后端服务器访问）
    // 如果当前地址和配置的前端地址不一致，说明在使用生产构建，应该使用当前地址
    if (effectiveConfig && effectiveConfig.frontendUrl) {
      const configuredFrontendUrl = effectiveConfig.frontendUrl.replace(/\/$/, ''); // 移除尾部斜杠
      const currentOriginClean = currentOrigin.replace(/\/$/, ''); // 移除尾部斜杠
      
      // 如果当前地址和配置的前端地址相同，说明在使用开发服务器，使用配置的地址
      if (configuredFrontendUrl === currentOriginClean) {
        redirectUri = `${effectiveConfig.frontendUrl}/auth/dingtalk/callback`;
        console.log('✅ 使用配置的前端地址作为回调地址（开发服务器）:', redirectUri);
      } else {
        // 如果不同，说明在使用生产构建，使用当前地址（后端地址）
        console.log('✅ 使用当前地址作为回调地址（生产构建）:', redirectUri);
        console.log('   配置的前端地址:', effectiveConfig.frontendUrl);
        console.log('   当前地址:', currentOrigin);
      }
    } else {
      console.log('⚠️ 使用当前地址作为回调地址:', redirectUri);
      console.log('   提示：建议在数据库配置 frontendUrl，确保回调地址正确');
    }
    
    // 重要提示：确保回调地址已在钉钉开放平台配置
    console.log('📝 回调地址检查：');
    console.log('   当前使用的回调地址:', redirectUri);
    console.log('   请确保此地址已在钉钉开放平台的"登录与分享"->"回调域名"中配置');
    console.log('   配置后需要点击"应用发布"并等待10-30分钟生效');

    try {
      console.log('==========================================');
      console.log('🔵 调用DTFrameLogin，回调地址信息：');
      console.log('   原始回调地址:', redirectUri);
      console.log('   编码后的回调地址:', encodeURIComponent(redirectUri));
      console.log('   当前页面地址:', window.location.href);
      console.log('   当前域名:', window.location.origin);
      console.log('==========================================');
      console.log('调用DTFrameLogin...');
      console.log('参数:', {
        id: 'dingtalk_qr_container',
        client_id: clientId.substring(0, 10) + '...',
        redirect_uri: redirectUri,
        redirect_uri_encoded: encodeURIComponent(redirectUri),
        corpId: corpId || 'undefined',
      });
      
      // 使用setTimeout确保在下一个事件循环中执行，避免与React渲染冲突
      setTimeout(() => {
        // 再次检查容器是否存在（React可能已经重新渲染）
        const container = document.getElementById('dingtalk_qr_container');
        if (!container) {
          console.error('❌ 容器在调用时不存在');
          setError('二维码容器未准备好，请刷新页面重试');
          setLoading(false);
          return;
        }

        // 清空容器（使用原生DOM操作，因为DTFrameLogin需要直接操作DOM）
        // 注意：容器内不应该有React子元素，所以这里应该是安全的
        // 但为了安全，我们使用try-catch包裹
        try {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        } catch (e) {
          // 如果移除失败，可能是React正在管理这些节点，忽略错误
          console.warn('清空容器时出现警告（可忽略）:', e.message);
        }

        // 记录实际发送给钉钉的参数
        const dingTalkParams = {
          redirect_uri: encodeURIComponent(redirectUri),
          client_id: clientId,
          scope: 'openid corpid',
          response_type: 'code',
          state: 'STATE',
          prompt: 'consent',
          corpId: corpId || undefined,
          view: 'pc',
          loginType: 'qr',
        };
        
        console.log('==========================================');
        console.log('📤 发送给钉钉的参数：');
        console.log('   redirect_uri (原始):', redirectUri);
        console.log('   redirect_uri (编码):', encodeURIComponent(redirectUri));
        console.log('   完整参数:', JSON.stringify(dingTalkParams, null, 2));
        console.log('==========================================');
        
        window.DTFrameLogin(
          {
            id: 'dingtalk_qr_container',
            width: 220,
            height: 220,
            // 确保iframe有足够的空间显示授权内容
            style: 'border:none;',
          },
          dingTalkParams,
          (loginResult) => {
            // 登录成功回调
            console.log('==========================================');
            console.log('✅ 钉钉登录成功回调触发！');
            console.log('回调数据:', loginResult);
            console.log('==========================================');
            
            const { redirectUrl, authCode, state, code } = loginResult;
            
            // 支持多种可能的参数名
            const finalCode = authCode || code || (loginResult && loginResult.code);
            const finalRedirectUrl = redirectUrl || (loginResult && loginResult.redirectUrl);
            
            console.log('解析后的参数:', {
              redirectUrl: finalRedirectUrl ? finalRedirectUrl.substring(0, 50) + '...' : 'null',
              authCode: finalCode ? finalCode.substring(0, 20) + '...' : 'null',
              state: state || 'null'
            });
            
            // 根据官方demo，redirectUrl是钉钉返回的完整回调URL，直接跳转
            if (finalRedirectUrl) {
              console.log('使用redirectUrl跳转:', finalRedirectUrl);
              window.location.href = finalRedirectUrl;
            } else if (finalCode) {
              // 如果没有redirectUrl但有authCode，手动跳转
              console.log('使用authCode/code跳转:', finalCode);
              const callbackUrl = `/auth/dingtalk/callback?code=${finalCode}${state ? `&state=${state}` : ''}`;
              console.log('回调URL:', callbackUrl);
              navigate(callbackUrl, { replace: true });
            } else {
              console.error('❌ 回调中没有找到redirectUrl或authCode/code');
              console.error('完整的回调数据:', JSON.stringify(loginResult, null, 2));
              message.error('登录回调数据异常，请重试');
              setError('登录回调数据异常，请重试');
              setLoading(false);
            }
          },
          (errorMsg) => {
            // 登录失败回调
            console.error('❌ 钉钉登录失败:', errorMsg);
            message.error(`登录失败: ${errorMsg}`);
            setError(errorMsg);
            setLoading(false);
          },
        );

        console.log('✅ DTFrameLogin调用成功，等待二维码生成...');
        
        // 等待一段时间，检查二维码是否生成
        setTimeout(() => {
          const qrElement = document.getElementById('dingtalk_qr_container');
          if (qrElement) {
            console.log('✅ 二维码容器已找到');
            // 检查是否有iframe（DTFrameLogin会在容器内创建iframe）
            const iframe = qrElement.querySelector('iframe');
            if (iframe) {
              console.log('✅ 二维码iframe已生成');
              console.log('iframe src:', iframe.src);
              console.log('iframe width:', iframe.width);
              console.log('iframe height:', iframe.height);
              console.log('iframe style:', iframe.style.cssText);
              
              // 确保iframe居中显示并设置正确的尺寸
              iframe.style.display = 'block';
              iframe.style.margin = '0 auto';
              iframe.style.width = '220px';
              iframe.style.height = '220px';
              iframe.style.border = 'none';
              iframe.style.overflow = 'hidden';
              
              // 监听iframe加载事件，检查授权内容是否加载
              iframe.onload = () => {
                console.log('✅ iframe内容已加载');
                try {
                  // 尝试访问iframe内容（可能因为跨域而失败，但不影响）
                  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (iframeDoc) {
                    console.log('✅ 可以访问iframe内容');
                    console.log('iframe内容:', iframeDoc.body?.innerHTML?.substring(0, 200));
                  } else {
                    console.log('⚠️ 无法访问iframe内容（跨域限制，这是正常的）');
                  }
                } catch (e) {
                  console.log('⚠️ 无法访问iframe内容（跨域限制，这是正常的）:', e.message);
                }
              };
              
              // 检查iframe是否已经有内容
              if (iframe.contentWindow) {
                try {
                  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                  if (iframeDoc && iframeDoc.body) {
                    console.log('✅ iframe已有内容');
                  }
                } catch (e) {
                  // 跨域限制，这是正常的
                  console.log('⚠️ 无法检查iframe内容（跨域限制）');
                }
              }
              
              setLoading(false);
            } else {
              console.log('⏳ 等待二维码iframe生成...');
              console.log('容器当前内容:', qrElement.innerHTML.substring(0, 200));
              // 再等待一下
              setTimeout(() => {
                const iframe2 = qrElement.querySelector('iframe');
                if (iframe2) {
                  console.log('✅ 二维码iframe已生成（延迟）');
                  console.log('iframe src:', iframe2.src);
                  // 确保iframe居中显示并设置正确的尺寸
                  iframe2.style.display = 'block';
                  iframe2.style.margin = '0 auto';
                  iframe2.style.width = '220px';
                  iframe2.style.height = '220px';
                  iframe2.style.border = 'none';
                  iframe2.style.overflow = 'hidden';
                  
                  // 监听iframe加载
                  iframe2.onload = () => {
                    console.log('✅ iframe内容已加载（延迟）');
                  };
                  
                  setLoading(false);
                } else {
                  console.log('⚠️ 二维码iframe仍未生成，但继续等待...');
                  setLoading(false); // 即使没有iframe也停止loading，让用户看到
                }
              }, 2000);
            }
          } else {
            console.error('❌ 未找到二维码容器');
            setLoading(false);
          }
        }, 1000); // 等待1秒后检查
        
        // 添加CSS样式确保iframe居中并正确显示授权内容
        const style = document.createElement('style');
        style.textContent = `
          #dingtalk_qr_container {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
            overflow: visible !important;
          }
          #dingtalk_qr_container iframe {
            display: block !important;
            margin: 0 auto !important;
            border: none !important;
            width: 240px !important;
            height: 240px !important;
            min-width: 240px !important;
            min-height: 240px !important;
            max-width: 240px !important;
            max-height: 240px !important;
            overflow: hidden !important;
            position: relative !important;
          }
          /* 确保授权内容可见 */
          #dingtalk_qr_container * {
            visibility: visible !important;
          }
        `;
        // 避免重复添加样式
        if (!document.getElementById('dingtalk-qr-login-style')) {
          style.id = 'dingtalk-qr-login-style';
          document.head.appendChild(style);
        }
      }, 100); // 延迟100ms执行，确保React渲染完成
    } catch (error) {
      console.error('❌ 渲染二维码失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
      });
      setError(error.message || '生成二维码失败');
      setLoading(false);
    }
  };

  // 检查URL参数中是否有code（扫码登录成功后会跳转回来）
  useEffect(() => {
    // 即使在钉钉客户端内，也允许使用扫码登录（用户可能想用其他账号登录）
    // 所以不跳过初始化，继续加载扫码登录
    if (isInDingTalkClient()) {
      console.log('在钉钉客户端内，但仍允许使用扫码登录');
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (code) {
      console.log('检测到回调code，跳转到回调处理页面...');
      navigate(`/auth/dingtalk/callback?code=${code}${state ? `&state=${state}` : ''}`, { replace: true });
      return;
    }

    // 等待DOM渲染完成，确保容器元素已存在
    // 使用requestAnimationFrame确保在DOM更新后执行
    if (!config) {
      const checkAndInit = () => {
        const container = document.getElementById('dingtalk_qr_container');
        if (container) {
          console.log('✅ 容器元素已准备好，开始初始化');
          initDingLogin();
        } else {
          console.log('⏳ 等待容器元素准备...');
          // 使用requestAnimationFrame继续检查
          requestAnimationFrame(checkAndInit);
        }
      };
      
      // 延迟一下，确保React已经渲染完成
      setTimeout(() => {
        checkAndInit();
      }, 100);
    }
  }, [searchParams, navigate, config]);

  // 刷新二维码
  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    if (config) {
      initDingLogin();
    }
  };

  return (
    <div className="dingtalk-qr-login-container">
      {/* 动态背景层 */}
      <div className="animated-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        <div className="particles">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="particle" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`
            }}></div>
          ))}
        </div>
        <div className="grid-overlay"></div>
      </div>

      {/* 主内容卡片 */}
      <Card className="dingtalk-login-card">
        <div className="card-header">
          <div className="logo-container">
            <QrcodeOutlined className="logo-icon" />
          </div>
          <Title level={2} className="login-title">钉钉扫码登录</Title>
          <Text className="login-subtitle">安全便捷的企业级登录方式</Text>
        </div>
        
        {inDingTalkClient && (
          <div className="redirecting-container">
            <Spin size="large" />
            <div className="redirecting-text">
              <Text>检测到您在钉钉客户端内</Text>
              <Text type="secondary">正在跳转到免登登录...</Text>
            </div>
          </div>
        )}
        
        <div className="login-content" style={{ display: inDingTalkClient ? 'none' : 'block' }}>
          {/* Loading状态显示 */}
          {loading && (
            <div className="loading-container">
              <Spin size="large" tip="正在生成二维码..." />
            </div>
          )}
          
          {/* 错误信息显示 */}
          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <Text type="danger" className="error-text">{error}</Text>
              <Button type="primary" onClick={handleRefresh} className="retry-button">
                重试
              </Button>
              <a onClick={() => navigate('/login')} className="back-link">返回登录页面</a>
            </div>
          )}
          
          {/* 二维码容器 */}
          <div className="qr-code-wrapper" style={{ 
            display: loading || error ? 'none' : 'flex'
          }}>
            <div className="qr-code-container">
              <div
                id="dingtalk_qr_container"
                className="dingtalk-qr-box"
              />
              <div className="qr-glow"></div>
            </div>
            {!loading && !error && (
              <div className="qr-instructions">
                <Text className="instruction-title">使用钉钉APP扫描上方二维码登录</Text>
                <div className="instruction-list">
                  <div className="instruction-item">
                    <span className="instruction-icon">📱</span>
                    <Text>扫码后，授权确认将在手机端完成</Text>
                  </div>
                  <div className="instruction-item">
                    <span className="instruction-icon">🔄</span>
                    <Text>授权信息会自动返回网页端</Text>
                  </div>
                  <div className="instruction-item">
                    <span className="instruction-icon">✅</span>
                    <Text>登录成功后会有记录</Text>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* 操作按钮 */}
          {!loading && !error && (
            <div className="action-buttons">
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={handleRefresh}
                className="action-button"
              >
                刷新二维码
              </Button>
              <Button 
                type="text" 
                onClick={() => navigate('/login')}
                className="action-button"
              >
                返回登录页面
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DingTalkQRLogin;
