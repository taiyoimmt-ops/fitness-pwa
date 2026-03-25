import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle } from 'lucide-react';
import { api } from '../api/gas.js';
import { EXERCISES, BODY_PARTS } from '../constants.js';
import { useToast } from '../components/Toast.jsx';

export default function WorkoutPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  // phase: 'part' | 'exercise' | 'sets'
  const [phase, setPhase] = useState('part');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [lastWorkout, setLastWorkout] = useState(null);
  const [sets, setSets] = useState([{ weight: '', reps: '' }]);
  const [saving, setSaving] = useState(false);
  const [heatmap, setHeatmap] = useState({});

  useEffect(() => {
    api.getBodyParts7days().then(setHeatmap).catch(() => {});
  }, []);

  const handlePartSelect = (part) => {
    setSelectedPart(part);
    setPhase('exercise');
  };

  const handleExerciseSelect = async (exercise) => {
    setSelectedExercise(exercise);
    try {
      const last = await api.getLastWorkout(exercise);
      setLastWorkout(last?.exists ? last : null);
      setSets([{
        weight: last?.exists ? (last.weight_kg + 2.5).toString() : '',
        reps: last?.exists ? (last.reps + 1).toString() : '',
      }]);
    } catch {
      setSets([{ weight: '', reps: '' }]);
    }
    setPhase('sets');
  };

  const addSet = () => setSets([...sets, { weight: sets[sets.length - 1]?.weight || '', reps: '' }]);
  const removeSet = (i) => setSets(sets.filter((_, idx) => idx !== i));
  const updateSet = (i, field, value) => {
    const next = [...sets];
    next[i] = { ...next[i], [field]: value };
    setSets(next);
  };

  const handleSave = async () => {
    const validSets = sets.filter((s) => s.weight && s.reps);
    if (validSets.length === 0) return showToast('⚠️ セットを入力してください', 'error');
    setSaving(true);
    try {
      await api.addWorkout(
        validSets.map((s, i) => ({
          exercise: selectedExercise,
          body_part: selectedPart,
          set_number: i + 1,
          weight_kg: Number(s.weight),
          reps: Number(s.reps),
        }))
      );
      showToast(`✅ ${validSets.length}セットを記録しました！`);
      navigate('/');
    } catch (e) {
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ヒートマップの色クラスを計算
  const heatClass = (count) => {
    if (count === 0) return 'level-0';
    if (count <= 5) return 'level-1';
    if (count <= 10) return 'level-2';
    return 'level-3';
  };

  // 直近7日で3日以上未刺激かどうか
  const isStalePart = (part) => {
    const counts = Object.values(heatmap).map((day) => day[part] || 0);
    const last3days = counts.slice(-3);
    return last3days.every((c) => c === 0);
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => phase === 'part' ? navigate('/') : setPhase(phase === 'sets' ? 'exercise' : 'part')} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">
          {phase === 'part' ? 'トレーニング' : phase === 'exercise' ? selectedPart : selectedExercise}
        </h1>
      </div>

      {/* 部位選択 */}
      {phase === 'part' && (
        <>
          {/* ヒートマップ */}
          {Object.keys(heatmap).length > 0 && (
            <div className="card">
              <div className="card-title">直近7日 部位別刺激</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 8px', alignItems: 'center' }}>
                {BODY_PARTS.map((part) => {
                  const days = Object.keys(heatmap).sort();
                  const stale = isStalePart(part);
                  return (
                    <>
                      <div key={part + '-label'} style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', gridColumn: 1 }}>
                        {stale ? '🔴' : ''}{part}
                      </div>
                      <div key={part + '-cells'} style={{ display: 'flex', gap: 4, gridColumn: 2 }}>
                        {days.map((d) => {
                          const count = heatmap[d]?.[part] || 0;
                          return (
                            <div
                              key={d}
                              className={`heatmap-cell ${heatClass(count)} ${stale ? 'stale' : ''}`}
                              style={{ flex: 1, fontSize: 10 }}
                              title={`${d} ${part}: ${count}セット`}
                            >
                              {count || ''}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>🔴 3日以上未刺激</span>
                <span>■ 1-5 / ■ 6-10 / ■ 11+</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {BODY_PARTS.map((part) => (
              <button
                key={part}
                className="btn btn-secondary"
                style={{ fontSize: 18, minHeight: 64, position: 'relative', borderColor: isStalePart(part) ? 'rgba(255,68,68,0.4)' : undefined }}
                onClick={() => handlePartSelect(part)}
              >
                {part}
                {isStalePart(part) && (
                  <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 10, color: 'var(--red)' }}>
                    未刺激
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 種目選択 */}
      {phase === 'exercise' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(EXERCISES[selectedPart] || []).map((ex) => (
            <button
              key={ex}
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', fontSize: 16 }}
              onClick={() => handleExerciseSelect(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* セット入力 */}
      {phase === 'sets' && (
        <>
          {lastWorkout && (
            <div className="card" style={{ background: 'var(--accent-dim2)', borderColor: 'rgba(57,255,20,0.15)' }}>
              <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>📋 前回記録</div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                {lastWorkout.weight_kg}kg × {lastWorkout.reps}rep
                <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                  ({lastWorkout.timestamp?.slice(0, 10)})
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                → 今回の目標: {lastWorkout.weight_kg + 2.5}kg × {lastWorkout.reps + 1}rep
              </div>
            </div>
          )}

          {sets.map((s, i) => (
            <div key={i} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Set {i + 1}</span>
                {sets.length > 1 && (
                  <button className="btn btn-ghost" onClick={() => removeSet(i)} style={{ color: 'var(--red)', padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="num-input-row">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">重量 (kg)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.5"
                    placeholder={lastWorkout ? `${lastWorkout.weight_kg + 2.5}` : '0'}
                    value={s.weight}
                    onChange={(e) => updateSet(i, 'weight', e.target.value)}
                    style={{ fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">回数</label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder={lastWorkout ? `${lastWorkout.reps + 1}` : '0'}
                    value={s.reps}
                    onChange={(e) => updateSet(i, 'reps', e.target.value)}
                    style={{ fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                  />
                </div>
              </div>
              {s.weight && s.reps && (
                <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Volume: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {(Number(s.weight) * Number(s.reps)).toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          ))}

          <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={addSet}>
            <Plus size={18} /> セットを追加
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <CheckCircle size={20} />
            {saving ? '保存中...' : 'トレーニングを保存'}
          </button>
        </>
      )}
    </div>
  );
}
