/**
 * 钉钉JSAPI脚本
 * 需要在HTML中引入：https://g.alicdn.com/dingding/dingtalk-jsapi/2.7.13/dingtalk.open.js
 * 或者在index.html中添加：
 * <script src="https://g.alicdn.com/dingding/dingtalk-jsapi/2.7.13/dingtalk.open.js"></script>
 */

// 如果钉钉JSAPI未加载，提供提示
if (typeof window.dd === 'undefined') {
  console.warn('钉钉JSAPI未加载，请在HTML中引入钉钉JSAPI脚本');
}

