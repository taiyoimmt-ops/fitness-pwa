// Google Apps Script API クライアント
const GAS_URL = import.meta.env.VITE_GAS_URL;

/**
 * GAS GETリクエスト
 * @param {string} action - アクション名
 * @param {Object} params - 追加パラメータ
 * @returns {Promise<any>}
 */
export async function gasGet(action, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json.data;
}

/**
 * GAS POSTリクエスト
 * @param {string} action - アクション名
 * @param {Object} body - リクエストボディ
 * @returns {Promise<any>}
 */
export async function gasPost(action, body = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // GASのCORSを回避するためJSONではなくtext/plain
    body: JSON.stringify({ action, ...body }),
    redirect: 'follow',
  });
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  return json.data;
}

// ────────────────────────────────────────
// 各エンドポイントのラッパー
// ────────────────────────────────────────

export const api = {
  // 食事
  getMealsToday: () => gasGet('getMealsToday'),
  addMeal: (data) => gasPost('addMeal', data),

  // トレーニング
  getLastWorkout: (exercise) => gasGet('getLastWorkout', { exercise }),
  addWorkout: (sets, timestamp) => gasPost('addWorkout', { sets, timestamp }),
  getBodyParts7days: () => gasGet('getBodyParts7days'),

  // 体重
  addBodyWeight: (body_weight_kg, note = '') => gasPost('addBodyWeight', { body_weight_kg, note }),

  // 目標
  getGoals: () => gasGet('getGoals'),
  updateGoalProgress: (goal_id, current_value) => gasPost('updateGoalProgress', { goal_id, current_value }),

  // サマリー
  getSummary7days: () => gasGet('getSummary7days'),
};
