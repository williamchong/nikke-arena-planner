import type { ArenaMode } from '~/types/character'
import type { TeamComposition } from '~/types/template'
import type { Recommend15v15Request, Recommend15v15Response } from '~/workers/recommend15v15.worker'

interface Job {
  request: Recommend15v15Request
  resolve: (result: TeamComposition[][] | null) => void
  runLocally: () => void
}

/**
 * Runs recommend15v15 in a Web Worker so the annealing loop (up to ~500ms on phones)
 * doesn't block taps. Falls back to the main thread if the worker can't start or errors.
 *
 * Only the newest request waits behind the one in flight; an older waiting request
 * resolves to null instead of spending another anneal on a result nobody will show.
 */
export function useRecommend15v15Worker() {
  const { recommend15v15 } = useTeamRecommender()
  let worker: Worker | null = null
  let workerFailed = false
  let inFlight: Job | null = null
  let queued: Job | null = null

  function send(w: Worker, job: Job) {
    inFlight = job
    w.postMessage(job.request)
  }

  function failWorker() {
    workerFailed = true
    worker?.terminate()
    worker = null
    const jobs = [inFlight, queued]
    inFlight = queued = null
    for (const job of jobs) job?.runLocally()
  }

  function getWorker(): Worker | null {
    if (worker || workerFailed) return worker
    try {
      const w = new Worker(new URL('../workers/recommend15v15.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = ({ data }: MessageEvent<Recommend15v15Response>) => {
        inFlight?.resolve(data.result)
        inFlight = null
        const next = queued
        queued = null
        if (next) send(w, next)
      }
      w.onerror = failWorker
      w.onmessageerror = failWorker
      worker = w
    }
    catch {
      workerFailed = true
    }
    return worker
  }

  /** Resolves to null when a newer call superseded this one before it started. */
  function run(ownedIds: Set<string>, mode: ArenaMode, teamLocks?: Set<string>[]): Promise<TeamComposition[][] | null> {
    const runLocally = () => recommend15v15(ownedIds, mode, teamLocks)
    const w = getWorker()
    if (!w) return Promise.resolve(runLocally())
    return new Promise((resolve) => {
      const job: Job = {
        request: { ownedIds: [...ownedIds], mode, teamLocks: teamLocks?.map(s => [...s]) },
        resolve,
        runLocally: () => resolve(runLocally()),
      }
      if (!inFlight) return send(w, job)
      queued?.resolve(null)
      queued = job
    })
  }

  onBeforeUnmount(() => {
    worker?.terminate()
    inFlight = queued = null
  })

  return { run }
}
