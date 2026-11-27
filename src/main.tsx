import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { APP_VERSION } from './version';
import './index.css';

// Clear outdated Workbox precache if client version changed so stale versions (e.g. v1.5.2) never linger
if (typeof window !== 'undefined') {
  try {
    const versionKey = 'myqueue_sw_app_version';
    const prevVersion = localStorage.getItem(versionKey);
    if (prevVersion !== APP_VERSION) {
      localStorage.setItem(versionKey, APP_VERSION);
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((k) => k.includes('workbox') || k.includes('precache'))
                .map((k) => caches.delete(k))
            )
          )
          .catch(() => {});
      }
    }
  } catch {}
}

const reloadOnceForVersion = (targetVersion: string) => {
  try {
    const guardKey = `myqueue_reloaded_for_${targetVersion}`;
    if (sessionStorage.getItem(guardKey) === '1') return;
    sessionStorage.setItem(guardKey, '1');
  } catch {}
  window.location.reload();
};

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true).catch(() => {});
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      registration.update().catch(() => {});
      // Check for SW updates periodically and whenever tab regains focus/visibility
      setInterval(() => {
        registration.update().catch(() => {});
      }, 2 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });
    }
  },
});

// Live server freshness check on startup: if /api/health reports a newer version, clear SW precache & reload once
if (typeof window !== 'undefined') {
  fetch(`/api/health?t=${Date.now()}`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return;
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) return;
      const data = await res.json();
      const serverVer = typeof data?.version === 'string' ? data.version.trim() : '';
      if (serverVer && serverVer !== APP_VERSION) {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.includes('workbox') || k.includes('precache') || k.includes('myqueue-sw-marker'))
              .map((k) => caches.delete(k))
          );
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
        }
        reloadOnceForVersion(serverVer);
      }
    })
    .catch(() => {});
}

// Google Maps Platform Tier 1 Quota / Auth Failure Listener
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    reloadOnceForVersion(APP_VERSION);
  });
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'SW_UPDATED_RELOAD') {
      if (refreshing) return;
      refreshing = true;
      reloadOnceForVersion(event.data?.version || APP_VERSION);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
