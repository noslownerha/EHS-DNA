/**
 * Offline submission queue.
 *
 * Incidents get reported where they happen — the back of a rickhouse, a loading
 * dock, a warehouse aisle. Those are exactly the places with no signal. Without a
 * queue, every one of those reports is lost, which is both a safety miss and a
 * compliance gap.
 *
 * Design notes:
 *  - IndexedDB, not localStorage: photos are base64 and blow the ~5MB quota.
 *  - Each item carries a client-minted UUID. The server treats it as an
 *    idempotency key, so a flaky reconnect that retries mid-flight returns the
 *    original incident instead of filing a duplicate.
 *  - Flush is attempted on: app load, the browser 'online' event, and after any
 *    successful direct submit (cheap way to drain a backlog).
 *  - Items are only removed after the server confirms. A 4xx (bad data) is
 *    terminal — retrying forever won't fix a rejected payload — so those are
 *    marked failed and surfaced rather than silently dropped.
 */

const DB_NAME = "ehs-dna";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "uuid" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older mobile browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Add a report to the outbox. Returns the queued item. */
export async function enqueue(payload) {
  const item = {
    uuid: payload.clientUuid || uuid(),
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
    status: "pending",       // pending | failed
  };
  item.payload.clientUuid = item.uuid;
  await tx("readwrite", store => store.put(item));
  notifyListeners();
  return item;
}

export async function listQueue() {
  try { return (await tx("readonly", store => store.getAll())) ?? []; }
  catch { return []; }
}

export async function queueCount() {
  const all = await listQueue();
  return all.filter(i => i.status === "pending").length;
}

async function remove(id) {
  await tx("readwrite", store => store.delete(id));
}

async function update(item) {
  await tx("readwrite", store => store.put(item));
}

/** Drop a permanently-failed item the user has acknowledged. */
export async function discard(id) {
  await remove(id);
  notifyListeners();
}

// ── Change notifications, so the UI badge stays in sync ──
const listeners = new Set();
export function onQueueChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyListeners() {
  queueCount().then(n => listeners.forEach(fn => { try { fn(n); } catch {} }));
}

/**
 * Try to send everything pending. Safe to call often — it no-ops when offline
 * or when a flush is already running.
 */
let flushing = false;
export async function flushQueue(submitFn) {
  if (flushing) return { sent: 0, failed: 0, skipped: true };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0, failed: 0, offline: true };

  flushing = true;
  let sent = 0, failed = 0;
  try {
    const items = (await listQueue()).filter(i => i.status === "pending");
    for (const item of items) {
      try {
        await submitFn(item.payload);   // server is idempotent on clientUuid
        await remove(item.uuid);
        sent++;
      } catch (err) {
        const status = err?.status;
        item.attempts += 1;
        item.lastError = err?.message ?? "Unknown error";
        // 4xx means the payload itself is bad — retrying will never help.
        // Anything else (network, 5xx) stays pending for the next attempt.
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          item.status = "failed";
          failed++;
        }
        await update(item);
        // A network error means we're probably offline again — stop early.
        if (!status) break;
      }
    }
  } finally {
    flushing = false;
    notifyListeners();
  }
  return { sent, failed };
}

/** Wire up automatic flushing. Call once, at app start. */
export function startAutoFlush(submitFn) {
  const run = () => flushQueue(submitFn).catch(() => {});
  run();                                   // drain anything left from last session
  window.addEventListener("online", run);
  // Belt and braces: some mobile browsers fire 'online' unreliably, so also try
  // when the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
  return () => window.removeEventListener("online", run);
}
