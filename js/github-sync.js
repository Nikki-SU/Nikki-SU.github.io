/**
 * GitHub Sync Script
 * 用于将本地数据同步到GitHub仓库
 * 
 * 使用方法:
 * 1. 在浏览器控制台中运行
 * 2. 或使用Node.js运行
 */

// GitHub配置
const GITHUB_CONFIG = {
    owner: 'Nikki-SU',
    repo: 'Nikki-SU.github.io',
    token: 'YOUR_GITHUB_TOKEN_HERE', // 从SECRET.md获取
    branch: 'main'
};

/**
 * 上传文件到GitHub
 */
async function uploadToGitHub(filePath, content, message) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    // 将内容转换为Base64
    const contentBase64 = btoa(unescape(encodeURIComponent(content)));
    
    // 先检查文件是否存在
    let sha = null;
    try {
        const checkResponse = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (checkResponse.ok) {
            const data = await checkResponse.json();
            sha = data.sha;
        }
    } catch (error) {
        console.log('文件不存在，将创建新文件');
    }
    
    // 上传文件
    const body = {
        message: message || `Update ${filePath}`,
        content: contentBase64,
        branch: GITHUB_CONFIG.branch
    };
    
    if (sha) {
        body.sha = sha;
    }
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`上传失败: ${error.message}`);
    }
    
    return await response.json();
}

/**
 * 下载GitHub上的文件
 */
async function downloadFromGitHub(filePath) {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 解码Base64内容
    const content = atob(data.content);
    
    return content;
}

/**
 * 同步所有数据文件
 */
async function syncAllData() {
    const dataFiles = [
        { path: 'data/papers.json', key: 'papersData' },
        { path: 'data/vocabulary.json', key: 'vocabularyData' },
        { path: 'data/weekly.json', key: 'weeklyData' },
        { path: 'data/journals.json', key: 'journalsData' }
    ];
    
    const results = [];
    
    for (const file of dataFiles) {
        try {
            const localData = localStorage.getItem(file.key);
            if (localData) {
                const jsonData = JSON.stringify(JSON.parse(localData), null, 2);
                await uploadToGitHub(file.path, jsonData, `Sync ${file.path}`);
                results.push({ file: file.path, status: 'success' });
                console.log(`✅ ${file.path} 同步成功`);
            }
        } catch (error) {
            results.push({ file: file.path, status: 'error', message: error.message });
            console.error(`❌ ${file.path} 同步失败:`, error);
        }
    }
    
    return results;
}

/**
 * 从GitHub下载并合并数据
 */
async function pullFromGitHub() {
    const dataFiles = [
        { path: 'data/papers.json', key: 'papersData' },
        { path: 'data/vocabulary.json', key: 'vocabularyData' },
        { path: 'data/weekly.json', key: 'weeklyData' },
        { path: 'data/journals.json', key: 'journalsData' }
    ];
    
    const results = [];
    
    for (const file of dataFiles) {
        try {
            const content = await downloadFromGitHub(file.path);
            localStorage.setItem(file.key, content);
            results.push({ file: file.path, status: 'success' });
            console.log(`✅ ${file.path} 下载成功`);
        } catch (error) {
            results.push({ file: file.path, status: 'error', message: error.message });
            console.error(`❌ ${file.path} 下载失败:`, error);
        }
    }
    
    return results;
}

// 导出函数供外部使用
window.GitHubSync = {
    uploadToGitHub,
    downloadFromGitHub,
    syncAllData,
    pullFromGitHub
};

// 如果在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        uploadToGitHub,
        downloadFromGitHub,
        syncAllData,
        pullFromGitHub,
        GITHUB_CONFIG
    };
}

console.log('GitHub同步脚本已加载。使用 GitHubSync.syncAllData() 同步数据到GitHub。');
