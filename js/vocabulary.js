/**
 * vocabulary.js - 生词本学习脚本（重构版）
 * 
 * 学习流程（批量模式）：
 * - 新学：先展示所有新词卡片 → 所有词做完英选中 → 所有词做完中选英 → 所有词做完英选义 → 所有词做完义选英
 * - 复习：直接所有词英选中 → 所有词中选英 → 所有词英选义 → 所有词义选英
 * 
 * 选错处理：
 * 1. 清零该词连续正确次数
 * 2. 增加该词错误次数
 * 3. 继续当前题型其他词
 * 4. 当前题型遍历完后，再出一遍这个词的这个题型
 * 5. 如果还错，继续循环直到答对
 * 6. 答对后才进入下一题型
 */

// 学习阶段枚举
const StudyPhase = {
    SHOW_CARD: 0,           // 展示单词卡片
    EN_SELECT_CN: 1,        // 英文 -> 选中文
    CN_SELECT_EN: 2,        // 中文 -> 选英文
    EN_SELECT_DEF: 3,       // 英文 -> 选释义
    DEF_SELECT_EN: 4        // 释义 -> 选英文
};

// 题型名称（用于显示）
const PHASE_NAMES = {
    [StudyPhase.SHOW_CARD]: '卡片展示',
    [StudyPhase.EN_SELECT_CN]: '英选中',
    [StudyPhase.CN_SELECT_EN]: '中选英',
    [StudyPhase.EN_SELECT_DEF]: '英选义',
    [StudyPhase.DEF_SELECT_EN]: '义选英'
};

// 阶段循环顺序（不含卡片展示）
const PHASE_SEQUENCE = [
    StudyPhase.EN_SELECT_CN,
    StudyPhase.CN_SELECT_EN,
    StudyPhase.EN_SELECT_DEF,
    StudyPhase.DEF_SELECT_EN
];

// 新学阶段顺序（含卡片展示）
const NEW_STUDY_PHASES = [
    StudyPhase.SHOW_CARD,
    ...PHASE_SEQUENCE
];

// 配置
const CONFIG = {
    CORRECT_TO_MASTER: 12,  // 需要连续答对12次才掌握
    ERROR_THRESHOLD: 3,      // 进入错词本的累计错误次数
    DEFAULT_STUDY_COUNT: 50, // 默认每次学习的单词数量
    vocabularyUrl: 'data/vocabulary.json',
    wrongWordsUrl: 'data/wrong-words.json',
    STORAGE_KEYS: {
        NEW_WORDS: 'newWords',           // 生词本（未练习过的新词）
        WRONG_WORDS: 'wrongWords',       // 错词本（累计错误>=3）
        MASTERED: 'masteredWords',       // 已掌握本
        PROGRESS: 'wordProgress',        // 学习进度
        PRACTICE_DATE: 'practiceDate',   // 上次练习日期
        TODAY_COMPLETED: 'todayCompleted', // 今日是否完成
        STUDY_COUNT: 'studyCount'         // 每次学习单词数量
    }
};

// 状态
let vocabulary = [];           // 原始词汇库
let newWords = [];              // 生词本（is_new=true，从未练习过）
let wrongWords = [];            // 错词本（error_count >= 3）
let learnedWords = [];          // 已学（练习过但未掌握）
let masteredWords = [];         // 已掌握（correct_count >= 12）
let wordProgress = {};          // 学习进度

// 学习状态
let currentMode = null;        // 'new' | 'review'
let currentPhase = StudyPhase.SHOW_CARD;
let currentPhaseIndex = 0;      // 在阶段序列中的索引
let options = [];
let isWaiting = false;

// 批量学习队列
let currentWordQueue = [];     // 当前学习的词队列
let currentWordIndex = 0;      // 当前正在学习的词在队列中的索引
let wrongWordsInPhase = [];    // 当前题型中答错的词（需要重做）
let studyCount = CONFIG.DEFAULT_STUDY_COUNT; // 每次学习单词数量

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadAllData();
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
    elements.wrongList = document.getElementById('wrongList');
    elements.wordList = document.getElementById('wordList');
    elements.addWordForm = document.getElementById('addWordForm');
    elements.categoryFilter = document.getElementById('categoryFilter');
    elements.searchWords = document.getElementById('searchWords');
    elements.studyButtons = document.getElementById('studyButtons');
    elements.queueInfo = document.getElementById('queueInfo');
    elements.studyCountInput = document.getElementById('studyCountInput');
    elements.learnedList = document.getElementById('learnedList');
}

/**
 * 初始化事件监听器
 */
function initEventListeners() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 新学按钮
    const newStudyBtn = document.getElementById('newStudyBtn');
    if (newStudyBtn) {
        newStudyBtn.addEventListener('click', () => startStudyMode('new'));
    }
    
    // 复习按钮
    const reviewBtn = document.getElementById('reviewBtn');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => startStudyMode('review'));
    }
    
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
    
    // 学习数量设置
    if (elements.studyCountInput) {
        elements.studyCountInput.value = localStorage.getItem(CONFIG.STORAGE_KEYS.STUDY_COUNT) || CONFIG.DEFAULT_STUDY_COUNT;
        elements.studyCountInput.addEventListener('change', (e) => {
            studyCount = parseInt(e.target.value) || CONFIG.DEFAULT_STUDY_COUNT;
            localStorage.setItem(CONFIG.STORAGE_KEYS.STUDY_COUNT, studyCount);
        });
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
    } else if (tab === 'wrong') {
        renderWrongList();
    } else if (tab === 'all') {
        renderWordList();
    } else if (tab === 'learned') {
        renderLearnedList();
    }
}

/**
 * 加载所有数据
 */
async function loadAllData() {
    // 加载原始词汇库
    try {
        const response = await fetch(CONFIG.vocabularyUrl);
        if (response.ok) {
            vocabulary = await response.json();
        }
    } catch (error) {
        console.error('加载词汇数据失败:', error);
        vocabulary = [];
    }
    
    // 从localStorage加载各单词本
    newWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.NEW_WORDS) || '[]');
    wrongWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.WRONG_WORDS) || '[]');
    learnedWords = JSON.parse(localStorage.getItem('learnedWords') || '[]');
    masteredWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MASTERED) || '[]');
    wordProgress = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS) || '{}');
    
    // 恢复学习数量设置
    studyCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.STUDY_COUNT)) || CONFIG.DEFAULT_STUDY_COUNT;
    
    // 检查新词：词汇库中有但不在任何单词本中的
    syncWordBooks();
    
    // 检查日期
    checkNewDay();
    
    // 渲染界面
    updateStats();
    updateStudyButtons();
}

/**
 * 同步单词本：确保词汇库中的词在正确的单词本中
 */
function syncWordBooks() {
    // 找出词汇库中已练习过但未掌握的词（is_new=false, correct_count<12）
    vocabulary.forEach(vocab => {
        const progress = wordProgress[vocab.id];
        
        // 如果有进度但不是生词
        if (progress && !newWords.some(w => w.id === vocab.id)) {
            // 如果未掌握，加入已学列表
            if (progress.correct_count < CONFIG.CORRECT_TO_MASTER) {
                if (!learnedWords.some(w => w.id === vocab.id)) {
                    learnedWords.push({
                        ...vocab,
                        correct_count: progress.correct_count || 0,
                        error_count: progress.error_count || 0,
                        is_new: false,
                        last_practice_date: progress.last_practice_date || ''
                    });
                }
            }
        }
    });
    
    // 同步错词本的错误次数
    wrongWords.forEach(wrong => {
        const progress = wordProgress[wrong.id];
        if (progress) {
            wrong.error_count = progress.error_count;
        }
    });
    
    // 保存更新
    localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
}

/**
 * 检查是否新的一天
 */
function checkNewDay() {
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem(CONFIG.STORAGE_KEYS.PRACTICE_DATE);
    
    if (storedDate !== today) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PRACTICE_DATE, today);
        localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_COMPLETED, 'false');
    }
}

/**
 * 更新统计信息
 */
function updateStats() {
    const stats = {
        newCount: newWords.length,
        wrongCount: wrongWords.length,
        learnedCount: learnedWords.length,
        masteredCount: masteredWords.length
    };
    
    ['newCount', 'wrongCount', 'masteredCount'].forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = stats[key];
    });
    
    // 更新已学数量
    const learnedCountEl = document.getElementById('learnedCount');
    if (learnedCountEl) learnedCountEl.textContent = stats.learnedCount;
    
    // 更新复习按钮数量
    const reviewCountEl = document.getElementById('reviewCount');
    if (reviewCountEl) reviewCountEl.textContent = getReviewableWords().length;
    
    // 更新新学按钮数量
    const newStudyCountEl = document.getElementById('newStudyCount');
    if (newStudyCountEl) newStudyCountEl.textContent = newWords.length;
    
    if (elements.todayCount) {
        elements.todayCount.textContent = Object.keys(wordProgress).length;
    }
}

/**
 * 更新学习按钮状态
 */
function updateStudyButtons() {
    if (!elements.studyButtons) return;
    
    const hasNewWords = newWords.length > 0;
    const hasReviewWords = getReviewableWords().length > 0;
    
    elements.studyButtons.innerHTML = `
        <div class="study-count-setting">
            <label for="studyCountInput">每次学习:</label>
            <input type="number" id="studyCountInput" value="${studyCount}" min="1" max="200">
            <span>个词</span>
        </div>
        <button class="btn btn-primary study-btn" id="newStudyBtn" ${!hasNewWords ? 'disabled' : ''}>
            📚 新学 (${newWords.length})
        </button>
        <button class="btn btn-secondary study-btn" id="reviewBtn" ${!hasReviewWords ? 'disabled' : ''}>
            🔄 复习 (${getReviewableWords().length})
        </button>
    `;
    
    // 重新绑定事件
    const newStudyBtn = document.getElementById('newStudyBtn');
    const reviewBtn = document.getElementById('reviewBtn');
    const studyCountInput = document.getElementById('studyCountInput');
    
    if (newStudyBtn) {
        newStudyBtn.addEventListener('click', () => startStudyMode('new'));
    }
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => startStudyMode('review'));
    }
    if (studyCountInput) {
        studyCountInput.value = studyCount;
        studyCountInput.addEventListener('change', (e) => {
            studyCount = parseInt(e.target.value) || CONFIG.DEFAULT_STUDY_COUNT;
            localStorage.setItem(CONFIG.STORAGE_KEYS.STUDY_COUNT, studyCount);
        });
    }
}

/**
 * 获取可以复习的词（练习过但未掌握：correct_count < 12）
 */
function getReviewableWords() {
    // 从有进度的词中找（已练习过但未掌握的）
    const reviewable = [];
    
    Object.keys(wordProgress).forEach(wordId => {
        const progress = wordProgress[wordId];
        const vocabWord = vocabulary.find(v => v.id === wordId);
        
        // 排除已掌握的
        if (vocabWord && progress.correct_count < CONFIG.CORRECT_TO_MASTER) {
            reviewable.push({
                ...vocabWord,
                correct_count: progress.correct_count || 0,
                error_count: progress.error_count || 0,
                is_new: false,
                last_practice_date: progress.last_practice_date || ''
            });
        }
    });
    
    // 从错词本中也加入（如果它们还有机会被复习）
    wrongWords.forEach(word => {
        if (!reviewable.some(w => w.word === word.word)) {
            reviewable.push(word);
        }
    });
    
    // 从已学列表中找
    learnedWords.forEach(word => {
        if (!reviewable.some(w => w.word === word.word)) {
            reviewable.push(word);
        }
    });
    
    return reviewable;
}

/**
 * 开始学习模式
 */
function startStudyMode(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    wrongWordsInPhase = [];
    
    if (mode === 'new') {
        // 新学：从生词本取词（is_new=true的词）
        currentWordQueue = newWords.slice(0, Math.min(studyCount, newWords.length));
    } else {
        // 复习：从复习词中取
        currentWordQueue = getReviewableWords().slice(0, Math.min(studyCount, getReviewableWords().length));
    }
    
    if (currentWordQueue.length === 0) {
        showMessage('没有可学习的词了！', 'info');
        updateStudyButtons();
        return;
    }
    
    // 确定起始阶段
    if (mode === 'new') {
        // 新学：从卡片展示开始
        currentPhase = StudyPhase.SHOW_CARD;
        currentPhaseIndex = 0;
    } else {
        // 复习：从英选中开始
        currentPhase = PHASE_SEQUENCE[0];
        currentPhaseIndex = 0;
    }
    
    // 隐藏按钮区域，显示学习区域
    if (elements.studyButtons) {
        elements.studyButtons.classList.add('hidden');
    }
    if (elements.queueInfo) {
        elements.queueInfo.classList.remove('hidden');
    }
    
    updateQueueInfo();
    renderCurrentQuestion();
}

/**
 * 更新队列信息
 */
function updateQueueInfo() {
    if (elements.queueInfo) {
        const phaseName = PHASE_NAMES[currentPhase] || '学习中';
        const totalWords = currentWordQueue.length;
        const currentIdx = currentWordIndex + 1;
        
        elements.queueInfo.innerHTML = `
            <span class="queue-badge">${currentMode === 'new' ? '新学模式' : '复习模式'}</span>
            <span class="phase-badge">${phaseName}</span>
            <span class="word-progress">第 ${currentIdx} / ${totalWords} 个词</span>
            ${wrongWordsInPhase.length > 0 ? `<span class="retry-badge">需重做: ${wrongWordsInPhase.length}个</span>` : ''}
        `;
    }
}

/**
 * 渲染当前题目
 */
function renderCurrentQuestion() {
    if (currentWordIndex >= currentWordQueue.length) {
        // 队列完成，检查是否还有需要重做的词
        if (wrongWordsInPhase.length > 0) {
            // 有答错的词，需要重做
            handleRetryWords();
            return;
        }
        
        // 当前题型完成，进入下一题型
        moveToNextPhase();
        return;
    }
    
    const currentWord = currentWordQueue[currentWordIndex];
    
    // 更新队列信息
    updateQueueInfo();
    
    if (currentPhase === StudyPhase.SHOW_CARD) {
        renderWordCard(currentWord);
    } else {
        renderQuizCard(currentWord);
    }
}

/**
 * 处理需要重做的词
 */
function handleRetryWords() {
    const wordToRetry = wrongWordsInPhase.shift();
    const wordInQueue = currentWordQueue.find(w => w.word === wordToRetry.word);
    
    if (wordInQueue) {
        // 更新该词的进度（连对清零）
        const progress = wordProgress[wordInQueue.id] || { correct_count: 0, error_count: 0 };
        progress.correct_count = 0; // 清零连续正确次数
        wordProgress[wordInQueue.id] = progress;
        localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
        
        // 更新已学列表中的记录
        learnedWords = learnedWords.map(w => {
            if (w.id === wordInQueue.id) {
                return { ...w, correct_count: 0 };
            }
            return w;
        });
        localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
        
        // 显示提示
        elements.studyHint.innerHTML = `<p class="retry-hint">🔄 重做「${wordInQueue.word}」的${PHASE_NAMES[currentPhase]}...</p>`;
        
        // 重新渲染当前题型
        renderQuizCard(wordInQueue);
    } else {
        // 如果词不在队列中（可能已掌握），直接继续
        renderCurrentQuestion();
    }
}

/**
 * 进入下一题型
 */
function moveToNextPhase() {
    // 清空当前题型的错词列表
    wrongWordsInPhase = [];
    
    // 确定下一个阶段
    if (currentMode === 'new' && currentPhase === StudyPhase.SHOW_CARD) {
        // 新学模式：卡片展示完成后进入题型
        currentPhase = PHASE_SEQUENCE[0];
        currentPhaseIndex = 0;
    } else {
        // 进入下一个题型
        currentPhaseIndex++;
        
        if (currentPhaseIndex >= PHASE_SEQUENCE.length) {
            // 所有题型完成，学习结束
            completeStudy();
            return;
        }
        
        currentPhase = PHASE_SEQUENCE[currentPhaseIndex];
    }
    
    // 重置词队列索引
    currentWordIndex = 0;
    
    // 更新提示
    elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入「${PHASE_NAMES[currentPhase]}」环节！</p>`;
    
    setTimeout(() => {
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 完成学习
 */
function completeStudy() {
    // 标记今日完成
    localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_COMPLETED, 'true');
    
    // 从生词本移除已学习的词（如果它们还有进度但未掌握，移到已学）
    if (currentMode === 'new') {
        const studiedWords = currentWordQueue.filter(w => w.is_new);
        
        studiedWords.forEach(word => {
            // 从生词本移除
            newWords = newWords.filter(w => w.word !== word.word);
            
            // 检查是否已掌握
            const progress = wordProgress[word.id];
            if (progress && progress.correct_count >= CONFIG.CORRECT_TO_MASTER) {
                // 已掌握，标记为已学
                masteredWord(word);
            } else if (progress && progress.correct_count > 0) {
                // 已练习过但未掌握，加入已学列表
                if (!learnedWords.some(w => w.word === word.word)) {
                    learnedWords.push({
                        ...word,
                        correct_count: progress.correct_count || 0,
                        error_count: progress.error_count || 0,
                        is_new: false
                    });
                }
            }
        });
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
        localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
    }
    
    // 显示完成消息
    elements.studyArea.innerHTML = `
        <div class="completion-message">
            <div class="completion-icon">🎉</div>
            <h3>${currentMode === 'new' ? '新学' : '复习'}完成！</h3>
            <p>今天${currentMode === 'new' ? '新学' : '复习'}了 ${currentWordQueue.length} 个单词</p>
            <button class="btn btn-primary" id="backToListBtn">返回单词本</button>
        </div>
    `;
    
    document.getElementById('backToListBtn').addEventListener('click', () => {
        if (elements.studyButtons) {
            elements.studyButtons.classList.remove('hidden');
        }
        if (elements.queueInfo) {
            elements.queueInfo.classList.add('hidden');
        }
        elements.studyArea.innerHTML = '<p class="empty-message">选择上方按钮开始学习</p>';
        elements.studyHint.innerHTML = '<p>🎯 点击按钮开始学习之旅！</p>';
        updateStats();
        updateStudyButtons();
    });
}

/**
 * 渲染单词卡片
 */
function renderWordCard(word) {
    elements.studyArea.innerHTML = `
        <div class="word-card-display">
            <div class="quiz-header">
                <span class="phase-indicator">${PHASE_NAMES[currentPhase]}</span>
            </div>
            <div class="word-main-display">
                <div class="word-en">${escapeHtml(word.word)}</div>
                <div class="word-cn">${escapeHtml(word.word_cn)}</div>
            </div>
            <div class="word-definition-section">
                <div class="section-label">释义</div>
                <div class="word-definition">${escapeHtml(word.definition || '暂无')}</div>
            </div>
            <div class="word-example-section">
                <div class="section-label">例句</div>
                <div class="word-example">${escapeHtml(word.example || '暂无')}</div>
                ${word.example_cn ? `<div class="word-example-cn">${escapeHtml(word.example_cn)}</div>` : ''}
            </div>
            <button class="continue-btn" id="continueBtn">记住了，继续 →</button>
        </div>
    `;
    
    document.getElementById('continueBtn').addEventListener('click', () => {
        // 初始化该词的学习进度（如果还没有）
        if (!wordProgress[word.id]) {
            wordProgress[word.id] = { correct_count: 0, error_count: 0 };
            localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
        }
        
        // 移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    });
}

/**
 * 生成选项
 */
function generateOptions(word, phase) {
    const otherWords = vocabulary.filter(w => w.id !== word.id);
    const shuffled = shuffleArray([...otherWords]).slice(0, 3);
    
    switch (phase) {
        case StudyPhase.EN_SELECT_CN:
            // 英文 -> 选中文
            return shuffleArray([word.word_cn, ...shuffled.map(w => w.word_cn)]);
        case StudyPhase.CN_SELECT_EN:
            // 中文 -> 选英文
            return shuffleArray([word.word, ...shuffled.map(w => w.word)]);
        case StudyPhase.EN_SELECT_DEF:
            // 英文 -> 选释义
            return shuffleArray([
                word.definition || word.word_cn,
                ...shuffled.map(w => w.definition || w.word_cn)
            ]);
        case StudyPhase.DEF_SELECT_EN:
            // 释义 -> 选英文
            return shuffleArray([word.word, ...shuffled.map(w => w.word)]);
        default:
            return [];
    }
}

/**
 * 渲染选择题卡片
 */
function renderQuizCard(word) {
    const phaseInfo = {
        [StudyPhase.EN_SELECT_CN]: { prompt: '选择中文释义', main: word.word, type: 'word-en' },
        [StudyPhase.CN_SELECT_EN]: { prompt: '选择英文单词', main: word.word_cn, type: 'word-cn' },
        [StudyPhase.EN_SELECT_DEF]: { prompt: '选择正确释义', main: word.word, type: 'word-en' },
        [StudyPhase.DEF_SELECT_EN]: { prompt: '选择对应单词', main: word.definition || word.word_cn, type: 'definition' }
    };
    
    const info = phaseInfo[currentPhase];
    const options = generateOptions(word, currentPhase);
    
    elements.studyArea.innerHTML = `
        <div class="quiz-header">
            <span class="phase-indicator">${PHASE_NAMES[currentPhase]}</span>
        </div>
        <div class="word-display ${info.type}">${escapeHtml(info.main)}</div>
        <div class="word-type">${info.prompt}</div>
        <div class="options-grid">
            ${options.map((opt, idx) => `
                <button class="option-btn" data-index="${idx}" data-value="${escapeHtml(opt)}">
                    ${escapeHtml(opt)}
                </button>
            `).join('')}
        </div>
    `;
    
    elements.studyArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleOptionClick(btn, word));
    });
}

/**
 * 处理选项点击
 */
function handleOptionClick(btn, word) {
    if (isWaiting) return;
    
    const selectedValue = btn.dataset.value;
    let correctAnswer;
    
    switch (currentPhase) {
        case StudyPhase.EN_SELECT_CN:
            correctAnswer = word.word_cn;
            break;
        case StudyPhase.CN_SELECT_EN:
        case StudyPhase.DEF_SELECT_EN:
            correctAnswer = word.word;
            break;
        case StudyPhase.EN_SELECT_DEF:
            correctAnswer = word.definition || word.word_cn;
            break;
    }
    
    const isCorrect = selectedValue === correctAnswer;
    
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (!isCorrect) {
        // 选错：找出正确答案并高亮
        elements.studyArea.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.value === correctAnswer) {
                b.classList.add('correct');
            }
        });
        
        handleWrongAnswer(word);
        return;
    }
    
    // 选对
    handleCorrectAnswer(word);
}

/**
 * 处理答错
 */
function handleWrongAnswer(word) {
    isWaiting = true;
    
    // 获取或初始化进度
    if (!wordProgress[word.id]) {
        wordProgress[word.id] = { correct_count: 0, error_count: 0 };
    }
    
    // 1. 清零该词连续正确次数
    wordProgress[word.id].correct_count = 0;
    
    // 2. 增加该词错误次数
    wordProgress[word.id].error_count = (wordProgress[word.id].error_count || 0) + 1;
    
    const totalErrors = wordProgress[word.id].error_count;
    const progress = wordProgress[word.id];
    
    // 更新进度
    progress.last_practice_date = new Date().toISOString();
    wordProgress[word.id] = progress;
    localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
    
    // 更新已学列表中的记录
    learnedWords = learnedWords.map(w => {
        if (w.id === word.id) {
            return { ...w, correct_count: 0, error_count: totalErrors };
        }
        return w;
    });
    localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
    
    // 3. 从生词本移除（如果存在）
    newWords = newWords.filter(w => w.word !== word.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
    
    // 4. 如果错误次数达到阈值，添加到错词本
    if (totalErrors >= CONFIG.ERROR_THRESHOLD) {
        if (!wrongWords.some(w => w.word === word.word)) {
            wrongWords.push({
                ...word,
                error_count: totalErrors,
                added_to_wrong_at: new Date().toISOString()
            });
        } else {
            // 更新错词本的错误次数
            wrongWords = wrongWords.map(w => {
                if (w.word === word.word) {
                    return { ...w, error_count: totalErrors };
                }
                return w;
            });
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！该词已移入错词本（累计错误${totalErrors}次）</p>`;
    } else {
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！（累计错误${totalErrors}次）</p>`;
    }
    elements.studyHint.classList.add('error');
    
    // 3. 将该词添加到当前题型的错词列表中
    if (!wrongWordsInPhase.some(w => w.word === word.word)) {
        wrongWordsInPhase.push(word);
    }
    
    updateStats();
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('error');
        
        // 4. 移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 处理答对
 */
function handleCorrectAnswer(word) {
    isWaiting = true;
    
    // 获取或初始化进度
    if (!wordProgress[word.id]) {
        wordProgress[word.id] = { correct_count: 0, error_count: 0 };
    }
    
    // 增加正确次数
    wordProgress[word.id].correct_count = (wordProgress[word.id].correct_count || 0) + 1;
    wordProgress[word.id].last_practice_date = new Date().toISOString();
    
    const correctCount = wordProgress[word.id].correct_count;
    
    // 保存进度
    localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
    
    // 从错词本移除（如果存在）
    const wasInWrongList = wrongWords.some(w => w.word === word.word);
    wrongWords = wrongWords.filter(w => w.word !== word.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
    // 更新已学列表中的记录
    learnedWords = learnedWords.map(w => {
        if (w.id === word.id) {
            return { ...w, correct_count: correctCount };
        }
        return w;
    });
    localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
    
    // 更新进度显示
    updateProgressDisplay(correctCount);
    
    // 显示正确提示
    if (wasInWrongList) {
        elements.studyHint.innerHTML = `<p class="correct-hint">✅ 正确！已从错词本移除！</p>`;
    } else {
        elements.studyHint.innerHTML = `<p class="correct-hint">✅ 正确！进度 ${correctCount}/${CONFIG.CORRECT_TO_MASTER}</p>`;
    }
    elements.studyHint.classList.add('correct');
    
    // 检查是否掌握
    if (correctCount >= CONFIG.CORRECT_TO_MASTER) {
        setTimeout(() => {
            masteredWord(word);
        }, 1000);
        return;
    }
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        
        // 6. 答对后移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    }, 1000);
}

/**
 * 标记单词为已掌握
 */
function masteredWord(word) {
    const correctCount = wordProgress[word.id]?.correct_count || 0;
    
    const masteredWordObj = {
        ...word,
        correct_count: correctCount,
        masteredAt: new Date().toISOString()
    };
    
    masteredWords.push(masteredWordObj);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MASTERED, JSON.stringify(masteredWords));
    
    // 清除该单词的进度
    delete wordProgress[word.id];
    localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
    
    // 从生词本、已学列表和错词本移除
    newWords = newWords.filter(w => w.word !== word.word);
    learnedWords = learnedWords.filter(w => w.word !== word.word);
    wrongWords = wrongWords.filter(w => w.word !== word.word);
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
    localStorage.setItem('learnedWords', JSON.stringify(learnedWords));
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
    elements.studyHint.innerHTML = `<p class="master-hint">🎉 太棒了！${word.word} 已移入掌握区！</p>`;
    elements.studyHint.classList.add('correct');
    
    updateStats();
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        
        // 移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    }, 2000);
}

/**
 * 更新进度显示
 */
function updateProgressDisplay(correctCount) {
    const percentage = (correctCount / CONFIG.CORRECT_TO_MASTER) * 100;
    elements.progressText.textContent = `进度: ${correctCount}/${CONFIG.CORRECT_TO_MASTER}`;
    elements.progressFill.style.width = `${percentage}%`;
    if (elements.currentStreak) {
        elements.currentStreak.textContent = correctCount;
    }
}

/**
 * 显示消息
 */
function showMessage(text, type = 'info') {
    elements.studyHint.innerHTML = `<p class="${type}-hint">${text}</p>`;
    elements.studyHint.classList.add(type);
    setTimeout(() => {
        elements.studyHint.classList.remove(type);
    }, 3000);
}

/**
 * 渲染已掌握列表
 */
function renderMasteredList() {
    if (!elements.masteredList) return;
    
    if (masteredWords.length === 0) {
        elements.masteredList.innerHTML = '<p class="empty-message">暂无已掌握的单词，继续学习吧！</p>';
        return;
    }
    
    elements.masteredList.innerHTML = masteredWords.map(word => `
        <div class="word-item mastered">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
            </div>
            <span class="word-meta">${word.category || ''}</span>
        </div>
    `).join('');
}

/**
 * 渲染错词列表
 */
function renderWrongList() {
    if (!elements.wrongList) return;
    
    if (wrongWords.length === 0) {
        elements.wrongList.innerHTML = '<p class="empty-message">暂无错词本中的单词，太棒了！</p>';
        return;
    }
    
    elements.wrongList.innerHTML = wrongWords.map(word => `
        <div class="word-item wrong">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
            </div>
            <span class="word-meta error-count">错 ${word.error_count || 0} 次</span>
        </div>
    `).join('');
}

/**
 * 渲染已学列表
 */
function renderLearnedList() {
    if (!elements.learnedList) return;
    
    if (learnedWords.length === 0) {
        elements.learnedList.innerHTML = '<p class="empty-message">暂无已学的单词，继续学习新词吧！</p>';
        return;
    }
    
    elements.learnedList.innerHTML = learnedWords.map(word => `
        <div class="word-item learned">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
            </div>
            <span class="word-meta progress-info">进度 ${word.correct_count || 0}/${CONFIG.CORRECT_TO_MASTER}</span>
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
        const isWrong = wrongWords.some(w => w.word === word.word);
        const isNew = newWords.some(n => n.word === word.word);
        const isLearned = learnedWords.some(l => l.word === word.word);
        const progress = wordProgress[word.id];
        
        let status = '';
        if (isMastered) status = '<span class="status-badge mastered">已掌握</span>';
        else if (isWrong) status = '<span class="status-badge wrong">错词</span>';
        else if (isNew) status = '<span class="status-badge new">新词</span>';
        else if (isLearned) status = `<span class="status-badge learned">已学 ${progress?.correct_count || 0}/12</span>`;
        else if (progress) status = `<span class="status-badge learning">进行中 ${progress.correct_count}/12</span>`;
        
        return `
            <div class="word-item">
                <div class="word-main">
                    <span class="word-text">${escapeHtml(word.word)}</span>
                    <span class="word-cn">${escapeHtml(word.word_cn)}</span>
                </div>
                <div class="word-item-right">
                    ${status}
                    <span class="word-meta">${word.category || ''}</span>
                </div>
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
        id: 'vocab-' + Date.now(),
        word: document.getElementById('word').value.trim(),
        word_cn: document.getElementById('wordCn').value.trim(),
        definition: document.getElementById('definition').value.trim(),
        example: document.getElementById('example').value.trim(),
        example_cn: document.getElementById('exampleCn').value.trim(),
        category: document.getElementById('category').value,
        correct_count: 0,
        error_count: 0,
        is_new: true,
        last_practice_date: ''
    };
    
    // 检查是否重复
    if (vocabulary.some(v => v.word.toLowerCase() === word.word.toLowerCase())) {
        alert('该单词已存在！');
        return;
    }
    
    vocabulary.push(word);
    newWords.push(word);
    
    // 保存到localStorage
    localStorage.setItem('vocabulary_local', JSON.stringify(vocabulary));
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
    
    alert('单词添加成功！\n提示：本地添加的单词需要联系小科同步到云端。');
    window.location.reload();
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
            clearTimeout(timeout);
        };
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
