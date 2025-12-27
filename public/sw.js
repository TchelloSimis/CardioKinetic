/**
 * CardioKinetic Service Worker
 * 
 * Provides offline caching for the PWA.
 * Uses cache-first strategy for static assets.
 */

const CACHE_NAME = 'cardiokinetic-v1';

// Assets to precache on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/index.css',
    '/manifest.json'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching core assets');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                // Activate immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Take control immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - cache-first for static, network-first for dynamic
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Skip POST and other non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Cache-first for static assets (js, css, images, fonts)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(event.request));
    } else {
        // Network-first for HTML and dynamic content
        event.respondWith(networkFirst(event.request));
    }
});

function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|eot)$/i.test(pathname) ||
        pathname.includes('/assets/');
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Fetch failed:', request.url, error);
        // Return a fallback response if available
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // Return the offline page for HTML requests
        if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}
