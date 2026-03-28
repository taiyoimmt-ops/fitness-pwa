import { useState, useRef, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { haptics } from '../utils/haptics.js';

/**
 * iPhone用 Haptic Input
 * 短く押すと1増減、長押しで高速増減。1つ変わるたびに selection フィードバック。
 */
export default function HapticInput({ value, onChange, step = 1, unit = '', label = '' }) {
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const update = (delta) => {
    haptics.selection();
    onChange(Number((Number(value) + delta).toFixed(1)));
  };

  const startAutoUpdate = (delta) => {
    update(delta);
    startTimeRef.current = Date.now();
    let speed = 200; // 初速

    const loop = () => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > 2000) speed = 50; // 2秒以上で加速
      else if (elapsed > 800) speed = 100;

      timerRef.current = setTimeout(() => {
        update(delta);
        loop();
      }, speed);
    };
    loop();
  };

  const stopAutoUpdate = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label className="input-label">{label}</label>}
      <div style={{
        display: 'flex', alignItems: 'center', background: 'var(--bg-3)',
        borderRadius: 16, padding: '4px', gap: 4, height: 60
      }}>
        <button
          className="btn btn-ghost"
          style={{ width: 52, height: 52, padding: 0, borderRadius: 12 }}
          onMouseDown={() => startAutoUpdate(-step)}
          onMouseUp={stopAutoUpdate}
          onMouseLeave={stopAutoUpdate}
          onTouchStart={(e) => { e.preventDefault(); startAutoUpdate(-step); }}
          onTouchEnd={stopAutoUpdate}
        >
          <Minus size={22} />
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: 52, height: 52, padding: 0, borderRadius: 12 }}
          onMouseDown={() => startAutoUpdate(step)}
          onMouseUp={stopAutoUpdate}
          onMouseLeave={stopAutoUpdate}
          onTouchStart={(e) => { e.preventDefault(); startAutoUpdate(step); }}
          onTouchEnd={stopAutoUpdate}
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}
