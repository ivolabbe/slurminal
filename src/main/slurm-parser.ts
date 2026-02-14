/**
 * Parsers for SLURM JSON output from OzStar (Ngarrgu Tindebeek).
 *
 * Each function takes the raw parsed JSON from the corresponding
 * SLURM command and returns a typed result.
 */

import type { SlurmJob, NodeSummary, TopUser, FairShareInfo } from '../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract `.number` from a SLURM `{set, infinite, number}` object. */
function num(obj: { set?: boolean; infinite?: boolean; number?: number } | undefined): number {
  return obj?.number ?? 0
}

/** Format seconds into "H:MM:SS". */
function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Format minutes into a human-readable time limit string. */
function formatTimeLimit(minutes: number): string {
  if (minutes <= 0) return 'N/A'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}-${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
  return `${hours}:${String(mins).padStart(2, '0')}:00`
}

/** Convert epoch seconds to ISO string, or "N/A" if zero / missing. */
function epochToISO(epoch: number): string {
  if (!epoch || epoch <= 0) return 'N/A'
  return new Date(epoch * 1000).toISOString()
}

/** Format megabytes into a human-readable string (e.g. "128.0 GB"). */
function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(0)} MB`
}

// ---------------------------------------------------------------------------
// parseMyJobs
// ---------------------------------------------------------------------------

/**
 * Parse the user's jobs from `squeue --json` output, optionally enriching
 * completed/historical jobs from `sacct --json` output.
 */
export function parseMyJobs(
  squeueJson: Record<string, unknown>,
  sacctJson?: Record<string, unknown>
): SlurmJob[] {
  const jobs: SlurmJob[] = []

  // --- squeue (running / pending) ---
  const squeueJobs = (squeueJson?.jobs ?? []) as Record<string, unknown>[]
  for (const j of squeueJobs) {
    const cpus = num(j.cpus as { number?: number })
    const memPerCpuMB = num(j.memory_per_cpu as { number?: number })
    const totalMemMB = memPerCpuMB * cpus

    const submitEpoch = num(j.submit_time as { number?: number })
    const startEpoch = num(j.start_time as { number?: number })
    const timeLimitMin = num(j.time_limit as { number?: number })

    // Elapsed = now - start for running jobs
    let elapsedSec = 0
    if (startEpoch > 0) {
      elapsedSec = Math.max(0, Math.floor(Date.now() / 1000) - startEpoch)
    }

    jobs.push({
      job_id: j.job_id as number,
      name: j.name as string,
      user: j.user_name as string,
      state: ((j.job_state as string[]) ?? ['UNKNOWN'])[0],
      partition: j.partition as string,
      num_cpus: cpus,
      num_nodes: num(j.node_count as { number?: number }),
      node_list: (j.nodes as string) || '',
      time_elapsed: formatElapsed(elapsedSec),
      time_limit: formatTimeLimit(timeLimitMin),
      submit_time: epochToISO(submitEpoch),
      start_time: epochToISO(startEpoch),
      reason: (j.state_reason as string) || 'None',
      stdout_path: (j.standard_output as string) || '',
      memory_requested: formatMB(totalMemMB),
    })
  }

  // --- sacct (completed / failed / cancelled) ---
  if (sacctJson) {
    const sacctJobs = (sacctJson?.jobs ?? []) as Record<string, unknown>[]
    // Collect squeue job IDs to avoid duplicates
    const squeueIds = new Set(jobs.map((j) => j.job_id))

    for (const j of sacctJobs) {
      const jobId = j.job_id as number
      if (squeueIds.has(jobId)) continue

      const stateObj = j.state as { current?: string[]; reason?: string }
      const state = (stateObj?.current ?? ['UNKNOWN'])[0]

      const timeObj = j.time as Record<string, unknown>
      const elapsedSec = (timeObj?.elapsed as number) ?? 0
      const submitEpoch = (timeObj?.submission as number) ?? 0
      const startEpoch = (timeObj?.start as number) ?? 0
      const timeLimitMin = num(timeObj?.limit as { number?: number })

      const assoc = j.association as { user?: string; account?: string }
      const exitCodeObj = j.exit_code as {
        return_code?: { number?: number }
        status?: string[]
      }
      const returnCode = num(exitCodeObj?.return_code)

      // Extract CPU count and memory from tres
      let numCpus = j.allocation_nodes as number
      let memMB = 0
      const tres = j.tres as {
        allocated?: { type: string; count: number }[]
        requested?: { type: string; count: number }[]
      }
      if (tres?.allocated) {
        const cpuEntry = tres.allocated.find((t) => t.type === 'cpu')
        if (cpuEntry) numCpus = cpuEntry.count
      }
      if (tres?.requested) {
        const memEntry = tres.requested.find((t) => t.type === 'mem')
        if (memEntry) memMB = memEntry.count
      }

      const partition = j.partition as string

      jobs.push({
        job_id: jobId,
        name: j.name as string,
        user: assoc?.user ?? '',
        state,
        partition: partition || '',
        num_cpus: numCpus,
        num_nodes: j.allocation_nodes as number,
        node_list: (j.nodes as string) || '',
        time_elapsed: formatElapsed(elapsedSec),
        time_limit: formatTimeLimit(timeLimitMin),
        submit_time: epochToISO(submitEpoch),
        start_time: epochToISO(startEpoch),
        reason: stateObj?.reason ?? 'None',
        stdout_path: '',
        memory_requested: formatMB(memMB),
        exit_code: `${returnCode}`,
      })
    }
  }

  return jobs
}

// ---------------------------------------------------------------------------
// parseNodeSummary
// ---------------------------------------------------------------------------

/**
 * Parse `sinfo --json` output into a cluster-wide NodeSummary.
 *
 * sinfo entries may contain overlapping nodes (same node listed in
 * multiple partition/feature groups). We deduplicate by node hostname
 * and classify each unique node once.
 */
export function parseNodeSummary(sinfoJson: Record<string, unknown>): NodeSummary {
  const entries = (sinfoJson?.sinfo ?? []) as {
    node: { state: string[] }
    nodes: { allocated: number; idle: number; other: number; total: number; nodes: string[] }
    cpus: { allocated: number; idle: number; other: number; total: number }
  }[]

  // Track each unique node: its state and per-node CPU breakdown
  const nodeState: Record<string, string[]> = {}
  const nodeCpus: Record<string, { allocated: number; idle: number; total: number }> = {}

  for (const entry of entries) {
    const nodeNames = entry.nodes.nodes ?? []
    const nNodes = nodeNames.length
    if (nNodes === 0) continue

    const cpuPerNode = Math.floor(entry.cpus.total / nNodes)
    const allocPerNode = Math.floor(entry.cpus.allocated / nNodes)
    const idlePerNode = Math.floor(entry.cpus.idle / nNodes)

    for (const name of nodeNames) {
      if (!(name in nodeState)) {
        nodeState[name] = entry.node.state
        nodeCpus[name] = { allocated: allocPerNode, idle: idlePerNode, total: cpuPerNode }
      }
    }
  }

  let allocatedNodes = 0
  let idleNodes = 0
  let downNodes = 0
  let mixedNodes = 0

  for (const states of Object.values(nodeState)) {
    if (states.includes('DOWN') || states.includes('DRAIN')) {
      downNodes++
    } else if (states.includes('ALLOCATED')) {
      allocatedNodes++
    } else if (states.includes('MIXED')) {
      mixedNodes++
    } else if (states.includes('IDLE')) {
      idleNodes++
    }
  }

  const totalNodes = Object.keys(nodeState).length
  const totalCpus = Object.values(nodeCpus).reduce((s, c) => s + c.total, 0)
  const allocatedCpus = Object.values(nodeCpus).reduce((s, c) => s + c.allocated, 0)
  const idleCpus = Object.values(nodeCpus).reduce((s, c) => s + c.idle, 0)

  return {
    total_nodes: totalNodes,
    allocated_nodes: allocatedNodes,
    idle_nodes: idleNodes,
    down_nodes: downNodes,
    mixed_nodes: mixedNodes,
    total_cpus: totalCpus,
    allocated_cpus: allocatedCpus,
    idle_cpus: idleCpus,
  }
}

// ---------------------------------------------------------------------------
// parseTopUsers
// ---------------------------------------------------------------------------

/**
 * Parse `squeue --all --json` output to rank users by number of
 * allocated cores (RUNNING jobs only), sorted descending.
 */
export function parseTopUsers(squeueAllJson: Record<string, unknown>): TopUser[] {
  const allJobs = (squeueAllJson?.jobs ?? []) as {
    user_name: string
    job_state: string[]
    cpus: { number: number }
  }[]

  const coresByUser: Record<string, number> = {}
  for (const j of allJobs) {
    if (j.job_state[0] !== 'RUNNING') continue
    const user = j.user_name
    coresByUser[user] = (coresByUser[user] ?? 0) + j.cpus.number
  }

  return Object.entries(coresByUser)
    .map(([user, core_count]) => ({ user, core_count }))
    .sort((a, b) => b.core_count - a.core_count)
}

// ---------------------------------------------------------------------------
// parseFairShare
// ---------------------------------------------------------------------------

/**
 * Parse `sshare --json` output for a specific user (default "ilabbe").
 */
export function parseFairShare(
  sshareJson: Record<string, unknown>,
  targetUser = 'ilabbe'
): FairShareInfo {
  const shares = ((sshareJson?.shares as Record<string, unknown>)?.shares ?? []) as {
    name: string
    fairshare: { factor: { number: number } }
    effective_usage: { number: number }
    shares: { number: number }
    usage_normalized: { number: number }
  }[]

  const entry = shares.find((s) => s.name === targetUser)
  if (!entry) {
    return { user: targetUser, raw_shares: 0, effective_usage: 0, fair_share_factor: 0 }
  }

  return {
    user: targetUser,
    raw_shares: num(entry.shares),
    effective_usage: num(entry.effective_usage),
    fair_share_factor: num(entry.fairshare?.factor),
  }
}
