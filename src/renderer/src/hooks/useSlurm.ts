import { useState, useEffect, useCallback, useRef } from 'react'
import type { ClusterData, ConnectionStatus, HpcConfig } from '../../../shared/types'

interface UseSlurmResult {
  data: ClusterData | null
  status: ConnectionStatus
  config: HpcConfig | null
  selectedJobId: number | null
  logTail: string | null
  selectJob: (jobId: number | null) => void
  refresh: () => void
  secondsUntilRefresh: number
}

export function useSlurm(): UseSlurmResult {
  const [data, setData] = useState<ClusterData | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [config, setConfig] = useState<HpcConfig | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [logTail, setLogTail] = useState<string | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    window.ozstar.getConfig().then(setConfig)
    window.ozstar.onClusterData((newData) => {
      setData(newData)
      setSecondsUntilRefresh(30)
    })
    window.ozstar.onConnectionStatus((newStatus) => {
      setStatus(newStatus as ConnectionStatus)
    })
  }, [])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsUntilRefresh((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const selectJob = useCallback(async (jobId: number | null) => {
    setSelectedJobId(jobId)
    setLogTail(null)
    if (jobId && data) {
      const job = data.my_jobs.find((j) => j.job_id === jobId)
      if (job?.stdout_path) {
        try {
          const tail = await window.ozstar.requestLogTail(job.stdout_path)
          setLogTail(tail)
        } catch {
          setLogTail('(could not read log file)')
        }
      }
    }
  }, [data])

  const refresh = useCallback(() => {
    window.ozstar.requestRefresh()
  }, [])

  return { data, status, config, selectedJobId, logTail, selectJob, refresh, secondsUntilRefresh }
}
