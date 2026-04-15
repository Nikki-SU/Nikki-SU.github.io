/**
 * settings.js - 设置页面脚本
 * 处理API Key配置、模型选择和连接测试
 */

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
});

function initSettings() {
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // 加载保存的设置
    loadSettings();

    // 事件绑定
    bindEvents();
}

function loadSettings() {
    // 加载API Key
    const savedKey = localStorage.getItem('siliconflow_api_key');
    if (savedKey) {
        document.getElementById('apiKeyInput').value = savedKey;
    }

    // 加载模型选择
    const savedModel = localStorage.getItem('siliconflow_model') || 'deepseek';
    const modelRadio = document.querySelector(`input[name="model"][value="${savedModel}"]`);
    if (modelRadio) {
        modelRadio.checked = true;
    }

    // 更新状态指示器
    updateStatusIndicator();
}

function bindEvents() {
    // API Key输入
    document.getElementById('apiKeyInput')?.addEventListener('input', (e) => {
        const key = e.target.value.trim();
        if (key) {
            localStorage.setItem('siliconflow_api_key', key);
        } else {
            localStorage.removeItem('siliconflow_api_key');
        }
        updateStatusIndicator();
    });

    // 模型选择
    document.querySelectorAll('input[name="model"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            localStorage.setItem('siliconflow_model', e.target.value);
        });
    });

    // 显示/隐藏密钥
    document.getElementById('toggleKeyVisibility')?.addEventListener('click', () => {
        const input = document.getElementById('apiKeyInput');
        const btn = document.getElementById('toggleKeyVisibility');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    });

    // 测试连接
    document.getElementById('testBtn')?.addEventListener('click', testConnection);

    // 清除设置
    document.getElementById('clearBtn')?.addEventListener('click', clearSettings);
}

function updateStatusIndicator() {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;

    const hasKey = !!localStorage.getItem('siliconflow_api_key');
    
    if (hasKey) {
        indicator.className = 'status-indicator configured';
        indicator.innerHTML = '✅ 已配置API Key';
    } else {
        indicator.className = 'status-indicator not-configured';
        indicator.innerHTML = '❌ 尚未配置API Key';
    }
}

async function testConnection() {
    const resultDiv = document.getElementById('testResult');
    const testBtn = document.getElementById('testBtn');
    
    // 先保存当前输入的Key
    const apiKeyInput = document.getElementById('apiKeyInput');
    const key = apiKeyInput.value.trim();
    
    if (key) {
        localStorage.setItem('siliconflow_api_key', key);
    }
    
    // 显示加载状态
    resultDiv.className = 'test-result loading';
    resultDiv.textContent = '正在测试连接...';
    testBtn.disabled = true;

    try {
        const result = await testApiConnection();
        
        resultDiv.className = 'test-result success';
        resultDiv.innerHTML = `✅ ${result.message}`;
        
        // 成功后刷新状态
        updateStatusIndicator();
        
    } catch (error) {
        resultDiv.className = 'test-result error';
        resultDiv.textContent = `❌ ${error.message}`;
    } finally {
        testBtn.disabled = false;
    }
}

function clearSettings() {
    if (confirm('确定要清除所有API设置吗？')) {
        localStorage.removeItem('siliconflow_api_key');
        localStorage.removeItem('siliconflow_model');
        
        document.getElementById('apiKeyInput').value = '';
        document.querySelector('input[name="model"][value="deepseek"]').checked = true;
        
        document.getElementById('testResult').className = 'test-result';
        document.getElementById('testResult').textContent = '';
        
        updateStatusIndicator();
        
        alert('已清除所有设置');
    }
}
