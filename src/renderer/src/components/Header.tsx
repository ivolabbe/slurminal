import type { ConnectionStatus } from '../../../shared/types'

interface HeaderProps {
  title: string
  status: ConnectionStatus
  secondsUntilRefresh: number
  lastUpdated: string | null
  onRefresh: () => void
}

export function Header({ title, status, secondsUntilRefresh, lastUpdated, onRefresh }: HeaderProps) {
  return (
    <div className="titlebar">
      <span>{title}</span>
      <div className="status">
        {lastUpdated && (
          <span className="refresh-timer" onClick={onRefresh} style={{ cursor: 'pointer' }}>
            {secondsUntilRefresh > 0 ? `${secondsUntilRefresh}s` : 'refreshing...'}
          </span>
        )}
        <span className={`status-dot ${status}`} />
        <span>{status}</span>
      </div>
    </div>
  )
}
