import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Weight } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { api } from '../api/gas.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
);

// Epley 1RM推定式
function calc1RM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// ─── チャートの共通オプション ───
function lineOptions(label, unit = 'kg') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a1a',
        borderColor: 'rgba(57,255,20,0.3)',
        borderWidth: 1,
        titleColor: '#888',
        bodyColor: '#f0f0f0',
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y}${unit}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 6 },
        border: { color: 'transparent' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#555', font: { size: 10 }, callback: (v) => `${v}${unit}` },
        border: { color: 'transparent' },
      },
    },
  };
}

// ─── 1RMトレンドカード ───
function OneRMChart({ exercise, records }) {
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(r => r.date.slice(5)); // MM-DD
  const data = sorted.map(r => calc1RM(r.weight_kg, r.reps));
  const maxRM = Math.max(...data);
  const latest = data[data.length - 1];
  const trend = data.length > 1 ? latest - data[0] : 0;

  const chartData = {
    labels,
    datasets: [{
      data,
      borderColor: '#39FF14',
      backgroundColor: 'rgba(57,255,20,0.08)',
      borderWidth: 2.5,
      pointRadius: 4,
      pointBackgroundColor: '#39FF14',
      pointBorderColor: '#000',
      pointBorderWidth: 1.5,
      fill: true,
      tension: 0.35,
    }],
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>{exercise}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{latest}kg</span>
            <span style={{ fontSize: 12, color: trend >= 0 ? 'var(--accent)' : 'var(--red)', fontWeight: 700 }}>
              {trend >= 0 ? '▲' : '▼'}{Math.abs(trend)}kg
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>推定1RM（Epley式）</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MAX</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{maxRM}kg</div>
        </div>
      </div>
      <div style={{ height: 140 }}>
        <Line data={chartData} options={lineOptions(exercise)} />
      </div>
    </div>
  );
}

// ─── 体重推移カード ───
function WeightChart({ records }) {
  if (!records || records.length === 0) return (
    <div className="card">
      <div className="card-title">体重推移 ⚖️</div>
      <div className="empty-state"><p>体重データがありません<br />ダッシュボードから記録してください</p></div>
    </div>
  );

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(r => r.date.slice(5));
  const data = sorted.map(r => r.weight_kg);
  const latest = data[data.length - 1];
  const trend = data.length > 1 ? (latest - data[0]).toFixed(1) : 0;

  const chartData = {
    labels,
    datasets: [{
      data,
      borderColor: '#39FF14',
      backgroundColor: 'rgba(57,255,20,0.06)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#39FF14',
      fill: true,
      tension: 0.4,
    }],
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>体重推移 ⚖️</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{latest}kg</span>
            <span style={{ fontSize: 12, color: Number(trend) >= 0 ? 'var(--accent)' : 'var(--red)', fontWeight: 700 }}>
              {Number(trend) >= 0 ? '▲' : '▼'}{Math.abs(trend)}kg
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {records.length}日間のデータ
          </div>
        </div>
      </div>
      <div style={{ height: 140 }}>
        <Line data={chartData} options={lineOptions('体重')} />
      </div>
    </div>
  );
}

// ─── 部位別ボリュームカード ───
function VolumeChart({ volumeData }) {
  if (!volumeData) return null;
  const BODY_PARTS = ['胸', '背中', '脚', '肩', '腕', '体幹'];
  const values = BODY_PARTS.map(p => volumeData[p] || 0);

  const chartData = {
    labels: BODY_PARTS,
    datasets: [{
      data: values,
      backgroundColor: values.map(v => v < 3 ? 'rgba(255,68,68,0.7)' : 'rgba(57,255,20,0.7)'),
      borderColor: values.map(v => v < 3 ? '#FF4444' : '#39FF14'),
      borderWidth: 1.5,
      borderRadius: 6,
    }],
  };

  const barOptions = {
    ...lineOptions('', 'セット'),
    scales: {
      ...lineOptions('', 'セット').scales,
      y: {
        ...lineOptions('', 'セット').scales.y,
        beginAtZero: true,
        ticks: { color: '#555', font: { size: 10 }, stepSize: 1, callback: (v) => `${v}` },
      },
    },
  };

  return (
    <div className="card">
      <div className="card-title">直近7日 部位別ボリューム 🔥</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--accent)' }}>■ 4セット以上</span>
        <span style={{ fontSize: 11, color: 'var(--red)' }}>■ 3セット以下（要刺激）</span>
      </div>
      <div style={{ height: 160 }}>
        <Bar data={chartData} options={barOptions} />
      </div>
    </div>
  );
}

// ─── メインページ ───
export default function StatsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weightHistory, setWeightHistory] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState({});
  const [volumeData, setVolumeData] = useState(null);
  const [error, setError] = useState('');

  const BIG3 = ['ベンチプレス', 'スクワット', 'デッドリフト'];

  useEffect(() => {
    const load = async () => {
      try {
        const [wh, bph, summary] = await Promise.all([
          api.getBodyWeightHistory(30).catch(() => []),
          api.getBodyParts7days().catch(() => ({})),
          api.getSummary7days().catch(() => null),
        ]);
        setWeightHistory(wh);
        // 部位別ボリューム集計
        const vol = {};
        Object.values(bph).forEach(dayData => {
          Object.entries(dayData).forEach(([part, sets]) => {
            vol[part] = (vol[part] || 0) + sets;
          });
        });
        setVolumeData(vol);

        // BIG3のワークアウト履歴を取得
        const histories = await Promise.all(
          BIG3.map(ex => api.getWorkoutHistory(ex, 20).catch(() => []))
        );
        const h = {};
        BIG3.forEach((ex, i) => { h[ex] = histories[i]; });
        setWorkoutHistory(h);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="spinner-center"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">Stats</h1>
      </div>

      {error && <div className="error-state">{error}</div>}

      {/* 体重推移 */}
      <WeightChart records={weightHistory} />

      {/* BIG3 推定1RM推移 */}
      {BIG3.map(ex => (
        <OneRMChart key={ex} exercise={ex} records={workoutHistory[ex] || []} />
      ))}

      {/* 部位別ボリューム */}
      <VolumeChart volumeData={volumeData} />
    </div>
  );
}
