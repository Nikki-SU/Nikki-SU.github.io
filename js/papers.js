/**
 * papers.js - 文献卡片模块脚本
 * 处理文献列表、筛选、导入、编辑和双语切换
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

    // PDF上传
    document.getElementById('importPdf')?.addEventListener('change', handlePdfUpload);
    document.getElementById('parsePdfBtn')?.addEventListener('click', parsePdfContent);
    
    // JSON导入（文件+粘贴自动解析）
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
 * 加载文献数据
 */
async function loadPapers() {
    try {
        const response = await fetch(CONFIG.papersUrl);
        if (response.ok) {
            papers = await response.json();
        }
    } catch (error) {
        console.error('加载文献失败:', error);
        // 从localStorage加载
        const stored = localStorage.getItem('papersData');
        if (stored) {
            papers = JSON.parse(stored);
        }
    }

    // 如果没有数据，加载示例数据
    if (papers.length === 0) {
        papers = getSamplePapers();
    }

    // 更新期刊筛选器
    updateJournalFilter();

    // 筛选并渲染
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
            image: '',
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
            abstract_cn: '理解钙钛矿薄膜的结晶动力学对于钙钛矿太阳能组件的可扩展制造至关重要。',
            category: 'characterization',
            keywords: ['GIWAXS', 'crystallization', 'blade coating', 'scalable'],
            image: '',
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
        },
        {
            id: 'sample-3',
            title: 'Passivation of grain boundaries by functionalized graphene quantum dots',
            title_cn: '功能化石墨烯量子点钝化晶界',
            authors: 'Liu, X.; Yang, Y.; Zhou, Q.',
            journal: 'Science',
            publish_date: '2024-02-10',
            doi: '10.1126/science.abq6872',
            abstract: 'Grain boundary passivation is a key strategy to reduce non-radiative recombination in perovskite solar cells.',
            abstract_cn: '晶界钝化是减少钙钛矿太阳能电池非辐射复合的关键策略。',
            category: 'mechanism',
            keywords: ['graphene quantum dot', 'grain boundary', 'passivation', 'recombination'],
            image: '',
            summary: 'Using functionalized graphene quantum dots as grain boundary passivating agents to significantly reduce carrier recombination.',
            summary_cn: '使用功能化石墨烯量子点作为晶界钝化剂，显著降低了载流子复合。',
            innovation: 'First application of functionalized graphene quantum dots for grain boundary passivation, opening new passivation strategies.',
            innovation_cn: '首次将功能化石墨烯量子点用于晶界钝化，开辟了新的钝化策略。',
            application: 'High-efficiency perovskite solar cells with reduced recombination losses.',
            application_cn: '高效钙钛矿太阳能电池',
            structure: '1. Introduction 2. GQDs Synthesis 3. Passivation Treatment 4. Characterization 5. Device Performance 6. Mechanism Discussion',
            structure_cn: '1.引言 2.GQDs合成 3.钝化处理 4.表征分析 5.器件性能 6.机理讨论',
            methods: 'TEM, PL mapping, KPFM, EIS, XPS',
            methods_cn: 'TEM、PL mapping、KPFM、EIS、XPS',
            source: 'sample'
        },
        {
            id: 'sample-4',
            title: 'Flexible perovskite solar cells with 23% efficiency',
            title_cn: '效率达23%的柔性钙钛矿太阳能电池',
            authors: 'Singh, R.; Kumar, A.; Sharma, P.',
            journal: 'Joule',
            publish_date: '2024-03-01',
            doi: '10.1016/j.joule.2024.01.015',
            abstract: 'Flexible perovskite solar cells hold great promise for portable electronics and wearable devices.',
            abstract_cn: '柔性钙钛矿太阳能电池在便携式电子产品和可穿戴设备方面具有巨大潜力。',
            category: 'application',
            keywords: ['flexible', 'wearable', 'bending stability', 'portable'],
            image: '',
            summary: 'Development of a novel perovskite ink formulation suitable for flexible substrates.',
            summary_cn: '开发了一种适用于柔性基底的新型钙钛矿墨水配方。',
            innovation: 'Achieved 23% efficiency in flexible perovskite cells while maintaining excellent bending stability.',
            innovation_cn: '实现了23%效率的柔性钙钛矿电池，并保持了优异的弯曲稳定性。',
            application: 'Flexible wearable electronic devices and portable power sources.',
            application_cn: '柔性可穿戴电子设备',
            structure: '1. Background 2. Material Design 3. Fabrication Process 4. Performance Testing 5. Stability Evaluation 6. Outlook',
            structure_cn: '1.背景 2.材料设计 3.制备工艺 4.性能测试 5.稳定性评估 6.展望',
            methods: 'SEM, AFM, XRD, Bending cycle test, J-V curves',
            methods_cn: 'SEM、AFM、XRD、弯曲循环测试、J-V曲线',
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
        // 分类筛选
        if (currentCategory && paper.category !== currentCategory) {
            return false;
        }

        // 期刊筛选
        if (currentJournal && paper.journal !== currentJournal) {
            return false;
        }

        // 搜索
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const searchableText = [
                paper.title,
                paper.title_cn,
                paper.authors,
                paper.journal,
                paper.keywords?.join(' '),
                paper.abstract
            ].filter(Boolean).join(' ').toLowerCase();

            return searchableText.includes(term);
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

    // 分页
    const totalPages = Math.ceil(filteredPapers.length / CONFIG.itemsPerPage);
    const startIndex = (currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = startIndex + CONFIG.itemsPerPage;
    const pagePapers = filteredPapers.slice(startIndex, endIndex);

    elements.papersGrid.innerHTML = pagePapers.map(paper => createPaperCard(paper)).join('');

    // 添加点击事件
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
        'synthesis': '合成',
        'characterization': '表征',
        'mechanism': '机理',
        'application': '应用',
        'industrial': '工业化',
        'custom': '自定义'
    };

    // 根据语言设置选择标题
    const title = getBilingualField(paper, 'title');
    const abstract = getBilingualField(paper, 'abstract');

    return `
        <div class="paper-card" data-id="${paper.id}">
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
 * 渲染分页
 */
function renderPagination(totalPages) {
    if (!elements.pagination) return;

    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }

    let html = '';

    // 上一页
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">←</button>`;

    // 页码
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

    // 下一页
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
 * @param {Object} paper - 文献对象
 * @param {string} field - 字段名（英文版）
 * @returns {string} 根据当前语言设置返回对应版本，无则返回另一个版本
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
    elements.langIndicator.textContent = displayLang === 'cn' ? '中文' : 'English';
    renderPapers();
}

/**
 * 详情模态框
 */
function openDetailModal(paperId) {
    const paper = papers.find(p => p.id === paperId);
    if (!paper) return;

    const categoryNames = {
        'synthesis': '合成',
        'characterization': '表征',
        'mechanism': '机理研究',
        'application': '应用',
        'industrial': '工业化',
        'custom': '自定义'
    };

    // 双语字段
    const title = getBilingualField(paper, 'title');
    const abstract = getBilingualField(paper, 'abstract');
    const summary = getBilingualField(paper, 'summary');
    const innovation = getBilingualField(paper, 'innovation');
    const application = getBilingualField(paper, 'application');
    const structure = getBilingualField(paper, 'structure');
    const methods = getBilingualField(paper, 'methods');

    // 双语标签
    const labels = displayLang === 'cn' ? {
        abstract: '摘要',
        summary: '工作总结',
        innovation: '主要创新点',
        application: '应用领域',
        structure: '文章脉络',
        methods: '表征技术与数据分析'
    } : {
        abstract: 'Abstract',
        summary: 'Summary',
        innovation: 'Key Innovation',
        application: 'Application',
        structure: 'Structure',
        methods: 'Methods & Analysis'
    };

    document.getElementById('detailModalTitle').textContent = title;

    const keywordsHtml = Array.isArray(paper.keywords) ?
        paper.keywords.map(k => `<span class="keyword-tag">${escapeHtml(k)}</span>`).join('') : '';

    const detailBody = document.getElementById('detailModalBody');
    detailBody.innerHTML = `
        <div class="paper-detail">
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

            <!-- 题图 -->
            ${paper.image ? `
            <div class="detail-section">
                <h4 class="detail-section-title">题图</h4>
                <img src="${escapeHtml(paper.image)}" alt="题图" class="detail-image">
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
            </div>
        </div>
    `;

    elements.detailModal.classList.remove('hidden');
}

function closeDetailModal() {
    elements.detailModal.classList.add('hidden');
}

/**
 * 导入模态框
 */
function openImportModal() {
    document.getElementById('importDoi').value = '';
    document.getElementById('doiResult').innerHTML = '';
    document.getElementById('pdfResult').innerHTML = '';
    document.getElementById('confirmImport').disabled = true;
    importData = {};
    elements.importModal.classList.remove('hidden');
}

function closeImportModal() {
    elements.importModal.classList.add('hidden');
}

function handleImportTypeChange(e) {
    const type = e.target.value;
    document.getElementById('doiImportField').classList.toggle('hidden', type !== 'doi');
    document.getElementById('pdfImportField').classList.toggle('hidden', type !== 'pdf');
    document.getElementById('jsonImportField').classList.toggle('hidden', type !== 'json');
    
    // 重置导入数据
    importData = {};
    document.getElementById('confirmImport').disabled = true;
}

async function fetchDoiPaper() {
    const doiInput = document.getElementById('importDoi').value.trim();
    if (!doiInput) {
        alert('请输入DOI');
        return;
    }

    // 提取DOI
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

        if (!response.ok) {
            throw new Error('获取失败');
        }

        const data = await response.json();
        const work = data.message;

        importData = {
            title: work.title?.[0] || '',
            authors: work.author?.map(a => `${a.family}, ${a.given}`).join('; ') || '',
            journal: work['container-title']?.[0] || '',
            publish_date: work.published?.['date-parts']?.[0] ? 
                work.published['date-parts'][0].join('-') : '',
            doi: doi,
            abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
            keywords: work.subject || [],
            vocabulary: []
        };

        // 检查摘要是否完整（DOI通常只能获取摘要）
        const abstractLength = importData.abstract.length;
        const hasShortAbstract = abstractLength < 500; // 摘要太短可能不完整

        // 如果没有勾选AI解析，提醒用户
        if (!useAI) {
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
                    <p style="font-weight: 600; color: #d97706;">⚠️ DOI导入通常只能获取摘要</p>
                    <p style="margin-top: 8px; color: var(--text-secondary);">
                        如需提取完整的文献卡片和词汇，请：
                    </p>
                    <ul style="margin-top: 8px; color: var(--text-secondary); padding-left: 20px;">
                        <li>勾选"使用AI深度解析"让AI分析摘要</li>
                        <li>或使用PDF导入上传完整文献</li>
                    </ul>
                </div>
                <div style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-top: 12px;">
                    <p style="font-weight: 600; color: var(--success-color);">已获取基本信息</p>
                    <p style="margin-top: 8px;"><strong>标题：</strong>${escapeHtml(importData.title)}</p>
                    <p style="margin-top: 4px;"><strong>作者：</strong>${escapeHtml(importData.authors)}</p>
                    <p style="margin-top: 4px;"><strong>期刊：</strong>${escapeHtml(importData.journal)}</p>
                    <p style="margin-top: 4px;"><strong>DOI：</strong>${escapeHtml(doi)}</p>
                    <p style="margin-top: 4px;"><strong>摘要：</strong>${abstractLength > 0 ? `${importData.abstract.substring(0, 200)}...` : '未获取到'}</p>
                </div>
            `;
            document.getElementById('confirmImport').disabled = false;
            btn.disabled = false;
            btn.textContent = '获取文献信息';
            return;
        }
        
        // 使用AI解析
        if (!isApiKeyConfigured()) {
            // 勾选了AI但没有配置API Key
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
                    <p style="font-weight: 600; color: #d97706;">⚠️ 尚未配置API Key</p>
                    <p style="margin-top: 8px;">请前往 <a href="settings.html" style="color: var(--primary-color);">设置页面</a> 配置API Key以启用AI深度解析。</p>
                    <p style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #d97706;">
                        <strong>已获取基本信息：</strong><br>
                        标题：${escapeHtml(importData.title)}<br>
                        作者：${escapeHtml(importData.authors)}
                    </p>
                </div>
            `;
            document.getElementById('confirmImport').disabled = false;
            btn.disabled = false;
            btn.textContent = '获取文献信息';
            return;
        }
        
        // 执行AI解析
        resultDiv.innerHTML = '<p class="text-muted">正在连接AI服务...</p>';
        btn.textContent = 'AI解析中...';
        
        try {
            const aiResult = await parsePaperWithAI(
                doi,
                importData.title,
                importData.abstract,
                (progress) => {
                    resultDiv.innerHTML = `<p class="text-muted">${progress}</p>`;
                }
            );
            
            // 合并AI解析结果
            importData = mergeWithBaseInfo(importData, aiResult);
            
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #f0fdf4; border-radius: 8px;">
                    <p style="font-weight: 600; color: var(--success-color);">✅ 成功获取并AI深度解析</p>
                    <p style="margin-top: 8px;"><strong>标题：</strong>${escapeHtml(importData.title)}</p>
                    <p style="margin-top: 4px;"><strong>中文标题：</strong>${escapeHtml(importData.title_cn || '（待翻译）')}</p>
                    <p style="margin-top: 4px;"><strong>作者：</strong>${escapeHtml(importData.authors)}</p>
                    <p style="margin-top: 4px;"><strong>期刊：</strong>${escapeHtml(importData.journal)}</p>
                    <details style="margin-top: 12px;">
                        <summary style="cursor: pointer; color: var(--primary-color);">查看AI解析详情</summary>
                        <div style="margin-top: 8px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 0.9rem;">
                            <p><strong>创新点：</strong>${escapeHtml(importData.innovation || '-')}</p>
                            <p style="margin-top: 8px;"><strong>工作总结：</strong>${escapeHtml(importData.summary || '-')}</p>
                            <p style="margin-top: 8px;"><strong>表征技术：</strong>${escapeHtml(importData.methods || '-')}</p>
                            <p style="margin-top: 8px;"><strong>分类：</strong>${escapeHtml(importData.category || '-')}</p>
                            ${importData.vocabulary && importData.vocabulary.length > 0 ? 
                                `<p style="margin-top: 8px;"><strong>提取词汇(${importData.vocabulary.length}个)：</strong>${importData.vocabulary.map(v => v.word).join(', ')}</p>` : ''}
                        </div>
                    </details>
                </div>
            `;
        } catch (aiError) {
            console.error('AI解析失败:', aiError);
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #fef3c7; border-radius: 8px;">
                    <p style="font-weight: 600; color: #d97706;">⚠️ DOI信息获取成功，但AI解析失败</p>
                    <p style="margin-top: 4px; color: var(--text-secondary);">${aiError.message}</p>
                    <p style="margin-top: 8px;">将使用基本信息导入，您可以稍后手动编辑补充。</p>
                </div>
                <div style="padding: 16px; background: #f0fdf4; border-radius: 8px; margin-top: 12px;">
                    <p style="font-weight: 600; color: var(--success-color);">已获取基本信息</p>
                    <p style="margin-top: 8px;"><strong>标题：</strong>${escapeHtml(importData.title)}</p>
                    <p style="margin-top: 4px;"><strong>作者：</strong>${escapeHtml(importData.authors)}</p>
                </div>
            `;
        }

        document.getElementById('confirmImport').disabled = false;

    } catch (error) {
        console.error('获取DOI信息失败:', error);
        resultDiv.innerHTML = `
            <div style="padding: 16px; background: #fef2f2; border-radius: 8px;">
                <p style="font-weight: 600; color: var(--error-color);">❌ 获取失败</p>
                <p class="text-muted mt-4">请检查DOI是否正确，或手动输入文献信息。</p>
            </div>
        `;
    }

    btn.disabled = false;
    btn.textContent = '获取文献信息';
}

async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const resultDiv = document.getElementById('pdfResult');
    const textArea = document.getElementById('pdfTextContent');
    
    resultDiv.innerHTML = '<p class="text-muted">📖 正在读取PDF...</p>';
    
    try {
        // 使用PDF.js读取PDF
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        
        // 读取所有页面
        for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) { // 最多读取20页
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        // 填充到文本框
        textArea.value = fullText.trim();
        
        resultDiv.innerHTML = `<p class="text-success">✅ 已提取 ${pdf.numPages} 页内容，可点击"解析PDF"进行AI分析</p>`;
        
    } catch (error) {
        console.error('PDF读取错误:', error);
        resultDiv.innerHTML = `<p class="text-danger">❌ PDF读取失败: ${error.message}。请手动复制文本内容。</p>`;
    }
}

async function parsePdfContent() {
    const textContent = document.getElementById('pdfTextContent')?.value || '';
    const category = document.getElementById('pdfCategory')?.value || 'custom';
    const useAI = document.getElementById('useAIParsePdf')?.checked;
    const resultDiv = document.getElementById('pdfResult');
    
    if (!textContent.trim()) {
        resultDiv.innerHTML = '<p class="text-danger">请先上传PDF或粘贴文本内容</p>';
        return;
    }
    
    resultDiv.innerHTML = '<p class="text-muted">🔄 正在解析...</p>';
    
    if (useAI) {
        // 使用AI解析
        if (typeof parsePaperWithAI !== 'function') {
            resultDiv.innerHTML = '<p class="text-danger">❌ AI解析模块未加载，请刷新页面重试</p>';
            return;
        }
        
        try {
            const aiResult = await parsePaperWithAI(textContent, 'pdf');
            
            if (aiResult.error) {
                resultDiv.innerHTML = `<p class="text-danger">❌ ${aiResult.error}</p>`;
                return;
            }
            
            // 保存解析结果
            importData = {
                title: aiResult.title || '',
                title_cn: aiResult.title_cn || aiResult.title || '',
                abstract: aiResult.abstract || textContent.substring(0, 500),
                abstract_cn: aiResult.abstract_cn || '',
                authors: aiResult.authors || '',
                journal: aiResult.journal || '',
                keywords: aiResult.keywords || [],
                summary: aiResult.summary || '',
                summary_cn: aiResult.summary_cn || '',
                innovation: aiResult.innovation || '',
                innovation_cn: aiResult.innovation_cn || '',
                application: aiResult.application || '',
                application_cn: aiResult.application_cn || '',
                structure: aiResult.structure || '',
                structure_cn: aiResult.structure_cn || '',
                methods: aiResult.methods || '',
                methods_cn: aiResult.methods_cn || '',
                vocabulary: aiResult.vocabulary || [],
                category: category,
                source: 'pdf'
            };
            
            // 显示预览
            resultDiv.innerHTML = `
                <div class="import-preview">
                    <h4>📄 解析结果预览</h4>
                    <p><strong>标题:</strong> ${importData.title}</p>
                    <p><strong>作者:</strong> ${importData.authors || '未提取'}</p>
                    <p><strong>关键词:</strong> ${(importData.keywords || []).join(', ') || '未提取'}</p>
                    <p><strong>创新点:</strong> ${(importData.innovation || '未提取').substring(0, 100)}...</p>
                    <p><strong>提取词汇:</strong> ${(importData.vocabulary || []).map(v => v.word).join(', ') || '无'}</p>
                    <p class="text-success mt-4">✅ 解析完成，可点击"确认导入"</p>
                </div>
            `;
            
            document.getElementById('confirmImport').disabled = false;
            
        } catch (error) {
            console.error('AI解析错误:', error);
            resultDiv.innerHTML = `<p class="text-danger">❌ 解析失败: ${error.message}</p>`;
        }
    } else {
        // 不使用AI，简单提取
        const lines = textContent.split('\n').filter(l => l.trim());
        const title = lines[0] || '未知标题';
        
        importData = {
            title: title,
            title_cn: '',
            abstract: textContent.substring(0, 2000),
            abstract_cn: '',
            authors: '',
            journal: '',
            keywords: [],
            category: category,
            source: 'pdf'
        };
        
        resultDiv.innerHTML = `
            <div class="import-preview">
                <h4>📄 内容预览</h4>
                <p><strong>标题:</strong> ${title}</p>
                <p class="text-muted">未使用AI解析，仅保存原文内容。如需提取详细信息，请勾选"使用AI深度解析"。</p>
                <p class="text-success mt-4">✅ 可点击"确认导入"</p>
            </div>
        `;
        
        document.getElementById('confirmImport').disabled = false;
    }
}

/**
 * JSON文件上传
 */
async function handleJsonFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const resultDiv = document.getElementById('jsonResult');
    resultDiv.innerHTML = '<p class="text-muted">正在读取文件...</p>';
    
    try {
        const text = await file.text();
        document.getElementById('jsonInput').value = text;
        parseJsonInput();
    } catch (error) {
        resultDiv.innerHTML = `<p class="text-danger">❌ 文件读取失败: ${error.message}</p>`;
    }
}

/**
 * 解析JSON输入（粘贴或文件）
 */
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
        // 尝试解析JSON
        let jsonData = JSON.parse(jsonInput.trim());
        
        // 如果是markdown代码块包裹的，尝试提取
        if (typeof jsonData === 'string') {
            const jsonMatch = jsonData.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonData = JSON.parse(jsonMatch[1]);
            }
        }
        
        // 验证必要字段
        if (!jsonData.title && !jsonData.title_cn) {
            resultDiv.innerHTML = '<p class="text-danger">JSON数据缺少标题字段</p>';
            return;
        }
        
        // 保存到importData
        importData = {
            title: jsonData.title || '',
            title_cn: jsonData.title_cn || '',
            authors: jsonData.authors || '',
            journal: jsonData.journal || '',
            publish_date: jsonData.publish_date || jsonData.date || '',
            doi: jsonData.doi || '',
            abstract: jsonData.abstract || '',
            abstract_cn: jsonData.abstract_cn || '',
            keywords: jsonData.keywords || [],
            summary: jsonData.summary || jsonData.work_summary || '',
            summary_cn: jsonData.summary_cn || jsonData.work_summary_cn || '',
            innovation: jsonData.innovation || jsonData.innovation_points || '',
            innovation_cn: jsonData.innovation_cn || jsonData.innovation_points_cn || '',
            application: jsonData.application || '',
            application_cn: jsonData.application_cn || '',
            structure: jsonData.structure || jsonData.argument_flow || '',
            structure_cn: jsonData.structure_cn || jsonData.argument_flow_cn || '',
            methods: jsonData.methods || jsonData.techniques || '',
            methods_cn: jsonData.methods_cn || jsonData.techniques_cn || '',
            category: jsonData.category || 'custom',
            vocabulary: jsonData.vocabulary || [],
            source: 'json_import'
        };
        
        // 显示预览
        resultDiv.innerHTML = `
            <div class="import-preview">
                <p><strong>标题:</strong> ${importData.title || importData.title_cn}</p>
                <p><strong>作者:</strong> ${importData.authors || '未提供'}</p>
                <p><strong>期刊:</strong> ${importData.journal || '未提供'}</p>
                <p><strong>DOI:</strong> ${importData.doi || '未提供'}</p>
                <p class="text-success">✅ 解析成功，可点击"确认导入"</p>
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
    const importType = document.querySelector('input[name="importType"]:checked').value;
    let category;

    if (importType === 'doi') {
        category = document.getElementById('importCategory').value;
    } else if (importType === 'pdf') {
        category = document.getElementById('pdfCategory').value;
    } else {
        // JSON导入，使用导入数据中的分类或默认
        category = importData.category || 'custom';
    }

    if (!importData.title && !importData.title_cn) {
        alert('请先解析文献信息');
        return;
    }

    const newPaper = {
        id: generateId(),
        title: importData.title || document.getElementById('paperTitle')?.value || '',
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
        source: 'import'
    };

    // 添加到列表
    papers.unshift(newPaper);

    // 保存
    await savePapers();

    // 如果有提取的词汇，提示用户
    if (newPaper.vocabulary && newPaper.vocabulary.length > 0) {
        const vocabCount = newPaper.vocabulary.length;
        const confirmMsg = `文献导入成功！\n\n已提取 ${vocabCount} 个专业词汇。\n是否需要将新词汇添加到词汇本？`;
        
        if (confirm(confirmMsg)) {
            // 获取已有词汇
            const existingVocab = JSON.parse(localStorage.getItem('vocabularyData') || '[]');
            
            // 已存在的词汇（包括已掌握的）
            const existingWords = new Set(existingVocab.map(v => (v.word || '').toLowerCase()));
            
            // 已掌握的词汇单独标记
            const masteredWords = new Set(
                existingVocab.filter(v => v.status === 'mastered').map(v => (v.word || '').toLowerCase())
            );
            
            // 过滤：排除已存在的词，特别排除已掌握的词
            const newWords = newPaper.vocabulary.filter(v => {
                const wordLower = (v.word || '').toLowerCase();
                return !existingWords.has(wordLower);
            });
            
            // 已掌握的词（如果有的话）
            const alreadyMastered = newPaper.vocabulary.filter(v => {
                const wordLower = (v.word || '').toLowerCase();
                return masteredWords.has(wordLower);
            });
            
            if (newWords.length > 0) {
                // 为新词汇设置默认状态为"新词"
                const wordsToAdd = newWords.map(w => ({
                    word: w.word || '',
                    word_cn: w.word_cn || '',
                    definition: w.definition || '',
                    definition_cn: w.definition_cn || '',
                    example: w.example || '',
                    category: category,
                    status: 'new',
                    added_date: new Date().toISOString(),
                    correct_count: 0,
                    error_count: 0,
                    phase_en_cn: false,
                    phase_cn_en: false,
                    phase_en_def: false,
                    phase_def_en: false,
                    last_practice: ''
                }));
                
                // 合并并保存
                const updatedVocab = [...wordsToAdd, ...existingVocab];
                localStorage.setItem('vocabularyData', JSON.stringify(updatedVocab));
                
                let msg = `已将 ${newWords.length} 个新词汇添加到词汇本！`;
                if (alreadyMastered.length > 0) {
                    msg += `\n\n有 ${alreadyMastered.length} 个词汇已在已掌握词库中，已跳过。`;
                }
                alert(msg);
            } else if (alreadyMastered.length > 0) {
                alert(`所有词汇都已在词汇本中（其中 ${alreadyMastered.length} 个已掌握），无需重复添加。`);
            } else {
                alert('这些词汇都已在词汇本中，无需重复添加。');
            }
        }
    }

    closeImportModal();
    filterPapers();

    alert('文献导入成功！');
}

async function savePapers() {
    localStorage.setItem('papersData', JSON.stringify(papers));
    updateJournalFilter();
}

/**
 * 编辑模态框
 */
function openEditModal(paperId = null) {
    const paper = paperId ? papers.find(p => p.id === paperId) : null;
    editingPaper = paper;

    document.getElementById('editModalTitle').textContent = paper ? '编辑文献' : '添加文献';
    document.getElementById('deletePaper').style.display = paper ? 'inline-flex' : 'none';

    if (paper) {
        document.getElementById('paperId').value = paper.id;
        document.getElementById('paperTitle').value = paper.title || '';
        document.getElementById('paperTitleCn').value = paper.title_cn || '';
        document.getElementById('paperAuthors').value = paper.authors || '';
        document.getElementById('paperJournal').value = paper.journal || '';
        document.getElementById('paperDate').value = paper.publish_date || '';
        document.getElementById('paperDoi').value = paper.doi || '';
        document.getElementById('paperAbstract').value = paper.abstract || '';
        document.getElementById('paperCategory').value = paper.category || 'custom';
        document.getElementById('paperKeywords').value = Array.isArray(paper.keywords) ? paper.keywords.join(', ') : '';
        document.getElementById('paperImage').value = paper.image || '';
        document.getElementById('paperSummary').value = paper.summary || '';
        document.getElementById('paperInnovation').value = paper.innovation || '';
        document.getElementById('paperApplication').value = paper.application || '';
        document.getElementById('paperStructure').value = paper.structure || '';
        document.getElementById('paperMethods').value = paper.methods || '';
    } else {
        document.getElementById('paperForm').reset();
        document.getElementById('paperId').value = '';
    }

    elements.editModal.classList.remove('hidden');
}

function closeEditModal() {
    elements.editModal.classList.add('hidden');
    editingPaper = null;
}

async function handlePaperSubmit(e) {
    e.preventDefault();

    const paperData = {
        id: document.getElementById('paperId').value || generateId(),
        title: document.getElementById('paperTitle').value,
        title_cn: document.getElementById('paperTitleCn').value,
        authors: document.getElementById('paperAuthors').value,
        journal: document.getElementById('paperJournal').value,
        publish_date: document.getElementById('paperDate').value,
        doi: document.getElementById('paperDoi').value,
        abstract: document.getElementById('paperAbstract').value,
        category: document.getElementById('paperCategory').value,
        keywords: document.getElementById('paperKeywords').value.split(',').map(k => k.trim()).filter(Boolean),
        image: document.getElementById('paperImage').value,
        summary: document.getElementById('paperSummary').value,
        innovation: document.getElementById('paperInnovation').value,
        application: document.getElementById('paperApplication').value,
        structure: document.getElementById('paperStructure').value,
        methods: document.getElementById('paperMethods').value,
        source: 'manual'
    };

    if (editingPaper) {
        // 更新
        const index = papers.findIndex(p => p.id === editingPaper.id);
        if (index !== -1) {
            papers[index] = { ...papers[index], ...paperData };
        }
    } else {
        // 新增
        papers.unshift(paperData);
    }

    await savePapers();
    closeEditModal();
    filterPapers();

    alert('保存成功！');
}

async function deletePaper() {
    if (!editingPaper) return;
    if (!confirm('确定要删除这篇文献吗？')) return;

    papers = papers.filter(p => p.id !== editingPaper.id);
    await savePapers();
    closeEditModal();
    filterPapers();

    alert('删除成功！');
}

/**
 * 检查URL参数
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const paperId = params.get('id');
    const action = params.get('action');
    const doi = params.get('doi');

    // 从周报跳转过来制作卡片
    if (action === 'import' && doi) {
        setTimeout(() => {
            openImportModal();
            // 填充DOI
            const doiInput = document.getElementById('importDoi');
            if (doiInput) {
                doiInput.value = doi;
                // 自动触发获取
                fetchDoiPaper();
            }
            // 清除URL参数
            window.history.replaceState({}, '', window.location.pathname);
        }, 300);
        return;
    }

    // 检查localStorage中是否有待处理的DOI
    const pendingDOI = localStorage.getItem('pendingPaperDOI');
    if (pendingDOI) {
        setTimeout(() => {
            openImportModal();
            const doiInput = document.getElementById('importDoi');
            if (doiInput) {
                doiInput.value = pendingDOI;
                fetchDoiPaper();
            }
            // 清除临时存储
            localStorage.removeItem('pendingPaperDOI');
            localStorage.removeItem('pendingPaperTitle');
        }, 300);
        return;
    }

    if (paperId) {
        setTimeout(() => {
            openDetailModal(paperId);
            // 清除URL参数
            window.history.replaceState({}, '', window.location.pathname);
        }, 500);
    }
}

/**
 * 工具函数
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
