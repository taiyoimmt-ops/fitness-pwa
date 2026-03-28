import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, BarChart2, Scale, Wifi, WifiOff, Share2, Flame } from 'lucide-react';
import { api, flushPendingQueue } from '../api/gas.js';
import { DAILY_TARGETS, GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import RingGauge from '../components/RingGauge.jsx';
import { useToast } from '../components/Toast.jsx';
import { DashboardSkeleton } from '../components/Skeleton.jsx';
import BadgesGroup from '../components/Badges.jsx';
import PullToRefresh from '../components/PullToRefresh.jsx';
import { haptics } from '../utils/haptics.js';

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
  const [streak, setStreak] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState([]);

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      await flushPendingQueue();
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
      const [meals, gs, summary] = await Promise.all([
        api.getMealsToday(),
        api.getGoals(),
        api.getSummary7days().catch(() => ({})),
      ]);
      setMealsToday(meals);
      setGoals(gs);
      setStreak(summary.workout_days_7days || 0);
      
      const badges = [];
      if (summary.workout_days_7days >= 3) badges.push('streak_3');
      if (summary.workout_days_7days >= 7) badges.push('streak_7');
      if (gs.some(g => (g.current_value / g.target_value) >= 1)) badges.push('goal_reached');
      setEarnedBadges(badges);
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

  const handleShare = async () => {
    haptics.medium();
    const text = `今日の筋トレ記録🔥\n摂取: ${totals.calories}kcal\nストリーク: ${streak}日連続！\n#IRON #筋トレPWA`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'IRON 記録', text });
      } catch (e) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('クリップボードにコピーしました！');
    }
  };

  const handleWeightSave = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 30 || w > 200) {
      haptics.error();
      return showToast('正しい体重を入力してください', 'error');
    }
    setSaving(true);
    haptics.medium();
    setShowWeightModal(false);
    setWeightInput('');
    try {
      await api.addBodyWeight(w, '朝の計測');
      haptics.success();
      showToast(isOnline ? '✅ 体重を記録しました！' : '📱 オフライン記録済み（後で同期）');
    } catch (e) {
      haptics.error();
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <PullToRefresh onRefresh={load}>
      <div className="page fade-in">
        <div className={`offline-banner ${isOnline ? 'hidden' : ''}`}>
          <WifiOff size={11} style={{ display: 'inline', marginRight: 4 }} />
          オフライン中 — 記録はオンライン復帰時に自動同期されます
        </div>

        {/* ヘッダー */}
        <div className="page-header" style={{ marginTop: isOnline ? 0 : 28, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
            <h1 className="page-title">ダッシュボード</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 12 }} onClick={handleShare}>
              <Share2 size={18} />
            </button>
            <button className="btn btn-secondary" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 12 }} onClick={() => { haptics.light(); setShowWeightModal(true); }}>
              <Scale size={18} />
            </button>
          </div>
        </div>

        {/* ストリーク & バッジ */}
        <div className="card" style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--accent)', marginBottom: 2 }}><Flame size={24} fill="var(--accent)" /></div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{streak}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Streak</div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
            <div className="card-title" style={{ marginBottom: 8, fontSize: 10 }}>獲得バッジ</div>
            <BadgesGroup earnedBadges={earnedBadges} />
          </div>
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
          <button ref={mealRipple.ref} className="btn btn-primary" onClick={(e) => { mealRipple.onClick(e); haptics.medium(); navigate('/meal'); }}>
            <Utensils size={20} /><span>食事記録</span>
          </button>
          <button ref={workoutRipple.ref} className="btn btn-secondary" onClick={(e) => { workoutRipple.onClick(e); haptics.medium(); navigate('/workout'); }}>
            <Dumbbell size={20} /><span>トレーニング</span>
          </button>
        </div>

        <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={() => { haptics.medium(); navigate('/analysis'); }}>
          <BarChart2 size={20} /><span>AIトレーナー IRON</span>
        </button>

        {/* 体重記録モーダル */}
        {showWeightModal && (
          <div className="modal-overlay" onClick={() => setShowWeightModal(false)}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">体重を記録</div>
              <div className="input-group">
                <label className="input-label">体重 (kg)</label>
                <input type="number" step="0.1" placeholder="65.0" className="input-field" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} style={{ fontSize: 28, textAlign: 'center', fontWeight: 800 }} autoFocus />
              </div>
              <button className="btn btn-primary" onClick={handleWeightSave} disabled={saving}>
                {saving ? '保存中...' : '✅ 保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
