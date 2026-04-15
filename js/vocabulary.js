/**
 * vocabulary.js - 生词本学习脚本（重构版）
 * 新学模式：卡片展示 → 英选中 → 中选英 → 英选义 → 义选英
 * 复习模式：英选中 → 中选英 → 英选义 → 义选英
 * 选错处理：展示卡片 → 重做当前步骤 → 清零连续正确次数
 */

// 学习阶段枚举
const StudyPhase = {
    SHOW_CARD: 0,           // 展示单词卡片
    EN_SELECT_CN: 1,        // 英文 -> 选中文
    CN_SELECT_EN: 2,        // 中文 -> 选英文
    EN_SELECT_DEF: 3,       // 英文 -> 选释义
    DEF_SELECT_EN: 4        // 释义 -> 选英文
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
    ERROR_THRESHOLD: 3,      // 进入错词本的累计错误次数
    vocabularyUrl: 'data/vocabulary.json',
    wrongWordsUrl: 'data/wrong-words.json',
    STORAGE_KEYS: {
        NEW_WORDS: 'newWords',           // 生词本（未练习过的新词）
        WRONG_WORDS: 'wrongWords',       // 错词本（累计错误>=3）
        MASTERED: 'masteredWords',       // 已掌握本
        PROGRESS: 'wordProgress',        // 学习进度
        PRACTICE_DATE: 'practiceDate',   // 上次练习日期
        TODAY_COMPLETED: 'todayCompleted' // 今日是否完成
    }
};

// 状态
let vocabulary = [];           // 原始词汇库
let newWords = [];              // 生词本
let wrongWords = [];            // 错词本
let masteredWords = [];         // 已掌握本
let wordProgress = {};          // 学习进度

// 学习状态
let currentMode = null;        // 'new' | 'review'
let currentWord = null;
let currentPhase = StudyPhase.SHOW_CARD;
let currentPhaseIndex = 0;      // 在循环中的位置 (0-3)
let correctCount = 0;           // 当前单词连续正确次数
let options = [];
let isWaiting = false;
let currentWordQueue = [];     // 当前学习队列
let currentWordIndex = 0;       // 当前学习的词在队列中的索引
let currentCyclePhase = 0;      // 当前循环阶段（0-3循环）

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
    masteredWords = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MASTERED) || '[]');
    wordProgress = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.PROGRESS) || '{}');
    
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
    // 找出词汇库中还没有在任何单词本中的词
    const practicedWords = new Set([
        ...masteredWords.map(w => w.word),
        ...wrongWords.map(w => w.word),
        ...Object.keys(wordProgress).map(id => {
            const word = vocabulary.find(v => v.id === id);
            return word ? word.word : null;
        }).filter(Boolean)
    ]);
    
    // 添加到生词本
    vocabulary.forEach(vocab => {
        if (!practicedWords.has(vocab.word) && !newWords.some(w => w.word === vocab.word)) {
            newWords.push({
                ...vocab,
                correct_count: 0,
                error_count: 0,
                is_new: true,
                last_practice_date: ''
            });
        }
    });
    
    // 保存更新后的生词本
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
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
        masteredCount: masteredWords.length
    };
    
    ['newCount', 'wrongCount', 'masteredCount'].forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = stats[key];
    });
    
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
    const todayCompleted = localStorage.getItem(CONFIG.STORAGE_KEYS.TODAY_COMPLETED) === 'true';
    
    elements.studyButtons.innerHTML = `
        <button class="btn btn-primary" id="newStudyBtn" ${!hasNewWords ? 'disabled' : ''}>
            📚 新学 (${newWords.length})
        </button>
        <button class="btn btn-secondary" id="reviewBtn" ${!hasReviewWords ? 'disabled' : ''}>
            🔄 复习 (${getReviewableWords().length})
        </button>
        ${todayCompleted ? '<span class="completed-badge">✅ 今日已完成</span>' : ''}
    `;
    
    // 重新绑定事件
    document.getElementById('newStudyBtn').addEventListener('click', () => startStudyMode('new'));
    document.getElementById('reviewBtn').addEventListener('click', () => startStudyMode('review'));
}

/**
 * 获取可以复习的词（不是新词且未掌握）
 */
function getReviewableWords() {
    const reviewable = [];
    
    // 从有进度的词中找
    Object.keys(wordProgress).forEach(wordId => {
        const progress = wordProgress[wordId];
        const vocabWord = vocabulary.find(v => v.id === wordId);
        
        if (vocabWord && !masteredWords.some(m => m.word === vocabWord.word)) {
            reviewable.push({
                ...vocabWord,
                correct_count: progress.correct_count || 0,
                error_count: progress.error_count || 0,
                is_new: false,
                last_practice_date: progress.last_practice_date || ''
            });
        }
    });
    
    // 从错词本中找
    wrongWords.forEach(word => {
        if (!reviewable.some(w => w.word === word.word) && !masteredWords.some(m => m.word === word.word)) {
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
    currentCyclePhase = 0;
    
    if (mode === 'new') {
        // 新学：从生词本取词
        currentWordQueue = [...newWords];
    } else {
        // 复习：从复习词中取
        currentWordQueue = getReviewableWords();
    }
    
    if (currentWordQueue.length === 0) {
        showMessage('没有可学习的词了！', 'info');
        updateStudyButtons();
        return;
    }
    
    // 隐藏按钮区域，显示学习区域
    if (elements.studyButtons) {
        elements.studyButtons.classList.add('hidden');
    }
    if (elements.queueInfo) {
        elements.queueInfo.classList.remove('hidden');
        elements.queueInfo.innerHTML = `<span class="queue-badge">${mode === 'new' ? '新学模式' : '复习模式'}</span> 共 ${currentWordQueue.length} 个词`;
    }
    
    // 开始学习第一个词
    startLearningCurrentWord();
}

/**
 * 开始学习当前队列中的词
 */
function startLearningCurrentWord() {
    if (currentWordIndex >= currentWordQueue.length) {
        // 队列完成
        completeCycle();
        return;
    }
    
    currentWord = currentWordQueue[currentWordIndex];
    currentCyclePhase = 0;
    
    // 获取或初始化进度
    const progress = wordProgress[currentWord.id] || { correct_count: 0, error_count: 0 };
    correctCount = progress.correct_count || 0;
    
    if (currentMode === 'new') {
        // 新学模式：先展示卡片
        currentPhase = StudyPhase.SHOW_CARD;
    } else {
        // 复习模式：直接开始选择题，从英选中开始
        currentPhase = PHASE_SEQUENCE[0];
    }
    
    updateQueueInfo();
    generateOptions();
    renderStudyCard();
    updateProgress();
}

/**
 * 更新队列信息
 */
function updateQueueInfo() {
    if (elements.queueInfo) {
        elements.queueInfo.innerHTML = `
            <span class="queue-badge">${currentMode === 'new' ? '新学模式' : '复习模式'}</span>
            第 ${currentWordIndex + 1} / ${currentWordQueue.length} 个词
        `;
    }
}

/**
 * 完成一轮学习循环
 */
function completeCycle() {
    // 标记今日完成
    localStorage.setItem(CONFIG.STORAGE_KEYS.TODAY_COMPLETED, 'true');
    
    // 从生词本移除已学习的词（如果它们还有进度）
    if (currentMode === 'new') {
        newWords = newWords.filter(w => {
            const progress = wordProgress[w.id];
            return !progress || progress.correct_count < CONFIG.CORRECT_TO_MASTER;
        });
        localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
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
 * 生成选项
 */
function generateOptions() {
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
        default:
            options = [];
    }
}

/**
 * 渲染学习卡片或选择题
 */
function renderStudyCard() {
    if (currentPhase === StudyPhase.SHOW_CARD) {
        renderWordCard();
    } else {
        renderQuizCard();
    }
}

/**
 * 渲染单词卡片（首次学习或选错后）
 */
function renderWordCard() {
    const roundNum = Math.floor(correctCount / 4) + 1;
    const phaseInRound = (correctCount % 4) + 1;
    
    elements.studyArea.innerHTML = `
        <div class="word-card-display">
            <div class="quiz-header">
                <span class="round-indicator">第 ${roundNum} 轮 · 第 ${phaseInRound} 题</span>
            </div>
            <div class="word-main-display">
                <div class="word-en">${escapeHtml(currentWord.word)}</div>
                <div class="word-cn">${escapeHtml(currentWord.word_cn)}</div>
            </div>
            <div class="word-definition-section">
                <div class="section-label">释义</div>
                <div class="word-definition">${escapeHtml(currentWord.definition || '暂无')}</div>
            </div>
            <div class="word-example-section">
                <div class="section-label">例句</div>
                <div class="word-example">${escapeHtml(currentWord.example || '暂无')}</div>
                ${currentWord.example_cn ? `<div class="word-example-cn">${escapeHtml(currentWord.example_cn)}</div>` : ''}
            </div>
            <button class="continue-btn" id="continueBtn">开始练习 →</button>
        </div>
    `;
    
    document.getElementById('continueBtn').addEventListener('click', () => {
        currentPhase = PHASE_SEQUENCE[0];
        currentCyclePhase = 0;
        generateOptions();
        renderStudyCard();
    });
}

/**
 * 渲染选择题卡片
 */
function renderQuizCard() {
    const phaseInfo = {
        [StudyPhase.EN_SELECT_CN]: { prompt: '选择中文释义', main: currentWord.word, type: 'word' },
        [StudyPhase.CN_SELECT_EN]: { prompt: '选择英文单词', main: currentWord.word_cn, type: 'word-cn' },
        [StudyPhase.EN_SELECT_DEF]: { prompt: '选择正确释义', main: currentWord.word, type: 'word' },
        [StudyPhase.DEF_SELECT_EN]: { prompt: '选择对应单词', main: currentWord.definition || currentWord.word_cn, type: 'definition' }
    };
    
    const info = phaseInfo[currentPhase];
    const roundNum = Math.floor(correctCount / 4) + 1;
    const phaseInRound = (correctCount % 4) + 1;
    
    elements.studyArea.innerHTML = `
        <div class="quiz-header">
            <span class="round-indicator">第 ${roundNum} 轮 · 第 ${phaseInRound} 题</span>
        </div>
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
    
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (!isCorrect) {
        // 选错：找出正确答案并高亮
        elements.studyArea.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.value === correctAnswer) {
                b.classList.add('correct');
            }
        });
        
        handleWrongAnswer();
        return;
    }
    
    // 选对
    handleCorrectAnswer();
}

/**
 * 处理答错
 */
function handleWrongAnswer() {
    isWaiting = true;
    
    // 更新错误计数
    if (!wordProgress[currentWord.id]) {
        wordProgress[currentWord.id] = { correct_count: 0, error_count: 0 };
    }
    wordProgress[currentWord.id].error_count = (wordProgress[currentWord.id].error_count || 0) + 1;
    
    const totalErrors = wordProgress[currentWord.id].error_count;
    
    // 从生词本移除（如果存在）
    newWords = newWords.filter(w => w.word !== currentWord.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
    
    // 如果错误次数达到阈值，添加到错词本
    if (totalErrors >= CONFIG.ERROR_THRESHOLD) {
        if (!wrongWords.some(w => w.word === currentWord.word)) {
            wrongWords.push({
                ...currentWord,
                error_count: totalErrors,
                added_to_wrong_at: new Date().toISOString()
            });
            localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
        }
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！该词已移入错词本（累计错误${totalErrors}次）</p>`;
    } else {
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 答错了！（累计错误${totalErrors}次）</p>`;
    }
    elements.studyHint.classList.add('error');
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('error');
        elements.studyHint.innerHTML = '<p>🎯 记住单词后，点击继续</p>';
        
        // 重置到卡片展示阶段
        currentPhase = StudyPhase.SHOW_CARD;
        saveProgress();
        renderStudyCard();
    }, 2000);
}

/**
 * 处理答对
 */
function handleCorrectAnswer() {
    isWaiting = true;
    correctCount++;
    currentCyclePhase = (currentCyclePhase + 1) % 4;
    
    // 保存进度
    saveProgress();
    
    // 从错词本移除（如果存在）
    wrongWords = wrongWords.filter(w => w.word !== currentWord.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
    // 更新进度显示
    updateProgress();
    
    // 检查是否掌握
    if (correctCount >= CONFIG.CORRECT_TO_MASTER) {
        masterWord();
        return;
    }
    
    // 继续下一个阶段
    elements.studyHint.innerHTML = '<p>✅ 正确！继续加油！</p>';
    elements.studyHint.classList.add('correct');
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        elements.studyHint.innerHTML = '<p>🎯 选择正确释义，继续加油！</p>';
        
        currentPhase = PHASE_SEQUENCE[currentCyclePhase];
        generateOptions();
        renderStudyCard();
    }, 1000);
}

/**
 * 保存进度
 */
function saveProgress() {
    wordProgress[currentWord.id] = {
        correct_count: correctCount,
        error_count: wordProgress[currentWord.id]?.error_count || 0,
        last_practice_date: new Date().toISOString()
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
    
    // 更新生词本中的记录
    newWords = newWords.map(w => {
        if (w.id === currentWord.id) {
            return { ...w, correct_count: correctCount, last_practice_date: new Date().toISOString() };
        }
        return w;
    });
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
}

/**
 * 标记单词为已掌握
 */
function masterWord() {
    const masteredWord = {
        ...currentWord,
        correct_count: correctCount,
        masteredAt: new Date().toISOString()
    };
    
    masteredWords.push(masteredWord);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MASTERED, JSON.stringify(masteredWords));
    
    // 清除该单词的进度
    delete wordProgress[currentWord.id];
    localStorage.setItem(CONFIG.STORAGE_KEYS.PROGRESS, JSON.stringify(wordProgress));
    
    // 从生词本和错词本移除
    newWords = newWords.filter(w => w.word !== currentWord.word);
    wrongWords = wrongWords.filter(w => w.word !== currentWord.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.NEW_WORDS, JSON.stringify(newWords));
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
    elements.studyHint.innerHTML = `<p>🎉 太棒了！${currentWord.word} 已移入掌握区！</p>`;
    elements.studyHint.classList.add('correct');
    
    updateStats();
    
    isWaiting = true;
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        elements.studyHint.innerHTML = '<p>🎯 继续下一个词！</p>';
        
        // 移动到下一个词
        currentWordIndex++;
        startLearningCurrentWord();
    }, 2000);
}

/**
 * 更新进度显示
 */
function updateProgress() {
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
        const progress = wordProgress[word.id];
        
        let status = '';
        if (isMastered) status = '<span class="status-badge mastered">已掌握</span>';
        else if (isWrong) status = '<span class="status-badge wrong">错词</span>';
        else if (isNew) status = '<span class="status-badge new">新词</span>';
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
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
