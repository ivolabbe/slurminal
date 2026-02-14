import type { SlurmJob } from '../../../shared/types'

interface MyJobsProps {
  jobs: SlurmJob[]
  selectedJobId: number | null
  onSelectJob: (jobId: number) => void
}

const STATE_ICONS: Record<string, string> = {
  RUNNING: '\u25B6',
  PENDING: '\u25F7',
  COMPLETED: '\u2713',
  FAILED: '\u2717',
  CANCELLED: '\u2715',
  TIMEOUT: '\u23F0',
}

export function MyJobs({ jobs, selectedJobId, onSelectJob }: MyJobsProps) {
  const stateOrder: Record<string, number> = { RUNNING: 0, PENDING: 1, COMPLETED: 2, FAILED: 3, CANCELLED: 4, TIMEOUT: 5 }
  const sorted = [...jobs].sort((a, b) => (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9))

  return (
    <div className="panel" style={{ gridRow: '1 / 2' }}>
      <div className="panel-title">My Jobs ({jobs.length})</div>
      {sorted.length === 0 && <span style={{ color: 'var(--text-dimmed)' }}>No jobs in queue</span>}
      {sorted.map((job) => (
        <div key={job.job_id} className={`job-row ${selectedJobId === job.job_id ? 'selected' : ''}`}
          onClick={() => onSelectJob(job.job_id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="job-name">{STATE_ICONS[job.state] ?? '?'} {job.name}</span>
            <span className={`state-badge ${job.state}`}>{job.state}</span>
          </div>
          <div className="job-meta">
            {job.num_cpus} core{job.num_cpus > 1 ? 's' : ''}
            {job.node_list ? ` \u00B7 ${job.node_list}` : ''}
            {job.time_elapsed !== '0:00' ? ` \u00B7 ${job.time_elapsed}` : ''}
            {job.state === 'PENDING' && job.reason ? ` \u00B7 ${job.reason}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}
