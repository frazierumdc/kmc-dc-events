// The kill switch (runbook: docs/workflow/runbooks.md#switch-the-service-worker-off-kill-switch).
// Deployed in place of the app's service worker when a broken version is stuck on phones:
// it takes over at once, deletes every cache, unregisters itself and reloads each open
// page from the network. The same build's app doesn't register a service worker, so
// nothing installs again until a normal deploy.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: "window" });
      for (const page of pages) await page.navigate(page.url);
    })(),
  );
});
