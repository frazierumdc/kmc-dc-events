/* global self */
// Notifications in the app's service worker (D65, NT-15, NT-16), loaded into the worker that
// vite-plugin-pwa builds (vite.config.ts, importScripts). Firebase Cloud Messaging delivers
// each message as web push: { data: { title, body, url, tag } }. Every push shows a
// notification, as iPhone requires; tapping it opens the app at the address the message
// carries: the list at the event's date (NT-15).

/** The message's own fields, or null when it carries none the app knows. */
function readMessage(event) {
  try {
    const data = event.data ? event.data.json().data : null;
    if (!data || typeof data.title !== "string" || typeof data.body !== "string") return null;
    // Only the app's own pages: a path on this site.
    const url = typeof data.url === "string" && /^\/[^/]/.test(data.url) ? data.url : "/";
    return { title: data.title, body: data.body, url, tag: data.tag || undefined };
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const message = readMessage(event) ?? {
    title: "KMC DC Events",
    body: "The schedule changed. Open the app to see it.",
    url: "/",
  };
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      // One event's later change replaces the earlier one on the lock screen (NT-14).
      tag: message.tag,
      renotify: Boolean(message.tag),
      icon: "/pwa-192x192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // The app already open: bring it forward at the message's address; it loads the new
      // schedule on returning (EV-18). Otherwise open it there.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) return client.navigate(url);
        return undefined;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
