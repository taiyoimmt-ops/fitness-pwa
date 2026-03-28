import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, TrendingUp, Bell, BellOff } from 'lucide-react';
import { api } from '../api/supabase.js';
import { GOAL_LABELS, GOAL_UNITS } from '../constants.js';
import { useToast } from '../components/Toast.jsx';

export default function SettingsPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState({});
  const [saving, setSaving] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(Notification.permission);

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
      const gs = await api.getGoals();
      setGoals(gs);
      setUpdates({});
    } catch (e) {
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === 'granted') {
        showToast('✅ 通知が許可されました');
        // デスト用通知
        new Notification('IRON', { body: '通知の準備は整った。ジムへ行け。' });
      } else {
        showToast('❌ 通知が拒否されました', 'error');
      }
    } catch (e) {
      showToast('⚠️ ブラウザが通知に対応していません', 'error');
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

      {/* 通知設定 */}
      <div className="card">
        <div className="card-title">プッシュ通知 🔔</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>ジムのリマインダー</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              毎日 19:00 に通知を受け取る
            </div>
          </div>
          {notificationStatus === 'granted' ? (
            <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <Bell size={16} /> 有効
            </div>
          ) : (
            <button className="btn btn-secondary" style={{ width: 'auto', minHeight: 40, padding: '8px 16px', fontSize: 13 }}
              onClick={requestNotificationPermission}>
              許可する
            </button>
          )}
        </div>
        {notificationStatus === 'denied' && (
          <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>
            ブラウザの設定から通知を許可してください
          </p>
        )}
      </div>

      {/* 目標進捗の更新 */}
      <div className="card">
        <div className="card-title">現在値を更新 📈</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          トレーニングや体重計測後に最新の数値を入力してください。
        </p>

        {goals.map((g) => (
          <div key={g.goal_id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <label className="input-label" style={{ marginBottom: 0 }}>
                {GOAL_LABELS[g.goal_id] || g.goal_id}
              </label>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                目標: {g.target_value}{GOAL_UNITS[g.goal_id] || ''}
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
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {GOAL_UNITS[g.goal_id] || ''}
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
              <div className="progress-track">
                <div className="progress-fill green" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">便利な機能 ⚡️</div>
        <button className="btn btn-secondary" onClick={() => navigate('/import')}>
          📤 スクショからインポート
        </button>
      </div>
    </div>
  );
}
