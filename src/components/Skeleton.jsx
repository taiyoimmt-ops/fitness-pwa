/**
 * Skeleton Screen コンポーネント群
 * - 通信中の「データの枠組み」を表示してローディング感を排除
 */

/** 汎用スケルトンライン */
export function SkeletonLine({ width = '100%', height = 16, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: 6, ...style }}
    />
  );
}

/** ダッシュボード用スケルトン */
export function DashboardSkeleton() {
  return (
    <div className="page fade-in">
      {/* ヘッダー */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <SkeletonLine width={80} height={12} style={{ marginBottom: 6 }} />
          <SkeletonLine width={140} height={24} />
        </div>
      </div>

      {/* PFCカード */}
      <div className="card">
        <SkeletonLine width={100} height={14} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <SkeletonLine width={60} height={12} />
              <SkeletonLine width={100} height={12} />
            </div>
            <SkeletonLine width="100%" height={8} style={{ borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* リングゲージカード */}
      <div className="card">
        <SkeletonLine width={80} height={14} style={{ marginBottom: 20 }} />
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div className="skeleton" style={{ width: 76, height: 76, borderRadius: '50%' }} />
              <SkeletonLine width={48} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
