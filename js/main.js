/**
 * main.js - 全局公共函数
 */

// Toast通知
let toastContainer = null;

function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 工具函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
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

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 数据存储
const Storage = {
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    }
};

// 文献库数据
const LibraryStore = {
    key: 'libraryPapers',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    add(paper) {
        const papers = this.getAll();
        const exists = papers.find(p => p.doi === paper.doi);
        if (exists) {
            return { success: false, message: '文献已存在' };
        }
        papers.unshift({
            id: Date.now().toString(),
            ...paper,
            addedAt: new Date().toISOString()
        });
        Storage.set(this.key, papers);
        return { success: true, message: '添加成功' };
    },
    
    remove(id) {
        const papers = this.getAll();
        const filtered = papers.filter(p => p.id !== id);
        Storage.set(this.key, filtered);
    },
    
    clear() {
        Storage.remove(this.key);
    }
};

// 文献卡片数据
const PapersStore = {
    key: 'papersData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    getById(id) {
        const papers = this.getAll();
        return papers.find(p => p.id === id);
    },
    
    add(card) {
        const cards = this.getAll();
        cards.unshift({
            id: Date.now().toString(),
            ...card,
            createdAt: new Date().toISOString()
        });
        Storage.set(this.key, cards);
        return { success: true, id: cards[0].id };
    },
    
    update(id, data) {
        const cards = this.getAll();
        const index = cards.findIndex(p => p.id === id);
        if (index !== -1) {
            cards[index] = { ...cards[index], ...data, updatedAt: new Date().toISOString() };
            Storage.set(this.key, cards);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const cards = this.getAll();
        const filtered = cards.filter(p => p.id !== id);
        Storage.set(this.key, filtered);
    }
};

// 词汇本数据
const VocabularyStore = {
    key: 'vocabularyData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    add(word) {
        const words = this.getAll();
        const exists = words.find(w => w.word.toLowerCase() === word.word.toLowerCase());
        if (exists) {
            return { success: false, message: '词汇已存在' };
        }
        words.unshift({
            id: Date.now().toString(),
            ...word,
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: word.category || 'custom',
            addedAt: new Date().toISOString()
        });
        Storage.set(this.key, words);
        return { success: true };
    },
    
    update(id, data) {
        const words = this.getAll();
        const index = words.findIndex(w => w.id === id);
        if (index !== -1) {
            words[index] = { ...words[index], ...data };
            Storage.set(this.key, words);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const words = this.getAll();
        const filtered = words.filter(w => w.id !== id);
        Storage.set(this.key, filtered);
    }
};

// 追踪配置
const TrackingConfig = {
    key: 'trackingConfig',
    
    get() {
        return Storage.get(this.key, {
            selectedJournals: [],
            keywords: [],
            lastTracking: null,
            autoTracking: false
        });
    },
    
    save(config) {
        Storage.set(this.key, config);
    }
};

// 全局设置
const GlobalSettings = {
    key: 'globalSettings',
    
    get() {
        return Storage.get(this.key, {
            apiProvider: 'siliconflow',
            apiKey: '',
            model: 'Qwen/Qwen2.5-7B-Instruct',
            vocabCount: 20
        });
    },
    
    save(settings) {
        Storage.set(this.key, settings);
    }
};

// 移动端菜单初始化
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
});

// 导出全局函数
window.showToast = showToast;
window.Storage = Storage;
window.LibraryStore = LibraryStore;
window.PapersStore = PapersStore;
window.VocabularyStore = VocabularyStore;
window.TrackingConfig = TrackingConfig;
window.GlobalSettings = GlobalSettings;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.debounce = debounce;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
