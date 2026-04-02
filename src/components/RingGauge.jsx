// SVGリングゲージコンポーネント
export default function RingGauge({ percent = 0, size = 84, label, sublabel, color = 'var(--accent)', celebrate = false }) {
  const strokeWidth = 5;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(percent, 100);
  const offset = circumference - (clamped / 100) * circumference;
  
  const isGoalReached = percent >= 100;

  return (
    <div className={`ring-wrap ${isGoalReached ? 'ring-celebrate' : ''}`} style={{ width: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        {/* 背景トラック */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-tertiary)"
          strokeWidth={strokeWidth}
        />
        {/* 進捗アーク */}
        <circle
          className="track-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isGoalReached ? 'var(--success)' : color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ 
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </svg>
      
      {/* 中央の数値 */}
      <div style={{ 
        marginTop: -size, 
        height: size, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        pointerEvents: 'none' 
      }}>
        <div style={{ 
          fontSize: 16, 
          fontWeight: 700, 
          color: isGoalReached ? 'var(--success)' : 'var(--text-primary)',
          letterSpacing: '-0.02em'
        }}>
          {Math.round(percent || 0)}<span style={{ fontSize: 10, marginLeft: 1 }}>%</span>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        {label && <div className="ring-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'none' }}>{label}</div>}
        {sublabel && <div className="ring-value" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}
