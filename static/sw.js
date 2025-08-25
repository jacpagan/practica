const CACHE_NAME = 'practika-v1.0.0';
const STATIC_CACHE = 'practika-static-v1.0.0';
const DYNAMIC_CACHE = 'practika-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/static/css/icon-ui.css',
    '/static/icons/icons.svg',
    '/static/manifest.json',
    '/exercises/',
    '/create/',
    '/login/',
    '/static/icons/icon-192x192.png',
    '/static/icons/icon-512x512.png'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip non-HTTP requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle different types of requests
    if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/media/')) {
        // Static assets - cache first strategy
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (url.pathname.startsWith('/api/')) {
        // API requests - network first strategy
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    } else {
        // HTML pages - network first strategy
        event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    }
});

// Cache first strategy for static assets
async function cacheFirst(request, cacheName) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Cache first strategy failed:', error);
        return new Response('Offline content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Network first strategy for dynamic content
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', error);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }

        return new Response('Content not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Get pending actions from IndexedDB
        const pendingActions = await getPendingActions();
        
        for (const action of pendingActions) {
            try {
                await processPendingAction(action);
                await removePendingAction(action.id);
            } catch (error) {
                console.error('Failed to process pending action:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'New notification from Practika',
            icon: '/static/icons/icon-192x192.png',
            badge: '/static/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            data: {
                url: data.url || '/'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View',
                    icon: '/static/icons/icon-72x72.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/static/icons/icon-72x72.png'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Practika', options)
        );
    }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

// Helper functions for background sync
async function getPendingActions() {
    // This would typically use IndexedDB
    // For now, return empty array
    return [];
}

async function processPendingAction(action) {
    // Process different types of pending actions
    switch (action.type) {
        case 'video_upload':
            return await processVideoUpload(action);
        case 'comment_create':
            return await processCommentCreate(action);
        default:
            console.log('Unknown action type:', action.type);
    }
}

async function processVideoUpload(action) {
    // Implementation for processing pending video uploads
    console.log('Processing pending video upload:', action);
}

async function processCommentCreate(action) {
    // Implementation for processing pending comment creation
    console.log('Processing pending comment creation:', action);
}

async function removePendingAction(actionId) {
    // Remove processed action from pending queue
    console.log('Removing processed action:', actionId);
}

// Handle video upload progress
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'VIDEO_UPLOAD_PROGRESS') {
        // Handle video upload progress updates
        console.log('Video upload progress:', event.data.progress);
    }
});
