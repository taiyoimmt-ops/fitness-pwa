import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Timer, Play, RotateCcw } from 'lucide-react';
import { api } from '../api/supabase.js';
import { EXERCISES, BODY_PARTS } from '../constants.js';
import { useToast } from '../components/Toast.jsx';
import { haptics } from '../utils/haptics.js';
import HapticInput from '../components/HapticInput.jsx';

/**
 * 休憩タイマーコンポーネント
 */
function IntervalTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [target, setTarget] = useState(60);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      clearInterval(timerRef.current);
      setIsActive(false);
      haptics.error(); // 終了時に強く3回振動
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, seconds]);

  const start = () => {
    haptics.medium();
    setSeconds(target);
    setIsActive(true);
  };

  const reset = () => {
    haptics.light();
    setIsActive(false);
    setSeconds(0);
  };

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: isActive ? 'var(--accent-dim)' : 'var(--bg-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Timer size={20} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
        {isActive ? (
          <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace', color: 'var(--accent)' }}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {[60, 90, 180].map(t => (
              <button key={t} onClick={() => { haptics.selection(); setTarget(t); }} style={{ 
                padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: target === t ? 'var(--accent)' : 'var(--bg-card)',
                color: target === t ? '#000' : 'var(--text-secondary)'
              }}>
                {t}s
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {isActive ? (
          <button className="btn btn-ghost" onClick={reset}><RotateCcw size={18}/></button>
        ) : (
          <button className="btn btn-primary" style={{ width: 'auto', minHeight: 36, padding: '0 16px', borderRadius: 8 }} onClick={start}>
            <Play size={16} /> START
          </button>
        )}
      </div>
    </div>
  );
}

export default function WorkoutPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  const [phase, setPhase] = useState('part');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [lastWorkout, setLastWorkout] = useState(null);
  const [sets, setSets] = useState([{ weight: 0, reps: 0 }]);
  const [saving, setSaving] = useState(false);

  const handleExerciseSelect = async (ex) => {
    haptics.medium();
    setSelectedExercise(ex);
    try {
      const last = await api.getLastWorkout(ex);
      setLastWorkout(last?.exists ? last : null);
      setSets([{
        weight: last?.exists ? last.weight_kg : 0,
        reps: last?.exists ? last.reps : 0,
      }]);
    } catch {
      setSets([{ weight: 0, reps: 0 }]);
    }
    setPhase('sets');
  };

  const handleSave = async () => {
    haptics.medium();
    setSaving(true);
    try {
      await api.addWorkout(sets.map((s, i) => ({
        exercise: selectedExercise,
        body_part: selectedPart,
        set_number: i + 1,
        weight_kg: Number(s.weight),
        reps: Number(s.reps),
      })));
      haptics.success();
      showToast('✅ トレーニングを保存しました！');
      navigate('/');
    } catch (e) {
      haptics.error();
      showToast('⚠️ ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => { haptics.light(); phase === 'part' ? navigate('/') : setPhase('part'); }} style={{ padding: 8 }}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="page-title">{phase === 'part' ? '筋トレ' : selectedExercise}</h1>
      </div>

      {phase === 'part' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {BODY_PARTS.map(p => (
            <button key={p} className="btn btn-secondary" style={{ fontSize: 18, minHeight: 80 }} onClick={() => { haptics.light(); setSelectedPart(p); setPhase('exercise'); }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {phase === 'exercise' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(EXERCISES[selectedPart] || []).map(ex => (
            <button key={ex} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => handleExerciseSelect(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {phase === 'sets' && (
        <div className="fade-in">
          <IntervalTimer />
          
          {sets.map((s, i) => (
            <div key={i} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 900, color: 'var(--accent)' }}>SET {i + 1}</span>
                {sets.length > 1 && <button className="btn btn-ghost" onClick={() => { haptics.light(); setSets(sets.filter((_, idx)=>idx!==i)) }}><Trash2 size={16}/></button>}
              </div>
              <HapticInput label="重量" value={s.weight} unit="kg" step={2.5} onChange={(v) => { const n = [...sets]; n[i].weight = v; setSets(n); }} />
              <HapticInput label="回数" value={s.reps} unit="rep" step={1} onChange={(v) => { const n = [...sets]; n[i].reps = v; setSets(n); }} />
            </div>
          ))}

          <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={() => { haptics.light(); setSets([...sets, {...sets[sets.length-1]}]) }}>
            <Plus size={18} /> セットを追加
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            確定して保存
          </button>
        </div>
      )}
    </div>
  );
}
