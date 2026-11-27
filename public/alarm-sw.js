// File: /public/alarm-sw.js | Revision: Rev 28 | Version: 1.5.9
// Background Service Worker Alarm Extension for 30-Min-Before Appointment Alerts

const SW_BUILD_VERSION = '1.5.9';
const SW_VERSION_MARKER_CACHE = 'myqueue-sw-marker-v1.5.9';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const hasCurrentMarker = await caches.has(SW_VERSION_MARKER_CACHE);
        const cacheKeys = await caches.keys();
        const legacyCaches = cacheKeys.filter(
          (k) =>
            (k.startsWith('myqueue-sw-marker-') && k !== SW_VERSION_MARKER_CACHE) ||
            (k.includes('workbox-precache') && !k.includes('myqueue-onsite-v159'))
        );

        await Promise.all(legacyCaches.map((k) => caches.delete(k)));

        if (!hasCurrentMarker) {
          const markerCache = await caches.open(SW_VERSION_MARKER_CACHE);
          await markerCache.put(
            new Request('/__sw_version_marker__'),
            new Response(SW_BUILD_VERSION, { headers: { 'Content-Type': 'text/plain' } })
          );
        }

        await self.clients.claim();

        if (!hasCurrentMarker) {
          const winClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });
          for (const client of winClients) {
            try {
              client.postMessage({ type: 'SW_UPDATED_RELOAD', version: SW_BUILD_VERSION });
              if (legacyCaches.length > 0 && 'navigate' in client) {
                await client.navigate(client.url);
              }
            } catch {
              // Ignore cross-origin / closed client errors
            }
          }
        }
      } catch (err) {
        console.warn('[alarm-sw] activate cleanup warning:', err);
      }
    })()
  );
});

const ALARM_DB_NAME = 'myqueue_alarm_db_v1';
const ALARM_STORE_SCHEDULES = 'schedules';
const ALARM_STORE_ACKS = 'acks';

function openAlarmDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ALARM_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ALARM_STORE_SCHEDULES)) {
        db.createObjectStore(ALARM_STORE_SCHEDULES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ALARM_STORE_ACKS)) {
        db.createObjectStore(ALARM_STORE_ACKS, { keyPath: 'ackKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSchedulesToIdb(schedules, acknowledgedKeys) {
  const db = await openAlarmDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ALARM_STORE_SCHEDULES, ALARM_STORE_ACKS], 'readwrite');
    const schedStore = tx.objectStore(ALARM_STORE_SCHEDULES);
    const ackStore = tx.objectStore(ALARM_STORE_ACKS);

    schedStore.clear();
    if (Array.isArray(schedules)) {
      for (const item of schedules) {
        schedStore.put(item);
      }
    }

    if (Array.isArray(acknowledgedKeys)) {
      for (const k of acknowledgedKeys) {
        ackStore.put({ ackKey: k, at: Date.now() });
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function markAckInIdb(ackKey) {
  if (!ackKey) return;
  const db = await openAlarmDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([ALARM_STORE_ACKS], 'readwrite');
    tx.objectStore(ALARM_STORE_ACKS).put({ ackKey, at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readSchedulesAndAcks() {
  const db = await openAlarmDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([ALARM_STORE_SCHEDULES, ALARM_STORE_ACKS], 'readonly');
    const schedReq = tx.objectStore(ALARM_STORE_SCHEDULES).getAll();
    const ackReq = tx.objectStore(ALARM_STORE_ACKS).getAll();

    tx.oncomplete = () => {
      const ackSet = new Set((ackReq.result || []).map((x) => x.ackKey));
      resolve({ schedules: schedReq.result || [], ackSet });
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function scheduleNativeTriggersIfSupported(schedules, ackSet) {
  // Check Notification Triggers API (TimestampTrigger in Chromium / Android Chrome PWA)
  const hasTimestampTrigger =
    typeof self.TimestampTrigger === 'function' &&
    typeof Notification !== 'undefined' &&
    'showTrigger' in Notification.prototype;

  if (!hasTimestampTrigger || Notification.permission !== 'granted') {
    return;
  }

  try {
    // Cancel existing scheduled triggers before re-scheduling latest schedules
    const existing = await self.registration.getNotifications({ includeTriggered: true });
    for (const notif of existing) {
      if (notif.tag && (notif.tag.startsWith('appt-30m-trigger-') || notif.tag.startsWith('appt-1hr-trigger-'))) {
        notif.close();
      }
    }

    const now = Date.now();
    for (const item of schedules) {
      if (ackSet.has(item.ackKey)) continue;
      if (item.reminderAt > now) {
        await self.registration.showNotification(
          `⏰ อีก 30 นาที ถึงเวลานัด! (${item.queueNumber})`,
          {
            body: `${item.product} • ลูกค้า: ${item.customerName} (${item.customerPhone})\nเวลานัด: ${item.appointmentTime}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `appt-30m-trigger-${item.ackKey}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [400, 150, 400, 150, 500, 200, 500],
            showTrigger: new self.TimestampTrigger(item.reminderAt),
            data: {
              jobId: item.id,
              ackKey: item.ackKey,
              url: `/?alarm_job=${encodeURIComponent(item.id)}`,
            },
            actions: [
              { action: 'open', title: 'เปิดดู & ส่งเสียงเตือน' },
              { action: 'ack', title: 'ยืนยันรับทราบ' },
            ],
          }
        );
      }
    }
  } catch (err) {
    console.warn('[alarm-sw] TimestampTrigger scheduling skipped:', err);
  }
}

async function checkAndFireDueNotifications() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  try {
    const { schedules, ackSet } = await readSchedulesAndAcks();
    const now = Date.now();

    for (const item of schedules) {
      if (ackSet.has(item.ackKey)) continue;
      // Due if current time is between 30 minutes before and 48 hours after appointment start
      if (now >= item.reminderAt && now <= item.appointmentAt + 48 * 60 * 60 * 1000) {
        const tag = `appt-30m-due-${item.ackKey}`;
        const activeNotifs = await self.registration.getNotifications({ tag });
        if (activeNotifs && activeNotifs.length > 0) {
          continue; // Already visible on notification tray
        }

        const diffMins = Math.round((item.appointmentAt - now) / 60000);
        const timeText =
          diffMins > 0
            ? `อีก ${diffMins} นาทีถึงเวลานัด`
            : diffMins === 0
            ? 'ถึงเวลานัดหมายแล้ว!'
            : `เกินคิวงานแล้ว ${Math.abs(diffMins)} นาที!`;

        await self.registration.showNotification(
          `🔔 ${timeText} (${item.queueNumber})`,
          {
            body: `${item.product}\nลูกค้า: ${item.customerName} (${item.customerPhone})\nเวลา: ${item.appointmentTime}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag,
            renotify: true,
            requireInteraction: true,
            vibrate: [450, 150, 450, 150, 600, 200, 600],
            data: {
              jobId: item.id,
              ackKey: item.ackKey,
              url: `/?alarm_job=${encodeURIComponent(item.id)}`,
            },
            actions: [
              { action: 'open', title: 'เปิดแอป & รับทราบ' },
              { action: 'ack', title: 'ยืนยันรับทราบ' },
            ],
          }
        );
      }
    }
  } catch (err) {
    console.warn('[alarm-sw] checkAndFireDueNotifications error:', err);
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'SYNC_APPOINTMENT_ALARMS') {
    event.waitUntil(
      (async () => {
        await saveSchedulesToIdb(data.schedules || [], data.acknowledgedKeys || []);
        const { schedules, ackSet } = await readSchedulesAndAcks();
        await scheduleNativeTriggersIfSupported(schedules, ackSet);
        await checkAndFireDueNotifications();
      })()
    );
  } else if (data.type === 'ACK_APPOINTMENT_ALARM') {
    event.waitUntil(
      (async () => {
        await markAckInIdb(data.ackKey);
        const allNotifs = await self.registration.getNotifications();
        for (const n of allNotifs) {
          if (n.data && n.data.ackKey === data.ackKey) {
            n.close();
          }
        }
      })()
    );
  } else if (data.type === 'CHECK_APPOINTMENTS_NOW') {
    event.waitUntil(checkAndFireDueNotifications());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'myqueue-appointment-check') {
    event.waitUntil(checkAndFireDueNotifications());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'myqueue-appointment-sync') {
    event.waitUntil(checkAndFireDueNotifications());
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      if (event.data) {
        try {
          const payload = event.data.json();
          await self.registration.showNotification(payload.title || '🔔 แจ้งเตือนคิวงานนัดหมาย', {
            body: payload.body || 'กรุณาเปิดดูรายละเอียดคิวงานที่ใกล้ถึงเวลานัดหมาย',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            requireInteraction: true,
            vibrate: [400, 150, 400, 150, 500],
            data: { url: payload.url || '/' },
          });
          return;
        } catch {
          // fallback to IndexedDB check
        }
      }
      await checkAndFireDueNotifications();
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const action = event.action;
  const ackKey = notif.data && notif.data.ackKey;
  const targetUrl = (notif.data && notif.data.url) || '/';

  notif.close();

  if (action === 'ack' && ackKey) {
    event.waitUntil(
      (async () => {
        await markAckInIdb(ackKey);
        const winClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of winClients) {
          c.postMessage({ type: 'ACK_FROM_SW', ackKey });
        }
      })()
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const winClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of winClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'OPEN_ALARM_FROM_SW', jobId: notif.data && notif.data.jobId });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
