import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, Dumbbell, BarChart2, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { api } from '../api/gas.js';
import { DAILY_TARGETS, GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import RingGauge from '../components/RingGauge.jsx';
import { useToast } from '../components/Toast.jsx';

function ProgressBar({ label, current, target, unit = '' }) {
  const pct = Math.min((current / target) * 100, 110);
  const cls = pct >= 100 ? 'red' : pct >= 70 ? 'green' : 'grey';
  const remaining = Math.max(target - current, 0);
  return (
    <div className="progress-bar-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <span>{current}{unit} / {target}{unit}（残り{remaining}{unit}）</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} data-cls={cls} />
      </div>
    </div>
  );
}

// 達成率に合わせたバーの色をCSSクラスで制御
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
  const [mealsToday, setMealsToday] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meals, gs] = await Promise.all([
        api.getMealsToday(),
        api.getGoals(),
      ]);
      setMealsToday(meals);
      setGoals(gs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // PFC合計
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
    try {
      await api.addBodyWeight(w, '朝の計測');
      showToast('✅ 体重を記録しました！');
      setShowWeightModal(false);
      setWeightInput('');
    } catch (e) {
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="spinner-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      {/* ヘッダー */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
            {new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          </div>
          <h1 className="page-title">ダッシュボード</h1>
        </div>
        <button className="btn btn-secondary" style={{ width: 44, minHeight: 44, padding: 0, borderRadius: 12 }}
          onClick={() => setShowWeightModal(true)}>
          <Scale size={18} />
        </button>
      </div>

      {/* PFC残量バー */}
      <div className="card">
        <div className="card-title">今日の栄養 📊</div>
        <PFCBar label="カロリー" current={totals.calories} target={DAILY_TARGETS.calories} unit="kcal" />
        <PFCBar label="タンパク質" current={totals.protein_g} target={DAILY_TARGETS.protein_g} unit="g" />
        <PFCBar label="脂質" current={totals.fat_g} target={DAILY_TARGETS.fat_g} unit="g" />
        <PFCBar label="炭水化物" current={totals.carb_g} target={DAILY_TARGETS.carb_g} unit="g" />
      </div>

      {/* 目標リングゲージ */}
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
              />
            );
          })}
        </div>
      </div>

      {/* アクションボタン */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate('/meal')}>
          <Utensils size={20} /><span>食事記録</span>
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/workout')}>
          <Dumbbell size={20} /><span>トレーニング</span>
        </button>
      </div>
      <button className="btn btn-secondary" onClick={() => navigate('/analysis')}
        style={{ marginBottom: 16 }}>
        <BarChart2 size={20} /><span>AIアドバイスを見る</span>
      </button>

      {/* 今日の食事ログ */}
      {mealsToday.length > 0 && (
        <div className="card">
          <div className="card-title">今日の食事ログ 🍽</div>
          {mealsToday.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: i < mealsToday.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.meal_label || '食事'}</div>
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
                style={{ fontSize: 24, textAlign: 'center', fontWeight: 700 }}
                autoFocus
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
