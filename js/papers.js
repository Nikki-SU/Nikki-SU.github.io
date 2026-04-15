/**
 * papers.js - 文献卡片管理脚本（重构版）
 * 处理文献列表展示、筛选、详情查看、传入和编辑功能
 */

// 配置
const CONFIG = {
    papersUrl: 'data/papers.json',
    itemsPerPage: 9,
    STORAGE_KEY: 'papers_local',
    DOI_API_URL: 'https://api.crossref.org/works/'
};

// 状态
let papers = [];
let filteredPapers = [];
let currentPage = 1;
let currentCategory = '';
let currentPaperId = null;

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
    elements.importModal = document.getElementById('importModal');
    elements.editModal = document.getElementById('editModal');
    elements.uploadForm = document.getElementById('uploadForm');
    elements.importForm = document.getElementById('importForm');
    elements.editForm = document.getElementById('editForm');
    elements.importBtn = document.getElementById('importBtn');
    elements.uploadBtn = document.getElementById('uploadBtn');
    elements.closeModal = document.getElementById('closeModal');
    elements.closeUpload = document.getElementById('closeUpload');
    elements.closeImport = document.getElementById('closeImport');
    elements.closeEdit = document.getElementById('closeEdit');
    elements.cancelUpload = document.getElementById('cancelUpload');
    elements.cancelImport = document.getElementById('cancelImport');
    elements.cancelEdit = document.getElementById('cancelEdit');
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
    
    // 传入文献按钮
    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', openImportModal);
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
    if (elements.closeImport) {
        elements.closeImport.addEventListener('click', closeImportModal);
    }
    if (elements.closeEdit) {
        elements.closeEdit.addEventListener('click', closeEditModal);
    }
    if (elements.cancelUpload) {
        elements.cancelUpload.addEventListener('click', closeUploadModal);
    }
    if (elements.cancelImport) {
        elements.cancelImport.addEventListener('click', closeImportModal);
    }
    if (elements.cancelEdit) {
        elements.cancelEdit.addEventListener('click', closeEditModal);
    }
    
    // 表单提交
    if (elements.uploadForm) {
        elements.uploadForm.addEventListener('submit', handleUpload);
    }
    if (elements.importForm) {
        elements.importForm.addEventListener('submit', handleImport);
    }
    if (elements.editForm) {
        elements.editForm.addEventListener('submit', handleEdit);
    }
    
    // 点击背景关闭弹窗
    [elements.paperModal, elements.uploadModal, elements.importModal, elements.editModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAllModals();
                }
            });
        }
    });
}

/**
 * 检查URL参数
 */
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const paperId = params.get('id');
    
    if (paperId) {
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
        const local = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (local) {
            papers = JSON.parse(local);
        }
    }
    
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
            id: 'sample-1',
            title: 'Ionic engineering of perovskite films for efficient and stable solar cells',
            title_cn: '钙钛矿薄膜的离子工程以实现高效稳定太阳能电池',
            authors: 'Chen, Y.; Wang, L.; Zhang, M.',
            journal: 'Nature Energy',
            publish_date: '2024-01-15',
            doi: '10.1038/s41560-023-01401-2',
            abstract: 'We report a novel ionic engineering strategy to simultaneously improve the efficiency and stability of perovskite solar cells through controlled anion incorporation.',
            main_work: '开发了一种新型离子工程技术，通过引入特定的阴离子来调控钙钛矿薄膜的晶体结构和缺陷密度。',
            synthesis_method: '两步法：首先沉积PbI₂层，然后在含有所需阴离子的溶液中进行处理。',
            characterization: 'XRD、SEM、UV-vis、PL、TRPL',
            results: '实现了25.8%的光电转换效率，在85°C下运行1000小时后仍保持95%的初始效率。',
            conclusion: '该工作为同时提升钙钛矿太阳能电池效率和稳定性提供了新思路。',
            keywords: 'perovskite, solar cell, ionic engineering, stability',
            words: ['ionic', 'defect', 'crystallinity', 'passivation'],
            category: 'synthesis',
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
        if (currentCategory && paper.category !== currentCategory) {
            return false;
        }
        
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
    
    const totalPages = Math.ceil(filteredPapers.length / CONFIG.itemsPerPage);
    const startIndex = (currentPage - 1) * CONFIG.itemsPerPage;
    const endIndex = startIndex + CONFIG.itemsPerPage;
    const pagePapers = filteredPapers.slice(startIndex, endIndex);
    
    elements.papersGrid.innerHTML = pagePapers.map(paper => createPaperCard(paper)).join('');
    
    elements.papersGrid.querySelectorAll('.paper-card').forEach(card => {
        card.addEventListener('click', () => {
            const paperId = card.dataset.id;
            const paper = papers.find(p => p.id === paperId);
            if (paper) {
                showPaperDetail(paper);
            }
        });
    });
    
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
    currentPaperId = paper.id;
    
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
                <div class="detail-item full">
                    <span class="detail-label">摘要</span>
                    <span class="detail-value">${escapeHtml(paper.abstract)}</span>
                </div>
            ` : ''}
            
            ${paper.main_work ? `
                <div class="detail-item full">
                    <span class="detail-label">主要工作</span>
                    <span class="detail-value">${escapeHtml(paper.main_work)}</span>
                </div>
            ` : ''}
            
            ${paper.synthesis_method ? `
                <div class="detail-item full">
                    <span class="detail-label">合成方法</span>
                    <span class="detail-value">${escapeHtml(paper.synthesis_method)}</span>
                </div>
            ` : ''}
            
            ${paper.characterization ? `
                <div class="detail-item full">
                    <span class="detail-label">表征手段</span>
                    <span class="detail-value">${escapeHtml(paper.characterization)}</span>
                </div>
            ` : ''}
            
            ${paper.results ? `
                <div class="detail-item full">
                    <span class="detail-label">主要结果</span>
                    <span class="detail-value">${escapeHtml(paper.results)}</span>
                </div>
            ` : ''}
            
            ${paper.conclusion ? `
                <div class="detail-item full">
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
            
            <div class="detail-actions">
                <button class="btn btn-secondary" id="editPaperBtn">
                    ✏️ 编辑
                </button>
            </div>
        </div>
    `;
    
    // 编辑按钮事件
    document.getElementById('editPaperBtn').addEventListener('click', () => {
        openEditModal(paper);
    });
    
    elements.paperModal.classList.remove('hidden');
}

/**
 * 关闭详情弹窗
 */
function closeModal() {
    elements.paperModal.classList.add('hidden');
    currentPaperId = null;
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
 * 打开传入文献弹窗
 */
function openImportModal() {
    elements.importModal.classList.remove('hidden');
    elements.importForm.reset();
    document.getElementById('importTypeDoi').checked = true;
    toggleImportFields('doi');
}

/**
 * 关闭传入弹窗
 */
function closeImportModal() {
    elements.importModal.classList.add('hidden');
}

/**
 * 打开编辑弹窗
 */
function openEditModal(paper) {
    elements.editModal.classList.remove('hidden');
    
    // 填充表单
    document.getElementById('editId').value = paper.id;
    document.getElementById('editTitle').value = paper.title || '';
    document.getElementById('editTitleCn').value = paper.title_cn || '';
    document.getElementById('editAuthors').value = paper.authors || '';
    document.getElementById('editJournal').value = paper.journal || '';
    document.getElementById('editDate').value = paper.publish_date || '';
    document.getElementById('editDoi').value = paper.doi || '';
    document.getElementById('editAbstract').value = paper.abstract || '';
    document.getElementById('editMainWork').value = paper.main_work || '';
    document.getElementById('editSynthesisMethod').value = paper.synthesis_method || '';
    document.getElementById('editCharacterization').value = paper.characterization || '';
    document.getElementById('editResults').value = paper.results || '';
    document.getElementById('editConclusion').value = paper.conclusion || '';
    document.getElementById('editKeywords').value = paper.keywords || '';
    document.getElementById('editCategory').value = paper.category || 'custom';
}

/**
 * 关闭编辑弹窗
 */
function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

/**
 * 关闭所有弹窗
 */
function closeAllModals() {
    elements.paperModal?.classList.add('hidden');
    elements.uploadModal?.classList.add('hidden');
    elements.importModal?.classList.add('hidden');
    elements.editModal?.classList.add('hidden');
}

/**
 * 切换传入方式字段
 */
function toggleImportFields(type) {
    const doiField = document.getElementById('importDoiField');
    const pdfField = document.getElementById('importPdfField');
    
    if (type === 'doi') {
        doiField.classList.remove('hidden');
        pdfField.classList.add('hidden');
    } else {
        doiField.classList.add('hidden');
        pdfField.classList.remove('hidden');
    }
}

/**
 * 处理传入文献
 */
async function handleImport(e) {
    e.preventDefault();
    
    const importType = document.querySelector('input[name="importType"]:checked').value;
    
    if (importType === 'doi') {
        await handleDoiImport();
    } else {
        handlePdfImport();
    }
}

/**
 * 处理DOI导入
 */
async function handleDoiImport() {
    const doiInput = document.getElementById('importDoi').value.trim();
    
    if (!doiInput) {
        alert('请输入DOI');
        return;
    }
    
    // 提取DOI（支持 https://doi.org/xxx 和纯DOI格式）
    let doi = doiInput;
    if (doiInput.includes('doi.org/')) {
        doi = doiInput.split('doi.org/')[1];
    }
    
    // 显示加载状态
    const submitBtn = elements.importForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '正在获取...';
    
    try {
        const response = await fetch(CONFIG.DOI_API_URL + doi);
        
        if (!response.ok) {
            throw new Error('DOI未找到');
        }
        
        const data = await response.json();
        const work = data.message;
        
        // 解析文献信息
        const paper = {
            id: 'paper-' + Date.now(),
            title: work.title ? work.title[0] : '未知标题',
            title_cn: '',
            authors: work.author ? work.author.map(a => `${a.family}, ${a.given}`).join('; ') : '未知作者',
            journal: work['container-title'] ? work['container-title'][0] : '',
            publish_date: work.published ? (work.published['date-parts'][0] ? work.published['date-parts'][0].join('-') : '') : '',
            doi: doi,
            abstract: work.abstract ? work.abstract.replace(/<[^>]*>/g, '') : '',
            main_work: '',
            synthesis_method: '',
            characterization: '',
            results: '',
            conclusion: '',
            keywords: work.subject ? work.subject.join(', ') : '',
            category: 'custom',
            words: [],
            source: 'doi'
        };
        
        // 添加到数据
        papers.unshift(paper);
        savePapers();
        
        closeImportModal();
        filterPapers();
        updateStats();
        
        alert('文献导入成功！\n注意：DOI只能获取摘要，其他详细信息需要联系小科补充。');
        
    } catch (error) {
        console.error('DOI获取失败:', error);
        alert('DOI获取失败，请检查DOI是否正确或尝试手动上传PDF。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '确认传入';
    }
}

/**
 * 处理PDF导入（提示用户发送给AI）
 */
function handlePdfImport() {
    const pdfInput = document.getElementById('importPdf');
    
    if (!pdfInput.files || pdfInput.files.length === 0) {
        alert('请选择PDF文件');
        return;
    }
    
    const file = pdfInput.files[0];
    
    // 检查文件类型
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('请选择PDF文件');
        return;
    }
    
    closeImportModal();
    
    // 创建临时记录
    const tempPaper = {
        id: 'paper-' + Date.now(),
        title: file.name.replace('.pdf', ''),
        title_cn: '',
        authors: '',
        journal: '',
        publish_date: '',
        doi: '',
        abstract: '',
        main_work: '',
        synthesis_method: '',
        characterization: '',
        results: '',
        conclusion: '',
        keywords: '',
        category: 'custom',
        words: [],
        source: 'pdf-pending',
        pdf_name: file.name
    };
    
    papers.unshift(tempPaper);
    savePapers();
    filterPapers();
    
    alert(`PDF文件 "${file.name}" 已暂存。\n\n请将PDF发送给"小科"进行解析处理。\n解析完成后文献信息将自动更新。`);
}

/**
 * 处理上传（手动填写）
 */
function handleUpload(e) {
    e.preventDefault();
    
    const paper = {
        id: 'paper-' + Date.now(),
        title: document.getElementById('paperTitle').value.trim(),
        title_cn: document.getElementById('paperTitleCn').value.trim(),
        authors: document.getElementById('paperAuthors').value.trim(),
        journal: document.getElementById('paperJournal').value.trim(),
        publish_date: document.getElementById('paperDate').value,
        doi: document.getElementById('paperDoi').value.trim(),
        abstract: document.getElementById('paperAbstract').value.trim(),
        keywords: document.getElementById('paperKeywords').value.trim(),
        category: document.getElementById('paperCategory').value,
        main_work: '',
        synthesis_method: '',
        characterization: '',
        results: '',
        conclusion: '',
        words: [],
        source: 'manual'
    };
    
    papers.unshift(paper);
    savePapers();
    
    closeUploadModal();
    filterPapers();
    updateStats();
    
    alert('文献添加成功！\n提示：本地添加的文献需要联系小科同步到云端。');
}

/**
 * 处理编辑
 */
function handleEdit(e) {
    e.preventDefault();
    
    const paperId = document.getElementById('editId').value;
    const paperIndex = papers.findIndex(p => p.id === paperId);
    
    if (paperIndex === -1) {
        alert('文献未找到');
        return;
    }
    
    // 更新文献信息
    const updatedPaper = {
        ...papers[paperIndex],
        title: document.getElementById('editTitle').value.trim(),
        title_cn: document.getElementById('editTitleCn').value.trim(),
        authors: document.getElementById('editAuthors').value.trim(),
        journal: document.getElementById('editJournal').value.trim(),
        publish_date: document.getElementById('editDate').value,
        doi: document.getElementById('editDoi').value.trim(),
        abstract: document.getElementById('editAbstract').value.trim(),
        main_work: document.getElementById('editMainWork').value.trim(),
        synthesis_method: document.getElementById('editSynthesisMethod').value.trim(),
        characterization: document.getElementById('editCharacterization').value.trim(),
        results: document.getElementById('editResults').value.trim(),
        conclusion: document.getElementById('editConclusion').value.trim(),
        keywords: document.getElementById('editKeywords').value.trim(),
        category: document.getElementById('editCategory').value,
        updated_at: new Date().toISOString()
    };
    
    papers[paperIndex] = updatedPaper;
    savePapers();
    
    closeEditModal();
    closeModal();
    filterPapers();
    
    alert('文献编辑成功！\n提示：本地编辑的内容需要联系小科同步到云端。');
}

/**
 * 保存文献到localStorage
 */
function savePapers() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(papers));
}

/**
 * 更新统计
 */
function updateStats() {
    const paperCountEl = document.getElementById('paperCount');
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
