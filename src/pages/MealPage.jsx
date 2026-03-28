import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, Edit3, ArrowLeft, AlertCircle, Scan } from 'lucide-react';
import { api } from '../api/gas.js';
import { useToast } from '../components/Toast.jsx';
import { haptics } from '../utils/haptics.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const PROMPT = `画像から食事または栄養成分表示（ラベル）を分析し、JSONのみで回答せよ。

【重要】
1. 画像内に「栄養成分表示」がある場合、その数値を最優先で抽出せよ。
2. 「100gあたり」と表示されている場合は、商品の内容量から合計値を計算せよ。
3. 食事本体の画像のみの場合は、これまでの学習データから平均的なPFCを予測せよ。

【出力形式】
{
  "meal_label": "具体的な商品名または料理名",
  "calories": 数値,
  "protein_g": 数値,
  "fat_g": 数値,
  "carb_g": 数値,
  "confidence": "high (数字が明快に読み取れた) | medium (予測) | low (不鮮明)",
  "is_label": true/false (栄養成分表示の表が存在したか)
}
前置きや説明は一切不要。`;

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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('解析結果を取得できませんでした');
  return JSON.parse(match[0]);
}

export default function MealPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileRef = useRef(null);
  const [phase, setPhase] = useState('idle'); 
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptics.light();
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setPhase('analyzing');
      setError('');

      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;

      try {
        const parsed = await analyzeImage(base64, mimeType);
        setResult(parsed);
        setForm(parsed);
        setPhase('result');
        haptics.success();
      } catch (err) {
        haptics.error();
        setError(err.message);
        setPhase('idle');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    haptics.medium();
    setPhase('saving');
    try {
      await api.addMeal({
        meal_label: form.meal_label,
        calories: Number(form.calories),
        protein_g: Number(form.protein_g),
        fat_g: Number(form.fat_g),
        carb_g: Number(form.carb_g),
      });
      haptics.success();
      showToast('✅ 食事を記録しました！');
      navigate('/');
    } catch (err) {
      haptics.error();
      showToast('⚠️ ' + err.message, 'error');
      setPhase('result');
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => { haptics.light(); navigate('/'); }} style={{ padding: 8 }}>
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
        <div className="card" style={{ textAlign: 'center', padding: 40, border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>📸</div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 8, fontSize: 16 }}>
            パッケージの「栄養成分表示」をスキャン
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 13 }}>
            カメラを成分表に向けるだけで、PFCを<br />正確に読み取り自動計算します。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className="btn btn-primary" onClick={() => { haptics.medium(); fileRef.current?.click(); }}>
            <Scan size={20} />
            スキャン開始
          </button>
        </div>
      )}

      {/* 解析中 */}
      {phase === 'analyzing' && (
        <>
          {imagePreview && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16, position: 'relative' }}>
              <img src={imagePreview} alt="食事" style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} />
              <div className="skeleton" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
            </div>
          )}
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 15 }}>スキャン中...</p>
          </div>
        </>
      )}

      {/* 解析結果 */}
      {(phase === 'result' || phase === 'saving') && result && (
        <>
          {imagePreview && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <img src={imagePreview} alt="食事" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                {result.is_label ? 'ラベルスキャン成功' : '解析結果'}
              </div>
              <span className={`badge ${result.confidence?.includes('high') ? 'badge-green' : 'badge-grey'}`}>
                {result.is_label ? 'OCR' : 'AI予測'}
              </span>
            </div>

            {!editing ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 20, color: 'var(--accent)' }}>
                  {form.meal_label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'カロリー', value: form.calories, unit: 'kcal' },
                    { label: 'タンパク質', value: form.protein_g, unit: 'g' },
                    { label: '脂質', value: form.fat_g, unit: 'g' },
                    { label: '炭水化物', value: form.carb_g, unit: 'g' },
                  ].map((item) => (
                    <div key={item.label} style={{ 
                      background: 'var(--bg-3)', 
                      borderRadius: 14, 
                      padding: '16px',
                      border: result.is_label ? '1px solid var(--accent-dim)' : '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                        {item.value}<span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => { haptics.light(); setEditing(true); }}>修正</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={phase === 'saving'}>
                    確定して保存
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label className="input-label">食事名</label>
                  <input className="input-field" value={form.meal_label || ''} onChange={(e) => setForm({ ...form, meal_label: e.target.value })} />
                </div>
                <div className="num-input-row">
                  <div className="input-group">
                    <label className="input-label">kcal</label>
                    <input className="input-field" type="number" value={form.calories || ''} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">P (g)</label>
                    <input className="input-field" type="number" value={form.protein_g || ''} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} />
                  </div>
                </div>
                <div className="num-input-row">
                  <div className="input-group">
                    <label className="input-label">F (g)</label>
                    <input className="input-field" type="number" value={form.fat_g || ''} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">C (g)</label>
                    <input className="input-field" type="number" value={form.carb_g || ''} onChange={(e) => setForm({ ...form, carb_g: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => { haptics.light(); setEditing(false); }}>キャンセル</button>
                  <button className="btn btn-primary" onClick={() => { haptics.success(); setEditing(false); }}>OK</button>
                </div>
              </>
            )}
          </div>

          <button className="btn btn-ghost" style={{ width: '100%', color: 'var(--text-muted)', marginTop: 8 }}
            onClick={() => { haptics.medium(); setPhase('idle'); setResult(null); setImagePreview(null); setEditing(false); }}>
            撮り直す
          </button>
        </>
      )}
    </div>
  );
}
