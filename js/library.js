/**
 * library.js - 文献库模块
 * 管理所有文献，支持DOI/PDF导入，批量制作卡片
 */

// PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// 配置
const CONFIG = {
    libraryKey: 'libraryPapers',
    papersKey: 'papersData',
    CROSSREF_API: 'https://api.crossref.org/works/',
    journalsUrl: 'data/journals.json'
};

// 默认期刊列表
const DEFAULT_JOURNALS = [
    { name: 'Nature', category: 'top' },
    { name: 'Science', category: 'top' },
    { name: 'Nature Materials', category: 'top' },
    { name: 'Nature Energy', category: 'top' },
    { name: 'Nature Nanotechnology', category: 'top' },
    { name: 'Nature Photonics', category: 'top' },
    { name: 'Nature Communications', category: 'top' },
    { name: 'Science Advances', category: 'top' },
    { name: 'Advanced Materials', category: 'material' },
    { name: 'Energy & Environmental Science', category: 'material' },
    { name: 'Joule', category: 'material' },
    { name: 'Materials Horizons', category: 'material' },
    { name: 'Advanced Energy Materials', category: 'applied' },
    { name: 'Angewandte Chemie', category: 'applied' },
    { name: 'JACS', category: 'applied' },
    { name: 'Chemical Society Reviews', category: 'applied' },
    { name: 'Nano Energy', category: 'applied' },
    { name: 'ACS Materials Letters', category: 'applied' },
    { name: 'Materials Today', category: 'applied' },
    { name: 'Nano Letters', category: 'nanomaterial' },
    { name: 'ACS Nano', category: 'nanomaterial' },
    { name: 'Advanced Functional Materials', category: 'nanomaterial' },
    { name: 'Small', category: 'nanomaterial' },
    { name: 'Chemistry of Materials', category: 'nanomaterial' },
    { name: 'Journal of Materials Chemistry A', category: 'nanomaterial' },
    { name: 'Chem', category: 'energy' },
    { name: 'Energy Storage Materials', category: 'energy' },
    { name: 'Nano-Micro Letters', category: 'energy' },
    { name: 'ACS Energy Letters', category: 'energy' },
    { name: 'Solar RRL', category: 'other' },
    { name: 'Advanced Science', category: 'other' },
    { name: 'Scientific Reports', category: 'other' },
    { name: 'ACS Applied Energy Materials', category: 'other' }
];

// 状态
let libraryPapers = [];
let selectedPapers = new Set();
let journals = [...DEFAULT_JOURNALS];
let displayLang = 'cn';
let pendingPdfPaper = null;

// DOM加载
document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    loadJournals();
    initEventListeners();
    updateStats();
});

// 解决浏览器前进/后退缓存问题
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        loadLibrary();
    }
});

function initEventListeners() {
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
}

// 加载文献库
function loadLibrary() {
    const stored = localStorage.getItem(CONFIG.libraryKey);
    if (stored) {
        libraryPapers = JSON.parse(stored);
    } else {
        libraryPapers = [];
    }
    renderPaperList();
}

// 保存文献库
function saveLibrary() {
    localStorage.setItem(CONFIG.libraryKey, JSON.stringify(libraryPapers));
    updateStats();
}

// 加载期刊列表
async function loadJournals() {
    try {
        const res = await fetch(CONFIG.journalsUrl);
        if (res.ok) {
            journals = await res.json();
        }
    } catch (e) {
        console.log('使用默认期刊列表');
    }
    
    // 填充期刊选择器
    const select = document.getElementById('journalSelect');
    if (select) {
        select.innerHTML = '<option value="">全部期刊</option>' +
            journals.map(j => `<option value="${j.name}">${j.name}</option>`).join('');
    }
}

// 渲染文献列表
function renderPaperList() {
    const container = document.getElementById('paperList');
    const emptyState = document.getElementById('emptyState');
    
    // 获取筛选条件
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const searchTerm = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const thisWeekOnly = document.getElementById('thisWeekOnly')?.checked || false;
    
    // 筛选
    let filtered = libraryPapers.filter(paper => {
        // 状态筛选
        if (statusFilter === 'has_pdf' && !paper.hasPdf) return false;
        if (statusFilter === 'no_pdf' && paper.hasPdf) return false;
        if (statusFilter === 'has_card' && !paper.hasCard) return false;
        if (statusFilter === 'no_card' && paper.hasCard) return false;
        
        // 搜索
        if (searchTerm) {
            const title = (displayLang === 'cn' && paper.title_cn) ? paper.title_cn : paper.title;
            if (!title.toLowerCase().includes(searchTerm) && 
                !paper.doi.toLowerCase().includes(searchTerm)) {
                return false;
            }
        }
        
        // 本周
        if (thisWeekOnly) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            if (new Date(paper.addedAt) < weekAgo) return false;
        }
        
        return true;
    });
    
    // 排序（最新在前）
    filtered.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    container.innerHTML = filtered.map(paper => {
        const title = (displayLang === 'cn' && paper.title_cn) ? paper.title_cn : paper.title;
        
        return `
            <div class="paper-item" data-id="${paper.id}">
                <input type="checkbox" class="paper-checkbox" 
                    ${selectedPapers.has(paper.id) ? 'checked' : ''} 
                    onchange="toggleSelect('${paper.id}')">
                <div class="paper-info">
                    <div class="paper-title">${escapeHtml(title)}</div>
                    <div class="paper-meta">
                        <span>📖 ${escapeHtml(paper.journal || '未知期刊')}</span>
                        <span>📅 ${paper.publishDate || '未知日期'}</span>
                        <span>DOI: ${paper.doi}</span>
                    </div>
                </div>
                <div class="paper-actions">
                    <button class="btn btn-sm btn-outline" onclick="openDoi('${paper.doi}')">
                        🔗 原文
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="deletePaper('${paper.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 筛选
function filterPapers() {
    renderPaperList();
}

// 切换语言
function toggleLang() {
    displayLang = displayLang === 'cn' ? 'en' : 'cn';
    renderPaperList();
}

// 选择/取消选择
function toggleSelect(id) {
    if (selectedPapers.has(id)) {
        selectedPapers.delete(id);
    } else {
        selectedPapers.add(id);
    }
    updateBatchActions();
}

function selectAll() {
    const checkboxes = document.querySelectorAll('.paper-checkbox');
    const allSelected = selectedPapers.size === checkboxes.length;
    
    if (allSelected) {
        selectedPapers.clear();
    } else {
        checkboxes.forEach(cb => {
            const id = cb.closest('.paper-item').dataset.id;
            selectedPapers.add(id);
        });
    }
    
    renderPaperList();
    updateBatchActions();
}

function clearSelection() {
    selectedPapers.clear();
    renderPaperList();
    updateBatchActions();
}

function updateBatchActions() {
    const batchActions = document.getElementById('batchActions');
    const selectedCount = document.getElementById('selectedCount');
    const batchCardBtn = document.getElementById('batchCardBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    if (selectedPapers.size > 0) {
        batchActions.classList.add('active');
        selectedCount.textContent = `已选择 ${selectedPapers.size} 篇`;
        batchCardBtn.disabled = false;
        batchDeleteBtn.disabled = false;
    } else {
        batchActions.classList.remove('active');
        batchCardBtn.disabled = true;
        batchDeleteBtn.disabled = true;
    }
}

// 更新统计
function updateStats() {
    document.getElementById('totalCount').textContent = libraryPapers.length;
    document.getElementById('withPdfCount').textContent = libraryPapers.filter(p => p.hasPdf).length;
    document.getElementById('cardCount').textContent = libraryPapers.filter(p => p.hasCard).length;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('thisWeekCount').textContent = 
        libraryPapers.filter(p => new Date(p.addedAt) >= weekAgo).length;
}

// ===== DOI 导入 =====

// 打开DOI原文链接
function openDoi(doi) {
    if (doi) {
        window.open(`https://doi.org/${doi}`, '_blank');
    }
}

function openDoiImport() {
    document.getElementById('doiModal').classList.remove('hidden');
    document.getElementById('doiInput').value = '';
}

function closeDoiModal() {
    document.getElementById('doiModal').classList.add('hidden');
}

async function importDois() {
    const input = document.getElementById('doiInput').value.trim();
    if (!input) return;
    
    const lines = input.split('\n').map(l => l.trim()).filter(l => l);
    const autoFetchPdf = document.getElementById('autoFetchPdf').checked;
    
    let added = 0;
    for (const line of lines) {
        let doi = line;
        
        // 提取DOI
        if (line.includes('doi.org/')) {
            doi = line.split('doi.org/')[1].split(/[?\s]/)[0];
        } else if (line.startsWith('http')) {
            continue; // 跳过其他URL
        }
        
        // 检查是否已存在
        if (libraryPapers.find(p => p.doi === doi)) {
            console.log('DOI已存在:', doi);
            continue;
        }
        
        try {
            const paper = await fetchPaperByDoi(doi);
            if (paper) {
                paper.needPdfPrompt = autoFetchPdf;
                paper.pdfDeclined = false;
                libraryPapers.unshift(paper);
                added++;
            }
        } catch (e) {
            console.error('导入失败:', doi, e);
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    saveLibrary();
    renderPaperList();
    closeDoiModal();
    
    if (added > 0) {
        alert(`成功导入 ${added} 篇文献`);
    }
}

async function fetchPaperByDoi(doi) {
    const response = await fetch(`${CONFIG.CROSSREF_API}${doi}`, {
        headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error('DOI获取失败');
    
    const data = await response.json();
    const work = data.message;
    
    return {
        id: generateId(),
        doi: doi,
        title: work.title?.[0] || 'Unknown',
        title_cn: '',
        authors: work.author?.map(a => `${a.given} ${a.family}`).join(', ') || '',
        journal: work['container-title']?.[0] || '',
        publishDate: work.published?.['date-parts']?.[0]?.join('-') || '',
        abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
        abstract_cn: '',
        hasPdf: false,
        pdfContent: '',
        hasCard: false,
        needPdfPrompt: true,
        pdfDeclined: false,
        keywords: [],
        addedAt: new Date().toISOString(),
        source: 'doi'
    };
}

// ===== PDF 上传 =====

async function handlePdfUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (const file of files) {
        try {
            const content = await extractPdfText(file);
            const paper = await parsePdfContent(content, file.name);
            
            if (paper) {
                // 检查是否已存在
                const existing = libraryPapers.find(p => 
                    p.doi && p.doi === paper.doi
                );
                
                if (existing) {
                    // 更新现有记录
                    existing.hasPdf = true;
                    existing.pdfContent = content;
                    existing.pdfFile = file.name;
                } else {
                    paper.hasPdf = true;
                    paper.pdfContent = content;
                    paper.pdfFile = file.name;
                    libraryPapers.unshift(paper);
                }
            }
        } catch (e) {
            console.error('PDF处理失败:', file.name, e);
            alert(`PDF "${file.name}" 处理失败: ${e.message}`);
        }
    }
    
    saveLibrary();
    renderPaperList();
    event.target.value = '';
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
    }
    
    return text;
}

async function parsePdfContent(content, filename) {
    // 尝试从PDF内容提取DOI
    const doiMatch = content.match(/10\.\d{4,}\/[^\s]+/i);
    const doi = doiMatch ? doiMatch[0].replace(/[.)\],;]$/, '') : '';
    
    // 尝试提取标题（通常在前几行）
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    const title = lines[0]?.substring(0, 200) || filename.replace('.pdf', '');
    
    // 如果有DOI，尝试从CrossRef获取更多信息
    if (doi) {
        try {
            const paper = await fetchPaperByDoi(doi);
            paper.title = paper.title || title;
            paper.source = 'pdf';
            return paper;
        } catch (e) {
            console.log('DOI获取失败，使用PDF内容');
        }
    }
    
    return {
        id: generateId(),
        doi: doi,
        title: title,
        title_cn: '',
        authors: '',
        journal: '',
        publishDate: '',
        abstract: content.substring(0, 2000),
        abstract_cn: '',
        hasPdf: true,
        pdfContent: content,
        pdfFile: filename,
        hasCard: false,
        needPdfPrompt: false,
        pdfDeclined: false,
        keywords: [],
        addedAt: new Date().toISOString(),
        source: 'pdf'
    };
}

// PDF上传提示
function promptPdfUpload(paperId) {
    pendingPdfPaper = paperId;
    const paper = libraryPapers.find(p => p.id === paperId);
    
    document.getElementById('pdfConfirmTitle').textContent = 
        (displayLang === 'cn' && paper.title_cn) ? paper.title_cn : paper.title;
    document.getElementById('pdfConfirmDoi').textContent = paper.doi;
    document.getElementById('pdfConfirmModal').classList.remove('hidden');
}

function closePdfConfirmModal() {
    document.getElementById('pdfConfirmModal').classList.add('hidden');
    pendingPdfPaper = null;
}

async function confirmPdfUpload(event) {
    const file = event.target.files[0];
    if (!file || !pendingPdfPaper) return;
    
    const paper = libraryPapers.find(p => p.id === pendingPdfPaper);
    if (!paper) return;
    
    try {
        const content = await extractPdfText(file);
        paper.hasPdf = true;
        paper.pdfContent = content;
        paper.pdfFile = file.name;
        paper.needPdfPrompt = false;
        
        saveLibrary();
        renderPaperList();
        closePdfConfirmModal();
    } catch (e) {
        alert('PDF解析失败: ' + e.message);
    }
}

function declinePdfUpload() {
    if (pendingPdfPaper) {
        declinePdf(pendingPdfPaper);
    }
    closePdfConfirmModal();
}

function declinePdf(paperId) {
    const paper = libraryPapers.find(p => p.id === paperId);
    if (paper) {
        paper.pdfDeclined = true;
        paper.needPdfPrompt = false;
        saveLibrary();
        renderPaperList();
    }
}

// ===== 期刊追踪 =====

function openJournalTrack() {
    document.getElementById('trackModal').classList.remove('hidden');
}

function closeTrackModal() {
    document.getElementById('trackModal').classList.add('hidden');
    document.getElementById('trackProgress').style.display = 'none';
}

async function startTracking() {
    const journal = document.getElementById('journalSelect').value;
    const keywords = document.getElementById('keywordInput').value.trim();
    const dateRange = parseInt(document.getElementById('dateRange').value);
    
    // 显示进度
    document.getElementById('trackProgress').style.display = 'block';
    updateTrackProgress(0, '准备中...');
    
    const targetJournals = journal ? [journal] : journals.map(j => j.name);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - dateRange);
    
    const todayStr = today.toISOString().split('T')[0];
    const startStr = startDate.toISOString().split('T')[0];
    
    let newPapers = [];
    
    for (let i = 0; i < targetJournals.length; i++) {
        const journalName = targetJournals[i];
        updateTrackProgress((i / targetJournals.length) * 100, `正在检查: ${journalName}`);
        
        try {
            const papers = await searchJournal(journalName, keywords, startStr, todayStr);
            newPapers.push(...papers);
        } catch (e) {
            console.error('搜索失败:', journalName, e);
        }
        
        await new Promise(r => setTimeout(r, 300));
    }
    
    updateTrackProgress(100, '处理中...');
    
    // 过滤已存在的
    const existingDois = new Set(libraryPapers.map(p => p.doi));
    newPapers = newPapers.filter(p => !existingDois.has(p.doi));
    
    // 添加到文献库
    for (const paper of newPapers) {
        libraryPapers.unshift(paper);
    }
    
    saveLibrary();
    renderPaperList();
    closeTrackModal();
    
    if (newPapers.length > 0) {
        alert(`发现 ${newPapers.length} 篇新文献，已添加到文献库`);
    } else {
        alert('未发现新文献');
    }
}

async function searchJournal(journalName, keywords, startDate, endDate) {
    // 构建查询
    let query = journalName;
    if (keywords) {
        const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k);
        if (keywordList.length > 0) {
            query += ' AND (' + keywordList.join(' OR ') + ')';
        }
    }
    
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&filter=from-pub-date:${startDate},until-pub-date:${endDate}&rows=20&sort=published&order=desc`;
    
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.message?.items || []).map(item => ({
        id: generateId(),
        doi: item.DOI,
        title: item.title?.[0] || 'Unknown',
        title_cn: '',
        authors: item.author?.map(a => `${a.given} ${a.family}`).join(', ') || '',
        journal: item['container-title']?.[0] || journalName,
        publishDate: item.published?.['date-parts']?.[0]?.join('-') || '',
        abstract: item.abstract?.replace(/<[^>]*>/g, '') || '',
        abstract_cn: '',
        hasPdf: false,
        pdfContent: '',
        hasCard: false,
        needPdfPrompt: true,
        pdfDeclined: false,
        keywords: [],
        addedAt: new Date().toISOString(),
        source: 'tracked'
    }));
}

function updateTrackProgress(percent, status) {
    const bar = document.getElementById('trackProgressBar');
    const statusEl = document.getElementById('trackStatus');
    if (bar) bar.style.width = `${percent}%`;
    if (statusEl) statusEl.textContent = status;
}

// ===== 制作卡片 =====

function makeCard(paperId) {
    const paper = libraryPapers.find(p => p.id === paperId);
    if (!paper) return;
    
    // 存储到localStorage供papers页面使用
    localStorage.setItem('pendingLibraryPaper', JSON.stringify(paper));
    window.location.href = 'papers.html?action=makeCard';
}

function batchMakeCards() {
    if (selectedPapers.size === 0) return;
    
    const papers = libraryPapers.filter(p => selectedPapers.has(p.id) && !p.hasCard);
    if (papers.length === 0) {
        alert('没有可制作卡片的文献');
        return;
    }
    
    // 存储选中的文献
    localStorage.setItem('pendingBatchPapers', JSON.stringify(papers));
    window.location.href = 'papers.html?action=batchMakeCards';
}

// ===== 删除 =====

function deletePaper(paperId) {
    if (!confirm('确定要删除这篇文献吗？')) return;
    
    libraryPapers = libraryPapers.filter(p => p.id !== paperId);
    selectedPapers.delete(paperId);
    saveLibrary();
    renderPaperList();
    updateBatchActions();
}

function batchDelete() {
    if (selectedPapers.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedPapers.size} 篇文献吗？`)) return;
    
    libraryPapers = libraryPapers.filter(p => !selectedPapers.has(p.id));
    selectedPapers.clear();
    saveLibrary();
    renderPaperList();
    updateBatchActions();
}

// 查看详情
function viewPaper(paperId) {
    const paper = libraryPapers.find(p => p.id === paperId);
    if (!paper) return;
    
    alert(`标题: ${paper.title}\n\nDOI: ${paper.doi}\n\n期刊: ${paper.journal}\n\n日期: ${paper.publishDate}\n\n摘要: ${paper.abstract?.substring(0, 500)}...`);
}

// 工具函数
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
