/**
 * IndexedDB ラッパー - Offline-First データストア
 * Stores: meals, workouts, goals, pendingSync
 */

const DB_NAME = 'fitness-pwa';
const DB_VERSION = 1;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // 今日の食事
      if (!db.objectStoreNames.contains('meals')) {
        const ms = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        ms.createIndex('date', 'date');
      }
      // 目標
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'goal_id' });
      }
      // ワークアウト
      if (!db.objectStoreNames.contains('workouts')) {
        const ws = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        ws.createIndex('exercise', 'exercise');
      }
      // 未送信キュー（オフライン同期用）
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

// ─── 汎用 CRUD ───
export async function dbGetAll(storeName) {
  const store = await tx(storeName);
  return new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function dbPut(storeName, data) {
  const store = await tx(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function dbAdd(storeName, data) {
  const store = await tx(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.add(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function dbClear(storeName) {
  const store = await tx(storeName, 'readwrite');
  return new Promise((res, rej) => {
    const req = store.clear();
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// ─── 食事 ───
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function cacheMealsToday(meals) {
  await dbClear('meals');
  const today = todayStr();
  for (const m of meals) {
    await dbAdd('meals', { ...m, date: today });
  }
}

export async function getCachedMealsToday() {
  const all = await dbGetAll('meals');
  const today = todayStr();
  return all.filter((m) => m.date === today);
}

// ─── 目標 ───
export async function cacheGoals(goals) {
  await dbClear('goals');
  for (const g of goals) {
    await dbPut('goals', g);
  }
}

export async function getCachedGoals() {
  return dbGetAll('goals');
}

// ─── 同期キュー ───
export async function enqueuePending(action, payload) {
  await dbAdd('pendingSync', { action, payload, createdAt: Date.now() });
}

export async function getPendingQueue() {
  return dbGetAll('pendingSync');
}

export async function clearPendingQueue() {
  await dbClear('pendingSync');
}
