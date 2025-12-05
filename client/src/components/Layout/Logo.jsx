import React from 'react';

const Logo = ({ collapsed = false, style = {} }) => {
  const logoId = `logo-gradient-${collapsed ? 'collapsed' : 'expanded'}`;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        ...style,
      }}
      onClick={() => {
        // 点击Logo可以跳转到首页
        if (window.location.pathname !== '/dashboard') {
          window.location.href = '/dashboard';
        }
      }}
    >
      {/* Logo SVG图标 */}
      <svg
        width={collapsed ? 24 : 32}
        height={collapsed ? 24 : 32}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* 渐变定义 */}
        <defs>
          <linearGradient id={logoId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1890ff" />
            <stop offset="50%" stopColor="#40a9ff" />
            <stop offset="100%" stopColor="#096dd9" />
          </linearGradient>
          <filter id={`shadow-${logoId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* 背景圆形 */}
        <circle 
          cx="24" 
          cy="24" 
          r="22" 
          fill={`url(#${logoId})`}
          filter={`url(#shadow-${logoId})`}
        />
        {/* 字母M（墨枫的首字母）- 更优雅的设计 */}
        <path
          d="M 14 34 L 14 16 L 18 16 L 24 26 L 30 16 L 34 16 L 34 34 L 30 34 L 30 20 L 24 30 L 18 20 L 18 34 Z"
          fill="white"
          stroke="white"
          strokeWidth="0.5"
        />
      </svg>
      {!collapsed && (
        <span
          style={{
            fontSize: style.fontSize || 16,
            fontWeight: 'bold',
            background: `linear-gradient(135deg, #1890ff 0%, #40a9ff 50%, #096dd9 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
          }}
        >
          墨枫CRM系统
        </span>
      )}
    </div>
  );
};

export default Logo;

