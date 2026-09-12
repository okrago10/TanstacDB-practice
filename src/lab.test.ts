import { QueryClient } from '@tanstack/query-core'
import { DbClient } from '@tanstack/react-db'
import { describe, expect, it } from 'vitest'
import { buildLiveBoardQuery } from './db-session.ts'
import {
  applyComplete,
  asPersonId,
  asProjectId,
  asTicketId,
  DEFAULT_QUERY,
  matchesFilter,
  parseSearch,
  SEED_TICKET_COUNT,
  toLikePattern,
  type Ticket,
} from './domain.ts'
import { bootExperiment } from './experiment.ts'
import { scanBoard } from './naive-session.ts'
import { contrastOf, createProbe } from './probe.ts'
import { assertSeedInvariants, createSeed } from './world.ts'

describe('createSeed', () => {
  it('keeps unique ids and live foreign keys', () => {
    const seed = createSeed({ ticketCount: SEED_TICKET_COUNT, rngSeed: 1 })
    expect(seed.projects).toHaveLength(6)
    expect(seed.people).toHaveLength(12)
    expect(seed.tickets).toHaveLength(5000)
    expect(new Set(seed.tickets.map((ticket) => ticket.id)).size).toBe(5000)
    assertSeedInvariants(seed)
    const projectIds = new Set(seed.projects.map((project) => project.id))
    const personIds = new Set(seed.people.map((person) => person.id))
    for (const ticket of seed.tickets) {
      expect(projectIds.has(ticket.projectId)).toBe(true)
      expect(personIds.has(ticket.assigneeId)).toBe(true)
    }
    expect(seed.projects[0]?.id).toBe(DEFAULT_QUERY.projectId)
    const visible = seed.tickets.filter((ticket) =>
      matchesFilter(ticket, DEFAULT_QUERY),
    )
    expect(visible.length).toBeGreaterThan(50)
    expect(visible.length).toBeLessThan(5000)
  })
})

describe('parseSearch', () => {
  it('strips like wildcards so ilike and includes stay aligned', () => {
    expect(parseSearch('login%_api\n')).toBe('loginapi')
    expect(toLikePattern('loginapi')).toBe('%loginapi%')
    expect(parseSearch('a'.repeat(90)).length).toBe(80)
  })
})

describe('applyComplete', () => {
  it('marks todo as done once and ignores a second call', () => {
    const firstAt = new Date('2026-01-01T00:00:00.000Z')
    const ticket: Ticket = {
      id: asTicketId('t-0'),
      projectId: asProjectId('p-0'),
      assigneeId: asPersonId('h-0'),
      title: 'ログイン API #0',
      status: 'todo',
      priority: 'high',
      updatedAt: firstAt,
    }
    const doneAt = new Date('2026-02-01T00:00:00.000Z')
    const done = applyComplete(ticket, doneAt)
    expect(done).toEqual({
      id: 't-0',
      projectId: 'p-0',
      assigneeId: 'h-0',
      title: 'ログイン API #0',
      status: 'done',
      priority: 'high',
      updatedAt: doneAt,
    })
    const later = new Date('2026-03-01T00:00:00.000Z')
    const again = applyComplete(done, later)
    expect(again).toBe(done)
    expect(again.updatedAt).toBe(doneAt)
  })
})

describe('matchesFilter and scanBoard', () => {
  it('agree on a fixture and sort by updatedAt desc', () => {
    const p0 = { id: asProjectId('p-0'), name: '基盤', color: '#7aa2ff' }
    const p1 = { id: asProjectId('p-1'), name: 'モバイル', color: '#8fd4a8' }
    const h0 = { id: asPersonId('h-0'), name: '佐藤 葵' }
    const h1 = { id: asPersonId('h-1'), name: '鈴木 蓮' }
    const t0: Ticket = {
      id: asTicketId('t-0'),
      projectId: p0.id,
      assigneeId: h0.id,
      title: 'Login bug',
      status: 'todo',
      priority: 'high',
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }
    const t1: Ticket = {
      id: asTicketId('t-1'),
      projectId: p0.id,
      assigneeId: h1.id,
      title: 'API timeout',
      status: 'doing',
      priority: 'low',
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    }
    const t2: Ticket = {
      id: asTicketId('t-2'),
      projectId: p1.id,
      assigneeId: h0.id,
      title: 'Login page',
      status: 'todo',
      priority: 'medium',
      updatedAt: new Date('2026-01-04T00:00:00.000Z'),
    }
    const dump = {
      projects: [p0, p1],
      people: [h0, h1],
      tickets: [t0, t1, t2],
    }
    const query = {
      projectId: p0.id,
      status: 'todo' as const,
      priority: 'all' as const,
      search: '',
    }
    expect(matchesFilter(t0, query)).toBe(true)
    expect(matchesFilter(t1, query)).toBe(false)
    expect(matchesFilter(t2, query)).toBe(false)
    const rows = scanBoard(dump, query, createProbe())
    expect(rows.map((row) => row.id)).toEqual(['t-0'])
    expect(rows[0]).toEqual({
      id: 't-0',
      title: 'Login bug',
      status: 'todo',
      priority: 'high',
      project: p0,
      assignee: h0,
      updatedAt: t0.updatedAt,
    })
    const searchRows = scanBoard(
      dump,
      {
        projectId: 'all',
        status: 'all',
        priority: 'all',
        search: 'login',
      },
      createProbe(),
    )
    expect(searchRows.map((row) => row.id)).toEqual(['t-2', 't-0'])
    for (const ticket of dump.tickets) {
      const hit = searchRows.some((row) => row.id === ticket.id)
      expect(hit).toBe(
        matchesFilter(ticket, {
          projectId: 'all',
          status: 'all',
          priority: 'all',
          search: 'login',
        }),
      )
    }
  })
})

describe('WorldPair', () => {
  it('keeps completeTicket on the db world out of the naive world', async () => {
    const experiment = bootExperiment()
    experiment.network.setLatency(0)
    const todo = experiment.seed.tickets.find(
      (ticket) =>
        ticket.status === 'todo' && ticket.projectId === DEFAULT_QUERY.projectId,
    )
    expect(todo).toBeDefined()
    await experiment.pair.db.completeTicket(todo!.id)
    const dbTickets = await experiment.pair.db.listTickets()
    const naiveTickets = await experiment.pair.naive.listTickets()
    expect(dbTickets.find((ticket) => ticket.id === todo!.id)?.status).toBe(
      'done',
    )
    expect(naiveTickets.find((ticket) => ticket.id === todo!.id)?.status).toBe(
      'todo',
    )
  })
})

describe('createTrackerDb', () => {
  it('loads collections and an inner-join live query', async () => {
    const experiment = bootExperiment()
    experiment.network.setLatency(0)
    const client = new DbClient({ queryClient: new QueryClient() })
    const tickets = client.collection(experiment.trackerDb.tickets)
    const projects = client.collection(experiment.trackerDb.projects)
    const people = client.collection(experiment.trackerDb.people)
    await Promise.all([tickets.preload(), projects.preload(), people.preload()])
    expect(tickets.toArray).toHaveLength(5000)
    expect(projects.toArray).toHaveLength(6)
    expect(people.toArray).toHaveLength(12)
    await client.preloadLiveQuery({
      query: (q) =>
        buildLiveBoardQuery(q, experiment.trackerDb, DEFAULT_QUERY),
    })
  })

  it('applies collection.update immediately and records persist after onUpdate', async () => {
    const experiment = bootExperiment()
    experiment.network.setLatency(40)
    const probe = createProbe()
    experiment.dbPersist.bind(probe)
    const client = new DbClient({ queryClient: new QueryClient() })
    const tickets = client.collection(experiment.trackerDb.tickets)
    await tickets.preload()
    const todo = tickets.toArray.find((ticket) => ticket.status === 'todo')
    expect(todo).toBeDefined()
    const id = asTicketId(todo!.id)
    probe.mutationStarted(id)
    tickets.update(id, (draft) => {
      draft.status = 'done'
      draft.updatedAt = new Date()
    })
    expect(tickets.get(id)?.status).toBe('done')
    expect(probe.snapshot().mutationPersistMs).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(probe.snapshot().mutationPersistMs).not.toBeNull()
    experiment.dbPersist.unbind()
  })
})

describe('contrastOf', () => {
  it('stays null until both panes have a sample', () => {
    const empty = {
      filterMs: null,
      mutationUiMs: null,
      mutationPersistMs: null,
      renderCount: 0,
    }
    expect(contrastOf(empty, empty).filterRatio).toBeNull()
    expect(contrastOf(empty, empty).uiWaitDeltaMs).toBeNull()
    expect(
      contrastOf({ ...empty, filterMs: 2 }, empty).filterRatio,
    ).toBeNull()
    expect(
      contrastOf(empty, { ...empty, mutationUiMs: 800 }).uiWaitDeltaMs,
    ).toBeNull()
    expect(
      contrastOf({ ...empty, filterMs: 2 }, { ...empty, filterMs: 10 })
        .filterRatio,
    ).toBe(5)
    expect(
      contrastOf({ ...empty, filterMs: 0 }, { ...empty, filterMs: 10 })
        .filterRatio,
    ).toBe(10000)
    expect(
      contrastOf(
        { ...empty, mutationUiMs: 1 },
        { ...empty, mutationUiMs: 800 },
      ).uiWaitDeltaMs,
    ).toBe(799)
  })
})
