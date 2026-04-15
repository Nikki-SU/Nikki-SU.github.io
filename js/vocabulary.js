/**
 * vocabulary.js - 词汇本核心脚本
 * 实现完整的学习流程、进度保存和复习功能
 */

// 学习阶段枚举
const StudyPhase = {
    CARD: 'card',           // 展示单词卡片
    EN_CN: 'en_cn',         // 英文 -> 选中文
    CN_EN: 'cn_en',         // 中文 -> 选英文
    EN_DEF: 'en_def',       // 英文 -> 选释义
    DEF_EN: 'def_en',       // 释义 -> 选英文
    SENT_EN: 'sent_en',     // 例句 -> 选英文（选出例句中标粗的词）
    SENT_DEF: 'sent_def'    // 例句 -> 选释义（选出例句中标粗词的释义）
};

// 单词状态
const WordStatus = {
    NEW: 'new',             // 新词
    STUDYING: 'studying',   // 正在学
    LEARNED: 'learned',     // 已学
    MASTERED: 'mastered'    // 已掌握
};

// 配置
const CONFIG = {
    vocabularyUrl: 'data/vocabulary.json',
    DEFAULT_STUDY_COUNT: 50,
    DEFAULT_MASTER_COUNT: 12,
    ERROR_THRESHOLD: 3
};

// 学习设置（默认值）
let SETTINGS = {
    speakEnabled: false,
    cutEnabled: false,
    masterCount: 12,
    phaseEnCn: true,
    phaseCnEn: true,
    phaseEnDef: true,
    phaseDefEn: true,
    phaseSentEn: true,
    phaseSentDef: true
};

// 状态
let vocabulary = [];
let currentMode = null;      // 'new' | 'review'
let currentPhase = StudyPhase.EN_CN;
let studyCount = CONFIG.DEFAULT_STUDY_COUNT;
let currentWordQueue = [];
let currentWordIndex = 0;
let wrongWordsInRound = [];
let currentRetryWord = null;
let studyProgress = {};
let isWaiting = false;
let hasShownCardThisWord = false;  // 当前单词本轮是否已显示过卡片

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadData();
});

function initElements() {
    elements.studyArea = document.getElementById('studyArea');
    elements.queueInfo = document.getElementById('queueInfo');
    elements.studyControls = document.getElementById('studyControls');
    elements.studyResult = document.getElementById('studyResult');
    elements.queueBadge = document.getElementById('queueBadge');
    elements.phaseBadge = document.getElementById('phaseBadge');
    elements.wordProgress = document.getElementById('wordProgress');
    elements.progressText = document.getElementById('progressText');
    elements.progressFill = document.getElementById('progressFill');
    elements.allWordList = document.getElementById('allWordList');
    elements.wrongWordList = document.getElementById('wrongWordList');
}

function initEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('startStudyBtn')?.addEventListener('click', () => startStudy('new'));
    document.getElementById('startReviewBtn')?.addEventListener('click', () => startStudy('review'));
    document.getElementById('quitStudyBtn')?.addEventListener('click', quitStudy);
    document.getElementById('backToStudyBtn')?.addEventListener('click', backToStudy);

    document.getElementById('studyCountSelect')?.addEventListener('change', (e) => {
        studyCount = parseInt(e.target.value);
        saveSettings();
    });

    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('settingCut')?.addEventListener('change', (e) => {
        SETTINGS.cutEnabled = e.target.checked;
    });

    document.getElementById('addWordBtn')?.addEventListener('click', openAddWord);
    document.getElementById('closeAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('cancelAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('addWordForm')?.addEventListener('submit', handleAddWord);

    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => reviewWrong());
    document.getElementById('clearWrongBtn')?.addEventListener('click', clearWrongWords);

    document.getElementById('masteredCount')?.parentElement?.addEventListener('click', openMastered);
    document.getElementById('closeMastered')?.addEventListener('click', closeMastered);
    document.getElementById('masteredSearchInput')?.addEventListener('input', debounce(renderMasteredList, 300));

    document.getElementById('allCategoryFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));

    document.getElementById('settingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') closeSettings();
    });
    document.getElementById('addWordModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'addWordModal') closeAddWord();
    });
    document.getElementById('masteredModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'masteredModal') closeMastered();
    });
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}Mode`);
    });

    if (tab === 'all') renderAllWords();
    if (tab === 'wrong') renderWrongWords();
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
        console.error('加载词汇失败:', error);
    }

    if (vocabulary.length === 0) {
        vocabulary = getSampleVocabulary();
    }

    const stored = localStorage.getItem('vocabularyData');
    if (stored) {
        const localVocab = JSON.parse(stored);
        localVocab.forEach(localWord => {
            const index = vocabulary.findIndex(v => v.word.toLowerCase() === localWord.word.toLowerCase());
            if (index === -1) {
                vocabulary.push(localWord);
            } else {
                vocabulary[index] = { ...vocabulary[index], ...localWord };
            }
        });
    }

    loadSettings();

    const savedProgress = localStorage.getItem('studyProgress');
    if (savedProgress) {
        studyProgress = JSON.parse(savedProgress);
    }

    updateStats();
    updateStudyButtons();
}

function loadSettings() {
    const stored = localStorage.getItem('vocabularySettings');
    if (stored) {
        SETTINGS = { ...SETTINGS, ...JSON.parse(stored) };
    }
    
    studyCount = SETTINGS.studyCount || CONFIG.DEFAULT_STUDY_COUNT;
    SETTINGS.masterCount = SETTINGS.masterCount || CONFIG.DEFAULT_MASTER_COUNT;
    
    // 应用设置到UI
    const studyCountSelect = document.getElementById('studyCountSelect');
    if (studyCountSelect) studyCountSelect.value = studyCount;
    
    const masterCountSelect = document.getElementById('masterCountSelect');
    if (masterCountSelect) masterCountSelect.value = SETTINGS.masterCount;
}

function saveSettings() {
    SETTINGS.studyCount = studyCount;
    localStorage.setItem('vocabularySettings', JSON.stringify(SETTINGS));
}

function saveVocabulary() {
    localStorage.setItem('vocabularyData', JSON.stringify(vocabulary));
}

function saveProgress() {
    localStorage.setItem('studyProgress', JSON.stringify(studyProgress));
}

/**
 * 更新统计
 */
function updateStats() {
    const newCount = vocabulary.filter(v => v.status === 'new').length;
    const studyingCount = vocabulary.filter(v => v.status === 'studying').length;
    const learnedCount = vocabulary.filter(v => v.status === 'learned').length;
    const masteredCount = vocabulary.filter(v => v.status === 'mastered').length;
    const wrongCount = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD).length;

    document.getElementById('newCount').textContent = newCount;
    document.getElementById('studyingCount').textContent = studyingCount;
    document.getElementById('learnedCount').textContent = learnedCount;
    document.getElementById('masteredCount').textContent = masteredCount;
    document.getElementById('wrongCount').textContent = wrongCount;

    updateStudyButtons();
}

function updateStudyButtons() {
    const newCount = vocabulary.filter(v => v.status === 'new' || v.status === 'studying').length;
    const learnedCount = vocabulary.filter(v => v.status === 'learned').length;

    const startStudyBtn = document.getElementById('startStudyBtn');
    const startReviewBtn = document.getElementById('startReviewBtn');

    if (startStudyBtn) {
        startStudyBtn.disabled = newCount === 0;
        startStudyBtn.textContent = `📚 学习 (${newCount})`;
    }
    if (startReviewBtn) {
        startReviewBtn.disabled = learnedCount === 0;
        startReviewBtn.textContent = `🔄 复习 (${learnedCount})`;
    }
}

/**
 * 开始学习/复习
 */
function startStudy(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    hasShownCardThisWord = false;

    // 获取词汇队列
    if (mode === 'new') {
        // 学习：新词 + 正在学的词
        currentWordQueue = vocabulary
            .filter(v => v.status === 'new' || v.status === 'studying')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    } else {
        // 复习：已学的词
        currentWordQueue = vocabulary
            .filter(v => v.status === 'learned')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    }

    if (currentWordQueue.length === 0) {
        alert(mode === 'new' ? '没有可学习的词汇' : '没有可复习的词汇');
        return;
    }

    // 显示学习界面
    document.getElementById('studyMode').classList.add('active');
    document.getElementById('allMode').classList.remove('active');
    document.getElementById('wrongMode').classList.remove('active');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    renderCurrentQuestion();
}

/**
 * 渲染当前问题
 */
function renderCurrentQuestion() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    if (!word) {
        finishStudy();
        return;
    }

    const area = elements.studyArea;
    area.innerHTML = '';

    // 更新进度
    updateProgress();

    // 根据阶段渲染题目
    if (currentPhase === StudyPhase.CARD) {
        renderCard(word);
    } else {
        renderQuestion(word);
    }
}

/**
 * 渲染单词卡片
 */
function renderCard(word) {
    const area = elements.studyArea;
    
    area.innerHTML = `
        <div class="word-card">
            <div class="card-word">${escapeHtml(word.word)}</div>
            <div class="card-phonetic">${escapeHtml(word.phonetic || '')}</div>
            <div class="card-cn">${escapeHtml(word.word_cn)}</div>
            <div class="card-def">
                <p><strong>中文释义：</strong>${escapeHtml(word.definition_cn || '')}</p>
                <p><strong>英文释义：</strong>${escapeHtml(word.definition_en || '')}</p>
            </div>
            ${word.example ? `
                <div class="card-example">
                    <strong>例句：</strong>${formatExample(word.example, word.word)}
                </div>
            ` : ''}
        </div>
        <div class="card-actions">
            <button class="btn btn-primary btn-lg" onclick="continueAfterCard()">继续</button>
        </div>
    `;

    // 朗读
    if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word.word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
}

/**
 * 格式化例句（将标粗的词保持标粗）
 */
function formatExample(example, word) {
    // 例句中已经用**word**格式标粗
    return example.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * 卡片后继续
 */
function continueAfterCard() {
    hasShownCardThisWord = true;
    
    if (currentRetryWord) {
        // 重做完成，回到队列末尾
        currentRetryWord = null;
        currentPhase = StudyPhase.EN_CN;
        nextWord();
    } else {
        // 正常流程，进入英选中
        currentPhase = StudyPhase.EN_CN;
        renderCurrentQuestion();
    }
}

/**
 * 渲染选择题
 */
function renderQuestion(word) {
    const area = elements.studyArea;
    const isReview = currentMode === 'review';
    const useEnDef = isReview; // 复习用英文释义，学习用中文释义

    let question, options, correctAnswer;

    switch (currentPhase) {
        case StudyPhase.EN_CN:
            question = `<span class="question-word">${escapeHtml(word.word)}</span>`;
            if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(word.word);
                utterance.lang = 'en-US';
                speechSynthesis.speak(utterance);
            }
            options = generateOptions(word, 'word_cn');
            correctAnswer = word.word_cn;
            break;

        case StudyPhase.CN_EN:
            question = `<span class="question-text">${escapeHtml(word.word_cn)}</span>`;
            options = generateOptions(word, 'word');
            correctAnswer = word.word;
            break;

        case StudyPhase.EN_DEF:
            question = `<span class="question-word">${escapeHtml(word.word)}</span>`;
            options = generateOptions(word, useEnDef ? 'definition_en' : 'definition_cn');
            correctAnswer = useEnDef ? word.definition_en : word.definition_cn;
            break;

        case StudyPhase.DEF_EN:
            const defKey = useEnDef ? 'definition_en' : 'definition_cn';
            question = `<span class="question-text">${escapeHtml(word[defKey])}</span>`;
            options = generateOptions(word, 'word');
            correctAnswer = word.word;
            break;

        case StudyPhase.SENT_EN:
            question = `<div class="question-sentence">${formatExample(word.example, word.word)}</div>
                        <p class="question-hint">选出句中标粗的词汇</p>`;
            options = generateOptions(word, 'word');
            correctAnswer = word.word;
            break;

        case StudyPhase.SENT_DEF:
            question = `<div class="question-sentence">${formatExample(word.example, word.word)}</div>
                        <p class="question-hint">选出句中标粗词汇的${useEnDef ? '英文释义' : '中文释义'}</p>`;
            options = generateOptions(word, useEnDef ? 'definition_en' : 'definition_cn');
            correctAnswer = useEnDef ? word.definition_en : word.definition_cn;
            break;
    }

    // 更新阶段显示
    updatePhaseBadge();

    area.innerHTML = `
        <div class="question-area">
            <div class="question-content">${question}</div>
            <div class="options-grid">
                ${options.map((opt, i) => `
                    <button class="option-btn" onclick="checkAnswer('${escapeAttr(opt)}', '${escapeAttr(correctAnswer)}', this)">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 生成选项
 */
function generateOptions(word, field) {
    const correctAnswer = word[field];
    if (!correctAnswer) return [word.word, word.word_cn];

    // 获取其他词汇的同字段值作为干扰项
    const otherWords = vocabulary.filter(v => v.id !== word.id && v[field]);
    const distractors = otherWords
        .map(v => v[field])
        .filter(val => val && val !== correctAnswer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    // 如果干扰项不足，用默认值填充
    while (distractors.length < 3) {
        distractors.push(`选项${distractors.length + 2}`);
    }

    // 打乱顺序
    const options = [correctAnswer, ...distractors.slice(0, 3)];
    return options.sort(() => Math.random() - 0.5);
}

/**
 * 检查答案
 */
function checkAnswer(selected, correct, btn) {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    const isCorrect = selected === correct;

    if (isCorrect) {
        btn.classList.add('correct');
        
        // 检查是否是英选中且需要显示卡片
        if (currentPhase === StudyPhase.EN_CN && !hasShownCardThisWord && currentMode === 'new') {
            // 第一次英选中正确，显示卡片
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                renderCurrentQuestion();
            }, 500);
            return;
        }

        // 进入下一阶段
        setTimeout(() => nextPhase(), 500);
    } else {
        btn.classList.add('wrong');
        
        // 答错处理
        word.error_count = (word.error_count || 0) + 1;
        
        // 清零连续正确次数
        word.correct_streak = 0;

        // 英选中做错：立即弹卡片重做
        if (currentPhase === StudyPhase.EN_CN) {
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                currentRetryWord = word;
                renderCurrentQuestion();
            }, 500);
            return;
        }

        // 其他题型做错：加到错题队列，本轮末尾补做
        if (!wrongWordsInRound.find(w => w.id === word.id)) {
            wrongWordsInRound.push({ ...word, retryPhase: currentPhase });
        }

        // 继续当前阶段
        setTimeout(() => renderCurrentQuestion(), 800);
    }

    saveVocabulary();
}

/**
 * 进入下一阶段
 */
function nextPhase() {
    const phases = currentMode === 'new' 
        ? [StudyPhase.EN_CN, StudyPhase.CN_EN, StudyPhase.EN_DEF, StudyPhase.DEF_EN, StudyPhase.SENT_EN, StudyPhase.SENT_DEF]
        : [StudyPhase.EN_CN, StudyPhase.CN_EN, StudyPhase.EN_DEF, StudyPhase.DEF_EN, StudyPhase.SENT_EN, StudyPhase.SENT_DEF];
    
    const currentIndex = phases.indexOf(currentPhase);
    
    if (currentIndex < phases.length - 1) {
        currentPhase = phases[currentIndex + 1];
        renderCurrentQuestion();
    } else {
        // 该词完成
        wordCompleted();
    }
}

/**
 * 单词完成一轮
 */
function wordCompleted() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    
    if (!currentRetryWord) {
        // 更新状态
        if (word.status === 'new') {
            word.status = 'studying';
        }
        
        // 增加连续正确次数
        word.correct_streak = (word.correct_streak || 0) + 1;
        
        // 检查是否掌握
        if (word.correct_streak >= SETTINGS.masterCount) {
            word.status = 'mastered';
        } else if (word.status === 'studying') {
            word.status = 'learned';
        }

        saveVocabulary();
        saveProgress();
    }

    currentRetryWord = null;
    hasShownCardThisWord = false;
    currentPhase = StudyPhase.EN_CN;
    nextWord();
}

/**
 * 下一个单词
 */
function nextWord() {
    currentWordIndex++;

    if (currentWordIndex >= currentWordQueue.length) {
        // 检查是否有错题需要补做
        if (wrongWordsInRound.length > 0) {
            currentRetryWord = wrongWordsInRound.shift();
            currentPhase = currentRetryWord.retryPhase || StudyPhase.EN_CN;
            hasShownCardThisWord = currentMode === 'review'; // 复习不弹卡片
            renderCurrentQuestion();
        } else {
            finishStudy();
        }
    } else {
        hasShownCardThisWord = false;
        currentPhase = StudyPhase.EN_CN;
        renderCurrentQuestion();
    }
}

/**
 * 更新进度显示
 */
function updateProgress() {
    const total = currentWordQueue.length;
    const current = currentWordIndex + 1;
    const percent = Math.round((currentWordIndex / total) * 100);

    if (elements.progressText) {
        elements.progressText.textContent = `${current} / ${total}`;
    }
    if (elements.progressFill) {
        elements.progressFill.style.width = `${percent}%`;
    }
}

/**
 * 更新阶段徽章
 */
function updatePhaseBadge() {
    const phaseNames = {
        [StudyPhase.EN_CN]: '英选中',
        [StudyPhase.CN_EN]: '中选英',
        [StudyPhase.EN_DEF]: currentMode === 'review' ? '英选义(英)' : '英选义(中)',
        [StudyPhase.DEF_EN]: currentMode === 'review' ? '义选英(英)' : '义选英(中)',
        [StudyPhase.SENT_EN]: '句选英',
        [StudyPhase.SENT_DEF]: currentMode === 'review' ? '句选义(英)' : '句选义(中)'
    };

    if (elements.phaseBadge) {
        elements.phaseBadge.textContent = phaseNames[currentPhase] || '';
    }
}

/**
 * 完成学习
 */
function finishStudy() {
    elements.studyArea.innerHTML = `
        <div class="study-complete">
            <div class="complete-icon">🎉</div>
            <h3>${currentMode === 'new' ? '学习' : '复习'}完成！</h3>
            <p>已完成 ${currentWordQueue.length} 个词汇</p>
            ${wrongWordsInRound.length > 0 ? `<p class="text-muted">错题已加入复习队列</p>` : ''}
            <div class="complete-actions">
                <button class="btn btn-outline" onclick="quitStudy()">返回</button>
                <button class="btn btn-primary" onclick="continueStudy()">继续${currentMode === 'new' ? '学习' : '复习'}</button>
            </div>
        </div>
    `;

    updateStats();
}

function continueStudy() {
    startStudy(currentMode);
}

function quitStudy() {
    currentMode = null;
    currentWordQueue = [];
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;

    document.getElementById('studyMode').classList.remove('active');
    document.getElementById('allMode').classList.add('active');
    document.querySelector('.tab-btn[data-tab="all"]').classList.add('active');

    updateStats();
    renderAllWords();
}

function backToStudy() {
    if (currentWordQueue.length > 0) {
        renderCurrentQuestion();
    } else {
        quitStudy();
    }
}

/**
 * 渲染所有词汇
 */
function renderAllWords() {
    const container = elements.allWordList;
    if (!container) return;

    const categoryFilter = document.getElementById('allCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('allStatusFilter')?.value || '';
    const searchTerm = document.getElementById('allSearchInput')?.value?.toLowerCase() || '';

    let filtered = vocabulary.filter(word => {
        if (categoryFilter && word.category !== categoryFilter) return false;
        if (statusFilter && word.status !== statusFilter) return false;
        if (searchTerm) {
            const searchFields = [word.word, word.word_cn, word.definition_cn, word.definition_en].join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无词汇</p></div>';
        return;
    }

    container.innerHTML = filtered.map(word => `
        <div class="word-item" data-id="${word.id}">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
                <span class="word-status status-${word.status}">${getStatusName(word.status)}</span>
            </div>
            <div class="word-actions">
                <button class="btn btn-sm btn-outline" onclick="editWord('${word.id}')">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteWord('${word.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

function getStatusName(status) {
    const names = {
        'new': '新词',
        'studying': '学习中',
        'learned': '已学',
        'mastered': '已掌握'
    };
    return names[status] || status;
}

/**
 * 渲染错词本
 */
function renderWrongWords() {
    const container = elements.wrongWordList;
    if (!container) return;

    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD);

    if (wrongWords.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无错词</p></div>';
        return;
    }

    container.innerHTML = wrongWords.map(word => `
        <div class="word-item" data-id="${word.id}">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
                <span class="error-count">错${word.error_count}次</span>
            </div>
        </div>
    `).join('');
}

function reviewWrong() {
    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD);
    if (wrongWords.length === 0) {
        alert('没有错词需要复习');
        return;
    }

    currentMode = 'review';
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    hasShownCardThisWord = false;

    currentWordQueue = wrongWords.map(v => ({ ...v }));

    document.getElementById('studyMode').classList.add('active');
    document.getElementById('wrongMode').classList.remove('active');

    renderCurrentQuestion();
}

function clearWrongWords() {
    if (!confirm('确定要清空错词本吗？这将重置所有词汇的错误次数。')) return;

    vocabulary.forEach(v => {
        v.error_count = 0;
    });
    saveVocabulary();
    renderWrongWords();
    updateStats();
}

/**
 * 添加单词
 */
function openAddWord() {
    document.getElementById('addWordModal').classList.remove('hidden');
    document.getElementById('addWordForm').reset();
}

function closeAddWord() {
    document.getElementById('addWordModal').classList.add('hidden');
}

function handleAddWord(e) {
    e.preventDefault();

    // 支持格式：英文|中文|中文定义|英文定义|例句
    const input = document.getElementById('wordInput').value.trim();
    
    // 尝试解析格式
    const parts = input.split('|').map(p => p.trim());
    
    let wordData = {};
    
    if (parts.length >= 5) {
        // 完整格式：英文|中文|中文定义|英文定义|例句
        wordData = {
            word: parts[0],
            word_cn: parts[1],
            definition_cn: parts[2],
            definition_en: parts[3],
            example: parts[4]
        };
    } else if (parts.length >= 4) {
        // 缺少例句
        wordData = {
            word: parts[0],
            word_cn: parts[1],
            definition_cn: parts[2],
            definition_en: parts[3],
            example: ''
        };
    } else {
        // 简单格式，只有英文和中文
        wordData = {
            word: document.getElementById('wordEn').value.trim(),
            word_cn: document.getElementById('wordCn').value.trim(),
            definition_cn: document.getElementById('defCn').value.trim(),
            definition_en: document.getElementById('defEn').value.trim(),
            example: document.getElementById('wordExample').value.trim()
        };
    }

    if (!wordData.word || !wordData.word_cn) {
        alert('请填写英文词汇和中文翻译');
        return;
    }

    // 检查是否已存在
    const existing = vocabulary.find(v => v.word.toLowerCase() === wordData.word.toLowerCase());
    if (existing) {
        alert('该词汇已存在');
        return;
    }

    // 检查是否在已掌握库中
    const mastered = vocabulary.find(v => v.word.toLowerCase() === wordData.word.toLowerCase() && v.status === 'mastered');
    if (mastered) {
        if (!confirm('该词汇已在已掌握库中，是否重新添加到学习队列？')) return;
        mastered.status = 'new';
        mastered.correct_streak = 0;
        saveVocabulary();
        closeAddWord();
        updateStats();
        renderAllWords();
        return;
    }

    const newWord = {
        id: Date.now().toString(),
        word: wordData.word,
        word_cn: wordData.word_cn,
        definition_cn: wordData.definition_cn || '',
        definition_en: wordData.definition_en || '',
        example: wordData.example || '',
        phonetic: '',
        status: 'new',
        correct_count: 0,
        error_count: 0,
        correct_streak: 0,
        category: 'custom',
        addedAt: new Date().toISOString()
    };

    vocabulary.push(newWord);
    saveVocabulary();
    closeAddWord();
    updateStats();
    renderAllWords();
}

function editWord(id) {
    const word = vocabulary.find(v => v.id === id);
    if (!word) return;

    const newWordCn = prompt('中文翻译:', word.word_cn);
    if (newWordCn === null) return;

    const newDefCn = prompt('中文释义:', word.definition_cn);
    if (newDefCn === null) return;

    const newDefEn = prompt('英文释义:', word.definition_en);
    if (newDefEn === null) return;

    word.word_cn = newWordCn || word.word_cn;
    word.definition_cn = newDefCn || word.definition_cn;
    word.definition_en = newDefEn || word.definition_en;

    saveVocabulary();
    renderAllWords();
}

function deleteWord(id) {
    if (!confirm('确定要删除这个词汇吗？')) return;

    vocabulary = vocabulary.filter(v => v.id !== id);
    saveVocabulary();
    updateStats();
    renderAllWords();
}

/**
 * 设置模态框
 */
function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');

    // 填充当前设置
    document.getElementById('settingSpeak').checked = SETTINGS.speakEnabled;
    document.getElementById('settingCut').checked = SETTINGS.cutEnabled;
    document.getElementById('masterCountSelect').value = SETTINGS.masterCount;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

/**
 * 已掌握库
 */
function openMastered() {
    const modal = document.getElementById('masteredModal');
    modal.classList.remove('hidden');
    renderMasteredList();
}

function closeMastered() {
    document.getElementById('masteredModal').classList.add('hidden');
}

function renderMasteredList() {
    const container = document.getElementById('masteredList');
    const searchTerm = document.getElementById('masteredSearchInput')?.value?.toLowerCase() || '';

    const mastered = vocabulary.filter(v => {
        if (v.status !== 'mastered') return false;
        if (searchTerm) {
            return v.word.toLowerCase().includes(searchTerm) || 
                   v.word_cn.toLowerCase().includes(searchTerm);
        }
        return true;
    });

    if (mastered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无已掌握词汇</p></div>';
        return;
    }

    container.innerHTML = mastered.map(word => `
        <div class="mastered-item">
            <div class="mastered-word">${escapeHtml(word.word)}</div>
            <div class="mastered-cn">${escapeHtml(word.word_cn)}</div>
            <button class="btn btn-sm btn-outline" onclick="unmasterWord('${word.id}')">取消掌握</button>
        </div>
    `).join('');
}

function unmasterWord(id) {
    const word = vocabulary.find(v => v.id === id);
    if (word) {
        word.status = 'learned';
        word.correct_streak = 0;
        saveVocabulary();
        renderMasteredList();
        updateStats();
    }
}

/**
 * 示例词汇
 */
function getSampleVocabulary() {
    return [
        {
            id: 'sample-1',
            word: 'perovskite',
            word_cn: '钙钛矿',
            definition_cn: '一种具有ABX3晶体结构的材料，广泛应用于太阳能电池',
            definition_en: 'A material with ABX3 crystal structure, widely used in solar cells',
            example: 'The **perovskite** solar cell achieved an efficiency of 25%.',
            phonetic: '/pəˈrɒvskaɪt/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'material'
        },
        {
            id: 'sample-2',
            word: 'photovoltaic',
            word_cn: '光伏的',
            definition_cn: '能够将光能直接转换为电能的',
            definition_en: 'Capable of converting light directly into electricity',
            example: 'The **photovoltaic** effect is the basis for solar cell operation.',
            phonetic: '/ˌfəʊtəʊvɒlˈteɪɪk/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'concept'
        }
    ];
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
