import { useState, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { haptics } from '../utils/haptics.js';

/**
 * iPhone用 Pull-to-Refresh
 * スワイプでデータを再読込
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pulled, setPulled] = useState(0); // 0 to 100

  const THRESHOLD = 100;

  const handleTouchStart = (e) => {
    // スクロール一番上のみ有効
    if (window.scrollY > 0) return;
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (window.scrollY > 0 || startY === 0) return;
    const y = e.touches[0].clientY;
    const diff = y - startY;
    if (diff > 0) {
      // 抵抗感のある数式
      const p = Math.min(diff / 2.5, THRESHOLD + 20);
      setPulled(p);
      if (p >= THRESHOLD && pulled < THRESHOLD) {
        haptics.light(); // しきい値を超えたら一瞬振動
      }
    }
  };

  const handleTouchEnd = useCallback(async () => {
    if (pulled >= THRESHOLD) {
      setRefreshing(true);
      haptics.medium();
      try {
        await onRefresh();
        haptics.success();
      } finally {
        setRefreshing(false);
        setPulled(0);
        setStartY(0);
      }
    } else {
      setPulled(0);
      setStartY(0);
    }
  }, [pulled, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        height: pulled > 0 || refreshing ? 60 : 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: refreshing ? 'none' : 'height 0.2s ease',
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 5,
      }}>
        <div style={{
          transform: `rotate(${pulled * 3.6}deg)`,
          opacity: Math.min(pulled / THRESHOLD, 1),
          color: 'var(--accent)',
          animation: refreshing ? 'spin 1s linear infinite' : 'none'
        }}>
          <RefreshCw size={24} />
        </div>
      </div>
      <div style={{
        transform: !refreshing && pulled > 0 ? `translateY(${pulled * 0.3}px)` : 'none',
        transition: !refreshing && pulled === 0 ? 'transform 0.3s cubic-bezier(0.17, 0.67, 0.83, 0.67)' : 'none'
      }}>
        {children}
      </div>
    </div>
  );
}
