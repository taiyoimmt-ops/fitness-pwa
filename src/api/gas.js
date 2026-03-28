/**
 * Offline-First APIクライアント
 * - オンライン時: GASに通信 → IndexedDBにキャッシュ
 * - オフライン時: IndexedDBから即座に返す → バックグラウンドでキューに追加
 */

import {
  cacheMealsToday, getCachedMealsToday,
  cacheGoals, getCachedGoals,
  enqueuePending, getPendingQueue, clearPendingQueue,
  dbAdd,
} from './db.js';

const GAS_URL = import.meta.env.VITE_GAS_URL;

// ─── 低レベルリクエスト ───
async function gasGet(action, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json.data;
}

async function gasPost(action, body = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
    redirect: 'follow',
  });
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json.data;
}

function isOnline() {
  return navigator.onLine;
}

// ─── Background Sync: オンライン復帰時にキューを送信 ───
export async function flushPendingQueue() {
  if (!isOnline()) return;
  const queue = await getPendingQueue();
  if (queue.length === 0) return;
  for (const item of queue) {
    try {
      await gasPost(item.action, item.payload);
    } catch {
      return; // 送信失敗したらここで止める（次回リトライ）
    }
  }
  await clearPendingQueue();
}

// ─── パブリック API ───
export const api = {
  /** 今日の食事取得（オフライン対応） */
  getMealsToday: async () => {
    // キャッシュを先に返す（高速表示）
    const cached = await getCachedMealsToday();
    if (!isOnline()) return cached;
    try {
      const fresh = await gasGet('getMealsToday');
      await cacheMealsToday(fresh);
      return fresh;
    } catch {
      return cached;
    }
  },

  /** 目標取得（オフライン対応） */
  getGoals: async () => {
    const cached = await getCachedGoals();
    if (!isOnline()) return cached;
    try {
      const fresh = await gasGet('getGoals');
      await cacheGoals(fresh);
      return fresh;
    } catch {
      return cached;
    }
  },

  /** 食事追加（Optimistic: 即座にキャッシュ → バックグラウンドでGAS） */
  addMeal: async (data) => {
    // まずローカルに即時反映
    const optimisticEntry = {
      ...data,
      date: new Date().toISOString().slice(0, 10),
      _pending: true,
    };
    await dbAdd('meals', optimisticEntry);
    // オンラインなら送信、オフラインならキュー
    if (isOnline()) {
      return gasPost('addMeal', data);
    } else {
      await enqueuePending('addMeal', data);
    }
  },

  /** ワークアウト追加（Optimistic） */
  addWorkout: async (sets, timestamp) => {
    if (isOnline()) {
      return gasPost('addWorkout', { sets, timestamp });
    } else {
      await enqueuePending('addWorkout', { sets, timestamp });
    }
  },

  /** 体重追加（Optimistic） */
  addBodyWeight: async (body_weight_kg, note = '') => {
    if (isOnline()) {
      return gasPost('addBodyWeight', { body_weight_kg, note });
    } else {
      await enqueuePending('addBodyWeight', { body_weight_kg, note });
    }
  },

  /** 前回のワークアウト取得 */
  getLastWorkout: (exercise) => gasGet('getLastWorkout', { exercise }),

  /** 7日間部位別ヒートマップ */
  getBodyParts7days: () => gasGet('getBodyParts7days'),

  /** 7日間サマリー取得 */
  getSummary7days: () => gasGet('getSummary7days'),

  /** 体重履歴取得（Stats用） */
  getBodyWeightHistory: (days = 30) => gasGet('getBodyWeightHistory', { days }),

  /** ワークアウト履歴取得（Stats・BIG3グラフ用） */
  getWorkoutHistory: (exercise, limit = 20) => gasGet('getWorkoutHistory', { exercise, limit }),

  /** 目標進捗更新 */
  updateGoalProgress: (goal_id, current_value) =>
    gasPost('updateGoalProgress', { goal_id, current_value }),
};
