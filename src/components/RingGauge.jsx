// SVGリングゲージコンポーネント
export default function RingGauge({ percent, size = 80, label, sublabel, color = '#39FF14' }) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(percent, 100);
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={percent > 100 ? '#FF4444' : color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
        />
        {/* テキスト（回転を戻す） */}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={percent > 100 ? '#FF4444' : color}
          fontSize="14"
          fontWeight="800"
          fontFamily="Inter, sans-serif"
          style={{ transform: `rotate(90deg) translate(0, -${size}px)` }}
        />
      </svg>
      {/* テキストはSVG外に出してシンプルに */}
      <div style={{ marginTop: -size - 4, height: size, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: percent > 100 ? '#FF4444' : color }}>
          {Math.round(percent)}%
        </span>
      </div>
      {label && <div className="ring-label">{label}</div>}
      {sublabel && <div className="ring-value">{sublabel}</div>}
    </div>
  );
}
