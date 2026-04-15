/**
 * papers.js - 文献卡片模块脚本
 * 处理文献列表、筛选、导入、编辑和双语切换
 * 支持粗略卡片（黄色）和完整卡片（绿色）的区分
 */

// 配置
const CONFIG = {
    papersUrl: 'data/papers.json',
    CROSSREF_API: 'https://api.crossref.org/works/',
    itemsPerPage: 12
};

// 状态
let papers = [];
let filteredPapers = [];
let currentPage = 1;
let currentCategory = '';
let currentJournal = '';
let searchTerm = '';
let displayLang = 'cn'; // 'cn' = 中文优先, 'en' = 英文优先
let editingPaper = null;
let importData = {};

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadPapers();
    checkUrlParams();
});

// 解决浏览器前进/后退缓存问题
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        loadPapers();
    }
});

function initElements() {
    elements.papersGrid = document.getElementById('papersGrid');
    elements.pagination = document.getElementById('pagination');
    elements.categoryFilter = document.getElementById('categoryFilter');
    elements.journalFilter = document.getElementById('journalFilter');
    elements.searchInput = document.getElementById('searchInput');
    elements.langToggle = document.getElementById('langToggle');
    elements.langIndicator = document.getElementById('langIndicator');
    elements.detailModal = document.getElementById('detailModal');
    elements.importModal = document.getElementById('importModal');
    elements.editModal = document.getElementById('editModal');
    elements.paperForm = document.getElementById('paperForm');
}

function initEventListeners() {
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // 筛选
    elements.categoryFilter?.addEventListener('change', handleFilterChange);
    elements.journalFilter?.addEventListener('change', handleFilterChange);
    elements.searchInput?.addEventListener('input', debounce(handleSearch, 300));

    // 导入按钮
    document.getElementById('importBtn')?.addEventListener('click', openImportModal);
    document.getElementById('addBtn')?.addEventListener('click', () => openEditModal());

    // 模态框
    document.getElementById('closeDetail')?.addEventListener('click', closeDetailModal);
    document.getElementById('closeImport')?.addEventListener('click', closeImportModal);
    document.getElementById('closeEdit')?.addEventListener('click', closeEditModal);
    document.getElementById('cancelImport')?.addEventListener('click', closeImportModal);
    document.getElementById('cancelEdit')?.addEventListener('click', closeEditModal);
    document.getElementById('deletePaper')?.addEventListener('click', deletePaper);

    // 语言切换
    elements.langToggle?.addEventListener('click', toggleLang);

    // 导入类型切换
    document.querySelectorAll('input[name="importType"]').forEach(radio => {
        radio.addEventListener('change', handleImportTypeChange);
    });

    // DOI获取
    document.getElementById('fetchDoiBtn')?.addEventListener('click', fetchDoiPaper);
    document.getElementById('importDoi')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchDoiPaper();
    });

    // JSON导入
    document.getElementById('jsonFileInput')?.addEventListener('change', handleJsonFileUpload);
    document.getElementById('jsonInput')?.addEventListener('input', debounce(parseJsonInput, 500));

    // 复制提示词
    document.getElementById('copyPromptBtn')?.addEventListener('click', () => {
        const promptText = document.getElementById('promptTemplate');
        promptText.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copyPromptBtn');
        const originalText = btn.textContent;
        btn.textContent = '已复制 ✓';
        btn.style.background = 'var(--success-color)';
        btn.style.color = 'white';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    });

    // 确认导入
    document.getElementById('confirmImport')?.addEventListener('click', confirmImport);

    // 表单提交
    elements.paperForm?.addEventListener('submit', handlePaperSubmit);

    // 补全按钮
    document.getElementById('completeCardBtn')?.addEventListener('click', openCompleteModal);
    document.getElementById('closeComplete')?.addEventListener('click', closeCompleteModal);
    document.getElementById('confirmComplete')?.addEventListener('click', confirmComplete);

    // 模态框点击背景关闭
    elements.detailModal?.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) closeDetailModal();
    });
    elements.importModal?.addEventListener('click', (e) => {
        if (e.target === elements.importModal) closeImportModal();
    });
    elements.editModal?.addEventListener('click', (e) => {
        if (e.target === elements.editModal) closeEditModal();
    });
}

/**
 * 检查URL参数（从文献库跳转过来时）
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const doi = params.get('doi');
    if (doi) {
        setTimeout(() => {
            const paper = papers.find(p => p.doi === doi);
            if (paper) {
                openDetailModal(paper.id);
            }
        }, 500);
    }
}

/**
 * 加载文献数据
 */
async function loadPapers() {
    // 优先从localStorage读取（这是用户的数据）
    const stored = localStorage.getItem('papersData');
    if (stored) {
        try {
            papers = JSON.parse(stored);
        } catch (e) {
            papers = [];
        }
    }

    // 如果localStorage没有数据，尝试从文件读取
    if (papers.length === 0) {
        try {
            const response = await fetch(CONFIG.papersUrl);
            if (response.ok) {
                papers = await response.json();
            }
        } catch (error) {
            console.error('加载文献失败:', error);
        }
    }

    // 如果还是没有数据，使用示例数据
    if (papers.length === 0) {
        papers = getSamplePapers();
    }

    updateJournalFilter();
    filterPapers();
}

function getSamplePapers() {
    return [
        {
            id: 'sample-1',
            title: 'Ionic engineering of perovskite films for efficient and stable solar cells',
            title_cn: '钙钛矿薄膜的离子工程以实现高效稳定太阳能电池',
            authors: 'Chen, Y.; Wang, L.; Zhang, M.',
            journal: 'Nature Energy',
            publish_date: '2024-01-15',
            doi: '10.1038/s41560-023-01401-2',
            abstract: 'We report a novel ionic engineering strategy to simultaneously improve the efficiency and stability of perovskite solar cells through controlled anion incorporation.',
            abstract_cn: '我们报道了一种新型离子工程技术，通过可控的阴离子引入来同时提升钙钛矿太阳能电池的效率和稳定性。',
            category: 'synthesis',
            keywords: ['perovskite', 'solar cell', 'ionic engineering', 'stability'],
            summary: 'We developed a novel ionic engineering technique to regulate the crystal structure and defect density of perovskite films through introducing specific anions.',
            summary_cn: '开发了一种新型离子工程技术，通过引入特定的阴离子来调控钙钛矿薄膜的晶体结构和缺陷密度。',
            innovation: 'First demonstration of ionic engineering strategy to simultaneously improve both efficiency and stability of perovskite solar cells.',
            innovation_cn: '首次提出离子工程策略，同时提升钙钛矿太阳能电池的效率和稳定性。',
            application: 'High-efficiency and stable perovskite solar cells for renewable energy applications.',
            application_cn: '高效稳定钙钛矿太阳能电池',
            structure: '1. Introduction 2. Materials Preparation 3. Characterization 4. Device Performance 5. Stability Testing 6. Conclusion',
            structure_cn: '1.引言 2.材料制备 3.表征分析 4.器件性能 5.稳定性测试 6.结论',
            methods: 'XRD, SEM, UV-vis, PL, TRPL, EIS',
            methods_cn: 'XRD、SEM、UV-vis、PL、TRPL、EIS',
            source: 'sample'
        },
        {
            id: 'sample-2',
            title: 'In-situ GIWAXS study of perovskite crystallization during blade coating',
            title_cn: '原位GIWAXS研究刮刀涂布过程中钙钛矿的结晶过程',
            authors: 'Kim, S.; Park, J.; Lee, H.',
            journal: 'Advanced Materials',
            publish_date: '2023-12-20',
            doi: '10.1002/adma.202306789',
            abstract: 'Understanding the crystallization kinetics of perovskite films is crucial for scalable manufacturing of perovskite solar modules.',
            abstract_cn: '理解钙钛矿薄膜的结晶动力学对于钙钛矿太阳能电池的可扩展制造至关重要。',
            category: 'characterization',
            keywords: ['GIWAXS', 'crystallization', 'blade coating', 'scalable'],
            summary: 'Real-time observation of perovskite crystallization dynamics during blade coating using in-situ GIWAXS technique.',
            summary_cn: '利用原位GIWAXS技术实时观测刮刀涂布过程中钙钛矿的结晶动态。',
            innovation: 'First in-situ GIWAXS study to track crystal evolution during blade coating process in real-time.',
            innovation_cn: '首次使用原位GIWAXS实时追踪刮刀涂布过程中的晶体演变。',
            application: 'Large-area perovskite thin film fabrication for solar modules.',
            application_cn: '大面积钙钛矿薄膜制备',
            structure: '1. Background 2. Experimental Methods 3. In-situ Characterization 4. Mechanism Analysis 5. Process Optimization 6. Conclusion',
            structure_cn: '1.背景 2.实验方法 3.原位表征 4.机理分析 5.工艺优化 6.结论',
            methods: 'GIWAXS, XRD, SEM, In-situ optical microscopy',
            methods_cn: 'GIWAXS、XRD、SEM、原位光学显微镜',
            source: 'sample'
        }
    ];
}

/**
 * 更新期刊筛选器
 */
function updateJournalFilter() {
    const journals = [...new Set(papers.map(p => p.journal).filter(Boolean))];
    journals.sort();

    if (elements.journalFilter) {
        elements.journalFilter.innerHTML = '<option value="">全部期刊</option>' +
            journals.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
    }
}

/**
 * 筛选文献
 */
function filterPapers() {
    filteredPapers = papers.filter(paper => {
        if (currentCategory && paper.category !== currentCategory) return false;
        if (currentJournal && paper.journal !== currentJournal) return false;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const searchableText = [
                paper.title, paper.title_cn, paper.authors, paper.journal,
                paper.keywords?.join(' '), paper.abstract
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchableText.includes(term)) return false;
        }

        return true;
    });

    currentPage = 1;
    renderPapers();
}

function handleFilterChange() {
    currentCategory = elements.categoryFilter?.value || '';
    currentJournal = elements.journalFilter?.value || '';
    filterPapers();
}

function handleSearch() {
    searchTerm = elements.searchInput?.value || '';
    filterPapers();
}

/**
 * 渲染文献列表
 */
function renderPapers() {
    if (!elements.papersGrid) return;

    if (filteredPapers.length === 0) {
        elements.papersGrid.innerHTML = `
            <div class="empty-message">
                <p>没有找到匹配的文献</p>
                <button class="btn btn-primary mt-4" onclick="document.getElementById('addBtn').click()">
                    添加第一篇文献
                </button>
            </div>
        `;
        elements.pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredPapers.length / CONFIG.itemsPerPage);
    const startIndex = (currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = startIndex + CONFIG.itemsPerPage;
    const pagePapers = filteredPapers.slice(startIndex, endIndex);

    elements.papersGrid.innerHTML = pagePapers.map(paper => createPaperCard(paper)).join('');

    elements.papersGrid.querySelectorAll('.paper-card').forEach(card => {
        card.addEventListener('click', () => {
            const paperId = card.dataset.id;
            openDetailModal(paperId);
        });
    });

    renderPagination(totalPages);
}

function createPaperCard(paper) {
    const categoryNames = {
        'synthesis': '合成', 'characterization': '表征', 'mechanism': '机理',
        'application': '应用', 'industrial': '工业化', 'custom': '自定义'
    };

    const title = getBilingualField(paper, 'title');
    const abstract = getBilingualField(paper, 'abstract');
    
    // 判断是否为粗略卡片
    const isRough = isRoughCard(paper);
    const cardClass = isRough ? 'paper-card rough-card' : 'paper-card complete-card';

    return `
        <div class="${cardClass}" data-id="${paper.id}">
            ${isRough ? '<span class="card-badge yellow">粗略卡片</span>' : '<span class="card-badge green">完整卡片</span>'}
            <span class="paper-category">${categoryNames[paper.category] || '未分类'}</span>
            <h4 class="paper-title">${escapeHtml(title || '无标题')}</h4>
            <p class="paper-authors">${escapeHtml(paper.authors || '未知作者')}</p>
            <div class="paper-meta">
                <span class="paper-meta-item">📰 ${escapeHtml(paper.journal || '未知期刊')}</span>
                <span class="paper-meta-item">📅 ${paper.publish_date || ''}</span>
            </div>
            ${abstract ? `<p class="paper-abstract">${escapeHtml(abstract)}</p>` : ''}
        </div>
    `;
}

/**
 * 判断是否为粗略卡片
 */
function isRoughCard(paper) {
    // 粗略卡片：isRough标记为true，或者必填字段为空
    if (paper.isRough === true) return true;
    
    const requiredFields = ['summary', 'summary_cn', 'innovation', 'innovation_cn', 
                           'application', 'application_cn', 'structure', 'structure_cn',
                           'methods', 'methods_cn'];
    
    for (const field of requiredFields) {
        const value = paper[field];
        if (!value) return true;
        // 支持字符串和数组
        if (Array.isArray(value) && value.length === 0) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
    }
    return false;
}

/**
 * 渲染分页
 */
function renderPagination(totalPages) {
    if (!elements.pagination) return;
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">←</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span style="padding: 0 8px;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="padding: 0 8px;">...</span>`;
        html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">→</button>`;
    elements.pagination.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderPapers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 获取双语字段值
 */
function getBilingualField(paper, field) {
    const cnField = field + '_cn';
    if (displayLang === 'cn') {
        return paper[cnField] || paper[field] || '';
    } else {
        return paper[field] || paper[cnField] || '';
    }
}

/**
 * 语言切换
 */
function toggleLang() {
    displayLang = displayLang === 'cn' ? 'en' : 'cn';
    if (elements.langIndicator) {
        elements.langIndicator.textContent = displayLang === 'cn' ? '中文' : 'English';
    }
    renderPapers();
}

/**
 * 详情模态框
 */
function openDetailModal(paperId) {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;

    const categoryNames = {
        'synthesis': '合成', 'characterization': '表征', 'mechanism': '机理研究',
        'application': '应用', 'industrial': '工业化', 'custom': '自定义'
    };

    const isRough = isRoughCard(paper);
    
    // 双语字段
    const title = getBilingualField(paper, 'title');
    const abstract = getBilingualField(paper, 'abstract');
    const summary = getBilingualField(paper, 'summary');
    const innovation = getBilingualField(paper, 'innovation');
    const application = getBilingualField(paper, 'application');
    const structure = getBilingualField(paper, 'structure');
    const methods = getBilingualField(paper, 'methods');

    const labels = displayLang === 'cn' ? {
        abstract: '摘要', summary: '工作总结', innovation: '主要创新点',
        application: '应用领域', structure: '文章脉络', methods: '表征技术与数据分析'
    } : {
        abstract: 'Abstract', summary: 'Summary', innovation: 'Key Innovation',
        application: 'Application', structure: 'Structure', methods: 'Methods & Analysis'
    };

    document.getElementById('detailModalTitle').textContent = title;

    const keywordsHtml = Array.isArray(paper.keywords) ?
        paper.keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('') : '';

    const detailBody = document.getElementById('detailModalBody');
    detailBody.innerHTML = `
        <div class="paper-detail ${isRough ? 'rough-card-detail' : 'complete-card-detail'}">
            <!-- 卡片类型标识 -->
            <div class="card-type-banner ${isRough ? 'yellow' : 'green'}">
                ${isRough ? '⚠️ 粗略卡片 - 请补全信息' : '✅ 完整卡片'}
            </div>
            
            <!-- 元信息 -->
            <div class="detail-meta">
                <div class="detail-meta-item">
                    <span class="detail-meta-label">分类</span>
                    <span class="detail-meta-value">${categoryNames[paper.category] || '未分类'}</span>
                </div>
                <div class="detail-meta-item">
                    <span class="detail-meta-label">作者</span>
                    <span class="detail-meta-value">${escapeHtml(paper.authors || '未知')}</span>
                </div>
                <div class="detail-meta-item">
                    <span class="detail-meta-label">期刊</span>
                    <span class="detail-meta-value">${escapeHtml(paper.journal || '未知')}</span>
                </div>
                <div class="detail-meta-item">
                    <span class="detail-meta-label">发表日期</span>
                    <span class="detail-meta-value">${paper.publish_date || '未知'}</span>
                </div>
                ${paper.doi ? `
                <div class="detail-meta-item">
                    <span class="detail-meta-label">DOI</span>
                    <span class="detail-meta-value">
                        <a href="https://doi.org/${paper.doi}" target="_blank">${paper.doi}</a>
                    </span>
                </div>
                ` : ''}
            </div>

            <!-- 关键词 -->
            ${keywordsHtml ? `
            <div class="detail-section">
                <h4 class="detail-section-title">关键词</h4>
                <div class="detail-keywords">${keywordsHtml}</div>
            </div>
            ` : ''}

            <!-- 摘要 -->
            ${abstract ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.abstract}</h4>
                <div class="detail-content">${escapeHtml(abstract)}</div>
            </div>
            ` : ''}

            <!-- 工作总结 -->
            ${summary ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.summary}</h4>
                <div class="detail-content">${escapeHtml(summary)}</div>
            </div>
            ` : ''}

            <!-- 主要创新点 -->
            ${innovation ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.innovation}</h4>
                <div class="detail-content">${escapeHtml(innovation)}</div>
            </div>
            ` : ''}

            <!-- 应用领域 -->
            ${application ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.application}</h4>
                <div class="detail-content">${escapeHtml(application)}</div>
            </div>
            ` : ''}

            <!-- 文章脉络 -->
            ${structure ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.structure}</h4>
                <div class="detail-content">${escapeHtml(structure)}</div>
            </div>
            ` : ''}

            <!-- 表征技术 -->
            ${methods ? `
            <div class="detail-section">
                <h4 class="detail-section-title">${labels.methods}</h4>
                <div class="detail-content">${escapeHtml(methods)}</div>
            </div>
            ` : ''}

            <!-- 操作按钮 -->
            <div class="detail-actions">
                ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" class="btn btn-primary">🔗 访问原文</a>` : ''}
                <button class="btn btn-secondary" onclick="closeDetailModal(); openEditModal('${paper.id}')">✏️ 编辑</button>
                ${isRough ? `<button class="btn btn-warning" onclick="closeDetailModal(); openCompleteModal('${paper.id}')">📝 补全</button>` : ''}
                <button class="btn btn-danger" onclick="confirmDeletePaper('${paper.id}')">🗑️ 删除</button>
            </div>
        </div>
    `;

    elements.detailModal.classList.remove('hidden');
}

function closeDetailModal() {
    elements.detailModal.classList.add('hidden');
}

/**
 * 补全模态框（仅粗略卡片显示）
 */
function openCompleteModal(paperId = null) {
    if (paperId) {
        editingPaper = papers.find(p => p.id === paperId);
    }
    
    if (!editingPaper) {
        alert('请先选择要补全的卡片');
        return;
    }

    // 生成补全提示词（去掉已在DOI处理中填写的字段）
    const prompt = generateCompletePrompt(editingPaper);
    
    document.getElementById('completePaperTitle').textContent = editingPaper.title || editingPaper.title_cn;
    document.getElementById('completePrompt').value = prompt;
    document.getElementById('completeJson').value = '';
    
    document.getElementById('completeModal').classList.remove('hidden');
}

function closeCompleteModal() {
    document.getElementById('completeModal').classList.add('hidden');
    editingPaper = null;
}

/**
 * 生成补全提示词
 */
function generateCompletePrompt(paper) {
    return `请补全以下文献卡片的剩余字段。

已填写的字段：
- 标题：${paper.title || paper.title_cn || '无'}
- 作者：${paper.authors || '无'}
- 期刊：${paper.journal || '无'}
- 出版日期：${paper.publish_date || '无'}
- DOI：${paper.doi || '无'}
- 摘要：${(paper.abstract || paper.abstract_cn || '无').substring(0, 200)}...

请补全以下JSON格式的字段（只需返回JSON，不要其他内容）：

{
  "summary": "英文工作总结（本文做了什么、得到了什么结论，100-200字）",
  "summary_cn": "中文工作总结",
  "innovation": "英文创新点（本文的主要贡献和创新之处）",
  "innovation_cn": "中文创新点",
  "application": "英文应用领域",
  "application_cn": "中文应用领域",
  "structure": "英文论证思路（研究了什么→用了什么方法→得到什么结果→得出什么结论）",
  "structure_cn": "中文论证思路",
  "methods": "英文表征技术（如：XRD, SEM, UV-vis等）",
  "methods_cn": "中文表征技术",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

所有字段必须完整，不能有null或空值。`;
}

/**
 * 确认补全
 */
function confirmComplete() {
    const jsonStr = document.getElementById('completeJson').value.trim();
    
    if (!jsonStr) {
        alert('请粘贴补全后的JSON数据');
        return;
    }

    try {
        const data = JSON.parse(jsonStr);
        
        // 验证必要字段
        const required = ['summary', 'summary_cn', 'innovation', 'innovation_cn', 
                        'application', 'application_cn', 'structure', 'structure_cn',
                        'methods', 'methods_cn'];
        
        for (const field of required) {
            if (!data[field] || data[field].trim() === '') {
                alert(`字段 "${field}" 不能为空`);
                return;
            }
        }

        // 更新卡片
        Object.assign(editingPaper, data);
        editingPaper.isRough = false;
        editingPaper.completedAt = new Date().toISOString();

        savePapers();
        closeCompleteModal();
        filterPapers();

        alert('✅ 卡片补全成功！');

    } catch (e) {
        alert('JSON格式错误: ' + e.message);
    }
}

/**
 * 导入模态框
 */
function openImportModal() {
    document.getElementById('importDoi').value = '';
    document.getElementById('doiResult').innerHTML = '';
    document.getElementById('confirmImport').disabled = true;
    importData = {};
    elements.importModal.classList.remove('hidden');
}

function closeImportModal() {
    elements.importModal.classList.add('hidden');
    // 清空状态
    importData = {};
    const jsonInput = document.getElementById('jsonInput');
    const jsonResult = document.getElementById('jsonResult');
    if (jsonInput) jsonInput.value = '';
    if (jsonResult) jsonResult.innerHTML = '';
    document.getElementById('confirmImport').disabled = true;
}

function handleImportTypeChange(e) {
    const type = e.target.value;
    document.getElementById('doiImportField').classList.toggle('hidden', type !== 'doi');
    document.getElementById('jsonImportField').classList.toggle('hidden', type !== 'json');
    
    importData = {};
    document.getElementById('confirmImport').disabled = true;
}

async function fetchDoiPaper() {
    const doiInput = document.getElementById('importDoi').value.trim();
    if (!doiInput) {
        alert('请输入DOI');
        return;
    }

    let doi = doiInput;
    if (doiInput.includes('doi.org/')) {
        doi = doiInput.split('doi.org/')[1];
    }

    const btn = document.getElementById('fetchDoiBtn');
    const useAI = document.getElementById('useAIParse')?.checked;
    const resultDiv = document.getElementById('doiResult');
    
    btn.disabled = true;
    btn.textContent = '获取中...';
    resultDiv.innerHTML = '<p class="text-muted">正在获取文献信息...</p>';

    try {
        const response = await fetch(`${CONFIG.CROSSREF_API}${doi}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error('获取失败');

        const data = await response.json();
        const work = data.message;

        importData = {
            title: work.title?.[0] || '',
            authors: work.author?.map(a => `${a.family}, ${a.given}`).join('; ') || '',
            journal: work['container-title']?.[0] || '',
            publish_date: work.published?.['date-parts']?.[0]?.join('-') || '',
            doi: doi,
            abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
            keywords: work.subject || [],
            vocabulary: []
        };

        if (!useAI || !isApiKeyConfigured()) {
            // 仅获取基本信息，创建粗略卡片
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
                    <p style="font-weight: 600; color: #d97706;">⚠️ 将创建粗略卡片</p>
                    <p style="margin-top: 8px; color: var(--text-secondary);">
                        DOI导入只能获取基本信息，完整卡片需要手动补全或使用AI解析。
                    </p>
                </div>
                <div style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-top: 12px;">
                    <p style="font-weight: 600; color: var(--success-color);">已获取基本信息</p>
                    <p style="margin-top: 8px;"><strong>标题：</strong>${escapeHtml(importData.title)}</p>
                    <p style="margin-top: 4px;"><strong>作者：</strong>${escapeHtml(importData.authors)}</p>
                    <p style="margin-top: 4px;"><strong>期刊：</strong>${escapeHtml(importData.journal)}</p>
                    <p style="margin-top: 4px;"><strong>DOI：</strong>${escapeHtml(doi)}</p>
                </div>
            `;
            document.getElementById('confirmImport').disabled = false;
        } else {
            // 使用AI解析
            resultDiv.innerHTML = '<p class="text-muted">正在连接AI服务...</p>';
            btn.textContent = 'AI解析中...';
            
            try {
                const aiResult = await parsePaperWithAI(doi, importData.title, importData.abstract);
                importData = mergeWithBaseInfo(importData, aiResult);
                
                resultDiv.innerHTML = `
                    <div style="padding: 16px; background: #f0fdf4; border-radius: 8px;">
                        <p style="font-weight: 600; color: var(--success-color);">✅ AI解析成功</p>
                        <details style="margin-top: 12px;">
                            <summary style="cursor: pointer; color: var(--primary-color);">查看解析详情</summary>
                            <div style="margin-top: 8px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 0.9rem;">
                                <p><strong>创新点：</strong>${escapeHtml(importData.innovation || '-')}</p>
                                <p style="margin-top: 8px;"><strong>工作总结：</strong>${escapeHtml(importData.summary || '-')}</p>
                                <p style="margin-top: 8px;"><strong>表征技术：</strong>${escapeHtml(importData.methods || '-')}</p>
                            </div>
                        </details>
                    </div>
                `;
            } catch (aiError) {
                resultDiv.innerHTML = `
                    <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
                        <p style="font-weight: 600; color: #d97706;">⚠️ AI解析失败，将创建粗略卡片</p>
                        <p style="margin-top: 4px; color: var(--text-secondary);">${aiError.message}</p>
                    </div>
                    <div style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-top: 12px;">
                        <p style="font-weight: 600; color: var(--success-color);">已获取基本信息</p>
                        <p style="margin-top: 8px;"><strong>标题：</strong>${escapeHtml(importData.title)}</p>
                    </div>
                `;
            }
            document.getElementById('confirmImport').disabled = false;
        }

    } catch (error) {
        console.error('获取DOI信息失败:', error);
        resultDiv.innerHTML = `
            <div style="padding: 16px; background: #fef2f2; border-radius: 8px;">
                <p style="font-weight: 600; color: var(--error-color);">❌ 获取失败</p>
                <p class="text-muted mt-4">请检查DOI是否正确。</p>
            </div>
        `;
    }

    btn.disabled = false;
    btn.textContent = '获取文献信息';
}

function handleJsonFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const resultDiv = document.getElementById('jsonResult');
    resultDiv.innerHTML = '<p class="text-muted">正在读取文件...</p>';
    
    file.text().then(text => {
        document.getElementById('jsonInput').value = text;
        parseJsonInput();
    }).catch(error => {
        resultDiv.innerHTML = `<p class="text-danger">❌ 文件读取失败: ${error.message}</p>`;
    });
}

function parseJsonInput() {
    const jsonInput = document.getElementById('jsonInput')?.value || '';
    const resultDiv = document.getElementById('jsonResult');
    
    if (!jsonInput.trim()) {
        resultDiv.innerHTML = '';
        importData = {};
        document.getElementById('confirmImport').disabled = true;
        return;
    }
    
    try {
        let jsonData = JSON.parse(jsonInput.trim());
        
        // 检查是否被代码块包裹
        if (typeof jsonData === 'string') {
            const jsonMatch = jsonData.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) jsonData = JSON.parse(jsonMatch[1]);
        }
        
        if (!jsonData.title && !jsonData.title_cn) {
            resultDiv.innerHTML = '<p class="text-danger">JSON数据缺少标题字段</p>';
            return;
        }
        
        importData = {
            title: jsonData.title || '',
            title_cn: jsonData.title_cn || '',
            authors: jsonData.authors || '',
            journal: jsonData.journal || '',
            publish_date: jsonData.publish_date || '',
            doi: jsonData.doi || '',
            abstract: jsonData.abstract || '',
            abstract_cn: jsonData.abstract_cn || '',
            keywords: jsonData.keywords || [],
            summary: jsonData.summary || '',
            summary_cn: jsonData.summary_cn || '',
            innovation: jsonData.innovation || '',
            innovation_cn: jsonData.innovation_cn || '',
            application: jsonData.application || '',
            application_cn: jsonData.application_cn || '',
            structure: jsonData.structure || '',
            structure_cn: jsonData.structure_cn || '',
            methods: jsonData.methods || '',
            methods_cn: jsonData.methods_cn || '',
            vocabulary: jsonData.vocabulary || [],
            category: jsonData.category || 'custom'
        };
        
        resultDiv.innerHTML = `
            <div class="import-preview">
                <p><strong>标题:</strong> ${importData.title || importData.title_cn}</p>
                <p><strong>作者:</strong> ${importData.authors || '未提供'}</p>
                <p><strong>期刊:</strong> ${importData.journal || '未提供'}</p>
                <p class="text-success">✅ 可点击"确认导入"</p>
            </div>
        `;
        
        document.getElementById('confirmImport').disabled = false;
        
    } catch (error) {
        resultDiv.innerHTML = `<p class="text-muted">等待完整JSON数据...</p>`;
        importData = {};
        document.getElementById('confirmImport').disabled = true;
    }
}

async function confirmImport() {
    const importType = document.querySelector('input[name="importType"]:checked')?.value || 'doi';
    const category = document.getElementById('importCategory')?.value || 'custom';

    if (!importData.title && !importData.title_cn) {
        alert('请先解析文献信息');
        return;
    }

    const newPaper = {
        id: generateId(),
        title: importData.title || '',
        title_cn: importData.title_cn || '',
        authors: importData.authors || '',
        journal: importData.journal || '',
        publish_date: importData.publish_date || '',
        doi: importData.doi || '',
        abstract: importData.abstract || '',
        abstract_cn: importData.abstract_cn || '',
        category: importData.category || category,
        keywords: importData.keywords || [],
        image: '',
        summary: importData.summary || '',
        summary_cn: importData.summary_cn || '',
        innovation: importData.innovation || '',
        innovation_cn: importData.innovation_cn || '',
        application: importData.application || '',
        application_cn: importData.application_cn || '',
        structure: importData.structure || '',
        structure_cn: importData.structure_cn || '',
        methods: importData.methods || '',
        methods_cn: importData.methods_cn || '',
        vocabulary: importData.vocabulary || [],
        source: 'import',
        isRough: !importData.summary,
        createdAt: new Date().toISOString()
    };

    // 检查是否已有该DOI的文献
    const existingIndex = papers.findIndex(p => p.doi === newPaper.doi);
    if (existingIndex !== -1) {
        papers[existingIndex] = { ...papers[existingIndex], ...newPaper };
    } else {
        papers.unshift(newPaper);
    }

    savePapers();
    closeImportModal();
    filterPapers();

    alert('文献导入成功！');
}

function openEditModal(paperId = null) {
    if (paperId) {
        editingPaper = papers.find(p => p.id === paperId);
    } else {
        editingPaper = null;
    }

    const form = elements.paperForm;
    if (editingPaper) {
        form.title.value = editingPaper.title || '';
        form.title_cn.value = editingPaper.title_cn || '';
        form.authors.value = editingPaper.authors || '';
        form.journal.value = editingPaper.journal || '';
        form.publish_date.value = editingPaper.publish_date || '';
        form.doi.value = editingPaper.doi || '';
        form.abstract.value = editingPaper.abstract || '';
        form.abstract_cn.value = editingPaper.abstract_cn || '';
        form.keywords.value = (editingPaper.keywords || []).join(', ');
        form.category.value = editingPaper.category || 'custom';
        form.summary.value = editingPaper.summary || '';
        form.summary_cn.value = editingPaper.summary_cn || '';
        form.innovation.value = editingPaper.innovation || '';
        form.innovation_cn.value = editingPaper.innovation_cn || '';
        form.application.value = editingPaper.application || '';
        form.application_cn.value = editingPaper.application_cn || '';
        form.structure.value = editingPaper.structure || '';
        form.structure_cn.value = editingPaper.structure_cn || '';
        form.methods.value = editingPaper.methods || '';
        form.methods_cn.value = editingPaper.methods_cn || '';
    } else {
        form.reset();
    }

    elements.editModal.classList.remove('hidden');
}

function closeEditModal() {
    elements.editModal.classList.add('hidden');
    editingPaper = null;
}

function handlePaperSubmit(e) {
    e.preventDefault();
    const form = e.target;

    const paperData = {
        title: form.title.value,
        title_cn: form.title_cn.value,
        authors: form.authors.value,
        journal: form.journal.value,
        publish_date: form.publish_date.value,
        doi: form.doi.value,
        abstract: form.abstract.value,
        abstract_cn: form.abstract_cn.value,
        keywords: form.keywords.value.split(',').map(k => k.trim()).filter(Boolean),
        category: form.category.value,
        summary: form.summary.value,
        summary_cn: form.summary_cn.value,
        innovation: form.innovation.value,
        innovation_cn: form.innovation_cn.value,
        application: form.application.value,
        application_cn: form.application_cn.value,
        structure: form.structure.value,
        structure_cn: form.structure_cn.value,
        methods: form.methods.value,
        methods_cn: form.methods_cn.value,
        isRough: !form.summary.value,
        updatedAt: new Date().toISOString()
    };

    if (editingPaper) {
        Object.assign(editingPaper, paperData);
    } else {
        paperData.id = generateId();
        paperData.createdAt = new Date().toISOString();
        papers.unshift(paperData);
    }

    savePapers();
    closeEditModal();
    filterPapers();

    alert(editingPaper ? '文献更新成功！' : '文献添加成功！');
}

function confirmDeletePaper(paperId) {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;
    
    if (!confirm('确定要删除这篇文献卡片吗？此操作不可撤销。')) return;
    
    papers = papers.filter(p => p.id !== paperId);
    savePapers();
    closeDetailModal();
    filterPapers();
    alert('文献卡片已删除');
}

function deletePaper() {
    if (!editingPaper) return;
    if (!confirm('确定要删除这篇文献吗？')) return;

    papers = papers.filter(p => p.id !== editingPaper.id);
    savePapers();
    closeDetailModal();
    closeEditModal();
    filterPapers();
    alert('文献已删除');
}

function savePapers() {
    localStorage.setItem('papersData', JSON.stringify(papers));
}

/**
 * 工具函数
 */
function generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    // 如果是数组，转换为列表
    if (Array.isArray(text)) {
        if (text.length === 0) return '';
        // 如果是innovation等，显示为列表
        return text.map(item => `<div class="list-item">• ${escapeHtml(item)}</div>`).join('');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
