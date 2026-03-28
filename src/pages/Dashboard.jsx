import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, BarChart2, Scale, Wifi, WifiOff } from 'lucide-react';
import { api, flushPendingQueue } from '../api/gas.js';
import { DAILY_TARGETS, GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import RingGauge from '../components/RingGauge.jsx';
import { useToast } from '../components/Toast.jsx';
import { DashboardSkeleton } from '../components/Skeleton.jsx';

/* ── Ripple ── */
function useRipple() {
  const ref = useRef(null);
  const handleClick = (e) => {
    const btn = ref.current;
    if (!btn) return;
    const dot = document.createElement('span');
    dot.classList.add('ripple-dot');
    const rect = btn.getBoundingClientRect();
    dot.style.left = `${e.clientX - rect.left}px`;
    dot.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  };
  return { ref, onClick: handleClick };
}

function PFCBar({ label, current, target, unit }) {
  const pct = target > 0 ? (current / target) * 100 : 0;
  const cls = pct >= 100 ? 'red' : pct >= 70 ? 'green' : 'grey';
  const remaining = Math.max(Math.round(target - current), 0);
  return (
    <div className="progress-bar-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <span>{Math.round(current)}{unit} / {target}{unit}（残り{remaining}{unit}）</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/* ── ハプティクスフィードバック ── */
function haptic(pattern = 'light') {
  if (!navigator.vibrate) return;
  if (pattern === 'light') navigator.vibrate(10);
  if (pattern === 'success') navigator.vibrate([10, 30, 10]);
  if (pattern === 'error') navigator.vibrate([30, 10, 30]);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const mealRipple = useRipple();
  const workoutRipple = useRipple();

  const [mealsToday, setMealsToday] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasCachedData, setHasCachedData] = useState(false);

  // ネットワーク状態の監視
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      await flushPendingQueue(); // バックグラウンドで同期
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      // キャッシュ優先: データをすぐに表示してからローディング解除
      const [meals, gs] = await Promise.all([
        api.getMealsToday(),
        api.getGoals(),
      ]);
      setMealsToday(meals);
      setGoals(gs);
      setHasCachedData(gs.length > 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = mealsToday.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein_g: acc.protein_g + (m.protein_g || 0),
      fat_g: acc.fat_g + (m.fat_g || 0),
      carb_g: acc.carb_g + (m.carb_g || 0),
    }),
    { calories: 0, protein_g: 0, fat_g: 0, carb_g: 0 }
  );

  const handleWeightSave = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 30 || w > 200) return showToast('正しい体重を入力してください', 'error');
    setSaving(true);
    haptic('light');
    // Optimistic: 即モーダルを閉じる
    setShowWeightModal(false);
    setWeightInput('');
    try {
      await api.addBodyWeight(w, '朝の計測');
      haptic('success');
      showToast(isOnline ? '✅ 体重を記録しました！' : '📱 オフライン記録済み（後で同期）');
    } catch (e) {
      haptic('error');
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="page fade-in">
      {/* オフラインバナー */}
      <div className={`offline-banner ${isOnline ? 'hidden' : ''}`}>
        <WifiOff size={11} style={{ display: 'inline', marginRight: 4 }} />
        オフライン中 — 記録はオンライン復帰時に自動同期されます
      </div>

      {/* ヘッダー */}
      <div className="page-header" style={{ marginTop: isOnline ? 0 : 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
            {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            {!isOnline && (
              <span style={{ color: 'var(--yellow)', fontWeight: 700, marginLeft: 8 }}>
                <span className="pending-dot" style={{ marginRight: 4 }} />
                オフライン
              </span>
            )}
          </div>
          <h1 className="page-title">ダッシュボード</h1>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 12 }}
          onClick={() => { haptic('light'); setShowWeightModal(true); }}
        >
          <Scale size={18} />
        </button>
      </div>

      {/* PFCバー */}
      <div className="card">
        <div className="card-title">今日の栄養 📊</div>
        <PFCBar label="カロリー" current={totals.calories} target={DAILY_TARGETS.calories} unit="kcal" />
        <PFCBar label="タンパク質" current={totals.protein_g} target={DAILY_TARGETS.protein_g} unit="g" />
        <PFCBar label="脂質" current={totals.fat_g} target={DAILY_TARGETS.fat_g} unit="g" />
        <PFCBar label="炭水化物" current={totals.carb_g} target={DAILY_TARGETS.carb_g} unit="g" />
      </div>

      {/* 目標リングゲージ */}
      {goals.length > 0 && (
        <div className="card">
          <div className="card-title">目標達成率 🎯</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
            {goals.map((g) => {
              const pct = g.target_value > 0 ? (g.current_value / g.target_value) * 100 : 0;
              return (
                <RingGauge
                  key={g.goal_id}
                  percent={pct}
                  size={76}
                  label={GOAL_LABELS[g.goal_id] || g.goal_id}
                  sublabel={`${g.current_value}→${g.target_value}${GOAL_UNITS[g.goal_id] || ''}`}
                  celebrate={pct >= 100}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <button
          ref={mealRipple.ref}
          className="btn btn-primary"
          onClick={(e) => { mealRipple.onClick(e); haptic('light'); navigate('/meal'); }}
        >
          <Utensils size={20} /><span>食事記録</span>
        </button>
        <button
          ref={workoutRipple.ref}
          className="btn btn-secondary"
          onClick={(e) => { workoutRipple.onClick(e); haptic('light'); navigate('/workout'); }}
        >
          <Dumbbell size={20} /><span>トレーニング</span>
        </button>
      </div>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: 16 }}
        onClick={() => { haptic('light'); navigate('/analysis'); }}
      >
        <BarChart2 size={20} /><span>AIアドバイスを見る</span>
      </button>

      {/* 今日の食事ログ */}
      {mealsToday.length > 0 && (
        <div className="card">
          <div className="card-title">今日の食事ログ 🍽</div>
          {mealsToday.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < mealsToday.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: m._pending ? 0.6 : 1,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{m.meal_label || '食事'}</span>
                  {m._pending && <span className="pending-dot" />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  P: {m.protein_g}g / F: {m.fat_g}g / C: {m.carb_g}g
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                {m.calories}kcal
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 体重記録モーダル */}
      {showWeightModal && (
        <div className="modal-overlay" onClick={() => setShowWeightModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">体重を記録</div>
            <div className="input-group">
              <label className="input-label">体重 (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="65.0"
                className="input-field"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                style={{ fontSize: 28, textAlign: 'center', fontWeight: 800 }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleWeightSave()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleWeightSave} disabled={saving}>
              {saving ? '保存中...' : '✅ 保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
