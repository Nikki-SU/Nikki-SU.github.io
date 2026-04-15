const CACHE_NAME = 'academic-site-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/weekly.html',
  '/papers.html',
  '/vocabulary.html',
  '/settings.html',
  '/sync.html',
  '/css/style.css',
  '/js/main.js',
  '/js/weekly.js',
  '/js/papers.js',
  '/js/vocabulary.js',
  '/js/ai-parser.js',
  '/js/settings.js',
  '/js/github-sync.js',
  '/data/papers.json',
  '/data/vocabulary.json',
  '/data/weekly.json',
  '/data/journals.json',
  '/manifest.json'
];

// 安装事件 - 缓存文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存文件中...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 请求拦截 - 缓存优先，网络备用
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 缓存命中，返回缓存
        if (response) {
          return response;
        }

        // 网络请求
        return fetch(event.request).then(response => {
          // 检查有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应并缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // 离线时返回首页
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
