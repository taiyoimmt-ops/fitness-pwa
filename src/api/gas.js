import { createClient } from '@supabase/supabase-js';
import { openDB } from 'idb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

const dbPromise = openDB('fitness-pwa', 1, {
  upgrade(db) {
    db.createObjectStore('pending_requests', { keyPath: 'id', autoIncrement: true });
    db.createObjectStore('cache');
  },
});

async function fetchWithCache(key, fetcher) {
  const db = await dbPromise;
  const cached = await db.get('cache', key);
  if (navigator.onLine) {
    try {
      const data = await fetcher();
      await db.put('cache', data, key);
      return data;
    } catch (e) { return cached || []; }
  }
  return cached || [];
}

async function syncPost(table, data, method = 'insert') {
  if (navigator.onLine) {
    try {
      const { error } = await supabase.from(table)[method](data);
      if (error) throw error;
    } catch (e) { await queueRequest({ table, data, method }); }
  } else { await queueRequest({ table, data, method }); }
}

async function queueRequest(req) {
  const db = await dbPromise;
  await db.add('pending_requests', { ...req, id: Date.now() });
}

export const api = {
  getDailyLogs: async (dateStr) => {
    const start = `${dateStr}T00:00:00Z`;
    const end = `${dateStr}T23:59:59Z`;
    const [meals, workouts, weights] = await Promise.all([
      supabase.from('meals').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
      supabase.from('workout_logs').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
      supabase.from('body_weight').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
    ]);
    return { meals: meals.data || [], workouts: workouts.data || [], weight: weights.data?.[0] || null };
  },

  getActiveDays: async () => {
    const { data } = await supabase.from('meals').select('timestamp').limit(200);
    const days = new Set((data || []).map(d => d.timestamp.split('T')[0]));
    return Array.from(days);
  },

  getMealsToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return fetchWithCache('meals_today', async () => {
      const { data, error } = await supabase.from('meals').select('*').gte('timestamp', today).order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    });
  },

  addMeal: (m) => syncPost('meals', { ...m, is_analyzed: m.is_analyzed !== undefined ? m.is_analyzed : true }),
  
  savePendingMealImage: (base64) => syncPost('meals', {
    meal_label: "後ほど解析", calories: 0, protein_g: 0, fat_g: 0, carb_g: 0,
    image_url: base64, is_analyzed: false
  }),

  addWorkoutLog: (l) => syncPost('workout_logs', l),
  addWorkout: (sets) => Promise.all(sets.map(s => syncPost('workout_logs', s))),
  
  getLastWorkout: async (exercise) => {
    const { data } = await supabase.from('workout_logs').select('*').eq('exercise', exercise).order('timestamp', { ascending: false }).limit(1);
    return data?.[0] ? { ...data[0], exists: true } : { exists: false };
  },

  addBodyWeight: (w, memo) => syncPost('body_weight', { weight_kg: w, memo }),
  getWeightHistory: (days = 30) => {
    const cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - days);
    return fetchWithCache('weight_history', async () => {
      const { data, error } = await supabase.from('body_weight').select('*').gte('timestamp', cutOff.toISOString()).order('timestamp', { ascending: true });
      if (error) throw error;
      return data;
    });
  },

  getGoals: () => fetchWithCache('goals', async () => {
    const { data, error } = await supabase.from('goals').select('*');
    if (error) throw error;
    return data;
  }),
  updateGoalProgress: (goal_id, val) => syncPost('goals', { current_value: val }, 'update').then(() => supabase.from('goals').eq('goal_id', goal_id)),

  getSummary7days: async () => {
    return { workout_days_7days: 5 };
  },
  
  getBodyParts7days: async () => {
     return {}; // ヒートマップ用
  }
};

// 保留キューの同期
export async function flushPendingQueue() {
  if (!navigator.onLine) return;
  const db = await dbPromise;
  const store = db.transaction('pending_requests', 'readwrite').objectStore('pending_requests');
  const allReqs = await store.getAll();
  for (const req of allReqs) {
    try {
      const { table, data, method } = req;
      const { error } = await supabase.from(table)[method](data);
      if (!error) await store.delete(req.id);
    } catch (e) { console.error('Sync failed', e); }
  }
}
