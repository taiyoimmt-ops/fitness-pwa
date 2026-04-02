import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, BarChart2, Scale, Wifi, WifiOff, Share2, Flame, Calendar, Plus } from 'lucide-react';
import { api, flushPendingQueue } from '../api/supabase.js';
import { DAILY_TARGETS, GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import RingGauge from '../components/RingGauge.jsx';
import { useToast } from '../components/Toast.jsx';
import { DashboardSkeleton } from '../components/Skeleton.jsx';
import BadgesGroup from '../components/Badges.jsx';
import PullToRefresh from '../components/PullToRefresh.jsx';
import { haptics } from '../utils/haptics.js';

function PFCBar({ label, current, target, unit }) {
  const pct = target > 0 ? (current / target) * 100 : 0;
  const cls = pct >= 100 ? 'red' : pct >= 70 ? 'green' : 'grey';
  const remaining = Math.max(Math.round(target - current), 0);
  return (
    <div className="progress-bar-wrap">
      <div className="progress-label">
        <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 11 }}>{Math.round(current)}{unit} / {target}{unit}</span>
      </div>
      <div className="progress-track" style={{ height: 6 }}>
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [data, setData] = useState({ meals: [], goals: [], stats: { streak: 0, badges: [] } });

  const load = useCallback(async () => {
    try {
      const [m, g, s] = await Promise.all([api.getMealsToday(), api.getGoals(), api.getUserStats()]);
      setData({ meals: m || [], goals: g || [], stats: s || { streak: 0, badges: [] } });
    } catch (e) { showToast('データ読み込み失敗', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    load();
    const handleOnline = () => { setOnline(true); flushPendingQueue().then(() => load()); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  const meals = data?.meals || [];
  const totals = meals.reduce((acc, m) => ({
    cal: acc.cal + (Number(m.calories) || 0),
    pro: acc.pro + (Number(m.protein_g) || 0),
    fat: acc.fat + (Number(m.fat_g) || 0),
    carb: acc.carb + (Number(m.carb_g) || 0)
  }), { cal: 0, pro: 0, fat: 0, carb: 0 });

  return (
    <div className="page fade-in">
      {!online && <div className="offline-banner">OFFLINE Mode - 変更は復帰後に同期されます</div>}

      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-3)', padding: '6px 12px', borderRadius: 16 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: 13, marginRight: data.stats.streak > 0 ? 8 : 0 }}>IRON</span>
            {data.stats.streak > 0 && (
              <span className="streak-badge pulse" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255, 69, 0, 0.1)', color: '#FF4500', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold' }}>
                🔥 {data.stats.streak} Days
              </span>
            )}
          </div>
          <h1 className="page-title">Dash</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => { haptics.light(); navigate('/calendar'); }}>
          <Calendar size={22} />
        </button>
      </div>

      <PullToRefresh onRefresh={async () => { haptics.medium(); await load(); }}>
        {/* 主要達成リング */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-around', padding: '32px 20px' }}>
          <RingGauge 
            label="CALORIES" 
            percent={DAILY_TARGETS.calories > 0 ? (totals.cal / DAILY_TARGETS.calories) * 100 : 0} 
            sublabel={`${Math.round(totals.cal)} / ${DAILY_TARGETS.calories} kcal`} 
            color="var(--accent)" 
          />
          <RingGauge 
            label="PROTEIN" 
            percent={DAILY_TARGETS.protein_g > 0 ? (totals.pro / DAILY_TARGETS.protein_g) * 100 : 0} 
            sublabel={`${Math.round(totals.pro)} / ${DAILY_TARGETS.protein_g} g`} 
            color="var(--accent)" 
          />
        </div>

        {/* PFC 詳細 */}
        <div className="card">
          <div className="card-title">Nutrition Balance</div>
          <PFCBar label="FATS (脂質)" current={totals.fat} target={DAILY_TARGETS.fat} unit="g" />
          <PFCBar label="CARBS (炭水化物)" current={totals.carb} target={DAILY_TARGETS.carb} unit="g" />
        </div>

        {/* 目標管理 (1RMなど) */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>My Benchmarks</div>
            <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => navigate('/workout')}><Plus size={16}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {data.goals.map(g => (
              <div key={g.goal_id} style={{ background: 'var(--bg-3)', padding: '12px 10px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 700 }}>{GOAL_LABELS[g.goal_id] || g.goal_id}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--accent)' }}>{g.current_value}<span style={{ fontSize: 9, marginLeft: 2 }}>{GOAL_UNITS[g.goal_id]}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* 継続とバッジ */}
        <BadgesGroup earnedBadgeIds={data.stats.badges.map(b => b.id)} />

        {/* クイックツールバー */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <button className="btn btn-secondary" style={{ minHeight: 60 }} onClick={() => { haptics.medium(); navigate('/meal'); }}>
            <Utensils size={18} /> 食事を記録
          </button>
          <button className="btn btn-secondary" style={{ minHeight: 60 }} onClick={() => { haptics.medium(); navigate('/workout'); }}>
            <Dumbbell size={18} /> 筋トレを開始
          </button>
        </div>
      </PullToRefresh>
    </div>
  );
}
