# 小N学术站 - 钙钛矿太阳能电池研究学习平台

## 📌 网站地址
**https://nikki-su.github.io/**

## 🎯 网站功能

### 1. 首页 (index.html)
- 学习概览统计（文献数量、生词数量、已掌握数）
- 最新周报预览
- 最近文献卡片
- 快捷操作入口

### 2. 周报模块 (weekly.html)
- **期刊追踪**：追踪33个钙钛矿太阳能电池相关期刊
- **周报管理**：创建、编辑、删除周报
- **文献导入**：支持DOI导入，自动获取文献信息
- **文献综述**：自动生成周报中的文献综述
- **期刊管理**：可添加/删除追踪的期刊

### 3. 文献卡片模块 (papers.html)
- **双语切换**：中文/英文显示切换
- **完整字段**：
  - 文献标题（中/英）
  - 作者、期刊、发表日期、DOI
  - 摘要
  - 分类（合成、表征、机理、应用等）
  - 关键词
  - 题图
  - 工作总结
  - 主要创新点
  - 应用领域
  - 文章脉络
  - 表征技术
- **导入方式**：
  - DOI导入（支持 `https://doi.org/xxx` 和纯DOI格式）
  - PDF导入（前端需配合后端解析）
- **手动编辑**：完整的CRUD操作

### 4. 词汇本模块 (vocabulary.html)
- **学习流程**（10个一组）：
  - 新学：单词卡片 → 英选中 → 中选英 → 英选义 → 义选英
  - 复习：跳过单词卡片，直接从选择题开始
- **进度保存**：每次学习和复习的进度自动保存，下次继续
- **错题处理**：答错弹出单词卡片，点击重做，本轮末尾补做
- **单词状态**：
  - 🆕 新词
  - 📖 正在学
  - ✅ 已学
  - 🏆 已掌握
  - ❌ 错词本
- **学习设置**：
  - 学习/复习词数（10/20/30/50/80/100）
  - 掌握条件（连续正确8次或12次）
  - 题型开关（英选中、中选英、英选义、义选英）
  - 朗读开关
  - 允许"斩"开关

### 5. 数据同步 (sync.html)
- 将本地数据推送到GitHub
- 从GitHub拉取数据到本地

## 📂 文件结构

```
academic-site/
├── index.html              # 首页
├── weekly.html             # 周报模块
├── papers.html             # 文献卡片模块
├── vocabulary.html         # 词汇本模块
├── sync.html               # 数据同步页面
├── css/
│   └── style.css           # 全局样式
├── js/
│   ├── main.js             # 首页脚本
│   ├── weekly.js           # 周报模块脚本
│   ├── papers.js           # 文献卡片脚本
│   ├── vocabulary.js       # 词汇本核心脚本
│   └── github-sync.js      # GitHub同步脚本
├── data/
│   ├── papers.json         # 文献数据
│   ├── vocabulary.json     # 词汇数据
│   ├── weekly.json         # 周报数据
│   └── journals.json       # 期刊列表
└── upload_to_github.py     # 上传脚本
```

## 🔧 技术实现

- **纯静态网站**：HTML + CSS + JavaScript
- **数据存储**：JSON文件 + localStorage
- **托管平台**：GitHub Pages
- **DOI获取**：CrossRef API
- **文献追踪**：CrossRef API

## 📊 初始数据

### 期刊列表（33个）
- **顶级综合**：Nature, Science, Nature Materials, Nature Energy, Nature Nanotechnology, Nature Photonics, Nature Communications, Science Advances
- **材料与能源**：Advanced Materials, Energy & Environmental Science, Joule, Materials Horizons
- **应用材料化学**：Advanced Energy Materials, Angewandte Chemie, JACS, Chemical Society Reviews, Nano Energy, ACS Materials Letters, Materials Today
- **材料纳米**：Nano Letters, ACS Nano, Advanced Functional Materials, Small, Chemistry of Materials, Journal of Materials Chemistry A
- **能源材料**：Chem, Energy Storage Materials, Nano-Micro Letters, ACS Energy Letters
- **其他**：Solar RRL, Advanced Science, Scientific Reports, ACS Applied Energy Materials

### 示例文献（4篇）
- 钙钛矿薄膜的离子工程 (Nature Energy)
- 原位GIWAXS研究刮刀涂布 (Advanced Materials)
- 功能化石墨烯量子点钝化晶界 (Science)
- 效率达23%的柔性钙钛矿电池 (Joule)

### 示例词汇（10个）
- perovskite（钙钛矿）
- crystallinity（结晶度）
- passivation（钝化）
- grain boundary（晶界）
- recombination（复合）
- XRD（X射线衍射）
- SEM（扫描电子显微镜）
- spin-coating（旋涂）
- efficiency（效率）
- defect（缺陷）

## 🚀 使用说明

### 数据持久化
网站使用localStorage存储本地数据，每次操作会自动保存。如需跨设备同步，使用sync.html页面。

### GitHub Token
如需使用同步功能，在sync.html中将 `YOUR_GITHUB_TOKEN_HERE` 替换为您的GitHub Personal Access Token。

### 扩展功能
- 可通过修改`data/journals.json`添加更多期刊
- 可通过修改`data/vocabulary.json`批量导入词汇
- 可通过修改`data/papers.json`批量导入文献

## 📝 更新日志

### v2.0 (2024-03)
- 完全重构网站代码
- 新增周报模块，支持期刊追踪和文献综述
- 新增完整的词汇本学习系统
- 实现进度保存和断点续学
- 支持双语切换
- 添加期刊管理功能

---

*小N学术学习站 | 钙钛矿太阳能电池研究方向*
