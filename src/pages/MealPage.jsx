import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle, Edit3, ArrowLeft, AlertCircle, Scan, Clock, Keyboard } from 'lucide-react';
import { api } from '../api/gas.js';
import { useToast } from '../components/Toast.jsx';
import { haptics } from '../utils/haptics.js';
import HapticInput from '../components/HapticInput.jsx';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const PROMPT = `画像から食事または栄養成分表示（ラベル）を分析し、JSONのみで回答せよ。
【出力形式】
{
  "meal_label": "具体的な商品名または料理名",
  "calories": 数値,
  "protein_g": 数値,
  "fat_g": 数値,
  "carb_g": 数値,
  "confidence": "high|medium|low",
  "is_label": true/false
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
  const [imagePayload, setImagePayload] = useState(null);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ meal_label: '', calories: 0, protein_g: 0, fat_g: 0, carb_g: 0 });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    haptics.light();
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setImagePayload(dataUrl.split(',')[1]);
      setPhase('analyzing');
      try {
        const parsed = await analyzeImage(dataUrl.split(',')[1], file.type);
        setResult(parsed);
        setForm(parsed);
        setPhase('result');
        haptics.success();
      } catch (err) {
        haptics.error();
        setPhase('error'); // AI失敗フェーズへ
      }
    };
    reader.readAsDataURL(file);
  };

  const saveManual = async () => {
    haptics.medium();
    try {
      await api.addMeal(form);
      showToast('✅ 記録しました');
      navigate('/');
    } catch (e) { showToast('保存失敗', 'error'); }
  };

  const saveLater = async () => {
    haptics.medium();
    try {
      await api.savePendingMealImage(imagePreview);
      showToast('📸 画像を保存しました。後で解析します。');
      navigate('/');
    } catch (e) { showToast('保存失敗', 'error'); }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}><ArrowLeft size={22} /></button>
        <h1 className="page-title">食事を記録</h1>
      </div>

      {phase === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: 40, border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>📸</div>
            <p style={{ fontWeight: 700, marginBottom: 24 }}>AIでスキャン</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>スキャン開始</button>
          </div>
          <button className="btn btn-secondary" onClick={() => { haptics.light(); setPhase('manual'); }}>
            <Keyboard size={18} /> 手入力で進める
          </button>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--accent)', fontWeight: 800 }}>スキャン中...</p>
          <button className="btn btn-ghost" style={{ marginTop: 24, fontSize: 13 }} onClick={() => setPhase('manual')}>
            待たずに手入力する
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>AIが現在混み合っています</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
            画像だけ保存して後で解析するか、<br />今すぐ手入力で記録できます。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary" onClick={saveLater}>
              <Clock size={18} /> 画像だけ保存（後で分析）
            </button>
            <button className="btn btn-secondary" onClick={() => setPhase('manual')}>
              <Keyboard size={18} /> 今すぐ手入力
            </button>
          </div>
        </div>
      )}

      {(phase === 'result' || phase === 'manual') && (
        <div className="card fade-in">
          <div className="card-title">{phase === 'manual' ? '手入力' : '解析結果'}</div>
          {imagePreview && phase !== 'manual' && <img src={imagePreview} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} />}
          
          <div className="input-group">
            <label className="input-label">食事名</label>
            <input className="input-field" value={form.meal_label} onChange={e => setForm({...form, meal_label: e.target.value})} placeholder="例: プロテイン" />
          </div>
          <HapticInput label="カロリー" value={form.calories} unit="kcal" onChange={v => setForm({...form, calories: v})} step={10} />
          <HapticInput label="タンパク質" value={form.protein_g} unit="g" onChange={v => setForm({...form, protein_g: v})} step={0.5} />
          <HapticInput label="脂質" value={form.fat_g} unit="g" onChange={v => setForm({...form, fat_g: v})} step={0.5} />
          <HapticInput label="炭水化物" value={form.carb_g} unit="g" onChange={v => setForm({...form, carb_g: v})} step={1} />

          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={saveManual}>
            確定して保存
          </button>
        </div>
      )}
    </div>
  );
}
