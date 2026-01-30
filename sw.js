const CACHE_NAME = 'apex-circle-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/public.css',
  '/assets/images/apex-circle-logo.png',
  '/dashboard/login.html',
  '/dashboard/admin/team-management.html',
  '/css/dashboard.css',
  '/css/status-badges.css',
  '/js/main.js',
  '/js/dashboard.js',
  '/js/team-management.js',
  '/js/team-dashboard.js',
  '/js/data.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
