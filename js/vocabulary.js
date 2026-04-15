/**
 * vocabulary.js - 生词本学习脚本（重构版 v2）
 * 
 * 学习流程重构：
 * - 新学：卡片+英选中交替 → 所有词中选英 → 英选义 → 义选英
 * - 复习（已学）：英选中 → 中选英 → 英选义 → 义选英
 * - 英选中做错：不做卡片，直接放到本轮末尾再练习英选中
 * 
 * 单词状态：
 * - new: 新词（从未展示过卡片）
 * - studying: 正在学（展示了卡片但未完成4个题型各一遍）
 * - learned: 已学（完成4个题型但未掌握，correct_count < 12）
 * - mastered: 已掌握（连续正确12次）
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
    EN_SELECT_CN: 1,         // 英文 -> 选中文
    CN_SELECT_EN: 2,        // 中文 -> 选英文
    EN_SELECT_DEF: 3,       // 英文 -> 选释义
    DEF_SELECT_EN: 4        // 释义 -> 选英文
};

// 题型名称（用于内部标识）
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

// 配置
const CONFIG = {
    CORRECT_TO_MASTER: 12,  // 需要连续答对12次才掌握
    ERROR_THRESHOLD: 3,     // 进入错词本的累计错误次数
    DEFAULT_STUDY_COUNT: 50, // 默认每次学习的单词数量
    vocabularyUrl: 'data/vocabulary.json',
    wrongWordsUrl: 'data/wrong-words.json',
    STORAGE_KEYS: {
        VOCABULARY: 'vocabularyData',      // 词汇库（含所有进度）
        WRONG_WORDS: 'wrongWords',         // 错词本（累计错误>=3）
        STUDY_COUNT: 'studyCount',         // 每次学习单词数量
        PRACTICE_DATE: 'practiceDate',     // 上次练习日期
        TODAY_COMPLETED: 'todayCompleted'  // 今日是否完成
    }
};

// 单词状态常量
const WordStatus = {
    NEW: 'new',           // 新词
    STUDYING: 'studying', // 正在学
    LEARNED: 'learned',   // 已学
    MASTERED: 'mastered'  // 已掌握
};

// 全局状态
let vocabularyData = {};     // 所有词汇及其进度（id -> wordData）
let wrongWords = [];          // 错词本
let masteredWords = [];       // 已掌握词汇列表
let studyCount = CONFIG.DEFAULT_STUDY_COUNT;

// 学习状态
let currentMode = null;      // 'new' | 'review'
let currentPhase = StudyPhase.SHOW_CARD;
let currentPhaseIndex = 0;
let isWaiting = false;

// 批量学习队列
let currentWordQueue = [];   // 当前学习的词队列
let currentWordIndex = 0;     // 当前正在学习的词在队列中的索引
let wrongWordsInPhase = [];   // 当前题型中答错的词（需要重做）

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
    elements.studyingList = document.getElementById('studyingList');
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
    } else if (tab === 'wrong') {
        renderWrongList();
    } else if (tab === 'all') {
        renderWordList();
    } else if (tab === 'learned') {
        renderLearnedList();
    } else if (tab === 'studying') {
        renderStudyingList();
    }
}

/**
 * 获取所有词汇（带进度信息）
 */
function getAllVocabulary() {
    return Object.values(vocabularyData);
}

/**
 * 获取各状态词汇
 */
function getWordsByStatus(status) {
    return getAllVocabulary().filter(w => w.status === status);
}

/**
 * 获取新词列表
 */
function getNewWords() {
    return getWordsByStatus(WordStatus.NEW);
}

/**
 * 获取正在学的词汇列表
 */
function getStudyingWords() {
    return getWordsByStatus(WordStatus.STUDYING);
}

/**
 * 获取已学词汇列表
 */
function getLearnedWords() {
    return getWordsByStatus(WordStatus.LEARNED);
}

/**
 * 获取已掌握词汇列表
 */
function getMasteredWords() {
    return getWordsByStatus(WordStatus.MASTERED);
}

/**
 * 获取错词本列表
 */
function getWrongWordList() {
    return getAllVocabulary().filter(w => w.error_count >= CONFIG.ERROR_THRESHOLD);
}

/**
 * 加载所有数据
 */
async function loadAllData() {
    // 加载原始词汇库
    try {
        const response = await fetch(CONFIG.vocabularyUrl);
        if (response.ok) {
            const vocabList = await response.json();
            // 初始化或更新词汇数据
            vocabList.forEach(vocab => {
                if (!vocabularyData[vocab.id]) {
                    // 新词汇，初始化进度
                    vocabularyData[vocab.id] = {
                        ...vocab,
                        status: WordStatus.NEW,
                        correct_count: 0,
                        error_count: 0,
                        phase_en_cn: false,
                        phase_cn_en: false,
                        phase_en_def: false,
                        phase_def_en: false,
                        current_phase: StudyPhase.SHOW_CARD,
                        last_practice_date: ''
                    };
                } else {
                    // 已有词汇，保留进度但更新基本信息
                    vocabularyData[vocab.id] = {
                        ...vocab,
                        ...vocabularyData[vocab.id]
                    };
                }
            });
        }
    } catch (error) {
        console.error('加载词汇数据失败:', error);
    }
    
    // 从localStorage加载进度数据
    const savedVocab = localStorage.getItem(CONFIG.STORAGE_KEYS.VOCABULARY);
    if (savedVocab) {
        const savedData = JSON.parse(savedVocab);
        // 合并保存的进度
        Object.keys(savedData).forEach(id => {
            if (vocabularyData[id]) {
                vocabularyData[id] = { ...vocabularyData[id], ...savedData[id] };
            }
        });
    }
    
    // 加载错词本
    wrongWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.WRONG_WORDS) || '[]');
    
    // 加载已掌握列表
    masteredWords = JSON.parse(localStorage.getItem('masteredWords') || '[]');
    
    // 恢复学习数量设置
    studyCount = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.STUDY_COUNT)) || CONFIG.DEFAULT_STUDY_COUNT;
    
    // 同步错词本状态
    syncWrongWords();
    
    // 渲染界面
    updateStats();
    updateStudyButtons();
}

/**
 * 同步错词本状态
 */
function syncWrongWords() {
    const wrongWordList = getWrongWordList();
    wrongWords = wrongWordList.map(w => ({
        ...w,
        added_to_wrong_at: w.added_to_wrong_at || new Date().toISOString()
    }));
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
}

/**
 * 保存词汇进度
 */
function saveVocabularyData() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.VOCABULARY, JSON.stringify(vocabularyData));
}

/**
 * 更新统计信息
 */
function updateStats() {
    const stats = {
        newCount: getNewWords().length,
        studyingCount: getStudyingWords().length,
        wrongCount: wrongWords.length,
        learnedCount: getLearnedWords().length,
        masteredCount: getMasteredWords().length + masteredWords.length
    };
    
    ['newCount', 'wrongCount', 'masteredCount'].forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = stats[key];
    });
    
    // 更新正在学数量
    const studyingCountEl = document.getElementById('studyingCount');
    if (studyingCountEl) studyingCountEl.textContent = stats.studyingCount;
    
    // 更新已学数量
    const learnedCountEl = document.getElementById('learnedCount');
    if (learnedCountEl) learnedCountEl.textContent = stats.learnedCount;
    
    // 更新复习按钮数量
    const reviewCountEl = document.getElementById('reviewCount');
    if (reviewCountEl) reviewCountEl.textContent = getLearnedWords().length;
    
    // 更新新学/继续学习按钮数量
    const newStudyCountEl = document.getElementById('newStudyCount');
    if (newStudyCountEl) newStudyCountEl.textContent = getNewWords().length;
    
    const continueStudyCountEl = document.getElementById('continueStudyCount');
    if (continueStudyCountEl) continueStudyCountEl.textContent = getStudyingWords().length;
    
    if (elements.todayCount) {
        const studiedToday = Object.values(vocabularyData).filter(w => w.last_practice_date && w.last_practice_date.startsWith(new Date().toISOString().split('T')[0])).length;
        elements.todayCount.textContent = studiedToday;
    }
}

/**
 * 更新学习按钮状态
 */
function updateStudyButtons() {
    if (!elements.studyButtons) return;
    
    const newWords = getNewWords();
    const studyingWords = getStudyingWords();
    const learnedWords = getLearnedWords();
    
    const totalStudyCount = Math.min(studyCount, newWords.length + studyingWords.length);
    
    elements.studyButtons.innerHTML = `
        <div class="study-count-setting">
            <label for="studyCountInput">每次学习:</label>
            <input type="number" id="studyCountInput" value="${studyCount}" min="1" max="200">
            <span>个词</span>
        </div>
        <button class="btn btn-primary study-btn" id="newStudyBtn" ${newWords.length === 0 && studyingWords.length === 0 ? 'disabled' : ''}>
            📚 开始学习 (${totalStudyCount})
        </button>
        <button class="btn btn-secondary study-btn" id="reviewBtn" ${learnedWords.length === 0 ? 'disabled' : ''}>
            🔄 复习已学 (${learnedWords.length})
        </button>
    `;
    
    // 绑定事件
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
            updateStudyButtons();
        });
    }
}

/**
 * 开始学习模式
 */
function startStudyMode(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    wrongWordsInPhase = [];
    
    if (mode === 'new') {
        // 新学：从新词 + 正在学中取词
        const newWords = getNewWords();
        const studyingWords = getStudyingWords();
        
        // 新词优先，然后是正在学的
        let allWords = [...newWords, ...studyingWords];
        
        // 按进度恢复：如果有正在学的词，从它的进度继续
        if (studyingWords.length > 0) {
            // 找第一个需要继续的词
            const firstIncomplete = studyingWords.find(w => !isWordComplete(w));
            if (firstIncomplete) {
                // 从这个词开始排序
                const idx = allWords.findIndex(w => w.id === firstIncomplete.id);
                if (idx > 0) {
                    allWords = [...allWords.slice(idx), ...allWords.slice(0, idx)];
                }
            }
        }
        
        currentWordQueue = allWords.slice(0, Math.min(studyCount, allWords.length));
        
        // 确定起始阶段：如果是继续学习，从该词的当前阶段开始
        if (currentWordQueue.length > 0 && currentWordQueue[0].status === WordStatus.STUDYING) {
            currentPhase = currentWordQueue[0].current_phase || StudyPhase.SHOW_CARD;
        } else {
            currentPhase = StudyPhase.SHOW_CARD;
        }
        
    } else {
        // 复习：从已学中取
        const learnedWords = getLearnedWords();
        currentWordQueue = learnedWords.slice(0, Math.min(studyCount, learnedWords.length));
        
        // 复习从英选中开始
        currentPhase = StudyPhase.EN_SELECT_CN;
    }
    
    if (currentWordQueue.length === 0) {
        showMessage('没有可学习的词了！', 'info');
        updateStudyButtons();
        return;
    }
    
    // 计算阶段索引
    currentPhaseIndex = PHASE_SEQUENCE.indexOf(currentPhase);
    if (currentPhaseIndex === -1) {
        currentPhaseIndex = 0;
        if (currentPhase === StudyPhase.SHOW_CARD) {
            // 新学模式且从卡片开始
            currentPhaseIndex = -1; // 还没有进入题型
        }
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
 * 检查词是否完成了所有题型
 */
function isWordComplete(word) {
    return word.phase_en_cn && word.phase_cn_en && word.phase_en_def && word.phase_def_en;
}

/**
 * 更新队列信息
 */
function updateQueueInfo() {
    if (elements.queueInfo) {
        const totalWords = currentWordQueue.length;
        const currentIdx = currentWordIndex + 1;
        
        let phaseText = '';
        if (currentPhase === StudyPhase.SHOW_CARD) {
            phaseText = '展示卡片';
        } else {
            phaseText = PHASE_NAMES[currentPhase];
        }
        
        elements.queueInfo.innerHTML = `
            <span class="queue-badge">${currentMode === 'new' ? '新学模式' : '复习模式'}</span>
            <span class="phase-badge">${phaseText}</span>
            <span class="word-progress">第 ${currentIdx} / ${totalWords} 个词</span>
            ${wrongWordsInPhase.length > 0 ? `<span class="retry-badge">需重做: ${wrongWordsInPhase.length}个</span>` : ''}
        `;
    }
}

/**
 * 渲染当前题目
 */
function renderCurrentQuestion() {
    // 检查是否有需要重做的词
    if (wrongWordsInPhase.length > 0 && currentWordIndex >= currentWordQueue.length) {
        handleRetryWords();
        return;
    }
    
    if (currentWordIndex >= currentWordQueue.length) {
        // 队列完成，进入下一题型
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
        vocabularyData[wordInQueue.id].correct_count = 0;
        vocabularyData[wordInQueue.id].last_practice_date = new Date().toISOString();
        saveVocabularyData();
        
        // 显示提示
        elements.studyHint.innerHTML = `<p class="retry-hint">🔄 重做「${wordInQueue.word}」...</p>`;
        
        // 重新渲染当前题型
        renderQuizCard(wordInQueue);
    } else {
        // 如果词不在队列中，直接继续
        renderCurrentQuestion();
    }
}

/**
 * 进入下一题型
 */
function moveToNextPhase() {
    // 清空当前题型的错词列表
    wrongWordsInPhase = [];
    
    // 标记当前队列中的词已完成当前阶段
    currentWordQueue.forEach(word => {
        markPhaseComplete(word, currentPhase);
    });
    
    // 确定下一个阶段
    if (currentMode === 'new' && currentPhase === StudyPhase.SHOW_CARD) {
        // 新学模式：卡片展示完成后进入英选中
        currentPhase = StudyPhase.EN_SELECT_CN;
        currentPhaseIndex = 0;
        elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入英文选中文环节！</p>`;
    } else {
        // 进入下一个题型
        currentPhaseIndex++;
        
        if (currentPhaseIndex >= PHASE_SEQUENCE.length) {
            // 所有题型完成，学习结束
            completeStudy();
            return;
        }
        
        currentPhase = PHASE_SEQUENCE[currentPhaseIndex];
        
        const phaseNames = {
            [StudyPhase.CN_SELECT_EN]: '中文选英文',
            [StudyPhase.EN_SELECT_DEF]: '英文选释义',
            [StudyPhase.DEF_SELECT_EN]: '释义选英文'
        };
        elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入${phaseNames[currentPhase]}环节！</p>`;
    }
    
    // 更新队列中所有词的当前阶段
    currentWordQueue.forEach(word => {
        vocabularyData[word.id].current_phase = currentPhase;
    });
    saveVocabularyData();
    
    // 重置词队列索引
    currentWordIndex = 0;
    
    setTimeout(() => {
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 标记阶段完成
 */
function markPhaseComplete(word, phase) {
    switch (phase) {
        case StudyPhase.EN_SELECT_CN:
            vocabularyData[word.id].phase_en_cn = true;
            break;
        case StudyPhase.CN_SELECT_EN:
            vocabularyData[word.id].phase_cn_en = true;
            break;
        case StudyPhase.EN_SELECT_DEF:
            vocabularyData[word.id].phase_en_def = true;
            break;
        case StudyPhase.DEF_SELECT_EN:
            vocabularyData[word.id].phase_def_en = true;
            break;
    }
    vocabularyData[word.id].last_practice_date = new Date().toISOString();
    saveVocabularyData();
}

/**
 * 完成学习
 */
function completeStudy() {
    // 更新所有词的状态
    currentWordQueue.forEach(word => {
        const wordData = vocabularyData[word.id];
        
        // 检查是否已掌握
        if (wordData.correct_count >= CONFIG.CORRECT_TO_MASTER) {
            // 已掌握
            vocabularyData[word.id].status = WordStatus.MASTERED;
            if (!masteredWords.some(m => m.id === word.id)) {
                masteredWords.push({ ...wordData });
            }
        } else if (wordData.status === WordStatus.NEW) {
            // 新词变成正在学
            vocabularyData[word.id].status = WordStatus.STUDYING;
        } else if (wordData.status === WordStatus.STUDYING && isWordComplete(wordData)) {
            // 正在学完成所有题型，变成已学
            vocabularyData[word.id].status = WordStatus.LEARNED;
        }
        
        vocabularyData[word.id].last_practice_date = new Date().toISOString();
    });
    
    saveVocabularyData();
    localStorage.setItem('masteredWords', JSON.stringify(masteredWords));
    
    // 显示完成消息
    elements.studyArea.innerHTML = `
        <div class="completion-message">
            <div class="completion-icon">🎉</div>
            <h3>${currentMode === 'new' ? '学习' : '复习'}完成！</h3>
            <p>${currentMode === 'new' ? '学习' : '复习'}了 ${currentWordQueue.length} 个单词</p>
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
    // 如果是正在学的词且已有卡片进度，跳过卡片直接进入英选中
    if (word.status === WordStatus.STUDYING && vocabularyData[word.id].phase_en_cn) {
        vocabularyData[word.id].current_phase = StudyPhase.EN_SELECT_CN;
        saveVocabularyData();
        currentPhase = StudyPhase.EN_SELECT_CN;
        renderQuizCard(word);
        return;
    }
    
    elements.studyArea.innerHTML = `
        <div class="word-card-display">
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
        if (!vocabularyData[word.id]) {
            vocabularyData[word.id] = {
                ...word,
                status: WordStatus.NEW,
                correct_count: 0,
                error_count: 0,
                phase_en_cn: false,
                phase_cn_en: false,
                phase_en_def: false,
                phase_def_en: false,
                current_phase: StudyPhase.SHOW_CARD,
                last_practice_date: ''
            };
        }
        
        // 标记该词状态为正在学
        if (vocabularyData[word.id].status === WordStatus.NEW) {
            vocabularyData[word.id].status = WordStatus.STUDYING;
        }
        vocabularyData[word.id].current_phase = StudyPhase.EN_SELECT_CN;
        saveVocabularyData();
        
        // 新学模式：卡片后直接进入该词的英选中
        currentPhase = StudyPhase.EN_SELECT_CN;
        
        // 移动到下一个词（下一个词显示卡片）
        currentWordIndex++;
        
        // 但当前词需要做英选中
        // 英选中做错的不显示卡片，直接再做一次英选中
        renderQuizCard(word);
    });
}

/**
 * 生成选项
 */
function generateOptions(word, phase) {
    const otherWords = Object.values(vocabularyData).filter(w => w.id !== word.id);
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
 * 渲染选择题卡片（不显示题型名称）
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
        <div class="quiz-card-display">
            <div class="word-display ${info.type}">${escapeHtml(info.main)}</div>
            <div class="options-grid">
                ${options.map((opt, idx) => `
                    <button class="option-btn" data-index="${idx}" data-value="${escapeHtml(opt)}">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
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
    
    const wordData = vocabularyData[word.id];
    
    // 1. 清零该词连续正确次数
    wordData.correct_count = 0;
    
    // 2. 增加该词错误次数
    wordData.error_count = (wordData.error_count || 0) + 1;
    wordData.last_practice_date = new Date().toISOString();
    
    saveVocabularyData();
    
    const totalErrors = wordData.error_count;
    
    // 3. 如果错误次数达到阈值，添加到错词本
    if (totalErrors >= CONFIG.ERROR_THRESHOLD) {
        if (!wrongWords.some(w => w.word === word.word)) {
            wrongWords.push({
                ...wordData,
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
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！（累计错误${totalErrors}次，已移入错词本）</p>`;
    } else {
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！（累计错误${totalErrors}次）</p>`;
    }
    elements.studyHint.classList.add('error');
    
    // 4. 将该词添加到当前题型的错词列表中（用于本轮重做）
    // 新学模式的英选中做错：不展示卡片，直接放到本轮末尾再做一次英选中
    if (!wrongWordsInPhase.some(w => w.word === word.word)) {
        wrongWordsInPhase.push(word);
    }
    
    updateStats();
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('error');
        
        // 5. 移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 处理答对
 */
function handleCorrectAnswer(word) {
    isWaiting = true;
    
    const wordData = vocabularyData[word.id];
    
    // 增加正确次数
    wordData.correct_count = (wordData.correct_count || 0) + 1;
    wordData.last_practice_date = new Date().toISOString();
    
    const correctCount = wordData.correct_count;
    
    saveVocabularyData();
    
    // 从错词本移除（如果存在）
    const wasInWrongList = wrongWords.some(w => w.word === word.word);
    wrongWords = wrongWords.filter(w => w.word !== word.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
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
        
        // 答对后移动到下一个词
        currentWordIndex++;
        renderCurrentQuestion();
    }, 1000);
}

/**
 * 标记单词为已掌握
 */
function masteredWord(word) {
    const wordData = vocabularyData[word.id];
    const correctCount = wordData.correct_count;
    
    const masteredWordObj = {
        ...wordData,
        status: WordStatus.MASTERED,
        correct_count: correctCount,
        masteredAt: new Date().toISOString()
    };
    
    vocabularyData[word.id].status = WordStatus.MASTERED;
    vocabularyData[word.id].masteredAt = masteredWordObj.masteredAt;
    saveVocabularyData();
    
    if (!masteredWords.some(m => m.id === word.id)) {
        masteredWords.push(masteredWordObj);
    }
    localStorage.setItem('masteredWords', JSON.stringify(masteredWords));
    
    elements.studyHint.innerHTML = `<p class="master-hint">🎉 太棒了！${word.word} 已掌握！</p>`;
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
 * 渲染正在学列表
 */
function renderStudyingList() {
    if (!elements.studyingList) return;
    
    const studyingWords = getStudyingWords();
    
    if (studyingWords.length === 0) {
        elements.studyingList.innerHTML = '<p class="empty-message">暂无正在学习的单词</p>';
        return;
    }
    
    elements.studyingList.innerHTML = studyingWords.map(word => {
        const phases = [];
        if (word.phase_en_cn) phases.push('✓');
        if (word.phase_cn_en) phases.push('✓');
        if (word.phase_en_def) phases.push('✓');
        if (word.phase_def_en) phases.push('✓');
        
        return `
            <div class="word-item studying">
                <div class="word-main">
                    <span class="word-text">${escapeHtml(word.word)}</span>
                    <span class="word-cn">${escapeHtml(word.word_cn)}</span>
                </div>
                <span class="word-meta progress-info">题型进度: ${phases.length}/4</span>
            </div>
        `;
    }).join('');
}

/**
 * 渲染已掌握列表
 */
function renderMasteredList() {
    if (!elements.masteredList) return;
    
    const allMastered = [...getMasteredWords(), ...masteredWords];
    
    if (allMastered.length === 0) {
        elements.masteredList.innerHTML = '<p class="empty-message">暂无已掌握的单词，继续学习吧！</p>';
        return;
    }
    
    elements.masteredList.innerHTML = allMastered.map(word => `
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
    
    const learnedWords = getLearnedWords();
    
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
    
    let filtered = Object.values(vocabularyData);
    
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
        const isMastered = word.status === WordStatus.MASTERED || masteredWords.some(m => m.id === word.id);
        const isWrong = wrongWords.some(w => w.word === word.word);
        const isNew = word.status === WordStatus.NEW;
        const isStudying = word.status === WordStatus.STUDYING;
        const isLearned = word.status === WordStatus.LEARNED;
        
        let status = '';
        if (isMastered) status = '<span class="status-badge mastered">已掌握</span>';
        else if (isWrong) status = '<span class="status-badge wrong">错词</span>';
        else if (isNew) status = '<span class="status-badge new">新词</span>';
        else if (isStudying) {
            const phases = [];
            if (word.phase_en_cn) phases.push('英');
            if (word.phase_cn_en) phases.push('中');
            if (word.phase_en_def) phases.push('义');
            if (word.phase_def_en) phases.push('英');
            status = `<span class="status-badge studying">正在学 ${phases.length}/4</span>`;
        }
        else if (isLearned) status = `<span class="status-badge learned">已学 ${word.correct_count || 0}/12</span>`;
        
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
    
    const wordId = 'vocab-' + Date.now();
    const newWord = {
        id: wordId,
        word: document.getElementById('word').value.trim(),
        word_cn: document.getElementById('wordCn').value.trim(),
        definition: document.getElementById('definition').value.trim(),
        example: document.getElementById('example').value.trim(),
        example_cn: document.getElementById('exampleCn').value.trim(),
        category: document.getElementById('category').value,
        correct_count: 0,
        error_count: 0,
        status: WordStatus.NEW,
        phase_en_cn: false,
        phase_cn_en: false,
        phase_en_def: false,
        phase_def_en: false,
        current_phase: StudyPhase.SHOW_CARD,
        last_practice_date: ''
    };
    
    // 检查是否在已掌握列表中
    if (masteredWords.some(m => m.word.toLowerCase() === newWord.word.toLowerCase())) {
        alert('该单词已掌握，无需重复学习！');
        return;
    }
    
    // 检查是否已存在
    if (Object.values(vocabularyData).some(v => v.word.toLowerCase() === newWord.word.toLowerCase())) {
        alert('该单词已存在！');
        return;
    }
    
    vocabularyData[wordId] = newWord;
    saveVocabularyData();
    
    alert('单词添加成功！');
    updateStats();
    updateStudyButtons();
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
        };
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
