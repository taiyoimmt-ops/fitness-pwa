import { createClient } from '@supabase/supabase-js';
import { openDB } from 'idb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase クライアント初期化
export const supabase = createClient(supabaseUrl, supabaseKey);

// --- IndexedDB (オフライン) 初期化 ---
const dbPromise = openDB('fitness-pwa', 1, {
  upgrade(db) {
    db.createObjectStore('pending_requests', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('cache');
  },
});

/**
 * キャッシュ優先 + バックグラウンド同期
 */
async function fetchWithCache(key, fetcher) {
  const db = await dbPromise;
  const cached = await db.get('cache', key);
  
  if (navigator.onLine) {
    try {
      const data = await fetcher();
      await db.put('cache', data, key);
      return data;
    } catch (e) {
      return cached || [];
    }
  }
  return cached || [];
}

/**
 * データのオフライン同期対応 POST / INSERT
 */
async function syncPost(table, data, method = 'insert') {
  if (navigator.onLine) {
    try {
      const { error } = await supabase.from(table)[method](data);
      if (error) throw error;
    } catch (e) {
      await queueRequest({ table, data, method });
    }
  } else {
    await queueRequest({ table, data, method });
  }
}

async function queueRequest(req) {
  const db = await dbPromise;
  await db.add('pending_requests', { ...req, id: Date.now() });
}

export const api = {
  // --- 食事 ---
  getMealsToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return fetchWithCache('meals_today', async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .gte('timestamp', today)
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    });
  },
  addMeal: (m) => syncPost('meals', m),

  // --- ワークアウト ---
  addWorkoutLog: (l) => syncPost('workout_logs', l),
  getWorkoutHistory: (exercise, limit = 20) => {
    return fetchWithCache(`workout_${exercise}`, async () => {
      const { data, error } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('exercise', exercise)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    });
  },

  // --- 体重 ---
  addBodyWeight: (w, memo) => syncPost('body_weight', { weight_kg: w, memo }),
  getWeightHistory: (days = 30) => {
    const cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - days);
    return fetchWithCache('weight_history', async () => {
      const { data, error } = await supabase
        .from('body_weight')
        .select('*')
        .gte('timestamp', cutOff.toISOString())
        .order('timestamp', { ascending: true });
      if (error) throw error;
      return data;
    });
  },

  // --- 目標 ---
  getGoals: () => fetchWithCache('goals', async () => {
    const { data, error } = await supabase.from('goals').select('*');
    if (error) throw error;
    return data;
  }),
  updateGoalProgress: (goal_id, val) => syncPost('goals', { current_value: val }, 'update').then(() => supabase.from('goals').eq('goal_id', goal_id)),

  getSummary7days: async () => {
    // 実際にはもっと複雑な集計が必要だが、まずはモックとしてレスポンス
    return { workout_days_7days: 5 };
  }
};

// 保留キューの同期
export async function flushPendingQueue() {
  if (!navigator.onLine) return;
  const db = await dbPromise;
  const tx = db.transaction('pending_requests', 'readwrite');
  const store = tx.objectStore('pending_requests');
  const allReqs = await store.getAll();

  for (const req of allReqs) {
    try {
      const { table, data, method } = req;
      const { error } = await supabase.from(table)[method](data);
      if (!error) await store.delete(req.id);
    } catch (e) {
      console.error('Sync failed', e);
    }
  }
}
