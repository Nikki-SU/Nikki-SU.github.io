/**
 * papers.js - 文献卡片管理脚本
 * 处理文献列表展示、筛选、详情查看和上传功能
 */

// 配置
const CONFIG = {
    papersUrl: 'data/papers.json',
    itemsPerPage: 9,
    STORAGE_KEY: 'papers_local'
};

// 状态
let papers = [];
let filteredPapers = [];
let currentPage = 1;
let currentCategory = '';

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadPapers();
    checkUrlParams();
});

/**
 * 初始化DOM元素引用
 */
function initElements() {
    elements.papersGrid = document.getElementById('papersGrid');
    elements.pagination = document.getElementById('pagination');
    elements.categoryFilter = document.getElementById('categoryFilter');
    elements.searchPapers = document.getElementById('searchPapers');
    elements.paperModal = document.getElementById('paperModal');
    elements.uploadModal = document.getElementById('uploadModal');
    elements.uploadForm = document.getElementById('uploadForm');
    elements.uploadBtn = document.getElementById('uploadBtn');
    elements.closeModal = document.getElementById('closeModal');
    elements.closeUpload = document.getElementById('closeUpload');
    elements.cancelUpload = document.getElementById('cancelUpload');
    elements.modalTitle = document.getElementById('modalTitle');
    elements.modalBody = document.getElementById('modalBody');
}

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 分类筛选
    if (elements.categoryFilter) {
        elements.categoryFilter.addEventListener('change', (e) => {
            currentCategory = e.target.value;
            currentPage = 1;
            filterPapers();
        });
    }
    
    // 搜索
    if (elements.searchPapers) {
        elements.searchPapers.addEventListener('input', debounce(filterPapers, 300));
    }
    
    // 上传按钮
    if (elements.uploadBtn) {
        elements.uploadBtn.addEventListener('click', openUploadModal);
    }
    
    // 关闭弹窗
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', closeModal);
    }
    if (elements.closeUpload) {
        elements.closeUpload.addEventListener('click', closeUploadModal);
    }
    if (elements.cancelUpload) {
        elements.cancelUpload.addEventListener('click', closeUploadModal);
    }
    
    // 上传表单
    if (elements.uploadForm) {
        elements.uploadForm.addEventListener('submit', handleUpload);
    }
    
    // 点击背景关闭弹窗
    if (elements.paperModal) {
        elements.paperModal.addEventListener('click', (e) => {
            if (e.target === elements.paperModal) closeModal();
        });
    }
    if (elements.uploadModal) {
        elements.uploadModal.addEventListener('click', (e) => {
            if (e.target === elements.uploadModal) closeUploadModal();
        });
    }
}

/**
 * 检查URL参数
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const paperId = params.get('id');
    
    if (paperId) {
        // 延迟执行，等待数据加载
        setTimeout(() => {
            const paper = papers.find(p => p.id === paperId);
            if (paper) {
                showPaperDetail(paper);
            }
        }, 500);
    }
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
        console.error('加载文献数据失败:', error);
        // 尝试从localStorage加载
        const local = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (local) {
            papers = JSON.parse(local);
        }
    }
    
    // 如果还是没有数据，使用示例数据
    if (papers.length === 0) {
        papers = getSamplePapers();
    }
    
    filterPapers();
    updateStats();
}

/**
 * 获取示例文献数据
 */
function getSamplePapers() {
    return [
        {
            id: '1',
            title: 'Ionic engineering of perovskite films for efficient and stable solar cells',
            title_cn: '钙钛矿薄膜的离子工程以实现高效稳定太阳能电池',
            authors: 'Chen, Y.; Wang, L; Zhang, M.',
            journal: 'Nature Energy',
            publish_date: '2024-01-15',
            doi: '10.1038/s41560-023-01401-2',
            abstract: 'We report a novel ionic engineering strategy to simultaneously improve the efficiency and stability of perovskite solar cells...',
            main_work: '开发了一种新型离子工程技术，通过引入特定的阴离子来调控钙钛矿薄膜的晶体结构和缺陷密度。',
            synthesis_method: '两步法：首先沉积PbI₂层，然后在含有所需阴离子的溶液中进行处理。',
            characterization: 'XRD、SEM、UV-vis、PL、TRPL',
            results: '实现了25.8%的光电转换效率，在85°C下运行1000小时后仍保持95%的初始效率。',
            conclusion: '该工作为同时提升钙钛矿太阳能电池效率和稳定性提供了新思路。',
            keywords: 'perovskite, solar cell, ionic engineering, stability',
            category: 'synthesis',
            words: ['ionic', 'defect', 'crystallinity', 'passivation'],
            source: 'auto'
        },
        {
            id: '2',
            title: 'In-situ GIWAXS study of perovskite crystallization during blade coating',
            title_cn: '原位GIWAXS研究刮刀涂布过程中钙钛矿的结晶过程',
            authors: 'Kim, S.; Park, J.; Lee, H.',
            journal: 'Advanced Materials',
            publish_date: '2023-12-20',
            doi: '10.1002/adma.202306789',
            abstract: 'Understanding the crystallization kinetics of perovskite films is crucial for scalable manufacturing...',
            main_work: '利用原位GIWAXS技术实时观测刮刀涂布过程中钙钛矿的结晶动态。',
            synthesis_method: '刮刀涂布法，结合热退火处理。',
            characterization: 'GIWAXS, XRD, SEM, in-situ optical microscopy',
            results: '揭示了溶剂挥发速率对晶体取向和晶粒大小的调控规律。',
            conclusion: '为大面积钙钛矿薄膜的可控制备提供了理论基础。',
            keywords: 'GIWAXS, blade coating, crystallization, scalable',
            category: 'characterization',
            words: ['crystallization', 'GIWAXS', 'in-situ', 'kinetics'],
            source: 'auto'
        },
        {
            id: '3',
            title: 'Passivation of grain boundaries by functionalized graphene quantum dots',
            title_cn: '功能化石墨烯量子点钝化晶界',
            authors: 'Liu, X.; Yang, Y.; Zhou, Q.',
            journal: 'Science',
            publish_date: '2024-02-10',
            doi: '10.1126/science.abq6872',
            abstract: 'Grain boundary passivation is a key strategy to reduce non-radiative recombination in perovskite solar cells...',
            main_work: '使用功能化石墨烯量子点作为晶界钝化剂，显著降低了载流子复合。',
            synthesis_method: '热注入法合成石墨烯量子点，后处理钝化。',
            characterization: 'TEM, PL mapping, KPFM, EIS',
            results: '开路电压提升了80mV，效率达到26.2%。',
            conclusion: '石墨烯量子点是一种有效的晶界钝化材料。',
            keywords: 'graphene quantum dot, grain boundary, passivation',
            category: 'mechanism',
            words: ['passivation', 'grain boundary', 'recombination', 'quantum dot'],
            source: 'auto'
        }
    ];
}

/**
 * 筛选文献
 */
function filterPapers() {
    const searchTerm = elements.searchPapers?.value.toLowerCase() || '';
    
    filteredPapers = papers.filter(paper => {
        // 分类筛选
        if (currentCategory && paper.category !== currentCategory) {
            return false;
        }
        
        // 搜索筛选
        if (searchTerm) {
            const searchableText = [
                paper.title,
                paper.title_cn,
                paper.authors,
                paper.journal,
                paper.keywords,
                paper.abstract
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        }
        
        return true;
    });
    
    renderPapers();
}

/**
 * 渲染文献列表
 */
function renderPapers() {
    if (!elements.papersGrid) return;
    
    if (filteredPapers.length === 0) {
        elements.papersGrid.innerHTML = '<p class="empty-message">没有找到匹配的文献</p>';
        elements.pagination.innerHTML = '';
        return;
    }
    
    // 分页计算
    const totalPages = Math.ceil(filteredPapers.length / CONFIG.itemsPerPage);
    const startIndex = (currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = startIndex + CONFIG.itemsPerPage;
    const pagePapers = filteredPapers.slice(startIndex, endIndex);
    
    // 渲染卡片
    elements.papersGrid.innerHTML = pagePapers.map(paper => createPaperCard(paper)).join('');
    
    // 添加点击事件
    elements.papersGrid.querySelectorAll('.paper-card').forEach(card => {
        card.addEventListener('click', () => {
            const paperId = card.dataset.id;
            const paper = papers.find(p => p.id === paperId);
            if (paper) {
                showPaperDetail(paper);
            }
        });
    });
    
    // 渲染分页
    renderPagination(totalPages);
}

/**
 * 创建文献卡片HTML
 */
function createPaperCard(paper) {
    const categoryNames = {
        synthesis: '合成',
        characterization: '表征',
        mechanism: '机理',
        application: '应用',
        custom: '自定义'
    };
    
    return `
        <div class="paper-card" data-id="${paper.id || ''}">
            <span class="paper-category">${categoryNames[paper.category] || '未分类'}</span>
            <h4 class="paper-title">${escapeHtml(paper.title || '无标题')}</h4>
            <p class="paper-authors">${escapeHtml(paper.authors || '未知作者')}</p>
            <div class="paper-meta">
                <span>${escapeHtml(paper.journal || '未知期刊')}</span>
                <span>${paper.publish_date || ''}</span>
            </div>
            ${paper.abstract ? `<p class="paper-abstract">${escapeHtml(paper.abstract)}</p>` : ''}
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
    
    let html = `
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">上一页</button>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页</button>`;
    
    elements.pagination.innerHTML = html;
    
    // 添加点击事件
    elements.pagination.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page)) {
                currentPage = page;
                renderPapers();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

/**
 * 显示文献详情
 */
function showPaperDetail(paper) {
    const categoryNames = {
        synthesis: '合成',
        characterization: '表征',
        mechanism: '机理',
        application: '应用',
        custom: '自定义'
    };
    
    elements.modalTitle.textContent = paper.title;
    
    elements.modalBody.innerHTML = `
        <div class="paper-detail">
            ${paper.title_cn ? `
                <div class="detail-item">
                    <span class="detail-label">中文标题</span>
                    <span class="detail-value">${escapeHtml(paper.title_cn)}</span>
                </div>
            ` : ''}
            
            <div class="detail-item">
                <span class="detail-label">作者</span>
                <span class="detail-value">${escapeHtml(paper.authors || '未知')}</span>
            </div>
            
            <div class="detail-item">
                <span class="detail-label">期刊</span>
                <span class="detail-value">${escapeHtml(paper.journal || '未知')} ${paper.publish_date ? `(${paper.publish_date})` : ''}</span>
            </div>
            
            ${paper.doi ? `
                <div class="detail-item">
                    <span class="detail-label">DOI</span>
                    <span class="detail-value"><a href="https://doi.org/${paper.doi}" target="_blank">${escapeHtml(paper.doi)}</a></span>
                </div>
            ` : ''}
            
            <div class="detail-item">
                <span class="detail-label">分类</span>
                <span class="detail-value">${categoryNames[paper.category] || '未分类'}</span>
            </div>
            
            ${paper.keywords ? `
                <div class="detail-item">
                    <span class="detail-label">关键词</span>
                    <span class="detail-value">${escapeHtml(paper.keywords)}</span>
                </div>
            ` : ''}
            
            ${paper.abstract ? `
                <div class="detail-item">
                    <span class="detail-label">摘要</span>
                    <span class="detail-value">${escapeHtml(paper.abstract)}</span>
                </div>
            ` : ''}
            
            ${paper.main_work ? `
                <div class="detail-item">
                    <span class="detail-label">主要工作</span>
                    <span class="detail-value">${escapeHtml(paper.main_work)}</span>
                </div>
            ` : ''}
            
            ${paper.synthesis_method ? `
                <div class="detail-item">
                    <span class="detail-label">合成方法</span>
                    <span class="detail-value">${escapeHtml(paper.synthesis_method)}</span>
                </div>
            ` : ''}
            
            ${paper.characterization ? `
                <div class="detail-item">
                    <span class="detail-label">表征方法</span>
                    <span class="detail-value">${escapeHtml(paper.characterization)}</span>
                </div>
            ` : ''}
            
            ${paper.results ? `
                <div class="detail-item">
                    <span class="detail-label">主要结果</span>
                    <span class="detail-value">${escapeHtml(paper.results)}</span>
                </div>
            ` : ''}
            
            ${paper.conclusion ? `
                <div class="detail-item">
                    <span class="detail-label">结论</span>
                    <span class="detail-value">${escapeHtml(paper.conclusion)}</span>
                </div>
            ` : ''}
            
            ${paper.words && paper.words.length > 0 ? `
                <div class="detail-item">
                    <span class="detail-label">关联词汇</span>
                    <span class="detail-value">${paper.words.map(w => escapeHtml(w)).join(', ')}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    elements.paperModal.classList.remove('hidden');
}

/**
 * 关闭详情弹窗
 */
function closeModal() {
    elements.paperModal.classList.add('hidden');
}

/**
 * 打开上传弹窗
 */
function openUploadModal() {
    elements.uploadModal.classList.remove('hidden');
    elements.uploadForm.reset();
}

/**
 * 关闭上传弹窗
 */
function closeUploadModal() {
    elements.uploadModal.classList.add('hidden');
}

/**
 * 处理上传
 */
function handleUpload(e) {
    e.preventDefault();
    
    const paper = {
        id: Date.now().toString(),
        title: document.getElementById('paperTitle').value.trim(),
        title_cn: document.getElementById('paperTitleCn').value.trim(),
        authors: document.getElementById('paperAuthors').value.trim(),
        journal: document.getElementById('paperJournal').value.trim(),
        publish_date: document.getElementById('paperDate').value,
        doi: document.getElementById('paperDoi').value.trim(),
        abstract: document.getElementById('paperAbstract').value.trim(),
        keywords: document.getElementById('paperKeywords').value.trim(),
        category: document.getElementById('paperCategory').value,
        source: 'upload',
        words: []
    };
    
    // 添加到数据
    papers.unshift(paper);
    
    // 保存到localStorage
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(papers));
    
    // 关闭弹窗并刷新
    closeUploadModal();
    filterPapers();
    updateStats();
    
    alert('文献添加成功！');
}

/**
 * 更新统计
 */
function updateStats() {
    // 更新首页统计
    const paperCountEl = parent.document.getElementById('paperCount');
    if (paperCountEl) {
        paperCountEl.textContent = papers.length;
    }
}

/**
 * 工具函数
 */
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
