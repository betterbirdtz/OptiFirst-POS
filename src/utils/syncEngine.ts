/**
 * Background Sync Engine
 * - Saves all writes to IndexedDB instantly (0ms response)
 * - Syncs to Google Sheets in background every 30 seconds
 * - Retries failed syncs automatically
 * - Works offline
 */

const DB_NAME = "optifirst_sync";
const DB_VERSION = 1;
const STORE_QUEUE = "sync_queue";
const STORE_CACHE = "data_cache";
const SYNC_INTERVAL = 30000; // 30 seconds

let db: IDBDatabase | null = null;
let syncTimer: number | null = null;
let syncing = false;

interface SyncItem {
  id: string;
  action: string;
  data: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: "pending" | "syncing" | "failed";
}

interface CacheItem {
  key: string;
  data: unknown;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_QUEUE)) {
        database.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORE_CACHE)) {
        database.createObjectStore(STORE_CACHE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
}

export async function addToSyncQueue(action: string, data: Record<string, unknown>): Promise<string> {
  const database = await openDb();
  const id = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: SyncItem = { id, action, data, createdAt: Date.now(), retries: 0, status: "pending" };
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_QUEUE, "readonly");
    const request = tx.objectStore(STORE_QUEUE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });
}

export async function getAllPending(): Promise<SyncItem[]> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_QUEUE, "readonly");
    const request = tx.objectStore(STORE_QUEUE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

async function removeSyncItem(id: string): Promise<void> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function updateSyncItem(item: SyncItem): Promise<void> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// Cache helpers
export async function getCachedData(key: string): Promise<unknown | null> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_CACHE, "readonly");
    const request = tx.objectStore(STORE_CACHE).get(key);
    request.onsuccess = () => {
      const item = request.result as CacheItem | undefined;
      if (!item) { resolve(null); return; }
      // 10 minute TTL
      if (Date.now() - item.timestamp > 10 * 60 * 1000) { resolve(null); return; }
      resolve(item.data);
    };
    request.onerror = () => resolve(null);
  });
}

export async function setCachedData(key: string, data: unknown): Promise<void> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_CACHE, "readwrite");
    tx.objectStore(STORE_CACHE).put({ key, data, timestamp: Date.now() } as CacheItem);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function clearCache(): Promise<void> {
  const database = await openDb();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_CACHE, "readwrite");
    tx.objectStore(STORE_CACHE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

// Sync engine
async function processQueue(): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    const items = await getAllPending();
    const pending = items.filter((i) => i.status === "pending" || i.status === "failed").sort((a, b) => a.createdAt - b.createdAt);

    const url = (import.meta.env.VITE_APPS_SCRIPT_URL || "").trim();
    if (!url) { syncing = false; return; }

    for (const item of pending) {
      if (item.retries >= 5) {
        // Give up after 5 retries
        await removeSyncItem(item.id);
        continue;
      }

      try {
        item.status = "syncing";
        await updateSyncItem(item);

        const response = await fetch(url, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: item.action, data: item.data })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            await removeSyncItem(item.id);
          } else {
            item.status = "failed";
            item.retries++;
            await updateSyncItem(item);
          }
        } else {
          item.status = "failed";
          item.retries++;
          await updateSyncItem(item);
        }
      } catch {
        item.status = "failed";
        item.retries++;
        await updateSyncItem(item);
        break; // Stop processing if network is down
      }
    }
  } finally {
    syncing = false;
  }
}

export function startSyncEngine(): void {
  if (syncTimer) return;
  // Initial sync after 2 seconds
  window.setTimeout(processQueue, 2000);
  // Then every 30 seconds
  syncTimer = window.setInterval(processQueue, SYNC_INTERVAL);
}

export function stopSyncEngine(): void {
  if (syncTimer) {
    window.clearInterval(syncTimer);
    syncTimer = null;
  }
}

// Force sync now (e.g. when user submits)
export function triggerSync(): void {
  window.setTimeout(processQueue, 500);
}
