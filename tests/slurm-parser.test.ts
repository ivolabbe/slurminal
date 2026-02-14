import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseMyJobs, parseNodeSummary, parseTopUsers, parseFairShare } from '../src/main/slurm-parser'

/** Load a fixture file from tests/fixtures/. */
function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
  return JSON.parse(raw)
}

const squeueJson = loadFixture('squeue.json')
const squeueAllJson = loadFixture('squeue-all.json')
const sinfoJson = loadFixture('sinfo.json')
const sshareJson = loadFixture('sshare.json')
const sacctJson = loadFixture('sacct.json')

// ---------------------------------------------------------------------------
// parseMyJobs
// ---------------------------------------------------------------------------

describe('parseMyJobs', () => {
  it('returns SlurmJob[] from squeue fixture', () => {
    const jobs = parseMyJobs(squeueJson)
    expect(Array.isArray(jobs)).toBe(true)
    expect(jobs.length).toBeGreaterThan(0)
  })

  it('jobs have correct types for all fields', () => {
    const jobs = parseMyJobs(squeueJson)
    for (const j of jobs) {
      expect(typeof j.job_id).toBe('number')
      expect(typeof j.name).toBe('string')
      expect(typeof j.user).toBe('string')
      expect(typeof j.state).toBe('string')
      expect(typeof j.partition).toBe('string')
      expect(typeof j.num_cpus).toBe('number')
      expect(typeof j.num_nodes).toBe('number')
      expect(typeof j.node_list).toBe('string')
      expect(typeof j.time_elapsed).toBe('string')
      expect(typeof j.time_limit).toBe('string')
      expect(typeof j.submit_time).toBe('string')
      expect(typeof j.start_time).toBe('string')
      expect(typeof j.reason).toBe('string')
      expect(typeof j.stdout_path).toBe('string')
      expect(typeof j.memory_requested).toBe('string')
    }
  })

  it('parses known job fields correctly', () => {
    const jobs = parseMyJobs(squeueJson)
    const j = jobs.find((j) => j.job_id === 9685110)
    expect(j).toBeDefined()
    expect(j!.name).toBe('se_v1')
    expect(j!.user).toBe('ilabbe')
    expect(j!.state).toBe('RUNNING')
    expect(j!.partition).toBe('milan')
    expect(j!.num_cpus).toBe(768)
    expect(j!.num_nodes).toBe(12)
    expect(j!.node_list).toContain('dave')
    expect(j!.time_limit).toBe('12:00:00')
    expect(j!.stdout_path).toContain('superedd')
    expect(j!.memory_requested).toBe('1536.0 GB')
  })

  it('enriches with sacct data without duplicating squeue jobs', () => {
    const jobs = parseMyJobs(squeueJson, sacctJson)
    // Should have squeue jobs + sacct jobs (minus any overlapping IDs)
    expect(jobs.length).toBeGreaterThan(2)

    // Check a sacct-only job exists
    const sacctJob = jobs.find((j) => j.job_id === 9641651)
    expect(sacctJob).toBeDefined()
    expect(sacctJob!.state).toBe('COMPLETED')
    expect(sacctJob!.user).toBe('ilabbe')
    expect(sacctJob!.exit_code).toBe('0')
  })

  it('formats time_elapsed correctly for sacct jobs', () => {
    const jobs = parseMyJobs(squeueJson, sacctJson)
    // Job 9641651 has elapsed=8 seconds
    const j = jobs.find((j) => j.job_id === 9641651)
    expect(j!.time_elapsed).toBe('0:00:08')
  })
})

// ---------------------------------------------------------------------------
// parseNodeSummary
// ---------------------------------------------------------------------------

describe('parseNodeSummary', () => {
  it('returns NodeSummary with total_nodes > 0', () => {
    const summary = parseNodeSummary(sinfoJson)
    expect(summary.total_nodes).toBeGreaterThan(0)
  })

  it('has correct structure', () => {
    const summary = parseNodeSummary(sinfoJson)
    expect(typeof summary.total_nodes).toBe('number')
    expect(typeof summary.allocated_nodes).toBe('number')
    expect(typeof summary.idle_nodes).toBe('number')
    expect(typeof summary.down_nodes).toBe('number')
    expect(typeof summary.mixed_nodes).toBe('number')
    expect(typeof summary.total_cpus).toBe('number')
    expect(typeof summary.allocated_cpus).toBe('number')
    expect(typeof summary.idle_cpus).toBe('number')
  })

  it('node counts sum to total (approximately)', () => {
    const s = parseNodeSummary(sinfoJson)
    const sumNodes = s.allocated_nodes + s.idle_nodes + s.down_nodes + s.mixed_nodes
    expect(sumNodes).toBe(s.total_nodes)
  })

  it('deduplicates overlapping nodes from sinfo entries', () => {
    const s = parseNodeSummary(sinfoJson)
    // The fixture has 462 total node mentions but only 322 unique nodes
    expect(s.total_nodes).toBe(322)
  })

  it('has reasonable CPU counts', () => {
    const s = parseNodeSummary(sinfoJson)
    expect(s.total_cpus).toBeGreaterThan(0)
    expect(s.allocated_cpus).toBeGreaterThan(0)
    expect(s.idle_cpus).toBeGreaterThanOrEqual(0)
    expect(s.allocated_cpus + s.idle_cpus).toBeLessThanOrEqual(s.total_cpus)
  })
})

// ---------------------------------------------------------------------------
// parseTopUsers
// ---------------------------------------------------------------------------

describe('parseTopUsers', () => {
  it('returns an array', () => {
    const users = parseTopUsers(squeueAllJson)
    expect(Array.isArray(users)).toBe(true)
  })

  it('is sorted descending by core_count', () => {
    const users = parseTopUsers(squeueAllJson)
    for (let i = 1; i < users.length; i++) {
      expect(users[i - 1].core_count).toBeGreaterThanOrEqual(users[i].core_count)
    }
  })

  it('only counts RUNNING jobs', () => {
    // The squeue-all fixture only has PENDING jobs, so should be empty
    const users = parseTopUsers(squeueAllJson)
    expect(users.length).toBe(0)
  })

  it('entries have user and core_count', () => {
    const users = parseTopUsers(squeueAllJson)
    for (const u of users) {
      expect(typeof u.user).toBe('string')
      expect(typeof u.core_count).toBe('number')
      expect(u.core_count).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// parseFairShare
// ---------------------------------------------------------------------------

describe('parseFairShare', () => {
  it('returns FairShareInfo for user "ilabbe"', () => {
    const fs = parseFairShare(sshareJson)
    expect(fs.user).toBe('ilabbe')
  })

  it('has a fair_share_factor between 0 and 1', () => {
    const fs = parseFairShare(sshareJson)
    expect(fs.fair_share_factor).toBeGreaterThan(0)
    expect(fs.fair_share_factor).toBeLessThanOrEqual(1)
  })

  it('has correct field types', () => {
    const fs = parseFairShare(sshareJson)
    expect(typeof fs.user).toBe('string')
    expect(typeof fs.raw_shares).toBe('number')
    expect(typeof fs.effective_usage).toBe('number')
    expect(typeof fs.fair_share_factor).toBe('number')
  })

  it('returns zeroed info for unknown user', () => {
    const fs = parseFairShare(sshareJson, 'nonexistent_user')
    expect(fs.user).toBe('nonexistent_user')
    expect(fs.fair_share_factor).toBe(0)
  })
})
