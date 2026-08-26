// Service Worker — Web Push Notifications
// Mouvement Christ Libère V2.0.9
//
// Handles push events + notification clicks.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = JSON.parse(event.data?.text() || "{}");
  } catch {
    data = { title: "Mouvement Christ Libère", body: event.data?.text() || "" };
  }

  const title = data.title || "Mouvement Christ Libère";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    tag: data.tag || "default",
    data: { url: data.url || "/yeshua-connect" },
    vibrate: [200, 100, 200],
    requireInteraction: data.tag === "announcements" || data.tag === "live",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/yeshua-connect";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: event.newSubscription }),
    })
  );
});
