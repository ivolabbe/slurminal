import { Header } from './components/Header'
import { ClusterOverview } from './components/ClusterOverview'
import { MyJobs } from './components/MyJobs'
import { FairShare } from './components/FairShare'
import { JobDetails } from './components/JobDetails'
import { useSlurm } from './hooks/useSlurm'

function App() {
  const { data, status, config, selectedJobId, logTail, selectJob, refresh, secondsUntilRefresh } = useSlurm()

  const selectedJob = data?.my_jobs.find((j) => j.job_id === selectedJobId) ?? null

  return (
    <div className="app">
      <Header
        title={config?.name ?? 'Slurminal'}
        status={status}
        secondsUntilRefresh={secondsUntilRefresh}
        lastUpdated={data?.last_updated ?? null}
        onRefresh={refresh}
      />
      <div className="panels">
        <ClusterOverview
          nodes={data?.node_summary ?? null}
          topUsers={data?.top_users ?? []}
          currentUser={config?.user ?? ''}
        />
        <MyJobs
          jobs={data?.my_jobs ?? []}
          selectedJobId={selectedJobId}
          onSelectJob={selectJob}
        />
        <FairShare fairShare={data?.fair_share ?? null} />
        <JobDetails job={selectedJob} logTail={logTail} />
      </div>
    </div>
  )
}

export default App
