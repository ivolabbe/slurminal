/** Shared type definitions for OzStar Monitor */

export interface SlurmJob {
  job_id: number
  name: string
  user: string
  state: 'RUNNING' | 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT' | 'OUT_OF_MEMORY' | string
  partition: string
  num_cpus: number
  num_nodes: number
  node_list: string
  time_elapsed: string
  time_limit: string
  submit_time: string
  start_time: string
  reason: string
  stdout_path: string
  memory_requested: string
  memory_used?: string
  exit_code?: string
}

export interface NodeSummary {
  total_nodes: number
  allocated_nodes: number
  idle_nodes: number
  down_nodes: number
  mixed_nodes: number
  total_cpus: number
  allocated_cpus: number
  idle_cpus: number
}

export interface TopUser {
  user: string
  core_count: number
}

export interface FairShareInfo {
  user: string
  raw_shares: number
  effective_usage: number
  fair_share_factor: number
}

export interface FilesystemQuota {
  filesystem: string
  owner: string
  space_used: string
  space_limit: string
  space_pct: number
  files_used: string
  files_limit: string
  files_pct: number
  over_quota: boolean
}

export interface QuotaInfo {
  filesystems: FilesystemQuota[]
}

export interface ClusterData {
  my_jobs: SlurmJob[]
  node_summary: NodeSummary
  top_users: TopUser[]
  fair_share: FairShareInfo
  quota: QuotaInfo
  last_updated: string
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export interface HpcConfig {
  host: string
  user: string
  name: string
}

export const IPC_CHANNELS = {
  CLUSTER_DATA: 'cluster:data',
  CONNECTION_STATUS: 'cluster:status',
  REQUEST_REFRESH: 'cluster:refresh',
  REQUEST_LOG_TAIL: 'cluster:log-tail',
  LOG_TAIL_RESULT: 'cluster:log-tail-result',
  GET_CONFIG: 'cluster:get-config',
} as const
