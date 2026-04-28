/**
 * files.js - 文件管理页面逻辑
 */

let currentLang = 'cn';
let currentCategory = null;
let currentTag = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
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
        const count = categoryTags.length;
        
        html += `
            <div class="category-item">
                <div class="category-header" onclick="toggleCategory('${category.id}')" oncontextmenu="openEditCategoryModal('${category.id}', event)">
                    <span class="category-toggle" id="toggle-${category.id}">▶</span>
                    <span class="category-name">${escapeHtml(category.name)}</span>
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
            <span class="tag-name">${escapeHtml(displayName)}</span>
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

// 按标签渲染数据
function renderDataByTag(tagId) {
    const tag = TagsStore.getById(tagId);
    if (!tag) return;
    
    const papers = PapersStore.getAll().filter(p => p.tagIds && p.tagIds.includes(tagId));
    const library = LibraryStore.getAll().filter(p => p.tagIds && p.tagIds.includes(tagId));
    
    const displayName = currentLang === 'cn' ? (tag.nameCn || tag.nameEn) : (tag.nameEn || tag.nameCn);
    
    let html = `<h3 style="margin-bottom: 16px; color: var(--primary);">标签: ${escapeHtml(displayName)} (${papers.length + library.length}条)</h3>`;
    
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

// 按分类渲染数据
function renderDataByCategory(categoryId) {
    const category = CategoriesStore.getById(categoryId);
    if (!category) return;
    
    const tags = TagsStore.getByCategory(categoryId);
    const tagIds = tags.map(t => t.id);
    
    const papers = PapersStore.getAll().filter(p => p.tagIds && p.tagIds.some(id => tagIds.includes(id)));
    const library = LibraryStore.getAll().filter(p => p.tagIds && p.tagIds.some(id => tagIds.includes(id)));
    
    let html = `<h3 style="margin-bottom: 16px; color: var(--primary);">分类: ${escapeHtml(category.name)} (${papers.length + library.length}条)</h3>`;
    
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
    if (data.journal) meta.push(data.journal);
    if (data.publishDate || data.year) meta.push(data.publishDate || data.year);
    if (data.doi) meta.push(`DOI: ${data.doi}`);
    
    const tags = (data.tagIds || []).map(id => TagsStore.getById(id)).filter(Boolean);
    const tagHtml = tags.map(t => {
        const name = currentLang === 'cn' ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
        return `<span class="data-tag">${escapeHtml(name)}</span>`;
    }).join('');
    
    const url = type === 'paper' ? `papers.html?id=${data.id}` : `papers.html?library=${data.id}`;
    
    return `
        <div class="data-card" onclick="window.location.href='${url}'">
            <div class="data-card-title">${escapeHtml(title)}</div>
            <div class="data-card-meta">${meta.join(' · ')}</div>
            ${tagHtml ? `<div class="data-card-tags">${tagHtml}</div>` : ''}
        </div>
    `;
}

// 搜索所有
function searchAll(query) {
    const results = [];
    
    // 搜索标签
    const tags = TagsStore.getAll().filter(t => {
        const nameCn = t.nameCn || t.name_cn || '';
        const nameEn = t.nameEn || t.name_en || '';
        return nameCn.toLowerCase().includes(query) || nameEn.toLowerCase().includes(query);
    });
    
    // 搜索分类
    const categories = CategoriesStore.getAll().filter(c => 
        c.name.toLowerCase().includes(query)
    );
    
    // 搜索文献卡片
    const papers = PapersStore.getAll().filter(p => {
        const title = (p.titleCn || p.titleEn || '').toLowerCase();
        const doi = (p.doi || '').toLowerCase();
        const abstract = (p.abstractCn || p.abstractEn || '').toLowerCase();
        return title.includes(query) || doi.includes(query) || abstract.includes(query);
    });
    
    // 搜索文献库
    const library = LibraryStore.getAll().filter(p => {
        const title = (p.titleCn || p.title || p.titleEn || '').toLowerCase();
        const doi = (p.doi || '').toLowerCase();
        const abstract = (p.abstract || p.abstractCn || '').toLowerCase();
        return title.includes(query) || doi.includes(query) || abstract.includes(query);
    });
    
    let html = '';
    
    if (tags.length > 0) {
        html += `<h4 style="margin: 16px 0 8px; color: var(--text-secondary);">标签 (${tags.length})</h4>`;
        tags.forEach(t => {
            const name = currentLang === 'cn' ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
            html += `<div class="tag-item" onclick="selectTag('${t.id}')">${escapeHtml(name)}</div>`;
        });
    }
    
    if (categories.length > 0) {
        html += `<h4 style="margin: 16px 0 8px; color: var(--text-secondary);">分类 (${categories.length})</h4>`;
        categories.forEach(c => {
            html += `<div class="tag-item" onclick="currentCategory='${c.id}';currentTag=null;renderDataList();">${escapeHtml(c.name)}</div>`;
        });
    }
    
    if (papers.length > 0 || library.length > 0) {
        html += `<h4 style="margin: 16px 0 8px; color: var(--text-secondary);">文献 (${papers.length + library.length})</h4>`;
        html += '<div class="data-list">';
        papers.forEach(p => html += renderDataCard(p, 'paper'));
        library.forEach(p => html += renderDataCard(p, 'library'));
        html += '</div>';
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
    document.getElementById('editCategoryName').value = category.name;
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
