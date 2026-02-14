import type { NodeSummary, TopUser } from '../../../shared/types'

interface ClusterOverviewProps {
  nodes: NodeSummary | null
  topUsers: TopUser[]
}

function UtilBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? (used / total) * 100 : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{used.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="bar-container">
        <div className={`bar-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ClusterOverview({ nodes, topUsers }: ClusterOverviewProps) {
  if (!nodes) return (
    <div className="panel"><div className="panel-title">Cluster Overview</div>
    <span style={{ color: 'var(--text-dimmed)' }}>Waiting for data...</span></div>
  )

  const busyNodes = nodes.allocated_nodes + nodes.mixed_nodes
  const nodeColor = busyNodes / nodes.total_nodes > 0.9 ? 'red' : busyNodes / nodes.total_nodes > 0.7 ? 'amber' : 'green'
  const cpuColor = nodes.allocated_cpus / nodes.total_cpus > 0.9 ? 'red' : nodes.allocated_cpus / nodes.total_cpus > 0.7 ? 'amber' : 'green'

  return (
    <div className="panel" style={{ gridRow: '1 / 2' }}>
      <div className="panel-title">Cluster Overview</div>
      <UtilBar label="Nodes" used={busyNodes} total={nodes.total_nodes} color={nodeColor} />
      <UtilBar label="Cores" used={nodes.allocated_cpus} total={nodes.total_cpus} color={cpuColor} />
      {nodes.down_nodes > 0 && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>
          {nodes.down_nodes} node{nodes.down_nodes > 1 ? 's' : ''} down
        </div>
      )}
      <div className="panel-title" style={{ marginTop: 16 }}>Top Users</div>
      {topUsers.slice(0, 10).map((u) => (
        <div key={u.user} className={`user-row ${u.user === 'ilabbe' ? 'me' : ''}`}>
          <span>{u.user}</span>
          <span>{u.core_count.toLocaleString()} cores</span>
        </div>
      ))}
    </div>
  )
}
