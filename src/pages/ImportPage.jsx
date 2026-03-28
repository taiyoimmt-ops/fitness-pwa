import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { api } from '../api/supabase.js';
import { useToast } from '../components/Toast.jsx';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const IMPORT_PROMPT = `以下は「筋トレメモ」アプリのスクリーンショットだ。
トレーニング記録をJSON配列で抽出せよ。前置き不要。
[
  {
    "date": "YYYY-MM-DD",
    "exercise": "種目名（日本語）",
    "body_part": "胸|背中|脚|肩|腕|体幹",
    "sets": [
      { "set_number": 1, "weight_kg": 数値, "reps": 数値 }
    ]
  }
]
日付が読み取れない場合は "unknown" とせよ。種目に対応する部位が不明な場合は最も近いものを選べ。`;

async function analyzeScreenshot(base64Data, mimeType) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: IMPORT_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    }
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('スクショからデータを抽出できませんでした');
  return JSON.parse(match[0]);
}

const BODY_PART_MAP = {
  'ベンチプレス': '胸', 'インクライン': '胸', 'ペックフライ': '胸', 'ディップス': '胸',
  'デッドリフト': '背中', 'ラットプル': '背中', 'ロー': '背中', 'チンニング': '背中',
  'スクワット': '脚', 'レッグプレス': '脚', 'レッグカール': '脚',
  'ショルダー': '肩', 'サイドレイズ': '肩', 'フロントレイズ': '肩',
  'カール': '腕', 'トライセプス': '腕', 'スカルクラッシャー': '腕',
  'プランク': '体幹', 'クランチ': '体幹', 'レッグレイズ': '体幹',
};

function guessBodyPart(exercise) {
  for (const [key, part] of Object.entries(BODY_PART_MAP)) {
    if (exercise.includes(key)) return part;
  }
  return '胸';
}

export default function ImportPage() {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileRef = useRef(null);

  const [phase, setPhase] = useState('idle'); // idle | analyzing | preview | saving
  const [imagePreview, setImagePreview] = useState(null);
  const [records, setRecords] = useState([]); // 解析結果
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setPhase('analyzing');
      setError('');

      const base64 = dataUrl.split(',')[1];
      try {
        const parsed = await analyzeScreenshot(base64, file.type);
        // body_partが空の場合は推測で補完
        const filled = parsed.map((rec) => ({
          ...rec,
          body_part: rec.body_part || guessBodyPart(rec.exercise),
          sets: (rec.sets || []).map((s, i) => ({
            ...s,
            set_number: s.set_number || i + 1,
          })),
        }));
        setRecords(filled);
        setPhase('preview');
      } catch (err) {
        setError(err.message);
        setPhase('idle');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAll = async () => {
    setPhase('saving');
    try {
      // 日付ごとにグループ化してaddWorkoutを呼ぶ
      for (const rec of records) {
        if (!rec.sets || rec.sets.length === 0) continue;
        const timestamp = rec.date !== 'unknown' ? `${rec.date} 12:00` : undefined;
        await api.addWorkout(
          rec.sets.map((s) => ({
            exercise: rec.exercise,
            body_part: rec.body_part,
            set_number: s.set_number,
            weight_kg: Number(s.weight_kg) || 0,
            reps: Number(s.reps) || 0,
          })),
          timestamp
        );
      }
      showToast(`✅ ${records.length}件のトレーニングを保存しました！`);
      navigate('/');
    } catch (err) {
      showToast('⚠️ ' + err.message, 'error');
      setPhase('preview');
    }
  };

  const removeRecord = (i) => setRecords(records.filter((_, idx) => idx !== i));

  const totalSets = records.reduce((acc, r) => acc + (r.sets?.length || 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/settings')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">スクショインポート</h1>
      </div>

      {error && (
        <div className="error-state" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* アップロードエリア */}
      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📸</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>筋トレメモのスクショを読み込む</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
            「筋トレメモ」アプリのスクリーンショットをアップロードすると<br />
            AIがトレーニング記録を自動抽出してSheetsに保存します
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
            <Upload size={20} />
            スクショを選択
          </button>
        </div>
      )}

      {/* 解析中 */}
      {phase === 'analyzing' && (
        <>
          {imagePreview && (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
              <img src={imagePreview} alt="スクショ" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
            </div>
          )}
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>AIがスクショを解析中...</p>
          </div>
        </>
      )}

      {/* プレビュー */}
      {(phase === 'preview' || phase === 'saving') && (
        <>
          <div className="card" style={{ background: 'var(--accent-dim2)', borderColor: 'rgba(57,255,20,0.15)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
                  <Eye size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  解析完了 - 保存前に確認してください
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {records.length}種目 / 計{totalSets}セット
                </div>
              </div>
            </div>
          </div>

          {records.map((rec, i) => (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{rec.exercise}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {rec.body_part} ·{' '}
                    <span style={{ color: rec.date === 'unknown' ? 'var(--yellow)' : 'var(--text-muted)' }}>
                      {rec.date === 'unknown' ? '⚠️ 日付不明' : rec.date}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ color: 'var(--red)', padding: 4 }}
                  onClick={() => removeRecord(i)}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(rec.sets || []).map((s, j) => (
                  <div key={j} style={{
                    background: 'var(--bg-3)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    Set{s.set_number}: {s.weight_kg}kg×{s.reps}rep
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setPhase('idle'); setRecords([]); setImagePreview(null); }}
            >
              ↩ やり直す
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveAll}
              disabled={phase === 'saving' || records.length === 0}
            >
              <CheckCircle size={18} />
              {phase === 'saving' ? '保存中...' : '一括保存'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
