const APP_VERSION = '1.14';

const OFFLINE_DB = 'legacy-oilfield-offline-v1';
const OFFLINE_STORE = 'pending_mutations';
const OFFLINE_CACHE = 'reference_cache';

let offlineDbPromise = null;
let syncBusy = false;

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    const q = indexedDB.open(OFFLINE_DB, 1);
    q.onupgradeneeded = () => {
      const d = q.result;
      if (!d.objectStoreNames.contains(OFFLINE_STORE)) {
        d.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(OFFLINE_CACHE)) {
        d.createObjectStore(OFFLINE_CACHE, { keyPath: 'key' });
      }
    };
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  return offlineDbPromise;
}

async function idbAll(store) {
  const d = await openOfflineDb();
  return new Promise((res, rej) => {
    const q = d.transaction(store, 'readonly').objectStore(store).getAll();
    q.onsuccess = () => res(q.result || []);
    q.onerror = () => rej(q.error);
  });
}

async function idbPut(store, v) {
  const d = await openOfflineDb();
  return new Promise((res, rej) => {
    const q = d.transaction(store, 'readwrite').objectStore(store).put(v);
    q.onsuccess = () => res(v);
    q.onerror = () => rej(q.error);
  });
}

async function idbDelete(store, key) {
  const d = await openOfflineDb();
  return new Promise((res, rej) => {
    const q = d.transaction(store, 'readwrite').objectStore(store).delete(key);
    q.onsuccess = () => res();
    q.onerror = () => rej(q.error);
  });
}

async function cacheRef(key, value) {
  try {
    await idbPut(OFFLINE_CACHE, { key, value, updated_at: new Date().toISOString() });
  } catch {}
}

async function getCachedRef(key) {
  try {
    return (await idbAll(OFFLINE_CACHE)).find(x => x.key === key)?.value || null;
  } catch {
    return null;
  }
}

function offlineId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'off-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

async function queueMutation(table, action, payload, match = null) {
  const item = {
    id: offlineId(),
    table,
    action,
    payload,
    match,
    queued_at: new Date().toISOString(),
    user_id: me?.id || null,
    status: 'pending',
    attempts: 0
  };
  await idbPut(OFFLINE_STORE, item);
  await updateOfflineBar();
  return item;
}

async function pendingCount() {
  return (await idbAll(OFFLINE_STORE)).filter(
    x => x.status === 'pending' || x.status === 'conflict'
  ).length;
}

async function updateOfflineBar(message = '') {
  const el = document.getElementById('offlineBar');
  if (!el) return;
  let n = 0;
  try {
    n = await pendingCount();
  } catch {}
  if (!navigator.onLine) {
    el.className = '';
    el.style.display = 'block';
    el.innerHTML = `OFFLINE • ${n} change${n === 1 ? '' : 's'} waiting to sync`;
    return;
  }
  if (message) {
    el.className = 'online';
    el.style.display = 'block';
    el.textContent = message;
    setTimeout(() => {
      if (n === 0) el.style.display = 'none';
    }, 4000);
    return;
  }
  if (n) {
    el.className = 'online';
    el.style.display = 'block';
    el.innerHTML = `ONLINE • <span class="syncPending">${n} change${n === 1 ? '' : 's'} waiting to sync</span>`;
  } else {
    el.style.display = 'none';
  }
}

window.addEventListener('offline', () => updateOfflineBar());
window.addEventListener('online', () => {
  updateOfflineBar('Signal restored • synchronizing…');
  syncPendingMutations();
});

const SUPABASE_URL = 'https://xxtwsaebnxsdgygxaekj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_I5FfFfwpAUPTH7d-6SfbyQ_qRZAOEC4';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let me = null;
let profile = null;
let current = 'dashboard';
let refs = {
  leases: [],
  wells: [],
  contractors: [],
  tanks: [],
  removalTypes: [],
  purchasers: []
};
let activeTankLeaseKey = null;
