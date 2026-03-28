import { Trophy, Star, Zap, Flame, Award } from 'lucide-react';

const BADGE_DEFS = {
  'streak_3': { icon: Flame, color: '#FF4500', label: '3日連続', desc: '継続の第一歩' },
  'streak_7': { icon: Flame, color: '#FF8C00', label: '1週間継続', desc: '習慣化の兆し' },
  'volume_100': { icon: Zap, color: '#39FF14', label: '力持ち', desc: '累計100セット達成' },
  'goal_reached': { icon: Trophy, color: '#FFD700', label: '目標達成者', desc: 'いずれかの目標を100%達成' },
  'big3_pro': { icon: Star, color: '#00BFFF', label: 'BIG3信者', desc: 'BIG3全種目を記録' },
};

export function BadgeItem({ type, earned = false }) {
  const badge = BADGE_DEFS[type];
  if (!badge) return null;
  const Icon = badge.icon;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      opacity: earned ? 1 : 0.2,
      filter: earned ? 'none' : 'grayscale(1)',
      transition: 'all 0.3s ease',
      width: 64,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: earned ? 'var(--bg-3)' : 'rgba(255,255,255,0.05)',
        border: earned ? `2px solid ${badge.color}` : '1px dashed var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: earned ? `0 0 15px ${badge.color}44` : 'none',
      }}>
        <Icon size={24} color={earned ? badge.color : '#444'} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, textAlign: 'center', color: earned ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {badge.label}
      </div>
    </div>
  );
}

export default function BadgesGroup({ earnedBadges = [] }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 0' }}>
      {Object.keys(BADGE_DEFS).map(id => (
        <BadgeItem key={id} type={id} earned={earnedBadges.includes(id)} />
      ))}
    </div>
  );
}
