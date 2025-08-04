<template>
  <div class="container">
    <div class="header">
      <h1>商品条码标签生成器 (Vue版)</h1>
      <p>支持Excel数据导入、批量生成条码标签、PDF导出</p>
    </div>

    <div class="card">
      <h3>📁 数据导入</h3>
      <div
        class="upload-area"
        @click="triggerFileInput"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        :class="{ dragover: isDragging }"
      >
        <div class="upload-icon">📄</div>
        <div class="upload-text">点击选择Excel文件或拖拽文件到此处</div>
        <div style="color: #999; font-size: 0.9em;">支持 .xlsx, .xls 格式</div>
      </div>
      <input type="file" ref="fileInput" class="file-input" accept=".xlsx,.xls" @change="handleFileChange">
    </div>

    <template v-if="allData.length > 0">
      <div class="data-stats">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-number">{{ allData.length }}</span>
            <span class="stat-label">总商品数</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ selectedSkcsCount }}</span>
            <span class="stat-label">已选SKC组</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ storeOptions.length }}</span>
            <span class="stat-label">店铺数</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">{{ colorOptions.length }}</span>
            <span class="stat-label">颜色数</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>🔍 数据筛选</h3>
        <div class="filters">
          <div class="filter-group">
            <label>店铺</label>
            <select v-model="filters.storeCode">
              <option value="">全部店铺</option>
              <option v-for="store in storeOptions" :key="store" :value="store">{{ store }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>SKC货号</label>
            <input type="text" v-model.trim="filters.skcCode" placeholder="输入SKC货号">
          </div>
          <div class="filter-group">
            <label>颜色</label>
            <select v-model="filters.chineseColor">
              <option value="">全部颜色</option>
              <option v-for="color in colorOptions" :key="color" :value="color">{{ color }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>尺码</label>
            <select v-model="filters.size">
              <option value="">全部尺码</option>
              <option v-for="size in sizeOptions" :key="size" :value="size">{{ size }}</option>
            </select>
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button class="btn btn-primary" @click="selectAllVisible">全选当前</button>
          <button class="btn" @click="deselectAllVisible" style="margin-left: 10px;">取消全选</button>
          <button class="btn" @click="clearFilters" style="margin-left: 10px;">清除筛选</button>
        </div>
      </div>

<div id="productSection" class="card">
    <h3>
        📦 商品列表 ({{ filteredAndGroupedData.length }} 组) | 
        <span style="color:#28a745">待打印SKU: {{ stats.skuToPrintCount }}</span> | 
        <span style="color:#667eea">标签总数: {{ stats.labelTotalCount }}</span>
    </h3>
    <div class="product-grid-new">
        <div v-for="group in filteredAndGroupedData" :key="group.representative.skcCode" class="product-group-item">
            <div class="group-header" @click="toggleSkcExpansion(group.representative.skcCode)">
                <input 
                    type="checkbox" 
                    class="product-checkbox"
                    @click.stop 
                    @change="handleSkcGroupCheck(group.items, $event)"
                />
                <img v-if="group.representative.imagePath" :src="group.representative.imagePath" class="product-image-small">
                <div class="group-info">
                    <strong>SKC: {{ group.representative.skcCode }}</strong>
                    <span>{{ group.representative.storeCode }} / {{ group.representative.chineseColor }}</span>
                </div>
                <span class="expand-icon">{{ expandedSkcs.has(group.representative.skcCode) ? '收起' : '展开' }}</span>
            </div>
            
            <div v-if="expandedSkcs.has(group.representative.skcCode)" class="sku-list">
                <div v-for="item in group.items" :key="item.sku" class="sku-item">
                    <div class="sku-info">
                        <span><strong>SKU:</strong> {{ item.sku }}</span>
                        <span><strong>货号:</strong> {{ item.skuCode }}</span>
                        <span><strong>尺码:</strong> {{ item.size }}</span>
                    </div>
                    <div class="sku-quantity">
                        <label>数量:</label>
                        <input 
                            type="number" 
                            v-model.number="item.quantity" 
                            min="0"
                            class="quantity-input" 
                            @click.stop
                        >
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

      <div class="card">
        <h3>🏷️ 标签生成</h3>
        <button class="btn btn-success" @click="generateBarcodes" :disabled="isProcessing || selectedSkcsCount === 0">
          {{ isProcessing ? '处理中...' : '生成条码标签' }}
        </button>
        <button class="btn btn-primary" @click="downloadPDF" :disabled="isProcessing || generatedLabels.length === 0" style="margin-left: 10px;">
          {{ isProcessing ? '生成中...' : '下载PDF' }}
        </button>
        <div v-if="isProcessing" class="progress-bar" style="margin-top: 15px;">
          <div class="progress-fill" :style="{ width: progress.value + '%' }"></div>
        </div>
        <div v-if="progress.text" class="loading" style="display: block;">{{ progress.text }}</div>
      </div>

      <div v-if="generatedLabels.length > 0" class="card">
        <h3>👀 标签预览 ({{ totalLabelCount }}个)</h3>
        <div id="barcodePreview" ref="barcodePreviewContainer">
          <template v-for="(label, index) in generatedLabels" :key="index">
            <div v-if="label.type === 'separator'" class="separator-page">
              颜色分割线 - {{ label.color }}
            </div>
            <div v-else class="barcode-label">
              <div class="barcode-content">
                <div class="barcode-top">
                  <span>{{ label.data.skuCode }}</span>
                  <span>{{ label.data.englishColor }} Color-{{ label.data.size }}</span>
                </div>
                <div class="barcode-middle">
                  <svg :id="`barcode-svg-${index}`"></svg>
                </div>
                <div class="barcode-bottom">
                  <span>{{ label.data.sku }}</span>
                  <span>Made In China</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

// --- 状态变量 ---
const allData = ref([]); // 存储所有商品数据，现在每个商品对象将包含 quantity 属性
const expandedSkcs = reactive(new Set()); // 跟踪哪些SKC分组是展开状态

//  --  移除了 selectedSkcs 和旧的 quantities 变量 --

const fileInput = ref(null);
const isProcessing = ref(false);
const generatedLabels = ref([]);
const filters = reactive({
  storeCode: '',
  skcCode: '',
  chineseColor: '',
  size: '',
});
const progress = reactive({ value: 0, text: '' });


// --- 计算属性 ---

// 新增：计算需要打印的SKU总数和标签总数
const stats = computed(() => {
    let skuToPrintCount = 0;
    let labelTotalCount = 0;
    allData.value.forEach(item => {
        if (item.quantity > 0) {
            skuToPrintCount++;
            labelTotalCount += Number(item.quantity);
        }
    });
    return { skuToPrintCount, labelTotalCount };
});

const storeOptions = computed(() =>[...new Set(allData.value.map(item => item.storeCode).filter(Boolean))]);
const colorOptions = computed(() => [...new Set(allData.value.map(item => item.chineseColor).filter(Boolean))]);
const sizeOptions = computed(() => [...new Set(allData.value.map(item => item.size).filter(Boolean))]);

// filteredAndGroupedData 逻辑保持，用于UI展示
const filteredAndGroupedData = computed(() => {
  // ... (此函数内容与之前版本相同，无需修改)
  const lowerSkcCode = filters.skcCode.toLowerCase();
  const filtered = allData.value.filter(item => {
    return (!filters.storeCode || item.storeCode === filters.storeCode) &&
           (!filters.skcCode || item.skcCode.toLowerCase().includes(lowerSkcCode)) &&
           (!filters.chineseColor || item.chineseColor === filters.chineseColor) &&
           (!filters.size || item.size === filters.size);
  });
  const grouped = {};
  filtered.forEach(item => {
    if (!grouped[item.skcCode]) {
      grouped[item.skcCode] = {
        representative: item,
        items: [],
      };
    }
    grouped[item.skcCode].items.push(item);
  });
  return Object.values(grouped);
});

// --- 监视器 (用于预览区条码生成) ---
watch(generatedLabels, async (newLabels) => {
  if (newLabels.length === 0) return;
  await nextTick();
  newLabels.forEach((label, index) => {
    if (label.type === 'label') {
      const barcodeElement = document.getElementById(`barcode-svg-${index}`);
      if (barcodeElement && label.data.barcode) {
        try {
          JsBarcode(barcodeElement, label.data.barcode, {
            format: "CODE128", width: 1.5, height: 30, displayValue: false, margin: 0
          });
        } catch (error) { console.error(`条码生成失败 for item ${index}:`, error); }
      }
    }
  });
}, { deep: true });


// --- 方法 ---

// 1. processFile: 为每个SKU添加quantity属性
function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      allData.value = jsonData.map(item => ({
        skuCode: item['SKU货号'] || '',
        sku: item['SKU系统'] || '',
        skcCode: item['SKC货号'] || '',
        storeCode: item['店铺代码'] || '',
        chineseColor: item['中文颜色'] || '',
        englishColor: item['英文颜色'] || '',
        size: item['尺码'] || '',
        barcode: item['条码编码'] || '',
        quantity: 1, // <--- 核心改动：为每个SKU默认数量为1
      }));

      clearFilters();
      generatedLabels.value = [];
      alert(`数据加载成功！共加载 ${allData.value.length} 条SKU记录`);
    } catch (error) { alert('文件读取失败：' + error.message); }
  };
  reader.readAsArrayBuffer(file);
}

// 2. 新增：UI交互方法
function toggleSkcExpansion(skcCode) {
    if (expandedSkcs.has(skcCode)) {
        expandedSkcs.delete(skcCode);
    } else {
        expandedSkcs.add(skcCode);
    }
}

function handleSkcGroupCheck(items, event) {
    const newQuantity = event.target.checked ? 1 : 0;
    items.forEach(item => {
        item.quantity = newQuantity;
    });
}

// 3. 重构：generateBarcodes 基于 quantity > 0
function generateBarcodes() {
    const itemsToPrint = allData.value.filter(item => item.quantity > 0);

    if (itemsToPrint.length === 0) {
        alert('没有需要打印的标签。请确保至少有一个SKU的数量大于0。');
        return;
    }

    isProcessing.value = true;
    progress.text = '正在准备标签数据...';

    setTimeout(() => {
        const labels = [];
        const finalPrintList = [];
        itemsToPrint.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                finalPrintList.push(item);
            }
        });

        const colorGroups = {};
        finalPrintList.forEach(item => {
            const colorKey = item.chineseColor || 'Uncategorized';
            if (!colorGroups[colorKey]) {
                colorGroups[colorKey] = [];
            }
            colorGroups[colorKey].push(item);
        });

        const sortedColors = Object.keys(colorGroups).sort();
        sortedColors.forEach((color, index) => {
            if (index > 0) {
                labels.push({ type: 'separator', color });
            }
            colorGroups[color].forEach(item => {
                labels.push({ type: 'label', data: item });
            });
        });

        generatedLabels.value = labels;
        progress.text = `预览生成完毕！共 ${labels.filter(l=>l.type==='label').length} 个标签。`;
        isProcessing.value = false;
    }, 100);
}


// 4. 修复：downloadPDF 使用 canvas 作为中介
async function downloadPDF() {
    if (generatedLabels.value.length === 0) {
        alert('请先生成条码预览');
        return;
    }

    isProcessing.value = true;
    // progress.text = '开始生成矢量PDF...';

    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [70, 20]
    });
    pdf.setFont('helvetica');

    const totalSteps = generatedLabels.value.length;

    for (let i = 0; i < generatedLabels.value.length; i++) {
        const label = generatedLabels.value[i];

        if (i > 0) pdf.addPage();
        
        progress.text = `正在绘制第 ${i + 1} / ${totalSteps} 页...`;
        progress.value = ((i + 1) / totalSteps) * 100;
        
        if (label.type === 'separator') {
            pdf.setFillColor(0, 0, 0);
            pdf.rect(0, 0, 70, 20, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(12);
            pdf.text(`Color Separator - ${label.color}`, 35, 11, { align: 'center' });
        } else {
            const item = label.data;
            
            // 添加边框，距离页面边缘2mm
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.2);
            pdf.rect(2, 2, 66, 16);
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(6); 
            pdf.text(item.skuCode, 3, 4); 
            pdf.text(`${item.englishColor}-${item.size}`, 66, 4, { align: 'right' }); // 调整坐标

            if (item.barcode) {
                // --- 核心修复：使用canvas作为中介 ---
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, item.barcode, {
                    format: "CODE128",
                    width: 3, // 增加条码宽度以提高在高分辨率canvas上的清晰度
                    height: 60,
                    displayValue: false,
                    margin: 0,
                });
                const barcodeImage = canvas.toDataURL('image/png');
                pdf.addImage(barcodeImage, 'PNG', 7, 6, 58, 8); 
            }

            pdf.setFontSize(6); 
            pdf.text(item.sku+"", 3, 17); 
            pdf.text('Made In China', 66, 17, { align: 'right' }); // 调整坐标
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    pdf.save(`Product_Barcodes_${timestamp}.pdf`);
    progress.text = 'PDF生成完成！';
    isProcessing.value = false;
    setTimeout(() => { progress.text = ''; }, 3000);
}

// 其他未修改的辅助函数
function clearFilters() {
    filters.storeCode = ''; filters.skcCode = ''; filters.chineseColor = ''; filters.size = '';
}
function triggerFileInput() { fileInput.value.click(); }
function handleFileChange(event) { if (event.target.files.length) processFile(event.target.files[0]); }
// 新增：计算已选SKC组数量
const selectedSkcsCount = computed(() => {
  const selectedSkcSet = new Set();
  allData.value.forEach(item => {
    if (item.quantity > 0) {
      selectedSkcSet.add(item.skcCode);
    }
  });
  return selectedSkcSet.size;
});
</script>

<style scoped>
/* 将原始CSS粘贴到此处。
  添加 `scoped` 属性是Vue的最佳实践，它能确保这里的样式只应用于当前组件，
  不会泄露到全局污染其他组件。
*/

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Microsoft YaHei', Arial, sans-serif;
    background: #f5f5f5;
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    border-radius: 15px;
    margin-bottom: 30px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.header h1 {
    font-size: 2.5em;
    margin-bottom: 10px;
    font-weight: 300;
}

.header p {
    font-size: 1.1em;
    opacity: 0.9;
}

.card {
    background: white;
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 25px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.08);
    border: 1px solid #e9ecef;
}

.card h3 {
    color: #333;
    margin-bottom: 20px;
    font-size: 1.3em;
    border-bottom: 2px solid #667eea;
    padding-bottom: 10px;
}

.upload-area {
    border: 3px dashed #667eea;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    transition: all 0.3s ease;
    cursor: pointer;
    background: linear-gradient(145deg, #f8f9ff, #ffffff);
}

.upload-area:hover {
    border-color: #764ba2;
    background: linear-gradient(145deg, #f0f2ff, #ffffff);
    transform: translateY(-2px);
}

.upload-area.dragover {
    border-color: #28a745;
    background: linear-gradient(145deg, #f0fff4, #ffffff);
}

.upload-icon {
    font-size: 3em;
    color: #667eea;
    margin-bottom: 15px;
}

.upload-text {
    font-size: 1.1em;
    color: #666;
    margin-bottom: 10px;
}

.file-input {
    display: none;
}

.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1em;
    font-weight: 500;
    transition: all 0.3s ease;
    text-decoration: none;
    display: inline-block;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}

.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}
.btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn-success {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
}
.btn-success:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(40, 167, 69, 0.4);
}

.filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
}
.filter-group {
    display: flex;
    flex-direction: column;
}
.filter-group label {
    font-weight: 500;
    color: #333;
    margin-bottom: 5px;
}
.filter-group select,
.filter-group input {
    padding: 10px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 1em;
    transition: border-color 0.3s ease;
}
.filter-group select:focus,
.filter-group input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.data-stats {
    background: linear-gradient(135deg, #17a2b8 0%, #6610f2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
}
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 20px;
}
.stat-item { text-align: center; }
.stat-number { font-size: 2em; font-weight: bold; display: block; }
.stat-label { font-size: 0.9em; opacity: 0.9; }

.product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
}
.product-item {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.1);
    border: 2px solid transparent;
    transition: all 0.3s ease;
    cursor: pointer;
}
.product-item:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}
.product-item.selected {
    border-color: #667eea;
    background: linear-gradient(145deg, #f8f9ff, #ffffff);
}
.product-checkbox {
    margin-right: 10px;
    transform: scale(1.2);
}
.product-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 10px;
}
.product-info { font-size: 0.9em; color: #666; }
.product-info strong { color: #333; }
.quantity-input {
    width: 80px;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-left: 10px;
}

#barcodePreview {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.barcode-label {
    width: 70mm;
    height: 20mm;
    border: 1px solid #ccc;
    padding: 1mm;
    font-family: Arial, sans-serif;
    position: relative;
    background: white;
    display: inline-block;
    box-sizing: border-box;
}
.barcode-content {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
}
.barcode-top {
    display: flex;
    justify-content: space-between;
    font-size: 8px;
    font-weight: bold;
}
.barcode-middle {
    text-align: center;
    margin: 1mm 0;
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}
.barcode-middle svg {
    max-width: 100%;
    height: auto;
}
.barcode-bottom {
    display: flex;
    justify-content: space-between;
    font-size: 7px;
}

.separator-page {
    width: 70mm;
    height: 20mm;
    background: #000;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    box-sizing: border-box;
}

.progress-bar {
    width: 100%;
    height: 4px;
    background: #e9ecef;
    border-radius: 2px;
    overflow: hidden;
    margin: 10px 0;
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #764ba2);
    transition: width 0.3s ease;
}
.loading {
    display: block;
    text-align: center;
    color: #667eea;
    font-weight: 500;
}
.product-grid-new {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.product-group-item {
    border: 1px solid #e9ecef;
    border-radius: 12px;
    transition: box-shadow 0.3s ease;
}

.product-group-item:hover {
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.group-header {
    display: flex;
    align-items: center;
    padding: 15px;
    cursor: pointer;
    background-color: #f8f9fa;
    border-radius: 12px 12px 0 0;
}

.product-image-small {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
    margin: 0 15px;
}

.group-info {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

.group-info span {
    font-size: 0.9em;
    color: #666;
}

.expand-icon {
    font-size: 0.9em;
    color: #667eea;
    font-weight: 500;
}

.sku-list {
    padding: 15px;
    border-top: 1px solid #e9ecef;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.sku-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #fff;
    border-radius: 8px;
    border: 1px solid #f1f1f1;
}

.sku-info {
    display: flex;
    gap: 20px;
    font-size: 0.9em;
}

.sku-quantity {
    display: flex;
    align-items: center;
    gap: 5px;
}

.quantity-input {
    width: 60px; /* 调整宽度 */
}
</style>