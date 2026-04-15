/**
 * vocabulary.js - 生词本学习脚本
 * 实现四选一学习模式：英选中、中选英、英选义、义选英
 */

// 学习阶段枚举
const StudyPhase = {
    EN_SELECT_CN: 'EN_SELECT_CN',   // 英文 -> 选中文
    CN_SELECT_EN: 'CN_SELECT_EN',   // 中文 -> 选英文
    EN_SELECT_DEF: 'EN_SELECT_DEF', // 英文 -> 选释义
    DEF_SELECT_EN: 'DEF_SELECT_EN'  // 释义 -> 选英文
};

// 配置
const CONFIG = {
    CORRECT_TO_MASTER: 12,
    vocabularyUrl: 'data/vocabulary.json',
    STORAGE_KEYS: {
        MASTERED: 'masteredWords',
        PROGRESS: 'currentWordProgress',
        TODAY_COUNT: 'todayCount',
        TODAY_DATE: 'todayDate'
    }
};

// 状态
let vocabulary = [];
let masteredWords = [];
let currentWord = null;
let currentPhase = StudyPhase.EN_SELECT_CN;
let correctCount = 0;
let currentStreak = 0;
let todayCount = 0;
let options = [];
let isWaiting = false;

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadData();
    checkNewDay();
});

/**
 * 初始化DOM元素引用
 */
function initElements() {
    elements.studyArea = document.getElementById('studyArea');
    elements.studyHint = document.getElementById('studyHint');
    elements.progressText = document.getElementById('progressText');
    elements.progressFill = document.getElementById('progressFill');
    elements.currentStreak = document.getElementById('currentStreak');
    elements.todayCount = document.getElementById('todayCount');
    elements.masteredList = document.getElementById('masteredList');
    elements.wordList = document.getElementById('wordList');
    elements.addWordForm = document.getElementById('addWordForm');
    elements.categoryFilter = document.getElementById('categoryFilter');
    elements.searchWords = document.getElementById('searchWords');
}

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 添加单词表单
    if (elements.addWordForm) {
        elements.addWordForm.addEventListener('submit', handleAddWord);
    }
    
    // 筛选和搜索
    if (elements.categoryFilter) {
        elements.categoryFilter.addEventListener('change', renderWordList);
    }
    if (elements.searchWords) {
        elements.searchWords.addEventListener('input', debounce(renderWordList, 300));
    }
}

/**
 * 切换标签页
 */
function switchTab(tab) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // 切换内容
    document.querySelectorAll('.vocab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tab}Mode`).classList.remove('hidden');
    
    // 渲染对应内容
    if (tab === 'mastered') {
        renderMasteredList();
    } else if (tab === 'all') {
        renderWordList();
    }
}

/**
 * 加载数据
 */
async function loadData() {
    try {
        const response = await fetch(CONFIG.vocabularyUrl);
        if (response.ok) {
            vocabulary = await response.json();
        }
    } catch (error) {
        console.error('加载词汇数据失败:', error);
        vocabulary = [];
    }
    
    // 加载已掌握单词
    masteredWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MASTERED) || '[]');
    
    // 开始学习
    startStudy();
}

/**
 * 检查是否新的一天，重置每日计数
 */
function checkNewDay() {
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem(CONFIG.STORAGE_KEYS.TODAY_DATE);
    
    if (storedDate !== today) {
        todayCount = 0;
        localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_DATE, today);
        localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_COUNT, '0');
    } else {
        todayCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TODAY_COUNT) || '0');
    }
    
    updateTodayCount();
}

/**
 * 开始学习
 */
function startStudy() {
    // 过滤掉已掌握的单词
    const unmasteredWords = vocabulary.filter(w => !masteredWords.some(m => m.word === w.word));
    
    if (unmasteredWords.length === 0) {
        elements.studyArea.innerHTML = '<p class="empty-message">🎉 所有单词都已掌握！恭喜！</p>';
        return;
    }
    
    // 随机选择一个单词
    currentWord = unmasteredWords[Math.floor(Math.random() * unmasteredWords.length)];
    
    // 随机选择学习阶段
    const phases = [
        StudyPhase.EN_SELECT_CN,
        StudyPhase.CN_SELECT_EN,
        StudyPhase.EN_SELECT_DEF,
        StudyPhase.DEF_SELECT_EN
    ];
    currentPhase = phases[Math.floor(Math.random() * phases.length)];
    
    // 加载进度
    const progress = JSON.parse(localStorage.getItem(`${CONFIG.STORAGE_KEYS.PROGRESS}_${currentWord.id}`) || '{"count":0}');
    correctCount = progress.count;
    
    // 生成选项
    generateOptions();
    renderStudyCard();
    updateProgress();
}

/**
 * 生成选项
 */
function generateOptions() {
    // 获取其他单词用于生成错误选项
    const otherWords = vocabulary.filter(w => w.id !== currentWord.id);
    const shuffled = shuffleArray([...otherWords]).slice(0, 3);
    
    switch (currentPhase) {
        case StudyPhase.EN_SELECT_CN:
            options = shuffleArray([currentWord.word_cn, ...shuffled.map(w => w.word_cn)]);
            break;
        case StudyPhase.CN_SELECT_EN:
            options = shuffleArray([currentWord.word, ...shuffled.map(w => w.word)]);
            break;
        case StudyPhase.EN_SELECT_DEF:
            options = shuffleArray([
                currentWord.definition || currentWord.word_cn,
                ...shuffled.map(w => w.definition || w.word_cn)
            ]);
            break;
        case StudyPhase.DEF_SELECT_EN:
            options = shuffleArray([currentWord.word, ...shuffled.map(w => w.word)]);
            break;
    }
}

/**
 * 渲染学习卡片
 */
function renderStudyCard() {
    const phaseInfo = {
        [StudyPhase.EN_SELECT_CN]: { prompt: '选择中文释义', main: currentWord.word, type: 'word' },
        [StudyPhase.CN_SELECT_EN]: { prompt: '选择英文单词', main: currentWord.word_cn, type: 'word-cn' },
        [StudyPhase.EN_SELECT_DEF]: { prompt: '选择正确释义', main: currentWord.word, type: 'word' },
        [StudyPhase.DEF_SELECT_EN]: { prompt: '选择对应单词', main: currentWord.definition || currentWord.word_cn, type: 'definition' }
    };
    
    const info = phaseInfo[currentPhase];
    
    elements.studyArea.innerHTML = `
        <div class="word-display">${escapeHtml(currentWord.word)}</div>
        <div class="word-type">${info.prompt}</div>
        <div class="options-grid">
            ${options.map((opt, idx) => `
                <button class="option-btn" data-index="${idx}" data-value="${escapeHtml(opt)}">
                    ${escapeHtml(opt)}
                </button>
            `).join('')}
        </div>
    `;
    
    // 添加点击事件
    elements.studyArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleOptionClick(btn));
    });
}

/**
 * 处理选项点击
 */
function handleOptionClick(btn) {
    if (isWaiting) return;
    
    const selectedValue = btn.dataset.value;
    let correctAnswer;
    
    switch (currentPhase) {
        case StudyPhase.EN_SELECT_CN:
            correctAnswer = currentWord.word_cn;
            break;
        case StudyPhase.CN_SELECT_EN:
        case StudyPhase.DEF_SELECT_EN:
            correctAnswer = currentWord.word;
            break;
        case StudyPhase.EN_SELECT_DEF:
            correctAnswer = currentWord.definition || currentWord.word_cn;
            break;
    }
    
    const isCorrect = selectedValue === correctAnswer;
    
    // 显示结果
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (!isCorrect) {
        // 选错：找出正确答案并高亮
        elements.studyArea.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.value === correctAnswer) {
                b.classList.add('correct');
            }
        });
        
        // 重置当前单词进度
        correctCount = 0;
        saveProgress();
        
        // 显示错误提示
        elements.studyHint.innerHTML = `<p>❌ 答错了！当前单词进度已重置，请重新开始。</p>`;
        elements.studyHint.classList.add('error');
        
        isWaiting = true;
        setTimeout(() => {
            isWaiting = false;
            elements.studyHint.classList.remove('error');
            elements.studyHint.innerHTML = '<p>🎯 选择正确释义，继续加油！</p>';
            renderStudyCard();
        }, 2000);
        
        return;
    }
    
    // 选对
    correctCount++;
    currentStreak++;
    todayCount++;
    saveProgress();
    updateProgress();
    updateTodayCount();
    
    // 检查是否掌握
    if (correctCount >= CONFIG.CORRECT_TO_MASTER) {
        masterWord();
        return;
    }
    
    // 继续下一轮
    elements.studyHint.innerHTML = '<p>✅ 正确！继续加油！</p>';
    elements.studyHint.classList.add('correct');
    
    isWaiting = true;
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        elements.studyHint.innerHTML = '<p>🎯 选择正确释义，继续加油！</p>';
        startStudy();
    }, 1000);
}

/**
 * 保存进度
 */
function saveProgress() {
    localStorage.setItem(`${CONFIG.STORAGE_KEYS.PROGRESS}_${currentWord.id}`, JSON.stringify({ count: correctCount }));
    localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_COUNT, todayCount.toString());
    localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_DATE, new Date().toDateString());
}

/**
 * 标记单词为已掌握
 */
function masterWord() {
    const masteredWord = {
        ...currentWord,
        masteredAt: new Date().toISOString()
    };
    
    masteredWords.push(masteredWord);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MASTERED, JSON.stringify(masteredWords));
    
    elements.studyHint.innerHTML = `<p>🎉 太棒了！${currentWord.word} 已移入掌握区！</p>`;
    
    // 更新显示
    updateStat('masteredCount', masteredWords.length);
    
    isWaiting = true;
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.innerHTML = '<p>🎯 选择正确释义，继续加油！</p>';
        startStudy();
    }, 2000);
}

/**
 * 更新进度显示
 */
function updateProgress() {
    const percentage = (correctCount / CONFIG.CORRECT_TO_MASTER) * 100;
    elements.progressText.textContent = `进度: ${correctCount}/${CONFIG.CORRECT_TO_MASTER}`;
    elements.progressFill.style.width = `${percentage}%`;
    elements.currentStreak.textContent = currentStreak;
}

/**
 * 更新今日计数
 */
function updateTodayCount() {
    if (elements.todayCount) {
        elements.todayCount.textContent = todayCount;
    }
}

/**
 * 渲染已掌握列表
 */
function renderMasteredList() {
    if (masteredWords.length === 0) {
        elements.masteredList.innerHTML = '<p class="empty-message">暂无已掌握的单词，继续学习吧！</p>';
        return;
    }
    
    elements.masteredList.innerHTML = masteredWords.map(word => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
            </div>
            <span class="word-meta">${word.category || ''}</span>
        </div>
    `).join('');
}

/**
 * 渲染全部单词列表
 */
function renderWordList() {
    const category = elements.categoryFilter?.value || '';
    const search = elements.searchWords?.value.toLowerCase() || '';
    
    let filtered = vocabulary;
    
    if (category) {
        filtered = filtered.filter(w => w.category === category);
    }
    
    if (search) {
        filtered = filtered.filter(w => 
            w.word.toLowerCase().includes(search) ||
            (w.word_cn && w.word_cn.includes(search))
        );
    }
    
    if (filtered.length === 0) {
        elements.wordList.innerHTML = '<p class="empty-message">没有找到匹配的单词</p>';
        return;
    }
    
    elements.wordList.innerHTML = filtered.map(word => {
        const isMastered = masteredWords.some(m => m.word === word.word);
        return `
            <div class="word-item">
                <div class="word-main">
                    <span class="word-text">${escapeHtml(word.word)}</span>
                    <span class="word-cn">${escapeHtml(word.word_cn)}</span>
                    ${isMastered ? '<span style="color: var(--success-color);">✓</span>' : ''}
                </div>
                <span class="word-meta">${word.category || ''}</span>
            </div>
        `;
    }).join('');
}

/**
 * 处理添加单词
 */
async function handleAddWord(e) {
    e.preventDefault();
    
    const word = {
        id: Date.now().toString(),
        word: document.getElementById('word').value.trim(),
        word_cn: document.getElementById('wordCn').value.trim(),
        definition: document.getElementById('definition').value.trim(),
        example: document.getElementById('example').value.trim(),
        example_cn: document.getElementById('exampleCn').value.trim(),
        category: document.getElementById('category').value,
        correct_count: 0
    };
    
    // 检查是否重复
    if (vocabulary.some(v => v.word.toLowerCase() === word.word.toLowerCase())) {
        alert('该单词已存在！');
        return;
    }
    
    vocabulary.push(word);
    
    // 保存到localStorage（实际项目中应该保存到文件）
    // 这里使用localStorage模拟，实际部署需要后端支持
    localStorage.setItem('vocabulary_local', JSON.stringify(vocabulary));
    
    // 刷新页面
    window.location.reload();
}

/**
 * 更新统计数字
 */
function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
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

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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
