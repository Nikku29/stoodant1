// Stoodant app service worker: makes the app installable and shows push notifications.
// Messages are sent by our Cloud Functions as data-only web pushes: { title, body, link, tag }.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Pages always come from the network, so a new release shows on the next open.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let msg = {};
  try {
    const raw = event.data ? event.data.json() : {};
    msg = raw.data || raw.notification || raw;
  } catch {
    msg = { body: event.data ? event.data.text() : "" };
  }
  const title = msg.title || "Stoodant";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: msg.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: msg.tag || undefined,
      renotify: Boolean(msg.tag),
      data: { link: msg.link || "/" },
    }),
  );
});

// Tapping a notification opens its page, reusing the app window when it is already open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = new URL(event.notification.data?.link || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(link).then((w) => (w || open).focus());
      return self.clients.openWindow(link);
    }),
  );
});
