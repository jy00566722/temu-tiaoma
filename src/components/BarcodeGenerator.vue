<template>
  <div class="container">
    <div class="header">
      <h1>商品条码标签生成器 (Vue版)</h1>
      <p>支持Excel数据导入、批量生成条码标签、PDF导出</p>
    </div>

    <!-- 三列布局 -->
    <div class="three-column-layout">
      <!-- 左列：数据输入和功能 -->
      <div class="column left-column">
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
            <h3>🏷️ 标签生成</h3>
            <button class="btn btn-primary" @click="downloadPDF" :disabled="isProcessing || printList.length === 0" style="margin-left: 10px;">
              {{ isProcessing ? '生成中...' : '下载PDF' }}
            </button>
            <div v-if="isProcessing" class="progress-bar" style="margin-top: 15px;">
              <div class="progress-fill" :style="{ width: progress.value + '%' }"></div>
            </div>
            <div v-if="progress.text" class="loading" style="display: block;">{{ progress.text }}</div>
          </div>
        </template>
      </div>

      <!-- 中列：筛选和商品列表 -->
      <div class="column middle-column">
        <template v-if="allData.length > 0">
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
                <button class="btn" @click="clearFiltersAndSetZero" style="margin-left: 10px;">清除筛选</button>
                <button class="btn" @click="setAllToZero" style="margin-left: 10px;">全部置0</button>
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
                    <div class="batch-fill" @click.stop>
                        <input 
                            type="number" 
                            v-model.number="batchQuantities[group.representative.skcCode]" 
                            min="0"
                            class="batch-quantity-input" 
                            placeholder="批量数量"
                        >
                        <button 
                            class="btn-small" 
                            @click="applyBatchQuantity(group.items, group.representative.skcCode)"
                        >
                            批量填充
                        </button>
                        <button 
                            class="btn-small btn-add" 
                            @click="addToPrintList(group.items)"
                        >
                            加入待打印列表
                        </button>
                    </div>
                    <span class="expand-icon">{{ expandedSkcs.has(group.representative.skcCode) ? '收起' : '展开' }}</span>
                  </div>
                    
                  <div v-if="expandedSkcs.has(group.representative.skcCode)" class="sku-list">
                      <div v-for="item in group.items" :key="item.sku" class="sku-item">
                          <div class="sku-info">
                              <span><strong>SKU:</strong> {{ item.sku }}</span>
                              <!-- <span><strong>条码:</strong> {{ item.barcode }}</span> -->
                              <span><strong>货号:</strong> {{ item.skuCode }}</span>
                              <span><strong>颜色:</strong> {{ item.chineseColor }}</span>
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
        </template>
      </div>

      <!-- 右列：待打印列表 -->
      <div class="column right-column">
        <template v-if="allData.length > 0">
          <div class="card">
            <h3>🖨️ 待打印列表 ({{ printList.length }}个SKU)  <span class="btn-small" @click="clearPrintList"> 清空列表</span></h3>
            <div class="print-list">
              <div v-if="printList.length === 0" class="empty-list">
                请从左侧添加商品到打印列表
              </div>
              <div v-for="(item, index) in printList" :key="index" class="print-item">
                <div class="print-item-info">
                  <div> {{ item.storeCode }}</div>
                  <div> {{ item.skcCode }}</div>
                  <div> {{ item.chineseColor }}</div>
                  <div>{{ item.size }}</div>
                  <div class="print-item-quantity">
                    <strong>数量:</strong>
                    <input 
                      type="number" 
                      v-model.number="item.quantity" 
                      min="1"
                      class="quantity-input-small" 
                    >
                  </div>
                </div>
                <div class="print-item-actions">
                  <button class="btn-small btn-delete" @click="removeFromPrintList(index)">
                    del
                  </button>
                </div>
              </div>
            </div>
            <div class="print-actions" v-if="printList.length > 0">
              <div class="print-total">总标签数: {{ printListTotalCount }}</div>
              <button class="btn btn-success" @click="generateBarcodesFromPrintList" :disabled="isProcessing">
                {{ isProcessing ? '处理中...' : '生成条码标签' }}
              </button>
            </div>
          </div>

          <div v-if="generatedLabels.length > 0" class="card">
            <h3>👀 标签预览 <span class="btn-small" @click="clearGeneratedLabels"> 清空预览</span></h3>
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
    </div>
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
const batchQuantities = reactive({}); // 存储每个SKC的批量填充数量
const isDragging = ref(false); // 拖拽状态标志
const printList = ref([]); // 存储待打印的SKU列表，每个元素包含SKU信息和数量


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


/**
 * 重要提示：关于中文字体
 * 默认的jsPDF不支持中文。为了显示中文，我们需要一个包含中文字形的.ttf字体文件。
 * 1. 将一个中文字体文件（例如 微软雅黑 `msyh.ttf`）放到项目的 `public` 目录下。
 * 例如，路径为 `public/fonts/msyh.ttf`
 * 2. 下面的函数会通过URL加载这个字体文件，并注册到jsPDF中。
 */
let isFontLoaded = false;

async function loadAndRegisterFont(pdf) {
    if (isFontLoaded) return;

    try {
        progress.text = '首次加载中文字体...';
        // 从 public 目录加载字体文件
        const fontUrl = '/fonts/msyh.ttf'; 
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error(`字体文件加载失败: ${response.statusText}`);
        const font = await response.arrayBuffer();
        const fontBase64 = btoa(new Uint8Array(font).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        // 注册字体到 jsPDF
        pdf.addFileToVFS('msyh.ttf', fontBase64);
        pdf.addFont('msyh.ttf', 'msyh', 'normal');
        isFontLoaded = true;
    } catch (error) {
        console.error("字体加载或注册失败:", error);
        alert("中文字体加载失败，PDF中的中文可能无法显示。请检查public/fonts/msyh.ttf文件是否存在。");
        // 即使失败，也标记为已尝试，避免重复加载
        isFontLoaded = true; 
    }
}

//计算需要打印的SKU总数和标签总数
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

// 店铺选项不变，始终显示所有店铺
const storeOptions = computed(() => [...new Set(allData.value.map(item => item.storeCode).filter(Boolean))]);

// 颜色选项根据已选店铺和SKC货号筛选
const colorOptions = computed(() => {
  // 先根据已选店铺和SKC货号筛选出符合条件的商品
  const filteredByStoreAndSkc = allData.value.filter(item => {
    const lowerSkcCode = filters.skcCode.toLowerCase();
    return (!filters.storeCode || item.storeCode === filters.storeCode) &&
           (!filters.skcCode || (item.skcCode && String(item.skcCode).toLowerCase().includes(lowerSkcCode)));
  });
  
  // 从筛选结果中提取不重复的颜色选项
  return [...new Set(filteredByStoreAndSkc.map(item => item.chineseColor).filter(Boolean))];
});

// 尺码选项根据已选店铺、SKC货号和颜色筛选
const sizeOptions = computed(() => {
  // 根据已选店铺、SKC货号和颜色筛选出符合条件的商品
  const filteredByStoreAndSkcAndColor = allData.value.filter(item => {
    const lowerSkcCode = filters.skcCode.toLowerCase();
    return (!filters.storeCode || item.storeCode === filters.storeCode) &&
           (!filters.skcCode || (item.skcCode && String(item.skcCode).toLowerCase().includes(lowerSkcCode))) &&
           (!filters.chineseColor || item.chineseColor === filters.chineseColor);
  });
  
  // 从筛选结果中提取不重复的尺码选项
  return [...new Set(filteredByStoreAndSkcAndColor.map(item => item.size).filter(Boolean))];
});

// filteredAndGroupedData 逻辑保持，用于UI展示
const filteredAndGroupedData = computed(() => {
  const lowerSkcCode = filters.skcCode.toLowerCase();
  const filtered = allData.value.filter(item => {
    return (!filters.storeCode || item.storeCode === filters.storeCode) &&
           (!filters.skcCode || (item.skcCode && String(item.skcCode).toLowerCase().includes(lowerSkcCode))) &&
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

// 新增：清空打印列表方法
function clearPrintList() {
    printList.value = [];
}
// 新增：清空预览方法
function clearGeneratedLabels() {
    generatedLabels.value = [];
}
// 添加 handleDrop 函数
function handleDrop(event) {
  isDragging.value = false;
  event.preventDefault();
  if (event.dataTransfer.files.length) {
    processFile(event.dataTransfer.files[0]);
  }
}

// 新增：批量填充方法
function applyBatchQuantity(items, skcCode) {
    const quantity = batchQuantities[skcCode];
    if (quantity !== undefined && quantity >= 0) {
        items.forEach(item => {
            item.quantity = quantity;
        });
        // 可选：清空输入框
        // batchQuantities[skcCode] = "";
    }
}

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
        quantity: 0, // <--- 核心改动：为每个SKU默认数量为1
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

// 添加到待打印列表的方法
function addToPrintList(items) {
    // 只添加数量大于0的SKU
    const itemsToAdd = items.filter(item => item.quantity > 0);
    
    if (itemsToAdd.length === 0) {
        alert('请先设置要打印的SKU数量');
        return;
    }
    
    // 深拷贝要添加的项目，避免引用问题
    itemsToAdd.forEach(item => {
        // 检查是否已存在相同的SKU
        const existingIndex = printList.value.findIndex(existing => existing.sku === item.sku);
        
        if (existingIndex >= 0) {
            // 如果已存在，更新数量
            printList.value[existingIndex].quantity = item.quantity;
        } else {
            // 否则添加新项目
            printList.value.push({
                ...item, // 复制所有属性
                quantity: item.quantity // 确保数量正确
            });
        }
    });
    
    alert(`已添加 ${itemsToAdd.length} 个SKU到待打印列表`);
}

// 从待打印列表中移除项目
function removeFromPrintList(index) {
    printList.value.splice(index, 1);
}

// 从待打印列表生成条码标签
function generateBarcodesFromPrintList() {
    if (printList.value.length === 0) {
        alert('待打印列表为空，请先添加商品');
        return;
    }
    
    isProcessing.value = true;
    progress.text = '正在准备标签数据...';
    
    setTimeout(() => {
        const labels = [];
        const finalPrintList = [];
        
        // 根据每个SKU的数量复制多份
        printList.value.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                finalPrintList.push(item);
            }
        });
        
        // 按颜色分组
        const colorGroups = {};
        finalPrintList.forEach(item => {
            const colorKey = item.chineseColor || 'Uncategorized';
            if (!colorGroups[colorKey]) {
                colorGroups[colorKey] = [];
            }
            colorGroups[colorKey].push(item);
        });
        
        // 生成标签，按颜色分组
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

// 原始的generateBarcodes方法（保留但不再使用）
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
        // 确保中文字体已加载
    //await loadAndRegisterFont(pdf);
    pdf.setFont('helvetica',"bold");
    //console.log(pdf.getFontList());

    const totalSteps = generatedLabels.value.length;

    for (let i = 0; i < generatedLabels.value.length; i++) {
        const label = generatedLabels.value[i];

        if (i > 0) pdf.addPage();
        
        progress.text = `正在绘制第 ${i + 1} / ${totalSteps} 页...`;
        progress.value = ((i + 1) / totalSteps) * 100;
        
        if (label.type === 'separator') {
            pdf.setFillColor(0, 0, 0);
            pdf.rect(3, 5, 60, 14, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(8);
            pdf.text(`Color Separator - ${label.color}`, 35, 11, { align: 'center' });
        } else {
            const item = label.data;
            
            // 添加边框，距离页面边缘2mm
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.2);
            pdf.rect(2, 2, 66, 16);
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(7); 
            pdf.text(item.skuCode, 3, 5); 
            pdf.text(`${item.englishColor}-${item.size}`, 66, 5, { align: 'right'}); // 调整坐标

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

            pdf.setFontSize(7); 
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
// 将所有已筛选的SKU数量设为0并清除选中状态
function setAllToZero() {
    filteredAndGroupedData.value.forEach(group => {
        group.items.forEach(item => {
            item.quantity = 0;
        });
    });
    // 清除所有SKC分组的展开状态
    expandedSkcs.clear();
}

// 清除筛选并将所有SKU数量设为0并清除选中状态
function clearFiltersAndSetZero() {
    clearFilters();
    allData.value.forEach(item => {
        item.quantity = 0;
    });
    // 清除所有SKC分组的展开状态
    expandedSkcs.clear();
}
function triggerFileInput() { fileInput.value.click(); }
function handleFileChange(event) { if (event.target.files.length) processFile(event.target.files[0]); }
// 计算已选SKC组数量
const selectedSkcsCount = computed(() => {
  const selectedSkcSet = new Set();
  allData.value.forEach(item => {
    if (item.quantity > 0) {
      selectedSkcSet.add(item.skcCode);
    }
  });
  return selectedSkcSet.size;
});

// 计算待打印列表中的总标签数量
const printListTotalCount = computed(() => {
  return printList.value.reduce((total, item) => total + item.quantity, 0);
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
    /* max-width: 1200px; */
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
.batch-fill {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-right: 10px;
}

.batch-quantity-input {
    width: 70px;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
}

.btn-small {
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    background: #667eea;
    color: white;
    cursor: pointer;
    font-size: 0.8em;
    transition: all 0.2s ease;
}

.btn-small:hover {
    background: #764ba2;
}

/* 三列布局样式 */
.three-column-layout {
    display: flex;
    gap: 20px;
    margin-top: 20px;
}

.column {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.left-column {
    flex: 1;
    min-width: 250px;
}

.middle-column {
    flex: 2;
    min-width: 400px;
}

.right-column {
    flex: 1;
    min-width: 250px;
}

/* 待打印列表样式 */
.print-list {
    max-height: 500px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.empty-list {
    padding: 20px;
    text-align: center;
    color: #666;
    font-style: italic;
}

.print-item {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 0px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #e9ecef;
    gap: 2px;
}

.print-item-info {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    width: 100%;
    justify-content: space-between;
    gap: 2px;
    font-size: 0.9em;
}

.print-item-quantity {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 0px;
}

.quantity-input-small {
    width: 50px;
    padding: 3px;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
}

.print-item-actions {
    display: flex;
    gap: 1px;
}

.btn-delete {
    background: #dc3545;
}

.btn-delete:hover {
    background: #c82333;
}

.btn-add {
    background: #28a745;
}

.btn-add:hover {
    background: #218838;
}

.print-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #e9ecef;
}

.print-total {
    font-weight: bold;
    color: #28a745;
}

/* 响应式调整 */
@media (max-width: 1200px) {
    .three-column-layout {
        flex-direction: column;
    }
    
    .column {
        width: 100%;
    }
}
</style>
