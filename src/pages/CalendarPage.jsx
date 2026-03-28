import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Dumbbell, Pizza, Weight } from 'lucide-react';
import { api } from '../api/gas.js';
import { haptics } from '../utils/haptics.js';
import { useNavigate } from 'react-router-dom';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDays, setActiveDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyLogs, setDailyLogs] = useState({ meals: [], workouts: [], weight: null });
  const [loading, setLoading] = useState(false);

  // カレンダーの日付生成
  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  useEffect(() => {
    api.getActiveDays().then(setActiveDays);
  }, [currentDate]);

  useEffect(() => {
    setLoading(true);
    api.getDailyLogs(selectedDate).then(logs => {
      setDailyLogs(logs);
      setLoading(false);
    });
  }, [selectedDate]);

  const changeMonth = (offset) => {
    haptics.light();
    const next = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
    setCurrentDate(new Date(next));
  };

  const isToday = (date) => date?.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
  const hasLog = (date) => activeDays.includes(date?.toISOString().split('T')[0]);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">記録カレンダー</h1>
      </div>

      {/* カレンダー UI */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 8px' }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {currentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => changeMonth(-1)}><ChevronLeft/></button>
            <button className="btn btn-ghost" onClick={() => changeMonth(1)}><ChevronRight/></button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, paddingBottom: 8 }}>{d}</div>
          ))}
          {generateCalendar().map((date, i) => {
            const dateStr = date?.toISOString().split('T')[0];
            const isSelected = selectedDate === dateStr;
            return (
              <div 
                key={i} 
                onClick={() => date && (haptics.selection(), setSelectedDate(dateStr))}
                style={{
                  height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12, background: isSelected ? 'var(--accent)' : 'transparent',
                  color: isSelected ? '#000' : (date ? 'var(--text-primary)' : 'transparent'),
                  position: 'relative', cursor: date ? 'pointer' : 'default', fontWeight: isToday(date) ? 900 : 500
                }}
              >
                {date?.getDate()}
                {hasLog(date) && !isSelected && (
                  <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択した日の詳細 */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>{selectedDate.replace(/-/g, '/')} の記録</h2>
          <button className="btn btn-primary" style={{ width: 'auto', minHeight: 36, padding: '0 12px', fontSize: 12 }} onClick={() => navigate('/workout')}>
            <Plus size={14} /> 新規追加
          </button>
        </div>

        {loading ? (
          <div className="spinner-center"><div className="spinner" /></div>
        ) : (
          <>
            {/* 食事 */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                <Pizza size={14}/> MEALS
              </div>
              {dailyLogs.meals.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>記録なし</p> : (
                dailyLogs.meals.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.meal_label}</div>
                    <div style={{ fontSize: 13, color: 'var(--accent)' }}>{m.calories}kcal</div>
                  </div>
                ))
              )}
            </div>

            {/* ワークアウト */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
                <Dumbbell size={14}/> WORKOUTS
              </div>
              {dailyLogs.workouts.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>記録なし</p> : (
                dailyLogs.workouts.map((w, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{w.exercise}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{w.weight_kg}kg × {w.reps}</div>
                  </div>
                ))
              )}
            </div>

            {/* 体重 */}
            {dailyLogs.weight && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Weight size={20} color="var(--text-muted)" />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{dailyLogs.weight.weight_kg}kg</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>体重記録</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
