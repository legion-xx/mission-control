/* Mission Control v2 - Service Worker */

const CACHE_NAME = 'mission-control-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/css/style.css',
    '/js/utils.js',
    '/js/capture.js',
    '/js/search.js',
    '/js/dashboard.js',
    '/js/board.js',
    '/js/notes.js',
    '/js/links.js',
    '/js/app.js',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
    /^\/api\/data$/,
    /^\/api\/tasks$/,
    /^\/api\/notes$/,
    /^\/api\/links$/,
    /^\/api\/tags$/,
    /^\/api\/settings$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Service worker installed successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim(); // Take control of all clients
            })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Handle different types of requests
    if (request.method === 'GET') {
        if (isStaticAsset(url.pathname)) {
            // Static assets - cache first, then network
            event.respondWith(cacheFirst(request));
        } else if (isApiRequest(url.pathname)) {
            // API requests - network first, then cache
            event.respondWith(networkFirst(request));
        } else if (isNavigationRequest(request)) {
            // Navigation requests - try network, fallback to cached app shell
            event.respondWith(navigationRequest(request));
        } else {
            // Other requests - try network, no cache fallback
            event.respondWith(fetch(request));
        }
    } else if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
        // Mutating requests - always use network, invalidate cache
        event.respondWith(mutatingRequest(request));
    }
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first failed:', error);
        throw error;
    }
}

// Network-first strategy for API requests
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful GET responses
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Handle navigation requests
async function navigationRequest(request) {
    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log('[SW] Navigation network failed, returning app shell');
        
        // Return cached app shell
        const cachedResponse = await caches.match('/');
        if (cachedResponse) {
            return cachedResponse;
        }
        
        throw error;
    }
}

// Handle mutating requests
async function mutatingRequest(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Invalidate related cache entries on successful mutations
        if (networkResponse.ok) {
            await invalidateCache(request.url);
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Mutating request failed:', error);
        throw error;
    }
}

// Invalidate cache entries related to the request
async function invalidateCache(url) {
    const cache = await caches.open(CACHE_NAME);
    
    // Invalidate specific patterns based on the request
    if (url.includes('/api/tasks')) {
        await cache.delete('/api/tasks');
        await cache.delete('/api/data');
    } else if (url.includes('/api/notes')) {
        await cache.delete('/api/notes');
        await cache.delete('/api/data');
    } else if (url.includes('/api/links')) {
        await cache.delete('/api/links');
        await cache.delete('/api/data');
    } else if (url.includes('/api/settings')) {
        await cache.delete('/api/settings');
        await cache.delete('/api/data');
    }
}

// Helper functions
function isStaticAsset(pathname) {
    return pathname.startsWith('/css/') ||
           pathname.startsWith('/js/') ||
           pathname.startsWith('/icons/') ||
           pathname === '/manifest.json' ||
           pathname === '/';
}

function isApiRequest(pathname) {
    return pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
           (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Message handling for cache management
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_UPDATE':
            // Force update cache for specific items
            updateCache(data.urls);
            break;
            
        case 'CLEAR_CACHE':
            // Clear all caches
            clearAllCaches();
            break;
    }
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

async function updateCache(urls) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urls);
        console.log('[SW] Cache updated for:', urls);
    } catch (error) {
        console.error('[SW] Failed to update cache:', error);
    }
}

async function clearAllCaches() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[SW] All caches cleared');
    } catch (error) {
        console.error('[SW] Failed to clear caches:', error);
    }
}

async function handleBackgroundSync() {
    console.log('[SW] Handling background sync');
    // TODO: Implement offline action sync
}

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'mission-control',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Open or focus the app
    event.waitUntil(
        self.clients.matchAll({ type: 'window' })
            .then((clients) => {
                if (clients.length > 0) {
                    return clients[0].focus();
                } else {
                    return self.clients.openWindow('/');
                }
            })
    );
});

console.log('[SW] Service worker script loaded');