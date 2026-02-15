import type { QuotaInfo, FilesystemQuota } from '../../../shared/types'

interface QuotaProps {
  quota: QuotaInfo | null
}

function barColor(pct: number): string {
  if (pct > 95) return 'red'
  if (pct > 80) return 'amber'
  return 'green'
}

function fmtPct(pct: number): string {
  const s = pct.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

function QuotaBar({ label, used, limit, pct }: { label: string; used: string; limit: string; pct: number }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{used} / {limit} ({fmtPct(pct)}%)</span>
      </div>
      <div className="bar-container">
        <div className={`bar-fill ${barColor(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function FilesystemEntry({ fs }: { fs: FilesystemQuota }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        <span>{fs.owner}</span>
        <span style={{ color: 'var(--text-dimmed)' }}> on </span>
        <span>{fs.filesystem}</span>
        {fs.over_quota && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>{'\u26A0'}</span>}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <QuotaBar label="Disk" used={fs.space_used} limit={fs.space_limit} pct={fs.space_pct} />
        <QuotaBar label="Files" used={fs.files_used} limit={fs.files_limit} pct={fs.files_pct} />
      </div>
    </div>
  )
}

export function Quota({ quota }: QuotaProps) {
  if (!quota) return (
    <div className="panel quota-panel">
      <div className="panel-title">Disk Quota</div>
      <span style={{ color: 'var(--text-dimmed)' }}>Waiting for data...</span>
    </div>
  )

  if (quota.filesystems.length === 0) return (
    <div className="panel quota-panel">
      <div className="panel-title">Disk Quota</div>
      <span style={{ color: 'var(--text-dimmed)' }}>No quotas found</span>
    </div>
  )

  return (
    <div className="panel quota-panel">
      <div className="panel-title">Disk Quota</div>
      {quota.filesystems.map((fs) => (
        <FilesystemEntry key={fs.filesystem} fs={fs} />
      ))}
    </div>
  )
}
