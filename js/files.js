
// ============== 紧急编码修复 ==============
// 问题根源：UTF-8字符串被错误地按Latin-1解码
// 修复原理：检测到乱码特征时，将字符串按Latin-1编码，再按UTF-8解码
(function() {
    function fixUTF8(str) {
        if (!str || typeof str !== 'string') return str;
        // 检测UTF-8乱码的特征字节
        if (/[ÃÂâäáéíóúàèìòù]/.test(str)) {
            try {
                // 将乱码字符串按Latin-1编码为字节，再按UTF-8解码
                return decodeURIComponent(escape(str));
            } catch(e) {
                return str;
            }
        }
        return str;
    }
    
    function fixObject(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) {
            return obj.map(item => fixObject(item));
        }
        const result = {};
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                result[key] = fixUTF8(obj[key]);
            } else if (typeof obj[key] === 'object') {
                result[key] = fixObject(obj[key]);
            } else {
                result[key] = obj[key];
            }
        }
        return result;
    }
    
    // 保存原始的Storage.get
    const originalGet = Storage.get;
    
    // 覆盖Storage.get，自动修复所有数据的编码
    Storage.get = function(key, defaultValue) {
        const value = originalGet.call(this, key, defaultValue);
        return fixObject(value);
    };
    
    // 立即修复所有localStorage中的数据
    const keys = ['libraryPapers', 'papersData', 'vocabularyData', 'abstractTranslationData', 'categoriesData', 'tagsData'];
    keys.forEach(key => {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                const fixed = fixObject(parsed);
                localStorage.setItem(key, JSON.stringify(fixed));
            }
        } catch(e) {
            console.error('修复失败:', key, e);
        }
    });
    
    console.log('✅ 紧急编码修复已应用');
})();
// ============== 编码修复结束 ==============


// 修复UTF-8被错误解码为Latin-1的乱码问题
function fixEncoding(str) {
    if (!str || typeof str !== 'string') return str;
    try {
        // 检测是否包含典型的UTF-8乱码字符
        if (str.indexOf('Ã') !== -1 || str.indexOf('Â') !== -1 || str.indexOf('â') !== -1 || str.indexOf('©') !== -1) {
            // 将字符串按Latin-1编码，再按UTF-8解码
            return decodeURIComponent(escape(str));
        }
        return str;
    } catch (e) {
        return str;
    }
}

// 递归修复对象中所有字符串的编码
function fixObjectEncoding(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => fixObjectEncoding(item));
    }
    const result = {};
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            result[key] = fixEncoding(obj[key]);
        } else if (typeof obj[key] === 'object') {
            result[key] = fixObjectEncoding(obj[key]);
        } else {
            result[key] = obj[key];
        }
    }
    return result;
}

// 修复localStorage中所有数据的编码
function fixAllStorageEncoding() {
    try {
        const keys = ['categoriesData', 'tagsData'];
        for (const key of keys) {
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                const fixed = fixObjectEncoding(parsed);
                localStorage.setItem(key, JSON.stringify(fixed));
            }
        }
    } catch (e) {
        console.error('修复编码失败:', e);
    }
}


/**
 * files.js - 文件管理页面逻辑（重构版）
 */

let currentLang = 'cn';
let currentCategory = null;
let currentTag = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    // 先修复localStorage中的编码问题
    fixAllStorageEncoding();
    // 初始化预置分类
    CategoriesStore.initPresetCategories();
    
    // 加载分类列表
    loadCategories();
    
    // 语言切换
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentLang = btn.dataset.lang;
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCategoryList();
            renderDataList();
        });
    });
    
    // 搜索功能
    document.getElementById('searchInput').addEventListener('input', debounce((e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query) {
            searchAll(query);
        } else {
            renderDataList();
        }
    }, 300));
});

// 加载分类列表
function loadCategories() {
    renderCategoryList();
}

// 渲染分类列表
function renderCategoryList() {
    const container = document.getElementById('categoryList');
    const categories = CategoriesStore.getAll();
    const tags = TagsStore.getAll();
    
    let html = '';
    
    // 渲染分类
    categories.forEach(category => {
        const categoryTags = TagsStore.getByCategory(category.id);
        const categoryItems = category.itemIds || [];
        const count = categoryTags.length + categoryItems.length;
        
        html += `
            <div class="category-item">
                <div class="category-header" onclick="toggleCategory('${category.id}')" oncontextmenu="openEditCategoryModal('${category.id}', event)">
                    <span class="category-toggle" id="toggle-${category.id}">▶</span>
                    <span class="category-name">${escapeHtml(fixEncoding(typeof category.name === 'object' ? (category.name.cn || category.name.en || JSON.stringify(category.name)) : category.name))}</span>
                    <span class="category-count">${count}</span>
                </div>
                <div class="tags-list" id="tags-${category.id}">
                    ${categoryTags.map(tag => renderTagItem(tag)).join('')}
                </div>
            </div>
        `;
    });
    
    // 渲染未分类标签
    const uncategorizedTags = TagsStore.getUncategorized();
    if (uncategorizedTags.length > 0) {
        html += `
            <div class="uncategorized-tags">
                <div class="uncategorized-title">未分类标签 (${uncategorizedTags.length})</div>
                ${uncategorizedTags.map(tag => renderTagItem(tag)).join('')}
            </div>
        `;
    }
    
    // 添加标签按钮
    html += `
        <div style="margin-top: 16px; text-align: center;">
            <button class="btn btn-secondary" onclick="openAddTagModal()">+ 添加标签</button>
        </div>
    `;
    
    container.innerHTML = html;
}

// 渲染标签项
function renderTagItem(tag) {
    const displayName = currentLang === 'cn' ? (tag.nameCn || tag.nameEn) : (tag.nameEn || tag.nameCn);
    const sourceLabel = {
        'keyword': '关键词',
        'method': '表征技术',
        'custom': '自定义'
    }[tag.source] || tag.source;
    
    return `
        <div class="tag-item ${currentTag === tag.id ? 'active' : ''}" 
             onclick="selectTag('${tag.id}')" 
             oncontextmenu="openEditTagModal('${tag.id}', event)">
            <span class="tag-name">${escapeHtml(fixEncoding(typeof displayName === 'object' ? (displayName.cn || displayName.en || JSON.stringify(displayName)) : displayName))}</span>
            <span class="tag-source">${sourceLabel}</span>
        </div>
    `;
}

// 展开/折叠分类
function toggleCategory(categoryId) {
    const tagsEl = document.getElementById(`tags-${categoryId}`);
    const toggleEl = document.getElementById(`toggle-${categoryId}`);
    
    if (tagsEl.classList.contains('expanded')) {
        tagsEl.classList.remove('expanded');
        toggleEl.classList.remove('expanded');
    } else {
        tagsEl.classList.add('expanded');
        toggleEl.classList.add('expanded');
    }
}

// 选择标签
function selectTag(tagId) {
    currentTag = tagId;
    currentCategory = null;
    renderCategoryList();
    renderDataList();
}

// 渲染数据列表
function renderDataList() {
    const container = document.getElementById('dataList');
    
    if (currentTag) {
        renderDataByTag(currentTag);
    } else if (currentCategory) {
        renderDataByCategory(currentCategory);
    } else {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <p>选择左侧分类或标签查看相关数据</p>
            </div>
        `;
    }
}

// 按标签渲染数据（分类型显示）
function renderDataByTag(tagId) {
    const tag = TagsStore.getById(tagId);
    if (!tag) return;
    
    // 去重后的数据
    const papers = PapersStore.getAll().filter(p => p.tagIds && [...new Set(p.tagIds)].includes(tagId));
    const library = LibraryStore.getAll().filter(p => p.tagIds && [...new Set(p.tagIds)].includes(tagId));
    
    const displayName = currentLang === 'cn' ? (tag.nameCn || tag.nameEn) : (tag.nameEn || tag.nameCn);
    
    const tagDisplayName = fixEncoding(typeof displayName === 'object' ? (displayName.cn || displayName.en || JSON.stringify(displayName)) : displayName);
    let html = `<h3 style="margin-bottom: 16px; color: var(--primary);">标签: ${escapeHtml(tagDisplayName)} (${papers.length + library.length}条)</h3>`;
    
    if (papers.length === 0 && library.length === 0) {
        html += '<div class="empty-state"><p>暂无数据</p></div>';
    } else {
        // 文献库词条
        if (library.length > 0) {
            html += `
                <details open style="margin-bottom: 16px;">
                    <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                        📚 ${currentLang === 'cn' ? '文献库词条' : 'Library'} (${library.length})
                    </summary>
                    <div class="data-list" style="margin-top: 8px;">
                        ${library.map(p => renderDataCard(p, 'library')).join('')}
                    </div>
                </details>
            `;
        }
        
        // 文献卡片
        if (papers.length > 0) {
            html += `
                <details open style="margin-bottom: 16px;">
                    <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                        🃏 ${currentLang === 'cn' ? '文献卡片' : 'Cards'} (${papers.length})
                    </summary>
                    <div class="data-list" style="margin-top: 8px;">
                        ${papers.map(p => renderDataCard(p, 'paper')).join('')}
                    </div>
                </details>
            `;
        }
    }
    
    document.getElementById('dataList').innerHTML = html;
}

// 按分类渲染数据（包含标签关联 + 直接关联）
function renderDataByCategory(categoryId) {
    const category = CategoriesStore.getById(categoryId);
    if (!category) return;
    
    // 通过标签关联的数据
    const tags = TagsStore.getByCategory(categoryId);
    const tagIds = tags.map(t => t.id);
    
    // 直接关联的数据ID
    const directItemIds = category.itemIds || [];
    
    // 获取所有数据
    const allPapers = PapersStore.getAll();
    const allLibrary = LibraryStore.getAll();
    
    // 通过标签关联
    const papersByTags = allPapers.filter(p => p.tagIds && [...new Set(p.tagIds)].some(id => tagIds.includes(id)));
    const libraryByTags = allLibrary.filter(p => p.tagIds && [...new Set(p.tagIds)].some(id => tagIds.includes(id)));
    
    // 直接关联
    const papersDirect = allPapers.filter(p => directItemIds.includes(p.id));
    const libraryDirect = allLibrary.filter(p => directItemIds.includes(p.id));
    
    // 合并去重
    const papers = [...new Map([...papersByTags, ...papersDirect].map(p => [p.id, p])).values()];
    const library = [...new Map([...libraryByTags, ...libraryDirect].map(p => [p.id, p])).values()];
    
    const categoryName = fixEncoding(typeof category.name === 'object' ? (category.name.cn || category.name.en || JSON.stringify(category.name)) : category.name);
    let html = `<h3 style="margin-bottom: 16px; color: var(--primary);">分类: ${escapeHtml(categoryName)} (${papers.length + library.length}条)</h3>`;
    
    if (papers.length === 0 && library.length === 0) {
        html += '<div class="empty-state"><p>暂无数据</p></div>';
    } else {
        html += '<div class="data-list">';
        papers.forEach(paper => html += renderDataCard(paper, 'paper'));
        library.forEach(paper => html += renderDataCard(paper, 'library'));
        html += '</div>';
    }
    
    document.getElementById('dataList').innerHTML = html;
}

// 渲染数据卡片
function renderDataCard(data, type) {
    const title = currentLang === 'cn' 
        ? (data.titleCn || data.title || data.titleEn || '无标题')
        : (data.titleEn || data.title || data.titleCn || 'No Title');
    
    const meta = [];
    if (data.journal) meta.push(escapeHtml(data.journal));
    if (data.publishDate || data.year) meta.push(escapeHtml(data.publishDate || data.year));
    if (data.doi) meta.push(`DOI: ${escapeHtml(data.doi)}`);
    
    // 去重 tagIds 后再展示
    const uniqueTagIds = [...new Set(data.tagIds || [])];
    const tags = uniqueTagIds.map(id => TagsStore.getById(id)).filter(Boolean);
    
    // 标签也去重展示（按名称去重）
    const seenTags = new Set();
    const tagHtml = tags.filter(t => {
        const key = t.nameCn || t.nameEn;
        if (seenTags.has(key)) return false;
        seenTags.add(key);
        return true;
    }).map(t => {
        const name = currentLang === 'cn' ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
        return `<span class="data-tag">${escapeHtml(name)}</span>`;
    }).join('');
    
    const url = type === 'paper' ? `papers.html?id=${data.id}&fromFiles=true` : `papers.html?library=${data.id}&fromFiles=true`;
    
    return `
        <div class="data-card" onclick="window.location.href='${url}'">
            <div class="data-card-title">${escapeHtml(title)}</div>
            <div class="data-card-meta">${meta.join(' · ')}</div>
            ${tagHtml ? `<div class="data-card-tags">${tagHtml}</div>` : ''}
        </div>
    `;
}

// 搜索所有（重构版 - 5类可折叠）
function searchAll(query) {
    let html = '';
    
    // 1. 文献库词条
    const library = LibraryStore.getAll().filter(p => {
        const titleCn = p.titleCn || p.title || '';
        const titleEn = p.titleEn || p.title || '';
        const doi = p.doi || '';
        const abstract = p.abstract || p.abstractCn || '';
        return titleCn.toLowerCase().includes(query) || 
               titleEn.toLowerCase().includes(query) ||
               doi.toLowerCase().includes(query) ||
               abstract.toLowerCase().includes(query);
    });
    
    if (library.length > 0) {
        html += `
            <details open style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                    📚 文献库词条 (${library.length})
                </summary>
                <div class="data-list" style="margin-top: 8px;">
                    ${library.map(p => renderDataCard(p, 'library')).join('')}
                </div>
            </details>
        `;
    }
    
    // 2. 文献卡片
    const papers = PapersStore.getAll().filter(p => {
        const titleCn = p.titleCn || '';
        const titleEn = p.titleEn || '';
        const doi = p.doi || '';
        const abstractCn = p.abstractCn || '';
        const abstractEn = p.abstractEn || '';
        return titleCn.toLowerCase().includes(query) ||
               titleEn.toLowerCase().includes(query) ||
               doi.toLowerCase().includes(query) ||
               abstractCn.toLowerCase().includes(query) ||
               abstractEn.toLowerCase().includes(query);
    });
    
    if (papers.length > 0) {
        html += `
            <details open style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                    🃏 文献卡片 (${papers.length})
                </summary>
                <div class="data-list" style="margin-top: 8px;">
                    ${papers.map(p => renderDataCard(p, 'paper')).join('')}
                </div>
            </details>
        `;
    }
    
    // 3. 词汇
    const vocabulary = VocabularyStore.getAll().filter(v => {
        const en = v.en || v.english || '';
        const cn = v.cn || v.chinese || '';
        const defCn = v.defCn || '';
        const defEn = v.defEn || '';
        return en.toLowerCase().includes(query) ||
               cn.toLowerCase().includes(query) ||
               defCn.toLowerCase().includes(query) ||
               defEn.toLowerCase().includes(query);
    });
    
    if (vocabulary.length > 0) {
        html += `
            <details open style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                    📖 词汇 (${vocabulary.length})
                </summary>
                <div style="margin-top: 8px;">
                    ${vocabulary.map(v => {
                        const en = v.en || v.english || '';
                        const cn = v.cn || v.chinese || '';
                        const display = currentLang === 'cn' ? `${cn || en} ${en ? `(${en})` : ''}` : `${en || cn} ${cn ? `(${cn})` : ''}`;
                        return `<div class="tag-item" onclick="window.location.href='vocabulary.html'">${escapeHtml(display)}</div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    
    // 4. 标签
    const tags = TagsStore.getAll().filter(t => {
        const nameCn = t.nameCn || '';
        const nameEn = t.nameEn || '';
        return nameCn.toLowerCase().includes(query) || nameEn.toLowerCase().includes(query);
    });
    
    if (tags.length > 0) {
        html += `
            <details open style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                    🏷️ 标签 (${tags.length})
                </summary>
                <div style="margin-top: 8px;">
                    ${tags.map(t => {
                        const name = currentLang === 'cn' ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
                        return `<div class="tag-item" onclick="selectTag('${t.id}')">${escapeHtml(name)}</div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    
    // 5. 分类
    const categories = CategoriesStore.getAll().filter(c => 
        c.name.toLowerCase().includes(query)
    );
    
    if (categories.length > 0) {
        html += `
            <details open style="margin-bottom: 16px;">
                <summary style="cursor: pointer; padding: 12px 16px; background: var(--bg); border-radius: 8px; font-weight: 500;">
                    📂 分类 (${categories.length})
                </summary>
                <div style="margin-top: 8px;">
                    ${categories.map(c => {
                        return `<div class="tag-item" onclick="currentCategory='${c.id}';currentTag=null;renderDataList();">${escapeHtml(c.name)}</div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    
    if (!html) {
        html = '<div class="empty-state"><p>未找到相关结果</p></div>';
    }
    
    document.getElementById('dataList').innerHTML = html;
}

// ===== 模态框操作 =====

function openModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function openAddCategoryModal() {
    document.getElementById('categoryName').value = '';
    openModal('addCategoryModal');
}

function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    if (!name) {
        showToast('请输入分类名称', 'error');
        return;
    }
    
    const result = CategoriesStore.add({ name });
    if (result.success) {
        showToast('分类添加成功', 'success');
        closeModal('addCategoryModal');
        renderCategoryList();
    } else {
        showToast('添加失败', 'error');
    }
}

function openEditCategoryModal(categoryId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const category = CategoriesStore.getById(categoryId);
    if (!category) return;
    
    document.getElementById('editCategoryId').value = categoryId;
    document.getElementById('editCategoryName').value = typeof category.name === 'object' ? (category.name.cn || category.name.en || '') : category.name;
    openModal('editCategoryModal');
}

function saveCategory() {
    const id = document.getElementById('editCategoryId').value;
    const name = document.getElementById('editCategoryName').value.trim();
    
    if (!name) {
        showToast('请输入分类名称', 'error');
        return;
    }
    
    CategoriesStore.update(id, { name });
    showToast('分类更新成功', 'success');
    closeModal('editCategoryModal');
    renderCategoryList();
}

function deleteCategory() {
    const id = document.getElementById('editCategoryId').value;
    
    if (confirm('确定删除此分类？分类下的标签不会被删除，但会变为未分类状态。')) {
        CategoriesStore.remove(id);
        showToast('分类已删除', 'success');
        closeModal('editCategoryModal');
        renderCategoryList();
    }
}

function openAddTagModal() {
    document.getElementById('tagNameCn').value = '';
    document.getElementById('tagNameEn').value = '';
    
    // 填充分类选项
    const categories = CategoriesStore.getAll();
    document.getElementById('tagCategory').innerHTML = 
        '<option value="">无分类</option>' +
        categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    
    openModal('addTagModal');
}

function addTag() {
    const nameCn = document.getElementById('tagNameCn').value.trim();
    const nameEn = document.getElementById('tagNameEn').value.trim();
    const categoryId = document.getElementById('tagCategory').value;
    
    if (!nameCn && !nameEn) {
        showToast('请输入中文名称或英文名称', 'error');
        return;
    }
    
    const result = TagsStore.add({
        nameCn,
        nameEn,
        source: 'custom',
        categoryIds: categoryId ? [categoryId] : []
    });
    
    if (result.success) {
        showToast('标签添加成功', 'success');
        closeModal('addTagModal');
        renderCategoryList();
    } else {
        showToast(result.message || '标签已存在', 'warning');
        closeModal('addTagModal');
    }
}

function openEditTagModal(tagId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    const tag = TagsStore.getById(tagId);
    if (!tag) return;
    
    document.getElementById('editTagId').value = tagId;
    document.getElementById('editTagNameCn').value = tag.nameCn || '';
    document.getElementById('editTagNameEn').value = tag.nameEn || '';
    
    // 渲染分类复选框
    const categories = CategoriesStore.getAll();
    const html = categories.map(c => `
        <label style="display: block; margin: 4px 0;">
            <input type="checkbox" value="${c.id}" ${(tag.categoryIds || []).includes(c.id) ? 'checked' : ''}>
            ${escapeHtml(c.name)}
        </label>
    `).join('');
    document.getElementById('editTagCategories').innerHTML = html;
    
    openModal('editTagModal');
}

function saveTag() {
    const id = document.getElementById('editTagId').value;
    const nameCn = document.getElementById('editTagNameCn').value.trim();
    const nameEn = document.getElementById('editTagNameEn').value.trim();
    
    if (!nameCn && !nameEn) {
        showToast('请输入中文名称或英文名称', 'error');
        return;
    }
    
    // 获取选中的分类
    const checkboxes = document.querySelectorAll('#editTagCategories input:checked');
    const categoryIds = Array.from(checkboxes).map(cb => cb.value).slice(0, 5);
    
    TagsStore.update(id, { nameCn, nameEn, categoryIds });
    showToast('标签更新成功', 'success');
    closeModal('editTagModal');
    renderCategoryList();
}

function deleteTag() {
    const id = document.getElementById('editTagId').value;
    
    if (confirm('确定删除此标签？相关数据的标签引用也会被移除。')) {
        TagsStore.remove(id);
        showToast('标签已删除', 'success');
        closeModal('editTagModal');
        renderCategoryList();
        renderDataList();
    }
}




