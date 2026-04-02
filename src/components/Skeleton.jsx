/**
 * Skeleton Screen コンポーネント群
 * - 通信中の「データの枠組み」を表示してローディング感を排除
 */

/** 汎用スケルトンライン */
export function SkeletonLine({ width = '100%', height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 8, ...style }}
    />
  );
}

/** ダッシュボード用スケルトン */
export function DashboardSkeleton() {
  return (
    <div className="page fade-in">
      {/* ヘッダー */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <SkeletonLine width={60} height={10} style={{ marginBottom: 10, borderRadius: 10, opacity: 0.6 }} />
          <SkeletonLine width={180} height={32} style={{ borderRadius: 12 }} />
        </div>
      </div>

      {/* PFCカード */}
      <div className="card">
        <SkeletonLine width={140} height={13} style={{ marginBottom: 28 }} />
        {[1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <SkeletonLine width={80} height={12} />
              <SkeletonLine width={60} height={12} />
            </div>
            <SkeletonLine width="100%" height={8} style={{ borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* リングゲージカード */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div className="skeleton" style={{ width: 84, height: 84, borderRadius: '50%' }} />
              <SkeletonLine width={60} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
