import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Send, Dumbbell, RotateCcw, Camera, Scan, User } from 'lucide-react';
import { api } from '../api/gas.js';
import { haptics } from '../utils/haptics.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─── Gemini 呼び出し ───
async function callGemini(contents) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const VISION_PROMPT = `この体型画像を分析し、以下の項目を厳しく査定せよ。前置き不要。
1. 推定体脂肪率 (%)
2. 筋肉の付き方の特徴と弱点部位
3. 今後のトレーニングのアドバイス（短く）

回答は日本語で、必ず「推定体脂肪率: XX%」という一文を冒頭に含め、合計200文字以内で完結させろ。`;

export default function AnalysisPage() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const fileRef = useRef(null);

  const [tab, setTab] = useState('routine'); // 'routine' | 'chat' | 'vision'
  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [routinePhase, setRoutinePhase] = useState('idle');
  const [routine, setRoutine] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Vision用状態
  const [visionImage, setVisionImage] = useState(null);
  const [visionResult, setVisionResult] = useState('');
  const [visionLoading, setVisionLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getSummary7days(), api.getGoals()])
      .then(([s, g]) => { setSummary(s); setGoals(g); });
  }, []);

  const handleVisionClick = () => {
    haptics.medium();
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setVisionImage(dataUrl);
      setVisionLoading(true);
      setVisionResult('');
      
      const base64 = dataUrl.split(',')[1];
      try {
        const reply = await callGemini([{
          role: 'user',
          parts: [
            { text: VISION_PROMPT },
            { inline_data: { mime_type: file.type, data: base64 } }
          ]
        }]);
        setVisionResult(reply);
        haptics.success();
      } catch (err) {
        setVisionResult('解析に失敗した。');
        haptics.error();
      } finally {
        setVisionLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page fade-in" style={{ paddingBottom: 'calc(var(--nav-height) + 80px)' }}>
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">AI トレーナー IRON</h1>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
        background: 'var(--bg-3)', borderRadius: 14, padding: 4, marginBottom: 20,
      }}>
        {[
          ['routine', 'メニュー', <Dumbbell size={14}/>], 
          ['chat', '相談', <Send size={14}/>], 
          ['vision', '体型診断', <Scan size={14}/>]
        ].map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => { haptics.light(); setTab(key); }}
            style={{
              background: tab === key ? 'var(--bg-card)' : 'transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
              border: 'none', borderRadius: 10, padding: '12px 0',
              fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === 'routine' && (
        <div className="fade-in">
          {routinePhase === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 50, marginBottom: 12 }}>⚔️</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
                直近の不足部位をAIが分析し<br />今日のメニューを決定する
              </p>
              <button className="btn btn-primary" onClick={() => { haptics.medium(); setRoutinePhase('loading'); setTimeout(() => setRoutinePhase('done'), 1000); }}>
                解析を開始せよ
              </button>
            </div>
          )}
          {routinePhase === 'loading' && <div className="spinner-center"><div className="spinner" /></div>}
          {routinePhase === 'done' && (
            <div className="card" style={{ border: '1px solid var(--accent-dim)' }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, marginBottom: 16 }}>SYSTEM: ACTIVE</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>胸・三頭筋</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>胸のボリュームが不足している。</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <p style={{ fontWeight: 700 }}>1. ベンチプレス 3set × 8rep</p>
                <p style={{ fontWeight: 700, marginTop: 8 }}>2. ダンベルフライ 3set × 12rep</p>
                <p style={{ fontWeight: 700, marginTop: 8 }}>3. スカルクラッシャー 3set × 10rep</p>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/workout')}>進む</button>
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div className="fade-in" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, fontWeight: 900 }}>I</div>
          <p style={{ color: 'var(--text-secondary)' }}>何を聞きたい？</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <input className="input-field" placeholder="増量について..." />
            <button className="btn btn-primary" style={{ width: 50, padding: 0 }}><Send size={18}/></button>
          </div>
        </div>
      )}

      {tab === 'vision' && (
        <div className="fade-in">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
          
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            {!visionImage ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
                  全身の写真を送れ。AIが体脂肪率と<br />筋肉のポテンシャルを計測する。
                </p>
                <button className="btn btn-primary" onClick={handleVisionClick}>
                  <Camera size={20} /> 写真を撮る
                </button>
              </>
            ) : (
              <div>
                <img src={visionImage} style={{ width: '100%', maxHeight: 250, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
                {visionLoading ? (
                  <div style={{ padding: 20 }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }} />
                    <p style={{ fontWeight: 800, color: 'var(--accent)' }}>BODY ANALYZING...</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'left', background: 'var(--bg-3)', padding: 16, borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 800, marginBottom: 12, fontSize: 12 }}>
                      <Zap size={14} /> RESULT
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                      {visionResult}
                    </div>
                    <button className="btn btn-secondary" style={{ marginTop: 16, minHeight: 44, fontSize: 13 }} onClick={() => setVisionImage(null)}>
                      撮り直す
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
