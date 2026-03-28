import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { api } from '../api/supabase.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler, ArcElement
);

// Epley 1RM推定式
function calc1RM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// ─── チャートの共通オプション ───
function lineOptions(unit = 'kg') {
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
        ticks: { color: '#888', font: { size: 10 }, maxTicksLimit: 6 },
        border: { color: 'transparent' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#888', font: { size: 10 }, callback: (v) => `${v}${unit}` },
        border: { display: false },
      },
    },
  };
}

// ─── 1RMトレンドカード ───
function OneRMChart({ exercise, records }) {
  if (!records || records.length === 0) return null;

  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const labels = sorted.map(r => r.timestamp.slice(5, 10)); // MM-DD
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
        <Line data={chartData} options={lineOptions('kg')} />
      </div>
    </div>
  );
}

// ─── 体重推移カード ───
function WeightChart({ records }) {
  if (!records || records.length === 0) return (
    <div className="card">
      <div className="card-title">体重推移 ⚖️</div>
      <div className="empty-state">体重データがありません</div>
    </div>
  );

  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const labels = sorted.map(r => r.timestamp.slice(5, 10));
  const data = sorted.map(r => r.weight_kg);
  const latest = data[data.length - 1];
  const trend = data.length > 1 ? (latest - data[0]).toFixed(1) : 0;

  const chartData = {
    labels,
    datasets: [{
      data,
      borderColor: '#00f2fe',
      backgroundColor: 'rgba(0,242,254,0.06)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#00f2fe',
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
            <span style={{ fontSize: 28, fontWeight: 800, color: '#00f2fe' }}>{latest}kg</span>
            <span style={{ fontSize: 12, color: Number(trend) >= 0 ? '#00f2fe' : 'var(--red)', fontWeight: 700 }}>
              {Number(trend) >= 0 ? '▲' : '▼'}{Math.abs(trend)}kg
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            過去30日間の推移
          </div>
        </div>
      </div>
      <div style={{ height: 140 }}>
        <Line data={chartData} options={lineOptions('kg')} />
      </div>
    </div>
  );
}

// ─── 部位別比率カード（Doughnut） ───
function BodyPartDoughnut({ volumeData }) {
  if (!volumeData || Object.keys(volumeData).length === 0) {
    return (
      <div className="card">
        <div className="card-title">部位別トレーニング比率</div>
        <div className="empty-state">直近7日間のデータがありません</div>
      </div>
    );
  }

  const parts = Object.keys(volumeData);
  const data = parts.map(p => volumeData[p]);
  
  const chartData = {
    labels: parts,
    datasets: [{
      data,
      backgroundColor: ['#39FF14', '#00f2fe', '#fdf300', '#ff007c', '#9d00ff', '#ff6a00'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };
  
  return (
    <div className="card">
      <div className="card-title">直近7日 部位別比率 (セット数)</div>
      <div style={{ height: 180, position: 'relative', marginTop: 12 }}>
        <Doughnut data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#888', font: {size: 11} } } } }} />
      </div>
    </div>
  );
}

// ─── PFCバランスカード（Stacked Bar） ───
function PfcBarChart({ meals }) {
  if (!meals || meals.length === 0) {
    return (
      <div className="card">
        <div className="card-title">直近7日 PFC摂取推移</div>
        <div className="empty-state">食事データがありません</div>
      </div>
    );
  }

  // meals を日付ごとに集計
  const daily = {};
  for (const m of meals) {
    if (!m.timestamp) continue;
    const d = m.timestamp.split('T')[0].slice(5); // MM-DD
    if (!daily[d]) daily[d] = { p: 0, f: 0, c: 0 };
    daily[d].p += parseFloat(m.protein_g) || 0;
    daily[d].f += parseFloat(m.fat_g) || 0;
    daily[d].c += parseFloat(m.carb_g) || 0;
  }
  
  const labels = Object.keys(daily).sort();
  const dataP = labels.map(l => Math.round(daily[l].p));
  const dataF = labels.map(l => Math.round(daily[l].f));
  const dataC = labels.map(l => Math.round(daily[l].c));

  const chartData = {
    labels,
    datasets: [
      { label: 'タンパク質 (g)', data: dataP, backgroundColor: '#39FF14', stack: 'Stack 0', borderRadius: 2 },
      { label: '脂質 (g)', data: dataF, backgroundColor: '#ff4444', stack: 'Stack 0', borderRadius: 2 },
      { label: '炭水化物 (g)', data: dataC, backgroundColor: '#00f2fe', stack: 'Stack 0', borderRadius: 2 }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: { backgroundColor: '#1a1a1a', titleColor: '#888', bodyColor: '#fff', borderWidth: 1, borderColor: '#333' }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: {color: '#888', font:{size:10}} },
      y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: {color: '#888', font:{size:10}}, border: {display: false} }
    }
  };

  return (
    <div className="card">
      <div className="card-title">直近7日 PFC摂取推移</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#39FF14' }}>■ ﾀﾝﾊﾟｸ質</span>
        <span style={{ fontSize: 11, color: '#ff4444' }}>■ 脂質</span>
        <span style={{ fontSize: 11, color: '#00f2fe' }}>■ 炭水化物</span>
      </div>
      <div style={{ height: 160 }}>
        <Bar data={chartData} options={options} />
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
  const [volumeData, setVolumeData] = useState({});
  const [mealsData, setMealsData] = useState([]);
  const [error, setError] = useState('');

  const BIG3 = ['ベンチプレス', 'スクワット', 'デッドリフト'];

  useEffect(() => {
    const load = async () => {
      try {
        const [wh, bph, summary] = await Promise.all([
          api.getWeightHistory(30).catch(() => []),
          api.getBodyParts7days().catch(() => ({})),
          api.getSummary7days().catch(() => ({ meals: [] })),
        ]);
        
        setWeightHistory(wh || []);
        setVolumeData(bph || {});
        setMealsData(summary?.meals || []);

        // BIG3のワークアウト履歴を取得
        const histories = await Promise.all(
          BIG3.map(ex => api.getWorkoutHistory(ex, 20).catch(() => []))
        );
        const h = {};
        BIG3.forEach((ex, i) => { h[ex] = histories[i] || []; });
        setWorkoutHistory(h);
      } catch (e) {
        console.error('Stats load error:', e);
        setError('データの取得に失敗しました。');
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
    <div className="page fade-in" style={{ paddingBottom: '90px' }}>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">Stats & Analytics</h1>
      </div>

      {error && <div className="error-state">{error}</div>}

      {/* PFCバランス推移 (Bar) */}
      <PfcBarChart meals={mealsData} />

      {/* 部位別トレーニング比率 (Doughnut) */}
      <BodyPartDoughnut volumeData={volumeData} />

      {/* 体重推移 (Line) */}
      <WeightChart records={weightHistory} />

      {/* BIG3 推定1RM推移 (Line) */}
      <div style={{ marginTop: '24px', marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>推定1RMトレンド</div>
      {BIG3.map(ex => (
        <OneRMChart key={ex} exercise={ex} records={workoutHistory[ex] || []} />
      ))}
    </div>
  );
}
