# 数据库导出文件说明

## 导出信息

- **数据库名**: crm
- **表数量**: 45 个表
- **导出时间**: 见SQL文件名中的时间戳

## 导出文件

SQL文件位于当前目录，文件名格式：`crm_export_YYYY-MM-DDTHH-MM-SS.sql`

## 导入到宝塔数据库

### 方法一：通过宝塔面板导入（推荐）

1. 登录宝塔面板
2. 进入 **数据库** 菜单
3. 找到目标数据库（如果没有，先创建一个名为 `crm` 的数据库）
4. 点击数据库名称进入管理页面
5. 点击 **导入** 按钮
6. 选择本目录下的 SQL 文件（`crm_export_*.sql`）
7. 点击 **开始导入**
8. 等待导入完成

### 方法二：通过命令行导入

如果宝塔面板支持SSH访问，可以使用命令行导入：

```bash
# 进入MySQL目录
cd /path/to/MySQL

# 导入数据库（替换用户名、密码和数据库名）
mysql -u数据库用户名 -p数据库密码 数据库名 < crm_export_*.sql
```

或者：

```bash
# 先登录MySQL
mysql -u数据库用户名 -p

# 然后执行
USE 数据库名;
SOURCE /path/to/MySQL/crm_export_*.sql;
```

## 注意事项

1. **导入前请备份**：导入前请确保备份目标数据库，避免数据丢失
2. **字符集**：确保目标数据库使用 `utf8mb4` 字符集
3. **数据库名**：如果目标数据库名不是 `crm`，需要修改SQL文件中的 `USE \`crm\`;` 为实际数据库名
4. **权限**：确保数据库用户有创建表、插入数据的权限
5. **外键约束**：SQL文件已包含 `SET FOREIGN_KEY_CHECKS = 0;` 和 `SET FOREIGN_KEY_CHECKS = 1;`，导入时会自动处理

## 导入后的验证

导入完成后，可以执行以下SQL验证：

```sql
-- 查看所有表
SHOW TABLES;

-- 查看表数量
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'crm';

-- 查看用户表数据
SELECT COUNT(*) as user_count FROM users;

-- 查看客户表数据
SELECT COUNT(*) as customer_count FROM customers;
```

## 数据库表列表

本次导出包含以下45个表：

1. activities - 活动记录
2. approval_records - 审批记录
3. approval_workflows - 审批流程
4. campaigns - 市场活动
5. contacts - 联系人
6. contract_products - 合同产品
7. contracts - 合同
8. customers - 客户
9. departments - 部门
10. dingtalk_config - 钉钉配置
11. dingtalk_users - 钉钉用户
12. financial_summary - 财务汇总
13. follow_ups - 跟进记录
14. invoices - 发票
15. leads - 线索
16. operation_logs - 操作日志
17. opportunities - 商机
18. opportunity_products - 商机产品
19. payment_plans - 付款计划
20. payments - 付款记录
21. print_templates - 打印模板
22. product_categories - 产品分类
23. product_prices - 产品价格
24. products - 产品
25. project_logs - 项目日志
26. project_phases - 项目阶段
27. project_risks - 项目风险
28. project_tasks - 项目任务
29. projects - 项目
30. quotation_items - 报价项
31. quotations - 报价单
32. roles - 角色
33. signatures - 签名
34. tickets - 工单
35. todos - 待办事项
36. transfer_rules - 流转规则
37. users - 用户
38. workflow_condition_rules - 工作流条件规则
39. workflow_definitions - 工作流定义
40. workflow_history - 工作流历史
41. workflow_instances - 工作流实例
42. workflow_node_instances - 工作流节点实例
43. workflow_nodes - 工作流节点
44. workflow_routes - 工作流路由
45. workflow_tasks - 工作流任务

## 数据统计

根据本次导出：
- **有数据的表**: 约 15 个表包含数据
- **空表**: 约 30 个表为空（结构已导出）
- **总记录数**: 约 200+ 条记录

## 问题排查

如果导入失败，请检查：

1. **文件大小限制**：宝塔面板可能有文件大小限制，如果SQL文件太大，可以分批导入或通过命令行导入
2. **字符编码**：确保SQL文件是UTF-8编码
3. **SQL语法**：检查目标MySQL版本是否支持SQL文件中的语法
4. **权限问题**：确保数据库用户有足够权限
5. **磁盘空间**：确保服务器有足够磁盘空间

## 联系支持

如有问题，请检查：
- 宝塔面板的错误日志
- MySQL的错误日志
- 导入过程中的错误提示

