import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Send, Dumbbell, RotateCcw } from 'lucide-react';
import { api } from '../api/gas.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─── Gemini 呼び出し（会話履歴対応） ───
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

// ─── システムコンテキスト構築 ───
function buildSystemContext(summary, goals) {
  return `あなたは「IRON」という名の専属AIパーソナルトレーナーだ。
口調は簡潔・容赦なし・断定的。絵文字は使わない。敬語なし。
全ての回答は日本語で100文字以内にまとめろ。

【ユーザーの現在データ】
目標: ${JSON.stringify(goals?.map(g => `${g.goal_id}: ${g.current_value}→${g.target_value}`) || [])}
直近7日平均体重: ${summary?.avg_weight_kg ?? '不明'}kg (${summary?.weight_trend ?? ''})
PFC達成率: カロリー${summary?.pfc_achievement_rate?.calories ?? '?'}% タンパク質${summary?.pfc_achievement_rate?.protein ?? '?'}%
部位別セット数: ${JSON.stringify(summary?.volume_by_part ?? {})}

上記を前提に、ユーザーの質問に答えろ。`;
}

// ─── 今日のルーティン生成プロンプト ───
function buildRoutinePrompt(summary, goals) {
  const stalePartsPrompt = summary?.volume_by_part
    ? Object.entries(summary.volume_by_part)
        .filter(([, v]) => (v ?? 0) < 3)
        .map(([k]) => k)
        .join('、')
    : '';

  return `以下のユーザーデータを基に、今日のトレーニングメニューをJSONで出力せよ。前置き不要。

データ:
- 名目上の目標種目: ベンチプレス${goals?.find(g=>g.goal_id==='bench_1rm')?.current_value ?? 70}kg, スクワット${goals?.find(g=>g.goal_id==='squat_1rm')?.current_value ?? 80}kg, デッドリフト${goals?.find(g=>g.goal_id==='deadlift_1rm')?.current_value ?? 120}kg
- 直近7日間の刺激が少ない部位: ${stalePartsPrompt || 'なし'}
- 平均体重: ${summary?.avg_weight_kg ?? '?'}kg

出力形式 (JSON):
{
  "focus": "今日のフォーカス部位（1語）",
  "reason": "理由（20字以内）",
  "exercises": [
    {
      "name": "種目名",
      "sets": 数値,
      "reps": "rep範囲（例: 8-10）",
      "weight_suggestion": "重量目安（例: 75kg or BW）",
      "tip": "フォームのコツ1行"
    }
  ]
}`;
}

// ─── チャットバブル ───
function Bubble({ role, text, isLoading }) {
  const isAI = role === 'model';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isAI ? 'flex-start' : 'flex-end',
      marginBottom: 12,
      gap: 8,
      alignItems: 'flex-end',
    }}>
      {isAI && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000',
        }}>
          I
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        background: isAI ? 'var(--bg-3)' : 'var(--accent)',
        color: isAI ? 'var(--text-primary)' : '#000',
        borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.6,
        fontWeight: isAI ? 400 : 600,
        boxShadow: isAI ? 'none' : '0 2px 12px rgba(57,255,20,0.3)',
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
            {[0, 0.15, 0.3].map((delay, i) => (
              <div key={i} className="pending-dot" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
        ) : text}
      </div>
    </div>
  );
}

// ─── ルーティンカード ───
function RoutineCard({ routine, onStartWorkout }) {
  return (
    <div className="card" style={{ borderColor: 'rgba(57,255,20,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>
            TODAY'S FOCUS
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{routine.focus}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{routine.reason}</div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Dumbbell size={22} color="var(--accent)" />
        </div>
      </div>
      {routine.exercises?.map((ex, i) => (
        <div key={i} style={{
          padding: '12px 0',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 8,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {ex.sets}セット × {ex.reps}rep — {ex.weight_suggestion}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{ex.tip}</div>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vol.</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
              {ex.sets}
            </div>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onStartWorkout}>
        <Dumbbell size={18} /> このメニューで開始
      </button>
    </div>
  );
}

// ─── メインページ ───
export default function AnalysisPage() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);

  const [tab, setTab] = useState('routine'); // 'routine' | 'chat'
  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [routinePhase, setRoutinePhase] = useState('idle'); // idle | loading | done | error
  const [routine, setRoutine] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // データ初期ロード
  useEffect(() => {
    Promise.all([api.getSummary7days(), api.getGoals()])
      .then(([s, g]) => { setSummary(s); setGoals(g); setDataLoaded(true); })
      .catch(() => setDataLoaded(true));
  }, []);

  // チャット: 画面最下部へスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // ─── ルーティン生成 ───
  const generateRoutine = async () => {
    setRoutinePhase('loading');
    try {
      const prompt = buildRoutinePrompt(summary, goals);
      const text = await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('ルーティンの生成に失敗しました');
      setRoutine(JSON.parse(match[0]));
      setRoutinePhase('done');
    } catch (e) {
      setRoutinePhase('error');
    }
  };

  // ─── チャット送信 ───
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');

    const systemCtx = buildSystemContext(summary, goals);
    const userMsg = { role: 'user', parts: [{ text }] };

    // 初回: システムコンテキストを先頭に挿入
    const history = messages.length === 0
      ? [{ role: 'user', parts: [{ text: systemCtx }] }, { role: 'model', parts: [{ text: '了解。データ確認した。何を聞く？' }] }, userMsg]
      : [...messages, userMsg];

    setMessages(history);
    setChatLoading(true);

    try {
      const reply = await callGemini(history);
      const aiMsg = { role: 'model', parts: [{ text: reply }] };
      setMessages([...history, aiMsg]);
    } catch (e) {
      const errMsg = { role: 'model', parts: [{ text: 'API制限中。少し待て。' }] };
      setMessages([...history, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="page fade-in" style={{ paddingBottom: 'calc(var(--nav-height) + 80px)' }}>
      {/* ヘッダー */}
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">AI トレーナー</h1>
      </div>

      {/* タブ切り替え */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
        background: 'var(--bg-3)', borderRadius: 12, padding: 4, marginBottom: 20,
      }}>
        {[['routine', '今日のメニュー'], ['chat', 'AIに相談']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? 'var(--bg-card)' : 'transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
              border: 'none', borderRadius: 10, padding: '10px 0',
              fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── タブ: 今日のメニュー ── */}
      {tab === 'routine' && (
        <>
          {routinePhase === 'idle' && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>今日のメニューを生成</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
                直近7日のデータから、今日やるべき<br />最適なトレーニングをAIが決定する
              </p>
              <button
                className="btn btn-primary"
                onClick={generateRoutine}
                disabled={!dataLoaded}
              >
                <Zap size={20} /> メニューを生成
              </button>
            </div>
          )}

          {routinePhase === 'loading' && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>AIがデータを解析中...</p>
            </div>
          )}

          {routinePhase === 'error' && (
            <div>
              <div className="error-state">生成に失敗しました（API制限の可能性）</div>
              <button className="btn btn-secondary" onClick={() => setRoutinePhase('idle')}>
                <RotateCcw size={16} /> 再試行
              </button>
            </div>
          )}

          {routinePhase === 'done' && routine && (
            <>
              <RoutineCard
                routine={routine}
                onStartWorkout={() => navigate('/workout')}
              />
              <button className="btn btn-secondary" onClick={generateRoutine}>
                <RotateCcw size={16} /> 再生成
              </button>
            </>
          )}
        </>
      )}

      {/* ── タブ: AIに相談（チャット） ── */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {/* チャット初期状態 */}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 900, color: '#000', margin: '0 auto 12px',
              }}>
                I
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>IRON</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                専属AIパーソナルトレーナー。<br />何でも聞け。
              </div>
              {/* クイックレプライ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                {[
                  '今週の課題を教えてくれ',
                  'タンパク質が不足している',
                  'ベンチが伸び悩んでいる',
                  '増量ペースは正常？',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    style={{
                      background: 'var(--bg-3)', border: '1px solid var(--border)',
                      borderRadius: 99, padding: '8px 14px', fontSize: 13,
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* メッセージ一覧（システムメッセージを除いて表示） */}
          <div style={{ flex: 1 }}>
            {messages
              .filter((m, i) => !(i === 0 && m.role === 'user' && messages[0]?.parts[0]?.text?.startsWith('あなたは「IRON」')))
              .map((m, i) => (
                <Bubble key={i} role={m.role} text={m.parts[0]?.text} />
              ))}

            {chatLoading && <Bubble role="model" isLoading />}
            <div ref={chatEndRef} />
          </div>

          {/* リセット */}
          {messages.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}
              onClick={() => setMessages([])}
            >
              <RotateCcw size={12} /> 会話をリセット
            </button>
          )}
        </div>
      )}

      {/* チャット入力欄（chatタブ時のみ） */}
      {tab === 'chat' && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--nav-height)',
          left: 0, right: 0,
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
        }}>
          <input
            className="input-field"
            style={{ flex: 1, minHeight: 44, padding: '10px 14px', fontSize: 15 }}
            placeholder="例: 今週サボった部位は？"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            className="btn btn-primary"
            style={{ width: 48, minHeight: 44, padding: 0, flexShrink: 0 }}
            onClick={sendMessage}
            disabled={chatLoading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
