import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, Edit3, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../api/gas.js';
import { useToast } from '../components/Toast.jsx';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const PROMPT = `以下の食事画像を分析し、必ずJSON形式のみで回答せよ。前置きや説明は不要。
{
  "meal_label": "食事名（例：チキン定食）",
  "calories": 数値,
  "protein_g": 数値,
  "fat_g": 数値,
  "carb_g": 数値,
  "confidence": "high|medium|low"
}
複数品がある場合は合算値を返せ。不明な場合は推測値を入れ confidence を low にせよ。`;

async function analyzeImage(base64Data, mimeType) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    }
  );
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // JSONを抽出
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('解析結果を取得できませんでした');
  return JSON.parse(match[0]);
}

export default function MealPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | analyzing | result | editing | saving
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // プレビュー
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setPhase('analyzing');
      setError('');

      // base64部分を取り出す
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;

      try {
        const parsed = await analyzeImage(base64, mimeType);
        setResult(parsed);
        setForm(parsed);
        setPhase('result');
      } catch (err) {
        setError(err.message);
        setPhase('idle');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setPhase('saving');
    try {
      await api.addMeal({
        meal_label: form.meal_label,
        calories: Number(form.calories),
        protein_g: Number(form.protein_g),
        fat_g: Number(form.fat_g),
        carb_g: Number(form.carb_g),
      });
      showToast('✅ 食事を記録しました！');
      navigate('/');
    } catch (err) {
      showToast('⚠️ ' + err.message, 'error');
      setPhase('result');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">食事を記録</h1>
      </div>

      {error && (
        <div className="error-state">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 撮影フェーズ */}
      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🍽️</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
            食事の写真を撮影すると<br />AIが栄養素を自動解析します
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            <Camera size={20} />
            カメラで撮影 / ライブラリから選択
          </button>
        </div>
      )}

      {/* 解析中 */}
      {phase === 'analyzing' && (
        <>
          {imagePreview && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <img src={imagePreview} alt="食事" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
            </div>
          )}
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>AIが解析中... しばらくお待ちください</p>
          </div>
        </>
      )}

      {/* 解析結果 */}
      {(phase === 'result' || phase === 'saving') && result && (
        <>
          {imagePreview && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <img src={imagePreview} alt="食事" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>解析結果</div>
              {result.confidence && (
                <span className={`badge ${result.confidence === 'high' ? 'badge-green' : result.confidence === 'medium' ? 'badge-grey' : 'badge-red'}`}>
                  精度: {result.confidence}
                </span>
              )}
            </div>

            {!editing ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{form.meal_label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'カロリー', value: form.calories, unit: 'kcal' },
                    { label: 'タンパク質', value: form.protein_g, unit: 'g' },
                    { label: '脂質', value: form.fat_g, unit: 'g' },
                    { label: '炭水化物', value: form.carb_g, unit: 'g' },
                  ].map((item) => (
                    <div key={item.label} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                        {item.value}<span style={{ fontSize: 12, fontWeight: 400 }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                    <Edit3 size={16} />修正
                  </button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={phase === 'saving'}>
                    <CheckCircle size={16} />{phase === 'saving' ? '保存中...' : '保存'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 編集フォーム */}
                <div className="input-group">
                  <label className="input-label">食事名</label>
                  <input className="input-field" value={form.meal_label || ''} onChange={(e) => setForm({ ...form, meal_label: e.target.value })} />
                </div>
                <div className="num-input-row">
                  <div className="input-group">
                    <label className="input-label">カロリー (kcal)</label>
                    <input className="input-field" type="number" value={form.calories || ''} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">タンパク質 (g)</label>
                    <input className="input-field" type="number" value={form.protein_g || ''} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} />
                  </div>
                </div>
                <div className="num-input-row">
                  <div className="input-group">
                    <label className="input-label">脂質 (g)</label>
                    <input className="input-field" type="number" value={form.fat_g || ''} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">炭水化物 (g)</label>
                    <input className="input-field" type="number" value={form.carb_g || ''} onChange={(e) => setForm({ ...form, carb_g: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
                  <button className="btn btn-primary" onClick={() => setEditing(false)}>✅ 確認</button>
                </div>
              </>
            )}
          </div>

          {/* もう一度撮り直す */}
          <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--text-secondary)', marginTop: 8 }}
            onClick={() => { setPhase('idle'); setResult(null); setImagePreview(null); setEditing(false); }}>
            ↩ 撮り直す
          </button>
        </>
      )}
    </div>
  );
}
