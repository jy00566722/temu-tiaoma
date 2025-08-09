const fs = require('fs');
const XLSX = require('xlsx');

// 读取 JSON 文件
const jsonData = JSON.parse(fs.readFileSync('input.json', 'utf8'));

// 提取所需字段
const extractedData = jsonData.map(item => ({
  '店铺ID':item.labelCodeVO.supplierId,
  'SPU系统': item.labelCodeVO.productId,
  'SKC系统': item.labelCodeVO.productSkcId,
  'SKU系统': item.labelCodeVO.productSkuId,
  '条码编码': item.labelCodeVO.labelCode,
  'SKC货号': item.labelCodeVO.skcExtCode,
  'SKU货号': item.labelCodeVO.skuExtCode,
  '中文颜色': item.productSkuSpecList[0]?.specName || '',
  '尺码': item.productSkuSpecList[1]?.specName || '',
  '英文颜色': item.productSkuSpecI18nMap.en[0]?.specName || '',
  '缩略图': item.displayImage || '',
  '类目标签': item.leafCat.catName || '',
}));

// 创建 Excel 工作簿和工作表
const worksheet = XLSX.utils.json_to_sheet(extractedData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

// 写入 Excel 文件
XLSX.writeFile(workbook, 'output.xlsx');

console.log('Excel 文件已生成：output.xlsx');