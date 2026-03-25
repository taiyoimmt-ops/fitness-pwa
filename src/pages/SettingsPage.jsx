import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, TrendingUp } from 'lucide-react';
import { api } from '../api/gas.js';
import { GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import { useToast } from '../components/Toast.jsx';

export default function SettingsPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState({}); // { goal_id: new_current_value }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getGoals()
      .then((gs) => { setGoals(gs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleUpdate = async () => {
    const entries = Object.entries(updates).filter(([, v]) => v !== '' && !isNaN(v));
    if (entries.length === 0) return showToast('⚠️ 変更がありません', 'error');
    setSaving(true);
    try {
      await Promise.all(
        entries.map(([goal_id, val]) => api.updateGoalProgress(goal_id, Number(val)))
      );
      showToast('✅ 目標を更新しました！');
      // KPI更新チェック
      // リロード
      const gs = await api.getGoals();
      setGoals(gs);
      setUpdates({});
    } catch (e) {
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page"><div className="spinner-center"><div className="spinner" /></div></div>;
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">設定・目標管理</h1>
      </div>

      {/* 目標進捗の更新 */}
      <div className="card">
        <div className="card-title">現在値を更新 📈</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          トレーニングや体重計測後に最新の数値を入力してください。月間KPIが自動再計算されます。
        </p>

        {goals.map((g) => (
          <div key={g.goal_id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <label className="input-label" style={{ marginBottom: 0 }}>
                {GOAL_LABELS[g.goal_id] || g.goal_id}
              </label>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                目標: {g.target_value}{GOAL_UNITS[g.goal_id] || ''} / 締切: {g.deadline}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="input-field"
                type="number"
                step="0.1"
                placeholder={`現在値: ${g.current_value}`}
                value={updates[g.goal_id] ?? ''}
                onChange={(e) => setUpdates({ ...updates, [g.goal_id]: e.target.value })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {GOAL_UNITS[g.goal_id] || ''}
              </span>
            </div>
            {/* KPI表示 */}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>
                現在: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {g.current_value}{GOAL_UNITS[g.goal_id] || ''}
                </span>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                月KPI: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  +{g.monthly_kpi}{GOAL_UNITS[g.goal_id] || ''}/月
                </span>
              </span>
            </div>
          </div>
        ))}

        <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
          <Save size={18} />
          {saving ? '更新中...' : '現在値を保存'}
        </button>
      </div>

      {/* 現在の目標一覧 */}
      <div className="card">
        <div className="card-title">目標一覧 🎯</div>
        {goals.map((g) => {
          const pct = g.target_value > 0 ? Math.round((g.current_value / g.target_value) * 100) : 0;
          return (
            <div key={g.goal_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{GOAL_LABELS[g.goal_id] || g.goal_id}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>{g.current_value} → {g.target_value}{GOAL_UNITS[g.goal_id]}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12} />+{g.monthly_kpi}/月
                </span>
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${pct >= 100 ? 'green' : 'green'}`} style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">便利な機能 ⚡️</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          「筋トレメモ」アプリのスクリーンショットから記録を移行できます。
        </p>
        <button className="btn btn-secondary" onClick={() => navigate('/import')}>
          📤 スクショからインポート
        </button>
      </div>

      {/* GAS URLなど（デバッグ情報） */}
      <div className="card">
        <div className="card-title">接続情報</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
          <div>GAS URL: {import.meta.env.VITE_GAS_URL?.slice(0, 60)}...</div>
          <div style={{ marginTop: 8 }}>
            Gemini API: {import.meta.env.VITE_GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY'
              ? <span style={{ color: 'var(--red)' }}>未設定</span>
              : <span style={{ color: 'var(--accent)' }}>設定済み</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
