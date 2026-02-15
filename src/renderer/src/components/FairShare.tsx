import type { FairShareInfo } from '../../../shared/types'

interface FairShareProps {
  fairShare: FairShareInfo | null
}

export function FairShare({ fairShare }: FairShareProps) {
  if (!fairShare) return (
    <div className="panel fairshare-panel"><div className="panel-title">Fair-Share</div>
    <span style={{ color: 'var(--text-dimmed)' }}>Waiting for data...</span></div>
  )

  const factor = fairShare.fair_share_factor
  const isOver = factor < 0.5
  const color = isOver ? 'amber' : 'green'
  const pct = factor * 100

  return (
    <div className="panel fairshare-panel">
      <div className="panel-title">Fair-Share</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>Your priority factor: {factor.toFixed(3)}</span>
        <span style={{ color: 'var(--text-secondary)' }}>Cluster avg: 0.500</span>
      </div>
      <div className="bar-container">
        <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {isOver && (
        <div style={{ color: 'var(--amber)', fontSize: 12, marginTop: 6 }}>
          {'\u26A0'} Over fair-share — your jobs may be deprioritized
        </div>
      )}
    </div>
  )
}
