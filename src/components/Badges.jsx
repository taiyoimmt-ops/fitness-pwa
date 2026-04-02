export const ALL_BADGES = [
  { id: 'first_blood', name: '初めの一歩', desc: '初めての記録', icon: '👶', color: '#00f2fe' },
  { id: 'streak_3', name: '三日坊主卒業', desc: '3日連続', icon: '🔥', color: '#FF4500' },
  { id: 'streak_7', name: 'ルーティンマスター', desc: '7日連続', icon: '📅', color: '#FF8C00' },
  { id: 'streak_30', name: '鉄の意志', desc: '30日連続', icon: '💎', color: '#b92b27' },
  { id: 'bench_100', name: '100kgクラブ', desc: 'ベンチ100kg', icon: '🦍', color: '#fdf300' },
  { id: 'squat_140', name: '大黒柱', desc: 'スクワット140kg', icon: '🏛️', color: '#39FF14' },
];

export function BadgeItem({ badge, earned = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      opacity: earned ? 1 : 0.35, filter: earned ? 'none' : 'grayscale(0.8)',
      transition: 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)', width: 72, flexShrink: 0
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: earned ? badge.color + '20' : 'var(--bg-tertiary)',
        border: earned ? `1px solid ${badge.color}40` : '1px dashed var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: earned ? `0 4px 12px ${badge.color}30` : 'none',
        fontSize: '26px'
      }}>
        {badge.icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', color: earned ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '-0.01em' }}>
        {badge.name}
      </div>
    </div>
  );
}

export default function BadgesGroup({ earnedBadgeIds = [] }) {
  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>My Achievements 🏆</span>
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 'bold' }}>
          {earnedBadgeIds.length} / {ALL_BADGES.length}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '12px 0 4px 0', scrollbarWidth: 'none' }} className="hide-scroll">
        {ALL_BADGES.map(badge => (
          <BadgeItem key={badge.id} badge={badge} earned={earnedBadgeIds.includes(badge.id)} />
        ))}
      </div>
    </div>
  );
}
