const { pool } = require('../config/database');

const expectedTables = [
  'activities','approval_records','approval_workflows','campaigns','contacts','contracts','contract_products','customers','departments','dingtalk_config','dingtalk_users','follow_ups','inbound_orders','inbound_order_items','inventory','invoices','leads','operation_logs','opportunities','opportunity_products','outbound_orders','outbound_order_items','payments','payment_plans','payment_records','print_templates','products','product_categories','product_prices','projects','project_logs','project_phases','project_tasks','purchase_orders','purchase_order_items','quotations','quotation_items','receipts','roles','signatures','suppliers','tickets','todos','transfer_rules','users','workflow_definitions','workflow_instances','workflow_nodes','workflow_routes','dashboards'
];

(async () => {
  const conn = await pool.getConnection();
  try {
    // 首选信息_schema，若权限受限则回退到 SHOW TABLES
    let rows = [];
    try {
      [rows] = await conn.execute(
        `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()`
      );
    } catch (err) {
      console.warn('信息_schema 访问受限，回退到 SHOW TABLES:', err.message);
    }

    if (!rows || rows.length === 0) {
      const [fallback] = await conn.query('SHOW TABLES');
      const key = Object.keys(fallback[0] || {})[0];
      rows = fallback.map(r => ({ name: r[key] }));
    }

    const existing = new Set(rows.map(r => r.name));
    const missing = expectedTables.filter(t => !existing.has(t));
    const present = expectedTables.filter(t => existing.has(t));
    console.log('📊 数据库表审计:');
    console.log('   已存在表数量:', present.length);
    console.log('   缺失表数量:', missing.length);
    if (missing.length) {
      console.log('   缺失表列表:', missing.join(', '));
    } else {
      console.log('   所有预期表均已存在');
    }
  } catch (e) {
    console.error('审计失败:', e.message);
  } finally {
    conn.release();
    process.exit(0);
  }
})();
