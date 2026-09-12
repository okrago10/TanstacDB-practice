import { useEffect, useMemo, useRef, useState } from 'react'
import {
  matchesFilter,
  visibleRows,
  type BoardQuery,
  type BoardSession,
  type Person,
  type Project,
  type Ticket,
  type TicketId,
  type TicketRow,
} from './domain.ts'
import type { Probe } from './probe.ts'
import type { SimulatedApi } from './world.ts'

export type ClientDump = {
  readonly projects: readonly Project[]
  readonly people: readonly Person[]
  readonly tickets: readonly Ticket[]
}

export function scanBoard(
  dump: ClientDump,
  query: BoardQuery,
  probe: Probe,
): TicketRow[] {
  return probe.measureFilter(() => {
    const matched = dump.tickets.filter((ticket) => matchesFilter(ticket, query))
    const rows: TicketRow[] = matched.map((ticket) => {
      const project = dump.projects.find((item) => item.id === ticket.projectId)
      const assignee = dump.people.find((item) => item.id === ticket.assigneeId)
      if (!project || !assignee) {
        throw new Error(`seed invariant failed for ${ticket.id}`)
      }
      return {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        project,
        assignee,
        updatedAt: ticket.updatedAt,
      }
    })
    rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    return rows
  })
}

export function useNaiveSession(
  api: SimulatedApi,
  query: BoardQuery,
  probe: Probe,
): BoardSession {
  const [dump, setDump] = useState<ClientDump | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)
  const dumpRef = useRef(dump)
  dumpRef.current = dump

  useEffect(() => {
    let cancelled = false
    void Promise.all([api.listProjects(), api.listPeople(), api.listTickets()])
      .then(([projects, people, tickets]) => {
        if (cancelled) return
        setDump({ projects, people, tickets })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLastError(error instanceof Error ? error : new Error(String(error)))
      })
    return () => {
      cancelled = true
    }
  }, [api])

  const rows = useMemo(
    () => (dump ? scanBoard(dump, query, probe) : []),
    [dump, query, probe],
  )

  const complete = (id: TicketId) => {
    const current = dumpRef.current
    if (!current) return
    const ticket = current.tickets.find((item) => item.id === id)
    if (!ticket || ticket.status === 'done') return
    probe.mutationStarted(id)
    void (async () => {
      try {
        const updated = await api.completeTicket(id)
        setDump((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            tickets: prev.tickets.map((item) =>
              item.id === updated.id ? updated : item,
            ),
          }
        })
        probe.mutationUiVisible(id)
        probe.mutationPersisted(id)
      } catch (error) {
        setLastError(error instanceof Error ? error : new Error(String(error)))
      }
    })()
  }

  return {
    status: dump === null ? 'loading' : 'ready',
    rows: visibleRows(rows),
    matchedCount: rows.length,
    lastError,
    complete,
    probe,
  }
}
