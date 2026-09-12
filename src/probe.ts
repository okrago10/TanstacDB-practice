import type { BoardQuery, TicketId } from './domain.ts'

export type ProbeSnapshot = {
  readonly filterMs: number | null
  readonly mutationUiMs: number | null
  readonly mutationPersistMs: number | null
  readonly renderCount: number
}

export type Felt = 'instant' | 'noticeable' | 'slow'

export function felt(ms: number): Felt {
  if (ms < 16) return 'instant'
  if (ms < 150) return 'noticeable'
  return 'slow'
}

export type Probe = {
  snapshot(): ProbeSnapshot
  subscribe(listener: () => void): () => void
  measureFilter<T>(run: () => T): T
  markQueryStart(query: BoardQuery): void
  markQueryApplied(query: BoardQuery): void
  mutationStarted(id: TicketId): void
  mutationUiVisible(id: TicketId): void
  mutationPersisted(id: TicketId): void
  pendingUiIds(): readonly TicketId[]
  isPersisting(id: TicketId): boolean
  noteRender(): void
}

type PendingMutation = {
  readonly t0: number
  uiMs: number | null
  persistMs: number | null
}

function queryKey(query: BoardQuery): string {
  return `${query.projectId}\0${query.status}\0${query.priority}\0${query.search}`
}

export function createProbe(): Probe {
  const listeners = new Set<() => void>()
  let latest: ProbeSnapshot = {
    filterMs: null,
    mutationUiMs: null,
    mutationPersistMs: null,
    renderCount: 0,
  }
  let pendingQuery: { key: string; t0: number } | null = null
  let filterOpen = false
  let filterSettled = false
  let mutationOpen = false
  let mutationSettled = false
  let windowRenders = 0
  const mutations = new Map<TicketId, PendingMutation>()
  const uiPending = new Set<TicketId>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const publish = (patch: Partial<ProbeSnapshot>) => {
    latest = { ...latest, ...patch }
    emit()
  }

  return {
    snapshot() {
      return latest
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    measureFilter(run) {
      filterOpen = true
      filterSettled = false
      windowRenders = 0
      const t0 = performance.now()
      const result = run()
      filterSettled = true
      publish({ filterMs: performance.now() - t0, renderCount: 0 })
      return result
    },
    markQueryStart(query) {
      pendingQuery = { key: queryKey(query), t0: performance.now() }
      filterOpen = true
      filterSettled = false
      windowRenders = 0
      publish({ renderCount: 0 })
    },
    markQueryApplied(query) {
      if (!pendingQuery || pendingQuery.key !== queryKey(query)) return
      const ms = performance.now() - pendingQuery.t0
      pendingQuery = null
      filterSettled = true
      publish({ filterMs: ms })
    },
    mutationStarted(id) {
      mutations.set(id, { t0: performance.now(), uiMs: null, persistMs: null })
      uiPending.add(id)
      mutationOpen = true
      mutationSettled = false
      windowRenders = 0
      publish({ renderCount: 0 })
    },
    mutationUiVisible(id) {
      const pending = mutations.get(id)
      if (!pending || pending.uiMs !== null) return
      pending.uiMs = performance.now() - pending.t0
      uiPending.delete(id)
      publish({ mutationUiMs: pending.uiMs })
    },
    mutationPersisted(id) {
      const pending = mutations.get(id)
      if (!pending || pending.persistMs !== null) return
      pending.persistMs = performance.now() - pending.t0
      mutationSettled = true
      publish({ mutationPersistMs: pending.persistMs })
    },
    pendingUiIds() {
      return Array.from(uiPending)
    },
    isPersisting(id) {
      const pending = mutations.get(id)
      return pending !== undefined && pending.persistMs === null
    },
    noteRender() {
      if (!filterOpen && !mutationOpen) return
      windowRenders += 1
      if (filterOpen && filterSettled) filterOpen = false
      if (mutationOpen && mutationSettled) mutationOpen = false
      publish({ renderCount: windowRenders })
    },
  }
}

export type Contrast = {
  readonly db: ProbeSnapshot
  readonly naive: ProbeSnapshot
  readonly filterRatio: number | null
  readonly uiWaitDeltaMs: number | null
}

export function contrastOf(db: ProbeSnapshot, naive: ProbeSnapshot): Contrast {
  const filterRatio =
    db.filterMs === null || naive.filterMs === null
      ? null
      : naive.filterMs / Math.max(db.filterMs, 0.001)
  const uiWaitDeltaMs =
    db.mutationUiMs === null || naive.mutationUiMs === null
      ? null
      : naive.mutationUiMs - db.mutationUiMs
  return { db, naive, filterRatio, uiWaitDeltaMs }
}

export function useRenderProbe(probe: Probe): void {
  probe.noteRender()
}

export type PersistMailbox = {
  bind(probe: Probe): void
  unbind(): void
  persisted(id: TicketId): void
}

export function createPersistMailbox(): PersistMailbox {
  const slot = { current: null as Probe | null }
  return {
    bind(probe) {
      slot.current = probe
    },
    unbind() {
      slot.current = null
    },
    persisted(id) {
      slot.current?.mutationPersisted(id)
    },
  }
}
