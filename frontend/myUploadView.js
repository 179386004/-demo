import React, { useEffect, useState } from 'react';
import { Table, Button, Popconfirm, message, Spin, Form, Input, DatePicker } from 'antd';
import moment from 'moment';
import { GetFileListByDoc, DeleteFileListByDoc, DownLoadFilesByDoc } from '../../../services/api';

const { RangePicker } = DatePicker;

const FileManagement = () => {
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm(); // 使用 Antd 表单管理

  // 获取文件列表，接受查询条件作为参数
  const fetchFiles = async (filters = {}) => {
    setLoading(true);
    try {
      // 调用接口，传递筛选条件
      const res = await GetFileListByDoc(filters);
      const updatedFiles = res.data.data.map((file) => ({
        ...file,
        deleting: false, // 添加删除状态
        downloading: false, // 添加下载状态
      }));
      setFileList(updatedFiles);
    } catch (error) {
      message.error('Failed to fetch files.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(); // 初次加载时获取所有文件
  }, []);

  // 下载文件
  const handleDownload = async (record) => {
    setFileList((prevFiles) =>
      prevFiles.map((file) =>
        file.id === record.id ? { ...file, downloading: true } : file
      )
    );

    try {
      const response = await DownLoadFilesByDoc(record.id);
      const fileName = record.fileName;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Download failed.');
    } finally {
      setFileList((prevFiles) =>
        prevFiles.map((file) =>
          file.id === record.id ? { ...file, downloading: false } : file
        )
      );
    }
  };

  const handleDownloadByLink = (record) => {
    // 设置文件列表中的下载状态
    setFileList((prevFiles) =>
      prevFiles.map((file) =>
        file.id === record.id ? { ...file, downloading: true } : file
      )
    );
    console.log(1);
    
    try {
      // 创建一个链接元素并设置其 href 为 record.filepath
      const link = document.createElement('a');
      link.href = `http://101.34.169.4:8073/PMT/TempDataDownload/${record.fileName}`;
      console.log(link.href);
      
      link.setAttribute('download', record.fileName); // 可选：设置下载文件名
      document.body.appendChild(link);
      link.click(); // 模拟点击下载
      link.parentNode.removeChild(link); // 移除链接元素
    } catch {
      message.error('Download failed.');
    } finally {
      // 还原文件列表中的下载状态
      setFileList((prevFiles) =>
        prevFiles.map((file) =>
          file.id === record.id ? { ...file, downloading: false } : file
        )
      );
    }
  };
  

  // 删除文件
  const handleDelete = async (fileId) => {
    setFileList((prevFiles) =>
      prevFiles.map((file) =>
        file.id === fileId ? { ...file, deleting: true } : file
      )
    ); // 设置文件删除状态为 true

    try {
      await DeleteFileListByDoc(fileId);
      message.success('File deleted successfully.');
      fetchFiles(); // 重新获取文件列表
    } catch {
      message.error('Failed to delete file.');
      setFileList((prevFiles) =>
        prevFiles.map((file) =>
          file.id === fileId ? { ...file, deleting: false } : file
        )
      ); // 失败时恢复删除状态
    }
  };

  // 表单提交时的筛选逻辑
  const onFinish = (values) => {
    const filters = {};

    // 按患者姓名筛选
    if (values.patientName) {
      filters.patientName = values.patientName;
    }

    // 按上传时间范围筛选
    if (values.dateRange && values.dateRange.length === 2) {
      const [startDate, endDate] = values.dateRange;
      filters.uploadStartDate = moment(startDate).format('YYYY-MM-DD');
      filters.uploadEndDate = moment(endDate).format('YYYY-MM-DD');
    }

    // 调用获取文件列表函数并传递筛选条件
    fetchFiles(filters);
  };

  // 定义表格列
  const columns = [
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
    },
    {
      title: 'Upload Time',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      render: (text) => new Date(text).toLocaleString(), // 格式化时间
    },
    {
      title: 'Organization Name',
      dataIndex: 'organizationName',
      key: 'organizationName',
    },
    {
      title: 'Patient Name',
      dataIndex: 'patientName',
      key: 'patientName',
    },
    {
      title: 'Remark',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <>
          <Button
            type="link"
            onClick={() => handleDownloadByLink(record)}
            style={{ marginRight: 8 }}
            disabled={record.deleting || record.downloading} // 禁用按钮
          >
            {record.downloading ? <Spin size="small" /> : 'Download'}
          </Button>
          <Popconfirm
            title="Are you sure to delete this file?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            disabled={record.deleting} // 禁用 Popconfirm
          >
            <Button type="link" danger disabled={record.deleting}>
              {record.deleting ? <Spin size="small" /> : 'Delete'} {/* 显示加载动画 */}
            </Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选表单 */}
      <Form form={form} layout="inline" onFinish={onFinish} style={{ marginBottom: 16 }}>
        <Form.Item name="patientName" label="Patient Name">
          <Input placeholder="Enter patient name" />
        </Form.Item>
        <Form.Item name="dateRange" label="Upload Date Range">
          <RangePicker format="YYYY-MM-DD" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Filter
          </Button>
        </Form.Item>
      </Form>

      {/* 刷新按钮 */}
   {/*    <Button type="primary" onClick={() => fetchFiles()} style={{ marginBottom: 16 }}>
        Refresh Files
      </Button> */}

      {/* 文件表格 */}
      <Table
        dataSource={fileList}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />
    </div>
  );
};

export default FileManagement
