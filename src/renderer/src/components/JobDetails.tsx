import type { SlurmJob } from '../../../shared/types'

interface JobDetailsProps {
  job: SlurmJob
  logTail: string | null
}

export function JobDetails({ job, logTail }: JobDetailsProps) {
  return (
    <div className="panel details-panel">
      <div className="panel-title">Job Details — {job.name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 12 }}>
        <span>Job ID: <span style={{ color: 'var(--text-primary)' }}>{job.job_id}</span></span>
        <span>Walltime: <span style={{ color: 'var(--text-primary)' }}>{job.time_elapsed} / {job.time_limit}</span></span>
        <span>Nodes: <span style={{ color: 'var(--text-primary)' }}>{job.node_list || 'N/A'}</span></span>
        <span>Memory: <span style={{ color: 'var(--text-primary)' }}>{job.memory_requested}{job.memory_used ? ` (used: ${job.memory_used})` : ''}</span></span>
        <span>Cores: <span style={{ color: 'var(--text-primary)' }}>{job.num_cpus}</span></span>
        <span>Partition: <span style={{ color: 'var(--text-primary)' }}>{job.partition || 'auto'}</span></span>
        {job.exit_code && <span>Exit code: <span style={{ color: 'var(--text-primary)' }}>{job.exit_code}</span></span>}
      </div>
      {job.stdout_path && (
        <>
          <div className="panel-title" style={{ marginTop: 12 }}>Output Log</div>
          <div className="log-output">{logTail ?? 'Loading...'}</div>
        </>
      )}
    </div>
  )
}
