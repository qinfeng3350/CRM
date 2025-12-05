import { useState } from 'react';
import { Button, Space, Popconfirm, message, Upload } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  FilterOutlined,
} from '@ant-design/icons';

/**
 * 通用批量操作组件
 * @param {Object} props
 * @param {Array} props.selectedRowKeys - 选中的行keys
 * @param {Function} props.onBatchDelete - 批量删除回调
 * @param {Function} props.onExport - 导出回调（传入选中的keys，如果为空则导出全部）
 * @param {Function} props.onImport - 导入回调
 * @param {Function} props.onFilter - 筛选回调
 * @param {Boolean} props.showDelete - 是否显示删除按钮
 * @param {Boolean} props.showExport - 是否显示导出按钮
 * @param {Boolean} props.showImport - 是否显示导入按钮
 * @param {Boolean} props.showFilter - 是否显示筛选按钮
 */
const BatchActions = ({
  selectedRowKeys = [],
  onBatchDelete,
  onExport,
  onImport,
  onFilter,
  showDelete = true,
  showExport = true,
  showImport = true,
  showFilter = true,
}) => {
  const [importLoading, setImportLoading] = useState(false);

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的数据');
      return;
    }
    if (onBatchDelete) {
      onBatchDelete(selectedRowKeys);
    }
  };

  const handleExport = (exportAll = false) => {
    if (onExport) {
      onExport(exportAll ? [] : selectedRowKeys);
    }
  };

  const handleImport = (file) => {
    if (onImport) {
      setImportLoading(true);
      onImport(file)
        .then(() => {
          message.success('导入成功');
        })
        .catch((error) => {
          message.error(error.message || '导入失败');
        })
        .finally(() => {
          setImportLoading(false);
        });
    }
    return false; // 阻止自动上传
  };

  if (selectedRowKeys.length === 0 && !showExport && !showImport && !showFilter) {
    return null;
  }

  return (
    <Space style={{ marginBottom: 16 }}>
      {selectedRowKeys.length > 0 && (
        <span style={{ color: '#1890ff', marginRight: 8 }}>
          已选择 {selectedRowKeys.length} 项
        </span>
      )}
      
      {showDelete && selectedRowKeys.length > 0 && (
        <Popconfirm
          title={`确定要删除选中的 ${selectedRowKeys.length} 条数据吗？`}
          onConfirm={handleBatchDelete}
          okText="确定"
          cancelText="取消"
        >
          <Button danger icon={<DeleteOutlined />}>
            批量删除
          </Button>
        </Popconfirm>
      )}

      {showExport && (
        <>
          {selectedRowKeys.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleExport(false)}
            >
              导出选中
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleExport(true)}
          >
            全部导出
          </Button>
        </>
      )}

      {showImport && (
        <Upload
          accept=".xlsx,.xls,.csv"
          beforeUpload={handleImport}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />} loading={importLoading}>
            导入
          </Button>
        </Upload>
      )}

      {showFilter && (
        <Button icon={<FilterOutlined />} onClick={onFilter}>
          筛选
        </Button>
      )}
    </Space>
  );
};

export default BatchActions;

