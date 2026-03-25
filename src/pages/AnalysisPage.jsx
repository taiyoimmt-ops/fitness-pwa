import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { api } from '../api/gas.js';
import { useToast } from '../components/Toast.jsx';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function buildPrompt(summary) {
  return `あなたは容赦のないパーソナルトレーナーだ。以下のデータを分析し、お世辞なしで3点の具体的指摘をせよ。
日本語で回答し、各指摘は2文以内にまとめよ。

[データ]
直近7日の平均体重: ${summary.avg_weight_kg}kg（前週比${summary.weight_trend}）
PFC達成率: カロリー${summary.pfc_achievement_rate?.calories}% タンパク質${summary.pfc_achievement_rate?.protein}% 脂質${summary.pfc_achievement_rate?.fat}% 炭水化物${summary.pfc_achievement_rate?.carb}%
部位別セット数: ${JSON.stringify(summary.volume_by_part)}

回答形式:
1. [最重要課題] ...
2. [食事面] ...
3. [トレーニング面] ...`;
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export default function AnalysisPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [phase, setPhase] = useState('idle'); // idle | loading | done
  const [summary, setSummary] = useState(null);
  const [advice, setAdvice] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setPhase('loading');
    setError('');
    try {
      const s = await api.getSummary7days();
      setSummary(s);
      const prompt = buildPrompt(s);
      const text = await callGemini(prompt);
      setAdvice(text);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('idle');
    }
  };

  // アドバイステキストをパース（番号付き箇条書き）
  const parseAdvice = (text) => {
    return text.split(/\n/).filter((l) => l.trim()).map((l, i) => (
      <p key={i} style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontSize: 15,
        lineHeight: 1.7,
      }}>
        {l}
      </p>
    ));
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">AIアドバイス</h1>
      </div>

      {error && <div className="error-state">{error}</div>}

      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🤖</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
            直近7日間のデータをAIが解析し<br />容赦のないフィードバックをします
          </p>
          <button className="btn btn-primary" onClick={handleGenerate}>
            <Zap size={20} /> アドバイスを生成
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>データを解析中...（5〜10秒）</p>
        </div>
      )}

      {phase === 'done' && (
        <>
          {/* サマリー数値 */}
          {summary && (
            <div className="card">
              <div className="card-title">直近7日 データサマリー</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>平均体重</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                    {summary.avg_weight_kg}kg
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{summary.weight_trend}</div>
                </div>
                {Object.entries(summary.pfc_achievement_rate || {}).map(([key, val]) => (
                  <div key={key} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {key === 'calories' ? 'カロリー' : key === 'protein' ? 'P' : key === 'fat' ? 'F' : 'C'}達成率
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: val >= 100 ? 'var(--red)' : val >= 70 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {val}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* アドバイス */}
          <div className="card">
            <div className="card-title">🔥 パーソナルトレーナーからの指摘</div>
            {parseAdvice(advice)}
          </div>

          <button className="btn btn-secondary" onClick={() => setPhase('idle')}>
            ↩ 再生成する
          </button>
        </>
      )}
    </div>
  );
}
