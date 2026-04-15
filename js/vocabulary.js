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
    DEF_EN: 'def_en'        // 释义 -> 选英文
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
    phaseDefEn: true
};

// 状态
let vocabulary = [];
let currentMode = null;      // 'new' | 'review'
let currentPhase = StudyPhase.EN_CN;
let studyCount = CONFIG.DEFAULT_STUDY_COUNT;
let currentWordQueue = [];
let currentWordIndex = 0;
let wrongWordsInRound = [];      // 当前题型中答错的题，做完后补做一次
let currentRetryWord = null;      // 当前需要立即重做的单词（答题区显示卡片后重做）
let newStudyStage = 0;           // 0:英选中 1:中选英 2:英选义 3:义选英
let studyProgress = {};      // 学习进度
let isWaiting = false;

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
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // Tabs切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 学习按钮
    document.getElementById('startStudyBtn')?.addEventListener('click', () => startStudy('new'));
    document.getElementById('startReviewBtn')?.addEventListener('click', () => startStudy('review'));
    document.getElementById('quitStudyBtn')?.addEventListener('click', quitStudy);
    document.getElementById('backToStudyBtn')?.addEventListener('click', backToStudy);

    // 学习数量
    document.getElementById('studyCountSelect')?.addEventListener('change', (e) => {
        studyCount = parseInt(e.target.value);
        saveSettings();
    });

    // 设置
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('settingCut')?.addEventListener('change', (e) => {
        SETTINGS.cutEnabled = e.target.checked;
    });

    // 添加单词
    document.getElementById('addWordBtn')?.addEventListener('click', openAddWord);
    document.getElementById('closeAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('cancelAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('addWordForm')?.addEventListener('submit', handleAddWord);

    // 错词本
    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => reviewWrong());
    document.getElementById('clearWrongBtn')?.addEventListener('click', clearWrongWords);

    // 已掌握库
    document.getElementById('masteredCount')?.parentElement?.addEventListener('click', openMastered);
    document.getElementById('closeMastered')?.addEventListener('click', closeMastered);
    document.getElementById('masteredSearchInput')?.addEventListener('input', debounce(renderMasteredList, 300));

    // 筛选
    document.getElementById('allCategoryFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));

    // 模态框
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

    // 如果没有数据，加载示例
    if (vocabulary.length === 0) {
        vocabulary = getSampleVocabulary();
    }

    // 合并本地存储的数据
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

    // 加载设置
    loadSettings();

    // 加载学习进度
    const savedProgress = localStorage.getItem('studyProgress');
    if (savedProgress) {
        studyProgress = JSON.parse(savedProgress);
    }

    updateStats();
    updateStudyButtons();
}

/**
 * 示例词汇数据
 */
function getSampleVocabulary() {
    return [
        {
            id: 'v1',
            word: 'perovskite',
            word_cn: '钙钛矿',
            definition: '一种具有ABX₃晶体结构的半导体材料，在太阳能电池中用作光吸收层',
            example: 'The perovskite layer absorbs sunlight and generates electron-hole pairs.',
            example_cn: '钙钛矿层吸收阳光并产生电子-空穴对。',
            category: 'synthesis',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v2',
            word: 'crystallinity',
            word_cn: '结晶度/结晶性',
            definition: '材料中原子或分子有序排列的程度，影响材料的光电性质',
            example: 'High crystallinity reduces grain boundaries and improves charge transport.',
            example_cn: '高结晶度减少晶界并改善电荷传输。',
            category: 'synthesis',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v3',
            word: 'passivation',
            word_cn: '钝化',
            definition: '通过表面处理减少材料表面缺陷态的过程，可降低载流子复合',
            example: 'Surface passivation significantly reduces non-radiative recombination.',
            example_cn: '表面钝化显著降低非辐射复合。',
            category: 'mechanism',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v4',
            word: 'grain boundary',
            word_cn: '晶界',
            definition: '多晶材料中不同取向晶粒之间的界面区域',
            example: 'Grain boundaries often act as recombination centers for charge carriers.',
            example_cn: '晶界通常作为载流子的复合中心。',
            category: 'mechanism',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v5',
            word: 'recombination',
            word_cn: '复合',
            definition: '电子和空穴相遇并湮灭释放能量的过程，是太阳能电池中的主要能量损失机制',
            example: 'Minimizing recombination is crucial for achieving high efficiency.',
            example_cn: '最小化复合对于实现高效率至关重要。',
            category: 'mechanism',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v6',
            word: 'XRD',
            word_cn: 'X射线衍射',
            definition: 'X-ray Diffraction，用于分析材料晶体结构的技术',
            example: 'XRD patterns reveal the crystallographic information of perovskite films.',
            example_cn: 'XRD图谱揭示了钙钛矿薄膜的晶体学信息。',
            category: 'characterization',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v7',
            word: 'SEM',
            word_cn: '扫描电子显微镜',
            definition: 'Scanning Electron Microscopy，用于观察材料表面形貌的高分辨率成像技术',
            example: 'SEM images show the surface morphology and grain size distribution.',
            example_cn: 'SEM图像显示了表面形貌和晶粒尺寸分布。',
            category: 'characterization',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v8',
            word: 'spin-coating',
            word_cn: '旋涂',
            definition: '通过高速旋转基底使液体均匀铺展成薄膜的制备方法',
            example: 'The perovskite layer was prepared by spin-coating at 4000 rpm.',
            example_cn: '钙钛矿层以4000转/分的速度旋涂制备。',
            category: 'synthesis',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v9',
            word: 'efficiency',
            word_cn: '效率',
            definition: '太阳能电池将入射光能转化为电能的百分比',
            example: 'The certified efficiency reached 26.2% under standard illumination.',
            example_cn: '在标准光照下认证效率达到26.2%。',
            category: 'application',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        },
        {
            id: 'v10',
            word: 'defect',
            word_cn: '缺陷',
            definition: '晶体结构中的不完整性，如空位、间隙原子或位错',
            example: 'Defects can act as traps for charge carriers.',
            example_cn: '缺陷可以作为载流子的陷阱。',
            category: 'mechanism',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            last_practice: ''
        }
    ];
}

/**
 * 更新统计数据
 */
function updateStats() {
    const newWords = vocabulary.filter(v => v.status === WordStatus.NEW).length;
    const studying = vocabulary.filter(v => v.status === WordStatus.STUDYING).length;
    const learned = vocabulary.filter(v => v.status === WordStatus.LEARNED).length;
    const mastered = vocabulary.filter(v => v.status === WordStatus.MASTERED).length;
    const wrong = vocabulary.filter(v => v.error_count >= CONFIG.ERROR_THRESHOLD).length;

    document.getElementById('newCount').textContent = newWords;
    document.getElementById('studyingCount').textContent = studying;
    document.getElementById('learnedCount').textContent = learned;
    document.getElementById('masteredCount').textContent = mastered;
    document.getElementById('wrongCount').textContent = wrong;

    if (elements.progressText) {
        elements.progressText.textContent = `新词: ${newWords} | 正在学: ${studying} | 已学: ${learned}`;
    }

    const total = newWords + studying + learned;
    const progress = total > 0 ? ((mastered / total) * 100).toFixed(1) : 0;
    if (elements.progressFill) {
        elements.progressFill.style.width = `${progress}%`;
    }
}

function updateStudyButtons() {
    const newWords = vocabulary.filter(v => v.status === WordStatus.NEW).length;
    const studying = vocabulary.filter(v => v.status === WordStatus.STUDYING).length;
    const learned = vocabulary.filter(v => v.status === WordStatus.LEARNED).length;
    const newAndStudying = newWords + studying;

    const studyBtn = document.getElementById('startStudyBtn');
    const reviewBtn = document.getElementById('startReviewBtn');

    if (studyBtn) {
        studyBtn.disabled = newAndStudying === 0;
        studyBtn.innerHTML = `📖 开始学习 (${newAndStudying}个)`;
    }

    if (reviewBtn) {
        reviewBtn.disabled = learned === 0;
        reviewBtn.innerHTML = `🔄 开始复习 (${learned}个)`;
    }
}

/**
 * 开始学习
 */
function startStudy(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    wrongWordsInRound = [];
    currentRetryWord = null;
    newStudyStage = 0;

    // 获取学习队列
    if (mode === 'new') {
        // 新学：优先"正在学"，然后是"新词"
        const studyingWords = vocabulary.filter(v => v.status === WordStatus.STUDYING);
        const newWordsList = vocabulary.filter(v => v.status === WordStatus.NEW);
        
        // 从上次进度继续
        const progressKey = 'new_study';
        const savedIndex = studyProgress[progressKey] || 0;
        
        currentWordQueue = [...studyingWords, ...newWordsList].slice(savedIndex, savedIndex + studyCount);
        
        if (currentWordQueue.length === 0) {
            alert('没有可学习的单词了！');
            return;
        }
        
        // 新学直接从英选中开始（不是卡片）
        currentPhase = StudyPhase.EN_CN;
        newStudyStage = 0;
    } else {
        // 复习：只复习"已学"
        const learnedWords = vocabulary.filter(v => v.status === WordStatus.LEARNED);
        
        // 从上次进度继续
        const progressKey = 'review';
        const savedIndex = studyProgress[progressKey] || 0;
        
        currentWordQueue = learnedWords.slice(savedIndex, savedIndex + studyCount);
        
        if (currentWordQueue.length === 0) {
            alert('没有需要复习的单词！');
            return;
        }
        
        currentPhase = StudyPhase.EN_CN;
        newStudyStage = 1; // 跳过英选中阶段（复习不需要卡片）
    }

    // 显示学习界面
    elements.studyControls?.classList.add('hidden');
    elements.studyResult?.classList.add('hidden');
    elements.queueInfo?.classList.remove('hidden');
    elements.studyArea.innerHTML = '<p class="empty-message">准备开始...</p>';

    updateQueueInfo();
    renderCurrentQuestion();
}

/**
 * 渲染当前题目
 */
function renderCurrentQuestion() {
    // 检查是否有需要立即重做的题（答题区显示卡片后重做）
    if (currentRetryWord !== null) {
        renderQuiz(currentRetryWord);
        currentRetryWord = null;
        return;
    }

    // 检查是否有错题需要补做（当前题型完成后）
    if (wrongWordsInRound.length > 0 && currentWordIndex >= currentWordQueue.length) {
        handleRetryWords();
        return;
    }

    // 检查是否完成
    if (currentWordIndex >= currentWordQueue.length) {
        moveToNextPhase();
        return;
    }

    const currentWord = currentWordQueue[currentWordIndex];
    updateQueueInfo();

    // 渲染题目（新学模式下的英选中完成后会弹出卡片，由 handleCorrectAnswer 处理）
    renderQuiz(currentWord);
}

/**
 * 渲染单词卡片
 * @param {Object} word - 单词对象
 * @param {boolean} isInitialCard - 是否是初始卡片（复习模式或首次进入），新学答题后弹出的卡片为false
 */
function renderWordCard(word, isInitialCard = true) {
    // 更新单词状态为"正在学"
    const wordInVocab = vocabulary.find(v => v.id === word.id);
    if (wordInVocab && wordInVocab.status === WordStatus.NEW) {
        wordInVocab.status = WordStatus.STUDYING;
    }

    // 发音
    if (SETTINGS.speakEnabled) {
        speakWord(word.word);
    }

    elements.studyArea.innerHTML = `
        <div class="word-card-display">
            <div class="word-main-display">
                <div class="word-en">${escapeHtml(word.word)}</div>
                <div class="word-cn">${escapeHtml(word.word_cn)}</div>
            </div>
            ${word.definition ? `
            <div class="word-definition-section">
                <div class="section-label">释义</div>
                <div class="word-definition">${escapeHtml(word.definition)}</div>
            </div>
            ` : ''}
            ${word.example ? `
            <div class="word-example-section">
                <div class="section-label">例句</div>
                <div class="word-example">${escapeHtml(word.example)}</div>
                ${word.example_cn ? `<div class="word-example-cn">${escapeHtml(word.example_cn)}</div>` : ''}
            </div>
            ` : ''}
            <button class="continue-btn" id="continueBtn">记住了，继续 →</button>
        </div>
    `;

    document.getElementById('continueBtn')?.addEventListener('click', () => {
        // 答题后弹出的卡片：点击继续后进入下一个单词的英选中
        if (!isInitialCard) {
            currentWordIndex++;
            renderCurrentQuestion();
        } else {
            // 初始卡片（复习模式或其他场景）：继续流程
            currentPhase = StudyPhase.EN_CN;
            currentWordIndex++;
            renderCurrentQuestion();
        }
    });
}

/**
 * 渲染选择题
 */
function renderQuiz(word) {
    const phaseConfig = {
        [StudyPhase.EN_CN]: { prompt: '选择中文释义', main: word.word, type: 'word-en' },
        [StudyPhase.CN_EN]: { prompt: '选择英文单词', main: word.word_cn, type: 'word-cn' },
        [StudyPhase.EN_DEF]: { prompt: '选择正确释义', main: word.word, type: 'word-en' },
        [StudyPhase.DEF_EN]: { prompt: '选择对应单词', main: word.definition || word.word_cn, type: 'definition' }
    };

    const config = phaseConfig[currentPhase];
    const options = generateOptions(word, currentPhase);

    elements.studyArea.innerHTML = `
        <div class="quiz-card-display">
            <div class="quiz-prompt">${config.prompt}</div>
            <div class="word-display ${config.type}">${escapeHtml(config.main)}</div>
            <div class="options-grid">
                ${options.map((opt, idx) => `
                    <button class="option-btn" data-value="${escapeHtml(opt)}" data-correct="${escapeHtml(getCorrectAnswer(word, currentPhase))}">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    elements.studyArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(btn, word));
    });
}

/**
 * 生成选项
 */
function generateOptions(word, phase) {
    const others = vocabulary.filter(v => v.id !== word.id);
    const shuffled = shuffleArray([...others]).slice(0, 3);

    while (shuffled.length < 3) {
        shuffled.push({ word: 'placeholder', word_cn: '占位选项', definition: '占位选项' });
    }

    let correct, distractors;
    switch (phase) {
        case StudyPhase.EN_CN:
            correct = word.word_cn;
            distractors = shuffled.map(w => w.word_cn);
            break;
        case StudyPhase.CN_EN:
        case StudyPhase.DEF_EN:
            correct = word.word;
            distractors = shuffled.map(w => w.word);
            break;
        case StudyPhase.EN_DEF:
            correct = word.definition || word.word_cn;
            distractors = shuffled.map(w => w.definition || w.word_cn);
            break;
        default:
            return [];
    }

    return shuffleArray([correct, ...distractors]);
}

function getCorrectAnswer(word, phase) {
    switch (phase) {
        case StudyPhase.EN_CN:
            return word.word_cn;
        case StudyPhase.CN_EN:
        case StudyPhase.DEF_EN:
            return word.word;
        case StudyPhase.EN_DEF:
            return word.definition || word.word_cn;
        default:
            return '';
    }
}

/**
 * 处理答题
 */
function handleAnswer(btn, word) {
    if (isWaiting) return;

    const selected = btn.dataset.value;
    const correct = btn.dataset.correct;
    const isCorrect = selected === correct;

    // 显示正确/错误
    elements.studyArea.querySelectorAll('.option-btn').forEach(b => {
        if (b.dataset.value === correct) {
            b.classList.add('correct');
        }
    });

    if (!isCorrect) {
        btn.classList.add('wrong');
        handleWrongAnswer(word);
        return;
    }

    handleCorrectAnswer(word);
}

function handleCorrectAnswer(word) {
    const wordInVocab = vocabulary.find(v => v.id === word.id);
    if (!wordInVocab) return;

    // 更新正确次数
    wordInVocab.correct_count = (wordInVocab.correct_count || 0) + 1;
    wordInVocab.last_practice = new Date().toISOString();

    // 更新阶段进度
    updatePhaseProgress(wordInVocab);

    // 检查是否掌握
    if (wordInVocab.correct_count >= SETTINGS.masterCount) {
        wordInVocab.status = WordStatus.MASTERED;
    }

    saveVocabulary();
    isWaiting = true;

    // 新学模式下，英选中完成后立即弹出该单词的卡片
    if (currentMode === 'new' && currentPhase === StudyPhase.EN_CN) {
        setTimeout(() => {
            isWaiting = false;
            renderWordCard(word, false); // false 表示是答题后的卡片，不是初始卡片
        }, 300);
        return;
    }

    setTimeout(() => {
        isWaiting = false;
        currentWordIndex++;
        renderCurrentQuestion();
    }, 300);
}

function handleWrongAnswer(word) {
    isWaiting = true;

    const wordInVocab = vocabulary.find(v => v.id === word.id);
    if (wordInVocab) {
        wordInVocab.correct_count = 0;
        wordInVocab.error_count = (wordInVocab.error_count || 0) + 1;
        wordInVocab.last_practice = new Date().toISOString();
        saveVocabulary();
    }

    // 添加到错题队列（题型结束后补做一次）
    if (!wrongWordsInRound.find(w => w.id === word.id)) {
        wrongWordsInRound.push(word);
    }

    setTimeout(() => {
        isWaiting = false;
        // 弹出单词卡片
        renderWrongWordCard(word);
    }, 500);
}

function renderWrongWordCard(word) {
    elements.studyArea.innerHTML = `
        <div class="word-card-display">
            <div style="color: var(--error-color); margin-bottom: 16px;">❌ 答错了，再记一遍！</div>
            <div class="word-main-display">
                <div class="word-en">${escapeHtml(word.word)}</div>
                <div class="word-cn">${escapeHtml(word.word_cn)}</div>
            </div>
            ${word.definition ? `
            <div class="word-definition-section">
                <div class="section-label">释义</div>
                <div class="word-definition">${escapeHtml(word.definition)}</div>
            </div>
            ` : ''}
            <button class="continue-btn btn-danger" id="retryBtn">记住了，重做这道题</button>
        </div>
    `;

    document.getElementById('retryBtn')?.addEventListener('click', () => {
        // 设置需要立即重做的单词（只重做一次，不是两遍）
        currentRetryWord = word;
        renderCurrentQuestion();
    });
}

/**
 * 处理错题补做（当前题型完成后，在队列末尾补做一次错题）
 */
function handleRetryWords() {
    const wordToRetry = wrongWordsInRound.shift();
    if (!wordToRetry) {
        // 所有错题都补做完了，继续下一阶段
        currentWordIndex = 0;
        renderCurrentQuestion();
        return;
    }

    elements.phaseBadge.textContent = '🔄 补做错题';
    elements.studyArea.innerHTML = '<p class="empty-message">正在补做错题...</p>';

    setTimeout(() => {
        renderQuiz(wordToRetry);
    }, 500);
}

/**
 * 更新阶段进度
 */
function updatePhaseProgress(word) {
    switch (currentPhase) {
        case StudyPhase.EN_CN:
            word.phase_en_cn = true;
            break;
        case StudyPhase.CN_EN:
            word.phase_cn_en = true;
            break;
        case StudyPhase.EN_DEF:
            word.phase_en_def = true;
            break;
        case StudyPhase.DEF_EN:
            word.phase_def_en = true;
            break;
    }

    // 如果4个题型都完成过，更新状态
    if (word.phase_en_cn && word.phase_cn_en && word.phase_en_def && word.phase_def_en) {
        if (word.status === WordStatus.STUDYING) {
            word.status = WordStatus.LEARNED;
        }
    }
}

/**
 * 进入下一阶段
 */
function moveToNextPhase() {
    // 进入下一阶段前，确保错题已经补做完成
    if (wrongWordsInRound.length > 0) {
        handleRetryWords();
        return;
    }

    wrongWordsInRound = [];

    if (currentMode === 'new') {
        newStudyStage++;
        
        switch (newStudyStage) {
            case 1:
                if (!SETTINGS.phaseCnEn) newStudyStage++;
            case 2:
                if (!SETTINGS.phaseEnDef) newStudyStage++;
            case 3:
                if (!SETTINGS.phaseDefEn) newStudyStage++;
        }

        if (newStudyStage >= 4) {
            completeStudy();
            return;
        }

        currentPhase = [StudyPhase.CN_EN, StudyPhase.EN_DEF, StudyPhase.DEF_EN][newStudyStage - 1];
    } else {
        // 复习模式：按顺序进行
        if (currentPhase === StudyPhase.EN_CN && SETTINGS.phaseCnEn) {
            currentPhase = StudyPhase.CN_EN;
        } else if (currentPhase === StudyPhase.CN_EN && SETTINGS.phaseEnDef) {
            currentPhase = StudyPhase.EN_DEF;
        } else if (currentPhase === StudyPhase.EN_DEF && SETTINGS.phaseDefEn) {
            currentPhase = StudyPhase.DEF_EN;
        } else {
            completeStudy();
            return;
        }
    }

    currentWordIndex = 0;
    saveProgress();
    updateQueueInfo();

    // 显示阶段切换提示
    showPhaseHint();
}

function showPhaseHint() {
    const phaseNames = {
        [StudyPhase.CN_EN]: '中文选英文',
        [StudyPhase.EN_DEF]: '英文选释义',
        [StudyPhase.DEF_EN]: '释义选英文'
    };

    elements.studyArea.innerHTML = `
        <div class="completion-message">
            <div class="completion-icon">📝</div>
            <h3>进入下一阶段</h3>
            <p>${phaseNames[currentPhase]}</p>
        </div>
    `;

    setTimeout(() => {
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 完成学习
 */
function completeStudy() {
    // 保存进度
    const progressKey = currentMode === 'new' ? 'new_study' : 'review';
    studyProgress[progressKey] = (studyProgress[progressKey] || 0) + currentWordQueue.length;
    saveProgress();

    // 更新统计
    updateStats();
    updateStudyButtons();
    saveVocabulary();

    // 显示完成界面
    elements.queueInfo?.classList.add('hidden');
    elements.studyResult?.classList.remove('hidden');
    
    document.getElementById('resultTitle').textContent = currentMode === 'new' ? '学习完成！' : '复习完成！';
    document.getElementById('resultText').textContent = `本次学习了 ${currentWordQueue.length} 个单词`;
}

/**
 * 更新队列信息
 */
function updateQueueInfo() {
    if (!elements.queueBadge || !elements.phaseBadge || !elements.wordProgress) return;

    const phaseNames = {
        [StudyPhase.EN_CN]: '英选中',
        [StudyPhase.CN_EN]: '中选英',
        [StudyPhase.EN_DEF]: '英选义',
        [StudyPhase.DEF_EN]: '义选英'
    };

    elements.queueBadge.textContent = currentMode === 'new' ? '📖 学习中' : '🔄 复习中';
    elements.phaseBadge.textContent = phaseNames[currentPhase];
    elements.wordProgress.textContent = `第 ${Math.min(currentWordIndex + 1, currentWordQueue.length)} / ${currentWordQueue.length} 个词`;
}

/**
 * 退出学习
 */
function quitStudy() {
    if (!confirm('确定要退出学习吗？当前进度将保存。')) return;

    // 保存进度
    const progressKey = currentMode === 'new' ? 'new_study' : 'review';
    studyProgress[progressKey] = (studyProgress[progressKey] || 0) + currentWordIndex;
    saveProgress();

    backToStudy();
}

/**
 * 返回学习界面
 */
function backToStudy() {
    elements.studyControls?.classList.remove('hidden');
    elements.studyResult?.classList.add('hidden');
    elements.queueInfo?.classList.add('hidden');
    elements.studyArea.innerHTML = '<p class="empty-message">选择上方按钮开始学习！</p>';
    currentMode = null;
}

/**
 * 复习错词
 */
function reviewWrong() {
    const wrongWords = vocabulary.filter(v => v.error_count >= CONFIG.ERROR_THRESHOLD);
    if (wrongWords.length === 0) {
        alert('错词本为空！');
        return;
    }

    currentMode = 'review';
    currentWordQueue = wrongWords.slice(0, studyCount);
    currentPhase = StudyPhase.EN_CN;
    currentWordIndex = 0;
    wrongWordsInRound = [];
    currentRetryWord = null;

    elements.studyControls?.classList.add('hidden');
    elements.queueInfo?.classList.remove('hidden');
    elements.studyArea.innerHTML = '<p class="empty-message">准备开始...</p>';

    updateQueueInfo();
    renderCurrentQuestion();
}

/**
 * 清空错词本
 */
function clearWrongWords() {
    if (!confirm('确定要清空错词本吗？所有错误记录将被清除。')) return;

    vocabulary.forEach(v => {
        if (v.error_count >= CONFIG.ERROR_THRESHOLD) {
            v.error_count = 0;
        }
    });

    saveVocabulary();
    updateStats();
    renderWrongWords();
}

/**
 * 渲染全部单词列表
 */
function renderAllWords() {
    const category = document.getElementById('allCategoryFilter')?.value || '';
    const status = document.getElementById('allStatusFilter')?.value || '';
    const search = document.getElementById('allSearchInput')?.value.toLowerCase() || '';

    let filtered = vocabulary;

    if (category) {
        filtered = filtered.filter(v => v.category === category);
    }

    if (status) {
        filtered = filtered.filter(v => v.status === status);
    }

    if (search) {
        filtered = filtered.filter(v => 
            v.word.toLowerCase().includes(search) ||
            v.word_cn.includes(search)
        );
    }

    // 按首字母排序
    filtered.sort((a, b) => a.word.localeCompare(b.word));

    if (filtered.length === 0) {
        elements.allWordList.innerHTML = '<div class="empty-message"><p>没有找到匹配的单词</p></div>';
        return;
    }

    elements.allWordList.innerHTML = filtered.map(word => createWordItem(word)).join('');

    // 添加编辑事件
    elements.allWordList.querySelectorAll('.edit-word-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editWord(btn.dataset.id);
        });
    });
}

/**
 * 创建单词项
 */
function createWordItem(word) {
    const statusNames = {
        [WordStatus.NEW]: { text: '新词', class: 'status-new' },
        [WordStatus.STUDYING]: { text: '正在学', class: 'status-studying' },
        [WordStatus.LEARNED]: { text: '已学', class: 'status-learned' },
        [WordStatus.MASTERED]: { text: '已掌握', class: 'status-mastered' }
    };

    const status = statusNames[word.status] || statusNames[WordStatus.NEW];

    return `
        <div class="word-item" data-id="${word.id}">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.word)}</span>
                <span class="word-cn">${escapeHtml(word.word_cn)}</span>
            </div>
            <div class="word-meta">
                <span class="word-status ${status.class}">${status.text}</span>
                <span class="text-muted" style="font-size: 0.85rem;">正确: ${word.correct_count} | 错误: ${word.error_count}</span>
                <button class="btn btn-sm btn-outline edit-word-btn" data-id="${word.id}">编辑</button>
            </div>
        </div>
    `;
}

/**
 * 渲染错词列表
 */
function renderWrongWords() {
    const wrongWords = vocabulary.filter(v => v.error_count >= CONFIG.ERROR_THRESHOLD)
        .sort((a, b) => b.error_count - a.error_count);

    if (wrongWords.length === 0) {
        elements.wrongWordList.innerHTML = '<div class="empty-message"><p>暂无错词记录</p></div>';
        return;
    }

    elements.wrongWordList.innerHTML = wrongWords.map(word => createWordItem(word)).join('');
}

/**
 * 渲染已掌握列表
 */
function renderMasteredList() {
    const search = document.getElementById('masteredSearchInput')?.value.toLowerCase() || '';
    let masteredWords = vocabulary.filter(v => v.status === WordStatus.MASTERED);

    if (search) {
        masteredWords = masteredWords.filter(v => 
            v.word.toLowerCase().includes(search)
        );
    }

    // 按首字母排序
    masteredWords.sort((a, b) => a.word.localeCompare(b.word));

    if (masteredWords.length === 0) {
        document.getElementById('masteredList').innerHTML = '<div class="empty-message"><p>暂无已掌握单词</p></div>';
        return;
    }

    document.getElementById('masteredList').innerHTML = masteredWords.map(word => createWordItem(word)).join('');
}

/**
 * 添加单词
 */
function openAddWord() {
    document.getElementById('addWordForm').reset();
    document.getElementById('addWordModal').classList.remove('hidden');
}

function closeAddWord() {
    document.getElementById('addWordModal').classList.add('hidden');
}

function handleAddWord(e) {
    e.preventDefault();

    const newWord = {
        id: generateId(),
        word: document.getElementById('wordEn').value.trim().toLowerCase(),
        word_cn: document.getElementById('wordCn').value.trim(),
        definition: document.getElementById('wordDef').value.trim(),
        example: document.getElementById('wordExample').value.trim(),
        example_cn: document.getElementById('wordExampleCn').value.trim(),
        category: document.getElementById('wordCat').value,
        status: WordStatus.NEW,
        correct_count: 0,
        error_count: 0,
        phase_en_cn: false,
        phase_cn_en: false,
        phase_en_def: false,
        phase_def_en: false,
        last_practice: ''
    };

    // 检查是否已存在
    if (vocabulary.find(v => v.word.toLowerCase() === newWord.word)) {
        alert('该单词已存在！');
        return;
    }

    vocabulary.push(newWord);
    saveVocabulary();
    updateStats();
    updateStudyButtons();
    closeAddWord();
    renderAllWords();

    alert('单词添加成功！');
}

/**
 * 编辑单词
 */
function editWord(wordId) {
    const word = vocabulary.find(v => v.id === wordId);
    if (!word) return;

    // 复用添加表单
    document.getElementById('wordEn').value = word.word;
    document.getElementById('wordCn').value = word.word_cn;
    document.getElementById('wordDef').value = word.definition || '';
    document.getElementById('wordExample').value = word.example || '';
    document.getElementById('wordExampleCn').value = word.example_cn || '';
    document.getElementById('wordCat').value = word.category || 'custom';

    // 修改表单提交逻辑
    const form = document.getElementById('addWordForm');
    const originalHandler = form.onsubmit;
    
    form.onsubmit = (e) => {
        e.preventDefault();
        
        word.word = document.getElementById('wordEn').value.trim().toLowerCase();
        word.word_cn = document.getElementById('wordCn').value.trim();
        word.definition = document.getElementById('wordDef').value.trim();
        word.example = document.getElementById('wordExample').value.trim();
        word.example_cn = document.getElementById('wordExampleCn').value.trim();
        word.category = document.getElementById('wordCat').value;

        saveVocabulary();
        updateStats();
        closeAddWord();
        renderAllWords();

        alert('单词更新成功！');
        form.onsubmit = originalHandler;
    };

    openAddWord();
}

/**
 * 设置
 */
function openSettings() {
    document.getElementById('settingSpeak').checked = SETTINGS.speakEnabled;
    document.getElementById('settingCut').checked = SETTINGS.cutEnabled;
    document.getElementById('settingMasterCount').value = SETTINGS.masterCount;
    document.getElementById('settingEnCn').checked = SETTINGS.phaseEnCn;
    document.getElementById('settingCnEn').checked = SETTINGS.phaseCnEn;
    document.getElementById('settingEnDef').checked = SETTINGS.phaseEnDef;
    document.getElementById('settingDefEn').checked = SETTINGS.phaseDefEn;
    
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
    SETTINGS.speakEnabled = document.getElementById('settingSpeak').checked;
    SETTINGS.cutEnabled = document.getElementById('settingCut').checked;
    SETTINGS.masterCount = parseInt(document.getElementById('settingMasterCount').value);
    SETTINGS.phaseEnCn = document.getElementById('settingEnCn').checked;
    SETTINGS.phaseCnEn = document.getElementById('settingCnEn').checked;
    SETTINGS.phaseEnDef = document.getElementById('settingEnDef').checked;
    SETTINGS.phaseDefEn = document.getElementById('settingDefEn').checked;

    localStorage.setItem('vocabSettings', JSON.stringify(SETTINGS));
    localStorage.setItem('studyCount', studyCount.toString());
    
    closeSettings();
    alert('设置已保存！');
}

function loadSettings() {
    const saved = localStorage.getItem('vocabSettings');
    if (saved) {
        SETTINGS = { ...SETTINGS, ...JSON.parse(saved) };
    }

    const savedCount = localStorage.getItem('studyCount');
    if (savedCount) {
        studyCount = parseInt(savedCount);
        const select = document.getElementById('studyCountSelect');
        if (select) select.value = studyCount.toString();
    }
}

/**
 * 已掌握库
 */
function openMastered() {
    renderMasteredList();
    document.getElementById('masteredModal').classList.remove('hidden');
}

function closeMastered() {
    document.getElementById('masteredModal').classList.add('hidden');
}

/**
 * 保存数据
 */
function saveVocabulary() {
    localStorage.setItem('vocabularyData', JSON.stringify(vocabulary));
}

function saveProgress() {
    localStorage.setItem('studyProgress', JSON.stringify(studyProgress));
}

/**
 * 工具函数
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function speakWord(word) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
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
