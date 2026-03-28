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
    } catch (e) { 
      console.error(`[Offline Sync] Request queued for ${table}:`, e);
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
  getDailyLogs: async (dateStr) => {
    try {
      const start = `${dateStr}T00:00:00Z`;
      const end = `${dateStr}T23:59:59Z`;
      const [meals, workouts, weights] = await Promise.all([
        supabase.from('meals').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
        supabase.from('workout_logs').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
        supabase.from('body_weight').select('*').gte('timestamp', start).lte('timestamp', end).order('timestamp', { ascending: true }),
      ]);
      return { meals: meals.data || [], workouts: workouts.data || [], weight: weights.data?.[0] || null };
    } catch (e) {
      console.error('Error fetching daily logs:', e);
      return { meals: [], workouts: [], weight: null };
    }
  },

  getActiveDays: async () => {
    try {
      const { data, error } = await supabase.from('meals').select('timestamp').limit(200);
      if (error) throw error;
      const days = new Set((data || []).map(d => d.timestamp.split('T')[0]));
      return Array.from(days);
    } catch (e) {
      console.error('Error fetching active days:', e);
      return [];
    }
  },

  getMealsToday: () => {
    const today = new Date().toLocaleDateString('sv-SE');
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
    try {
      const { data, error } = await supabase.from('workout_logs').select('*').eq('exercise', exercise).order('timestamp', { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ? { ...data[0], exists: true } : { exists: false };
    } catch (e) {
      console.error('Error fetching last workout:', e);
      return { exists: false };
    }
  },

  getWorkoutHistory: async (exercise, limit = 20) => {
    try {
      const { data, error } = await supabase.from('workout_logs')
        .select('*')
        .eq('exercise', exercise)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    } catch (e) {
      console.error('Error fetching workout history for', exercise, e);
      return [];
    }
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
  updateGoalProgress: async (goal_id, val) => {
    try {
      await syncPost('goals', { current_value: val }, 'update');
      return await supabase.from('goals').eq('goal_id', goal_id);
    } catch (e) {
      console.error('Error updating goal:', e);
      return null;
    }
  },

  getSummary7days: async () => {
    try {
      const db = await dbPromise;
      const cached = await db.get('cache', 'summary_7days');
      if (!navigator.onLine) return cached || { meals: [], workout_days: 0 };

      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - 7);
      const start = cutOff.toISOString();

      const [meals, workouts] = await Promise.all([
        supabase.from('meals').select('timestamp, calories, protein_g, fat_g, carb_g').gte('timestamp', start).order('timestamp', { ascending: true }),
        supabase.from('workout_logs').select('timestamp').gte('timestamp', start)
      ]);

      if (meals.error) throw meals.error;
      if (workouts.error) throw workouts.error;

      // 筋トレした日数をユニークカウント
      const days = new Set((workouts.data || []).map(d => d.timestamp.split('T')[0]));
      
      const result = { meals: meals.data || [], workout_days: days.size };
      await db.put('cache', result, 'summary_7days');
      return result;
    } catch (e) {
      console.error('Error in getSummary7days:', e);
      return { meals: [], workout_days: 0 };
    }
  },
  
  getBodyParts7days: async () => {
    try {
      const db = await dbPromise;
      const cached = await db.get('cache', 'body_parts_7days');
      if (!navigator.onLine) return cached || {};

      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - 7);
      const start = cutOff.toISOString();

      const { data, error } = await supabase.from('workout_logs').select('body_part').gte('timestamp', start);
      if (error) throw error;

      const counts = {};
      for (const log of (data || [])) {
        if (!log.body_part) continue;
        counts[log.body_part] = (counts[log.body_part] || 0) + 1;
      }
      
      await db.put('cache', counts, 'body_parts_7days');
      return counts;
    } catch (e) {
      console.error('Error in getBodyParts7days:', e);
      return {};
    }
  },

  getUserStats: async () => {
    try {
      const db = await dbPromise;
      const cached = await db.get('cache', 'user_stats');
      if (!navigator.onLine) return cached || { streak: 0, badges: [] };

      // 過去の記録日を全取得（長期利用時はLIMITや集計テーブルへの移行が必要）
      const [meals, workouts] = await Promise.all([
        supabase.from('meals').select('timestamp'),
        supabase.from('workout_logs').select('timestamp, exercise, weight_kg') 
      ]);
      
      if (meals.error) throw meals.error;
      if (workouts.error) throw workouts.error;

      // ユニークなアクティブ日を抽出
      const activeDays = new Set([
        ...(meals.data || []).map(d => d.timestamp.substring(0, 10)),
        ...(workouts.data || []).map(d => d.timestamp.substring(0, 10))
      ]);
      const sortedDays = Array.from(activeDays).sort((a, b) => b.localeCompare(a)); // 降順

      // --- ストリーク計算 (日本時間 sv-SE基準) ---
      let streak = 0;
      const today = new Date();
      const todayStr = today.toLocaleDateString('sv-SE');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

      // 今日か昨日記録があればストリーク継続と判定
      if (sortedDays.includes(todayStr) || sortedDays.includes(yesterdayStr)) {
         let ptr = new Date(sortedDays.includes(todayStr) ? todayStr : yesterdayStr);
         
         while (true) {
           const dStr = ptr.toLocaleDateString('sv-SE');
           if (sortedDays.includes(dStr)) {
             streak++;
             ptr.setDate(ptr.getDate() - 1); // 1日さかのぼる
           } else {
             break;
           }
         }
      }

      // --- バッジ獲得判定 ---
      const badges = [];
      if (sortedDays.length > 0) badges.push({ id: 'first_blood', name: '初めの一歩', desc: '初めての記録完了', icon: '👶' });
      if (streak >= 3) badges.push({ id: 'streak_3', name: '三日坊主卒業', desc: '3日連続で記録', icon: '🔥' });
      if (streak >= 7) badges.push({ id: 'streak_7', name: 'ルーティンマスター', desc: '7日連続で記録', icon: '📅' });
      if (streak >= 30) badges.push({ id: 'streak_30', name: '鉄の意志', desc: '30日連続で記録', icon: '💎' });
      
      const has100Bench = workouts.data?.some(w => w.exercise && w.exercise.includes('ベンチプレス') && w.weight_kg >= 100);
      if (has100Bench) badges.push({ id: 'bench_100', name: '100kgクラブ', desc: 'ベンチプレス100kg達成', icon: '🦍' });

      const has140Squat = workouts.data?.some(w => w.exercise && w.exercise.includes('スクワット') && w.weight_kg >= 140);
      if (has140Squat) badges.push({ id: 'squat_140', name: '大黒柱', desc: 'スクワット140kg達成', icon: '🏛️' });

      const stats = { streak, badges };
      await db.put('cache', stats, 'user_stats');
      return stats;

    } catch (e) {
      console.error('Error in getUserStats:', e);
      return { streak: 0, badges: [] };
    }
  }
};

// 保留キューの同期
export async function flushPendingQueue() {
  if (!navigator.onLine) return;
  const db = await dbPromise;
  
  // トランザクションが非同期通信のawait待ちで閉じるのを防ぐため、まず全量取得
  const allReqs = await db.getAll('pending_requests');
  if (allReqs.length === 0) return;

  for (const req of allReqs) {
    try {
      const { table, data, method } = req;
      const { error } = await supabase.from(table)[method](data);
      
      if (error) {
        console.error(`[Sync Error] Failed to sync to ${table}`, error);
        continue; // エラー時はキューに残す
      }
      
      // 成功した場合のみ、都度新しいトランザクションを開いて削除
      await db.delete('pending_requests', req.id);
    } catch (e) { 
      console.error('[Sync FatalError] Request failed:', e); 
    }
  }
}
