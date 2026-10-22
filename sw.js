const CACHE_NAME = "fazendinha-shell-v5";
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.svg", "./icon-512.svg"];
const CACHEABLE_ASSET_EXTENSIONS = [".webp", ".woff2", ".woff"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const staticDestinations = ["document", "script", "style", "image", "font"];
  const isNewAsset = CACHEABLE_ASSET_EXTENSIONS.some((extension) =>
    url.pathname.endsWith(extension));
  const isEdgeFunction = url.pathname.includes("/functions/");
  const isApiRoute = url.pathname.includes("/rest/") || url.pathname.includes("/auth/");
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (isEdgeFunction || isApiRoute ||
    (!staticDestinations.includes(request.destination) && !isNewAsset)) return;

  const networkFirst = ["document", "script", "style"].includes(request.destination);
  event.respondWith((networkFirst ? fetch(request) : caches.match(request))
    .then((response) => {
      if (response) {
        if (networkFirst && response.ok) {
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          void caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
          });
        }
        return networkResponse;
      });
    })
    .catch(() => caches.match(request).then((cached) => cached ||
      new Response("Offline", { status: 503 }))));
});
