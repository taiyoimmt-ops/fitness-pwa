// SVGリングゲージコンポーネント: 100%達成時の祝祭エフェクト付き
export default function RingGauge({ percent = 0, size = 80, label, sublabel, color = '#39FF14', celebrate = false }) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(percent, 100);
  const offset = circumference - (clamped / 100) * circumference;
  
  const isGoalReached = percent >= 100;

  return (
    <div className={`ring-wrap ${isGoalReached ? 'ring-celebrate' : ''}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        {/* 背景トラック */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        {/* 進捗アーク */}
        <circle
          className="track-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isGoalReached ? 'var(--accent)' : color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ 
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: isGoalReached ? 'drop-shadow(0 0 8px var(--accent))' : 'none'
          }}
        />
        
        {/* 100%時の粒子エフェクト（簡易版） */}
        {isGoalReached && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r + 4}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="2, 8"
            className="rotating-ring"
            style={{ animation: 'spin 4s linear infinite' }}
          />
        )}
      </svg>
      
      {/* 中央の％数値 */}
      <div style={{ 
        marginTop: -size, 
        height: size, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        pointerEvents: 'none' 
      }}>
        <span style={{ 
          fontSize: 16, 
          fontWeight: 900, 
          color: isGoalReached ? 'var(--accent)' : 'var(--text-primary)',
          textShadow: isGoalReached ? '0 0 10px rgba(57,255,20,0.5)' : 'none'
        }}>
          {Math.round(percent || 0)}%
        </span>
      </div>

      <div style={{ marginTop: 8, textAlign: 'center' }}>
        {label && <div className="ring-label" style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>}
        {sublabel && <div className="ring-value" style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}
