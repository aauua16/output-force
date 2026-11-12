// Output Force — Service Worker
// Handles background notifications when the tab is inactive
// NOTE: Service workers require HTTPS or localhost (not file://)

const SW_VERSION = 'v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

let checkInterval = null;
let scheduledTimes = [];
const firedToday = new Set();

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SETUP') {
    scheduledTimes = e.data.times || [];
    // Clear old interval
    if (checkInterval) clearInterval(checkInterval);
    // Check every 30 seconds
    checkInterval = setInterval(checkAndFire, 30000);
    checkAndFire();
  }

  if (e.data.type === 'STOP') {
    if (checkInterval) clearInterval(checkInterval);
  }

  if (e.data.type === 'TEST') {
    self.registration.showNotification('⚡ Output Force', {
      body: 'テスト通知です！通知は正常に動作しています。',
      icon: './icon.png',
      badge: './icon.png',
      tag: 'test',
      vibrate: [200, 100, 200]
    });
  }
});

function checkAndFire() {
  if (!scheduledTimes.length) return;

  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const today = now.toDateString();

  // Reset daily fired set at midnight
  if (checkAndFire._lastDay !== today) {
    firedToday.clear();
    checkAndFire._lastDay = today;
  }

  for (const time of scheduledTimes) {
    const key = `${today}__${time}`;
    if (hhmm === time && !firedToday.has(key)) {
      firedToday.add(key);
      fireNotification();
    }
  }
}

function fireNotification() {
  self.registration.showNotification('⚡ Output Force', {
    body: 'アウトプットの時間です！今日学んだことを振り返りましょう。',
    icon: './icon.png',
    badge: './icon.png',
    tag: `notif-${Date.now()}`,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: '開く' }
    ]
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cs => {
      if (cs.length) { cs[0].focus(); return; }
      clients.openWindow('./index.html');
    })
  );
});

function pad(n) { return n.toString().padStart(2, '0'); }
