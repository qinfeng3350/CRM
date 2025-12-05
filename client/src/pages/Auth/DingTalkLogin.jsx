import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { dingTalkService } from '../../services/dingTalkService';

// 日志辅助函数
const log = (level, message, data = null) => {
  console.log(`[${level}]`, message, data || '');
  // 同时发送到后端
  dingTalkService.logToBackend(level, message, data);
};

/**
 * 钉钉企业内部应用免登页面
 * 需要在钉钉客户端内打开，通过JSAPI获取code后登录
 * 
 * 注意：为了使用应用首页地址进行免登，此页面会自动重定向到 /login
 */
const DingTalkLogin = () => {
  const navigate = useNavigate();
  const loginAttemptedRef = useRef(false); // 使用 useRef 防止重复执行

  // 自动重定向到 /login 页面，在那里处理免登
  useEffect(() => {
    console.log('🔄 /auth/dingtalk/login 页面：自动重定向到 /login 页面');
    navigate('/login', { replace: true });
  }, [navigate]);

  // 原有的免登逻辑保留，但通常不会执行到这里（因为已经重定向）
  useEffect(() => {
    log('INFO', '========== useEffect 开始执行 ==========');
    log('INFO', 'loginAttemptedRef.current', { current: loginAttemptedRef.current });
    
    // 防止重复执行
    if (loginAttemptedRef.current) {
      log('WARN', 'useEffect已执行，跳过重复调用');
      return;
    }
    
    // 执行免登流程
    const performLogin = async () => {
      log('INFO', '========== performLogin 开始执行 ==========');
      log('INFO', 'loginAttemptedRef.current', { current: loginAttemptedRef.current });
      
      // 防止重复执行
      if (loginAttemptedRef.current) {
        log('WARN', '免登流程已执行，跳过重复调用');
        return;
      }
      loginAttemptedRef.current = true;
      log('INFO', '🔵 开始执行免登流程，设置标志为true');
      try {
        // 先检查JSAPI是否已加载
        if (typeof window.dd === 'undefined') {
          log('WARN', '⏳ JSAPI未加载，无法执行免登，等待JSAPI加载...');
          // 重置标志，允许在 JSAPI 加载后重新执行
          loginAttemptedRef.current = false;
          return; // 不执行后续逻辑，等待JSAPI加载
        }
        
        // 先获取配置，获取corpId
        log('INFO', '🔵 开始获取钉钉配置...');
        let corpId = '';
        try {
          const configResponse = await dingTalkService.getQRLoginConfig();
          if (configResponse && configResponse.success && configResponse.data) {
            corpId = configResponse.data.corpId || '';
            log('INFO', '✅ 获取到corpId', { corpId: corpId ? corpId.substring(0, 10) + '...' : '空（将使用当前企业）' });
          }
        } catch (configError) {
          log('WARN', '⚠️ 获取配置失败，将使用当前企业', { error: configError.message });
        }

        log('INFO', '🔵 准备调用 window.dd.ready...');
        log('INFO', 'window.dd 检查', { 
          ddExists: typeof window.dd !== 'undefined',
          readyExists: typeof window.dd?.ready === 'function'
        });
        
        // 使用钉钉JSAPI获取免登授权码（像宜搭一样直接授权）
        window.dd.ready(() => {
          log('INFO', '========== window.dd.ready 回调执行 ==========');
          log('INFO', '✅ 钉钉JSAPI已准备就绪，开始请求授权码...');
          log('INFO', 'window.dd.runtime 检查', {
            runtime: !!window.dd.runtime,
            permission: !!window.dd.runtime?.permission,
            requestAuthCode: !!window.dd.runtime?.permission?.requestAuthCode,
            corpId: corpId || '空（使用当前企业）'
          });
          
          // 检查是否有 permission API
          if (!window.dd.runtime || !window.dd.runtime.permission || !window.dd.runtime.permission.requestAuthCode) {
            log('ERROR', '❌ 钉钉JSAPI缺少 permission API', {
              runtime: window.dd.runtime,
              permission: window.dd.runtime?.permission
            });
            message.error('钉钉JSAPI版本过低或配置错误，请检查应用配置');
            setTimeout(() => {
              navigate('/login');
            }, 2000);
            return;
          }
          
          try {
            log('INFO', '🔵 准备调用 requestAuthCode...');
            // 请求授权码 - 这会弹出授权确认弹窗（类似宜搭）
            // 如果corpId为空，会使用当前企业，会自动弹出授权确认弹窗
            window.dd.runtime.permission.requestAuthCode({
              corpId: corpId || '', // 传入corpId，如果为空则使用当前企业
              onSuccess: async (result) => {
                const { code } = result;
                log('INFO', '✅ 获取到授权码', { code: code ? `${code.substring(0, 10)}...` : 'null' });
                
                if (!code) {
                  log('ERROR', '❌ 未获取到授权码');
                  message.error('未获取到授权码，请重试');
                  setTimeout(() => navigate('/login'), 2000);
                  return;
                }
                
                // 调用后端接口登录
                try {
                  log('INFO', '正在调用登录接口...');
                  message.loading('正在登录...', 0);
                  const response = await dingTalkService.loginWithCode(code);
                  message.destroy();
                  log('INFO', '登录响应', { success: response.success, message: response.message });
                  
                  if (response.success) {
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                    message.success('钉钉登录成功');
                    navigate('/dashboard', { replace: true });
                  } else {
                    message.error(response.message || '登录失败');
                    setTimeout(() => navigate('/login'), 2000);
                  }
                } catch (error) {
                  message.destroy();
                  const errorMsg = error.response?.data?.message || error.message || '登录失败';
                  log('ERROR', '登录接口调用失败', { error: errorMsg, response: error.response?.data });
                  message.error(errorMsg);
                  setTimeout(() => navigate('/login'), 2000);
                }
              },
              onFail: (err) => {
                const errorMsg = err?.errorMessage || err?.message || '获取授权码失败';
                log('ERROR', '❌ 获取授权码失败', {
                  errorMessage: err?.errorMessage,
                  message: err?.message,
                  error: err
                });
                
                // 重置标志，允许重试
                loginAttemptedRef.current = false;
                
                if (errorMsg.includes('notInDingTalk') || errorMsg.includes('not support')) {
                  message.warning('不在钉钉客户端内，将跳转到扫码登录页面');
                  setTimeout(() => {
                    navigate('/auth/dingtalk/qrlogin', { replace: true });
                  }, 1500);
                } else if (errorMsg.includes('cancel') || errorMsg.includes('取消')) {
                  message.warning('您取消了授权，返回登录页面');
                  setTimeout(() => {
                    navigate('/login');
                  }, 1500);
                } else if (errorMsg.includes('域名微应用') || errorMsg.includes('可信域名') || (err?.error?.errorCode === '9')) {
                  // 可信域名配置错误 - 自动跳转到扫码登录
                  const currentUrl = window.location.origin;
                  log('WARN', '⚠️ 可信域名未配置，自动跳转到扫码登录页面');
                  message.warning({
                    content: (
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>免登失败：域名未配置</div>
                        <div style={{ marginBottom: 8, fontSize: 12 }}>{errorMsg}</div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                          正在跳转到扫码登录页面（无需配置可信域名）...
                        </div>
                        <div style={{ fontSize: 12, color: '#1890ff', marginTop: 8 }}>
                          如需使用免登，请在钉钉开放平台配置可信域名：{currentUrl}
                        </div>
                      </div>
                    ),
                    duration: 5,
                  });
                  setTimeout(() => {
                    navigate('/auth/dingtalk/qrlogin', { replace: true });
                  }, 2000);
                } else if (errorMsg.includes('permission') || errorMsg.includes('权限')) {
                  message.error(`获取授权码失败: ${errorMsg}。请检查钉钉应用权限配置`);
                  setTimeout(() => {
                    navigate('/login');
                  }, 3000);
                } else {
                  message.error(`获取授权码失败: ${errorMsg}`);
                  setTimeout(() => {
                    navigate('/login');
                  }, 2000);
                }
              },
            });
          } catch (error) {
            log('ERROR', '❌ 调用钉钉API失败', { error: error.message, stack: error.stack });
            // 重置标志，允许重试
            loginAttemptedRef.current = false;
            if (error.message?.includes('notInDingTalk') || error.message?.includes('not support')) {
              message.warning('不在钉钉客户端内，将跳转到扫码登录页面');
              setTimeout(() => {
                navigate('/auth/dingtalk/qrlogin', { replace: true });
              }, 1500);
            } else {
              message.error(`钉钉登录失败: ${error.message || '未知错误'}`);
              setTimeout(() => {
                navigate('/login');
              }, 2000);
            }
          }
        });

        log('INFO', '🔵 设置 window.dd.error 回调...');
        window.dd.error((err) => {
          log('ERROR', '========== window.dd.error 回调执行 ==========');
          log('ERROR', '钉钉JSAPI错误', { error: err, errorMessage: err?.errorMessage, message: err?.message });
          // 重置标志，允许重试
          loginAttemptedRef.current = false;
          const errorMsg = err?.errorMessage || err?.message || '未知错误';
          if (errorMsg.includes('notInDingTalk') || errorMsg.includes('not support')) {
            message.warning('不在钉钉客户端内，将跳转到扫码登录页面');
            setTimeout(() => {
              navigate('/auth/dingtalk/qrlogin', { replace: true });
            }, 1500);
          } else {
            message.error(`钉钉环境初始化失败: ${errorMsg}`);
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        });
        
        log('INFO', '✅ window.dd.ready 和 window.dd.error 回调已设置');
      } catch (error) {
        log('ERROR', '钉钉登录错误', { error: error.message, stack: error.stack });
        // 重置标志，允许重试
        loginAttemptedRef.current = false;
        if (error.message?.includes('notInDingTalk') || error.message?.includes('not support')) {
          message.warning('不在钉钉客户端内，将跳转到扫码登录页面');
          setTimeout(() => {
            navigate('/auth/dingtalk/qrlogin', { replace: true });
          }, 1500);
        } else {
          message.error(`钉钉登录失败: ${error.message || '未知错误'}`);
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      }
    };

    // 检查是否在钉钉环境
    // 注意：钉钉JSAPI只有在真正的钉钉客户端内才会正常工作
    log('INFO', '========== 免登页面 - 环境检测 ==========');
    log('INFO', '环境信息', {
      userAgent: window.navigator.userAgent,
      hasDingTalkJSAPI: typeof window.dd !== 'undefined',
      url: window.location.href
    });
    
    // 首先检查User-Agent，如果不在钉钉客户端内，直接跳转
    const userAgent = window.navigator.userAgent;
    const isDingTalkUserAgent = userAgent.indexOf('DingTalk') > -1;
    
    if (!isDingTalkUserAgent) {
      log('WARN', '❌ User-Agent不包含DingTalk，不在钉钉客户端内');
      message.warning('检测到不在钉钉客户端内，将跳转到扫码登录页面');
      setTimeout(() => {
        navigate('/auth/dingtalk/qrlogin', { replace: true });
      }, 1500);
      return;
    }
    
    log('INFO', '✅ User-Agent检测通过，在钉钉客户端内');
    
    // 等待JSAPI加载，然后验证是否在钉钉环境
    const checkDingTalkEnv = () => {
      log('INFO', '========== checkDingTalkEnv 开始执行 ==========');
      log('INFO', 'loginAttemptedRef.current', { current: loginAttemptedRef.current });
      
      // 防止重复执行 - 如果已经设置了 ready 回调，就不再重复设置
      if (loginAttemptedRef.current) {
        log('WARN', 'checkDingTalkEnv已执行，跳过重复调用');
        return true;
      }
      
      if (typeof window.dd === 'undefined') {
        // JSAPI未加载，但User-Agent显示在钉钉内，继续等待
        log('WARN', '⏳ JSAPI未加载，但User-Agent显示在钉钉内，继续等待...');
        return false; // 返回false表示需要继续等待
      }
      
      log('INFO', '✅ JSAPI已加载，开始验证钉钉环境');
      log('INFO', 'JSAPI检查', {
        dd: !!window.dd,
        ready: typeof window.dd?.ready
      });
      
      // JSAPI已加载，尝试调用验证是否在钉钉环境
      // 注意：即使JSAPI加载了，如果不在钉钉客户端内，调用也会失败
      try {
        // 设置标志，防止重复设置 ready 回调
        loginAttemptedRef.current = true;
        log('INFO', '🔵 设置标志为true（防止重复设置ready回调），准备调用 window.dd.ready');
        
        window.dd.ready(() => {
          log('INFO', '========== window.dd.ready 回调执行（从 checkDingTalkEnv） ==========');
          log('INFO', '✅ 确认在钉钉客户端内，开始免登流程');
          // 重置标志，允许 performLogin 执行
          loginAttemptedRef.current = false;
          log('INFO', '🔵 重置标志为false，允许 performLogin 执行');
          // 在钉钉环境内，继续执行免登流程
          performLogin();
        });
        
        window.dd.error((error) => {
          const errorMsg = error?.errorMessage || error?.message || '';
          log('ERROR', '❌ 钉钉JSAPI错误', { error, errorMessage: errorMsg });
          
          // 重置标志，允许重试
          loginAttemptedRef.current = false;
          
          // 如果错误明确表示不在钉钉内，才跳转
          if (errorMsg.includes('notInDingTalk') || errorMsg.includes('not support')) {
            message.warning('不在钉钉客户端内，将跳转到扫码登录页面');
            setTimeout(() => {
              navigate('/auth/dingtalk/qrlogin', { replace: true });
            }, 1500);
          } else {
            // 其他错误，可能是配置问题，不再尝试免登
            message.error(`钉钉环境初始化失败: ${errorMsg}`);
            setTimeout(() => {
              navigate('/login');
            }, 2000);
          }
        });
        
        return true; // 返回true表示已设置好回调
      } catch (error) {
        log('ERROR', '❌ 调用钉钉JSAPI失败', { error: error.message, stack: error.stack });
        // 重置标志，允许重试
        loginAttemptedRef.current = false;
        // 不再尝试执行免登，直接跳转
        message.error(`钉钉环境初始化失败: ${error.message || '未知错误'}`);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return true;
      }
    };
    
    // 等待JSAPI加载（最多等待10秒，因为JSAPI可能需要更长时间加载）
    if (typeof window.dd === 'undefined') {
      log('INFO', '⏳ 等待JSAPI加载...');
      let retryCount = 0;
      const checkInterval = setInterval(() => {
        retryCount++;
        if (retryCount % 10 === 0) { // 每1秒输出一次日志
          log('INFO', `⏳ 检查JSAPI加载状态 (${retryCount}/100)...`);
        }
        if (typeof window.dd !== 'undefined') {
          log('INFO', '✅ JSAPI已加载，开始检查环境');
          clearInterval(checkInterval);
          const result = checkDingTalkEnv();
          if (!result) {
            // 如果检查失败，再等待一下
            log('WARN', '⚠️ checkDingTalkEnv 返回 false，500ms 后重试');
            setTimeout(() => {
              checkDingTalkEnv();
            }, 500);
          }
        } else if (retryCount > 100) { // 10秒超时
          clearInterval(checkInterval);
          log('ERROR', '⏱️ JSAPI加载超时（10秒），但User-Agent显示在钉钉内');
          // JSAPI加载超时，重置标志并跳转到登录页
          loginAttemptedRef.current = false;
          message.error('钉钉JSAPI加载超时，请检查网络连接或刷新页面重试');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      }, 100);
      
      return () => {
        log('INFO', '🧹 useEffect 清理函数执行，清除定时器');
        clearInterval(checkInterval);
        // 清理时重置标志
        loginAttemptedRef.current = false;
      };
    } else {
      // JSAPI已加载，直接检查
      log('INFO', '✅ JSAPI已加载，直接检查环境');
      checkDingTalkEnv();
    }
  }, [navigate]); // 只依赖 navigate，避免重复执行

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <Spin size="large" />
      <p style={{ marginTop: 16, color: '#666' }}>请稍候，正在获取授权...</p>
    </div>
  );
};

export default DingTalkLogin;
