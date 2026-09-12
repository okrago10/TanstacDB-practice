import {
  collectionOptions,
  eq,
  and,
  ilike,
  useDbClient,
  useLiveQuery,
  type InitialQueryBuilder,
} from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { QueryClient } from '@tanstack/query-core'
import { useLayoutEffect, useRef } from 'react'
import {
  personSchema,
  projectSchema,
  ticketSchema,
  toLikePattern,
  visibleRows,
  type BoardQuery,
  type BoardSession,
  type TicketId,
  type TicketRow,
} from './domain.ts'
import type { PersistMailbox, Probe } from './probe.ts'
import type { SimulatedApi } from './world.ts'

export function createTrackerDb(api: SimulatedApi, persist: PersistMailbox) {
  const tickets = collectionOptions('tickets', (client) =>
    queryCollectionOptions({
      id: 'tickets',
      queryKey: ['tickets'],
      queryClient: client.requireDependency<QueryClient>('queryClient'),
      queryFn: async () => [...(await api.listTickets())],
      getKey: (item) => item.id,
      schema: ticketSchema,
      startSync: true, // three list* queryFns start together, matching naive Promise.all
      onUpdate: async ({ transaction }) => {
        const mutation = transaction.mutations[0]
        if (!mutation) return
        const { original, modified } = mutation
        if (modified.status === 'done' && original.status !== 'done') {
          await api.completeTicket(original.id as TicketId)
          persist.persisted(original.id as TicketId)
        }
      },
    }),
  )
  const projects = collectionOptions('projects', (client) =>
    queryCollectionOptions({
      id: 'projects',
      queryKey: ['projects'],
      queryClient: client.requireDependency<QueryClient>('queryClient'),
      queryFn: async () => [...(await api.listProjects())],
      getKey: (item) => item.id,
      schema: projectSchema,
      startSync: true,
    }),
  )
  const people = collectionOptions('people', (client) =>
    queryCollectionOptions({
      id: 'people',
      queryKey: ['people'],
      queryClient: client.requireDependency<QueryClient>('queryClient'),
      queryFn: async () => [...(await api.listPeople())],
      getKey: (item) => item.id,
      schema: personSchema,
      startSync: true,
    }),
  )
  return { tickets, projects, people }
}

export type TrackerDb = ReturnType<typeof createTrackerDb>

export function buildLiveBoardQuery(
  q: InitialQueryBuilder,
  trackerDb: TrackerDb,
  query: BoardQuery,
) {
  const joined = q
    .from({ ticket: trackerDb.tickets })
    .join(
      { project: trackerDb.projects },
      ({ ticket, project }) => eq(ticket.projectId, project.id),
      'inner',
    )
    .join(
      { person: trackerDb.people },
      ({ ticket, person }) => eq(ticket.assigneeId, person.id),
      'inner',
    )

  const search = query.search.trim()
  const hasPred =
    query.projectId !== 'all' ||
    query.status !== 'all' ||
    query.priority !== 'all' ||
    search !== ''

  const filtered = hasPred
    ? joined.where(({ ticket }) => {
        const preds = []
        if (query.projectId !== 'all') {
          preds.push(eq(ticket.projectId, query.projectId))
        }
        if (query.status !== 'all') {
          preds.push(eq(ticket.status, query.status))
        }
        if (query.priority !== 'all') {
          preds.push(eq(ticket.priority, query.priority))
        }
        if (search !== '') {
          preds.push(ilike(ticket.title, toLikePattern(search)))
        }
        const first = preds[0]
        const second = preds[1]
        if (first === undefined) {
          throw new Error('filter had no predicates')
        }
        if (second === undefined) return first
        return and(first, second, ...preds.slice(2))
      })
    : joined

  return filtered
    .orderBy(({ ticket }) => ticket.updatedAt, 'desc')
    .select(({ ticket, project, person }) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      project,
      assignee: person,
      updatedAt: ticket.updatedAt,
    }))
}

export function useMeasureQueryApply(
  probe: Probe,
  query: BoardQuery,
  data: readonly TicketRow[] | undefined,
): void {
  useLayoutEffect(() => {
    if (data === undefined) return
    probe.markQueryApplied(query)
  }, [probe, query, data])
}

export function useMeasureMutationPaint(
  probe: Probe,
  data: readonly TicketRow[] | undefined,
): void {
  useLayoutEffect(() => {
    if (data === undefined) return
    for (const id of probe.pendingUiIds()) {
      const row = data.find((item) => item.id === id)
      if (!row || row.status === 'done') probe.mutationUiVisible(id)
    }
  }, [probe, data])
}

export function useDbSession(
  trackerDb: TrackerDb,
  query: BoardQuery,
  probe: Probe,
): BoardSession {
  const client = useDbClient()
  const tickets = client.collection(trackerDb.tickets)
  client.collection(trackerDb.projects)
  client.collection(trackerDb.people)

  const seenQuery = useRef<BoardQuery | null>(null)
  if (seenQuery.current === null) {
    seenQuery.current = query
  } else if (seenQuery.current !== query) {
    // Clock starts before useLiveQuery so filterMs includes the join, not only layout.
    probe.markQueryStart(query)
    seenQuery.current = query
  }

  const live = useLiveQuery({
    query: (q) => buildLiveBoardQuery(q, trackerDb, query),
  })

  const data = (live.isReady ? live.data : undefined) as
    | TicketRow[]
    | undefined

  useMeasureQueryApply(probe, query, data)
  useMeasureMutationPaint(probe, data)

  const complete = (id: TicketId) => {
    const row = (data ?? []).find((item) => item.id === id)
    if (!row || row.status === 'done') return
    probe.mutationStarted(id)
    tickets.update(id, (draft) => {
      draft.status = 'done'
      draft.updatedAt = new Date()
    })
  }

  const rows = data ?? []
  return {
    status: live.isReady ? 'ready' : 'loading',
    rows: visibleRows(rows),
    matchedCount: rows.length,
    lastError: null,
    complete,
    probe,
  }
}
