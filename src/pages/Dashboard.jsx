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
  const color = pct >= 100 ? 'var(--error)' : 'var(--accent)';
  return (
    <div className="progress-bar-wrap" style={{ marginBottom: 16 }}>
      <div className="progress-label" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{Math.round(current)}{unit} / {target}{unit}</span>
      </div>
      <div className="progress-track" style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
        <div className="progress-fill" style={{ 
          width: `${Math.min(pct, 100)}%`, 
          height: '100%', 
          background: color, 
          borderRadius: 4,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
        }} />
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

      <div className="page-header" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 12, letterSpacing: '0.05em' }}>IRON</span>
            {data.stats.streak > 0 && (
              <span className="streak-badge" style={{ background: 'rgba(255, 149, 0, 0.1)', color: 'var(--warning)', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                🔥 {data.stats.streak} DAYS
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        </div>
        <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => { haptics.light(); navigate('/calendar'); }}>
          <Calendar size={24} strokeWidth={2.2} />
        </button>
      </div>

      <PullToRefresh onRefresh={async () => { haptics.medium(); await load(); }}>
        {/* 主要達成リング */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-around', padding: '32px 10px' }}>
          <RingGauge 
            label="Calories" 
            percent={DAILY_TARGETS.calories > 0 ? (totals.cal / DAILY_TARGETS.calories) * 100 : 0} 
            sublabel={`${Math.round(totals.cal)} / ${DAILY_TARGETS.calories} kcal`} 
          />
          <div style={{ width: 1, background: 'var(--border)', height: 60, alignSelf: 'center' }} />
          <RingGauge 
            label="Protein" 
            percent={DAILY_TARGETS.protein_g > 0 ? (totals.pro / DAILY_TARGETS.protein_g) * 100 : 0} 
            sublabel={`${Math.round(totals.pro)} / ${DAILY_TARGETS.protein_g} g`} 
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {data.goals.map(g => (
              <div key={g.goal_id} style={{ background: 'var(--bg-secondary)', padding: '16px 10px', borderRadius: 16, textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>{GOAL_LABELS[g.goal_id] || g.goal_id}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{g.current_value}<span style={{ fontSize: 10, marginLeft: 2, color: 'var(--text-secondary)' }}>{GOAL_UNITS[g.goal_id]}</span></div>
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
