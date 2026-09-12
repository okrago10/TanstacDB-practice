import { z } from 'zod'

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type ProjectId = Brand<string, 'ProjectId'>
export type PersonId = Brand<string, 'PersonId'>
export type TicketId = Brand<string, 'TicketId'>

export type Status = 'todo' | 'doing' | 'done'
export type Priority = 'low' | 'medium' | 'high'

export type Project = {
  readonly id: ProjectId
  readonly name: string
  readonly color: string
}

export type Person = {
  readonly id: PersonId
  readonly name: string
}

export type Ticket = {
  readonly id: TicketId
  readonly projectId: ProjectId
  readonly assigneeId: PersonId
  readonly title: string
  readonly status: Status
  readonly priority: Priority
  readonly updatedAt: Date
}

export type BoardQuery = {
  readonly projectId: ProjectId | 'all'
  readonly status: Status | 'all'
  readonly priority: Priority | 'all'
  readonly search: string
}

export type TicketRow = {
  readonly id: TicketId
  readonly title: string
  readonly status: Status
  readonly priority: Priority
  readonly project: Project
  readonly assignee: Person
  readonly updatedAt: Date
}

export type RowChrome = 'idle' | 'syncing' | 'blocked'

export const DISPLAY_LIMIT = 50
export const SEED_TICKET_COUNT = 5000
export const DEFAULT_LATENCY_MS = 800
export const SEARCH_MAX_LEN = 80

export type TicketPatch = {
  readonly status: 'done'
  readonly updatedAt: Date
}

export function visibleRows(rows: readonly TicketRow[]): TicketRow[] {
  return rows.slice(0, DISPLAY_LIMIT)
}

export function asProjectId(raw: string): ProjectId {
  if (raw === '') throw new Error('empty ProjectId')
  return raw as ProjectId
}

export function asPersonId(raw: string): PersonId {
  if (raw === '') throw new Error('empty PersonId')
  return raw as PersonId
}

export function asTicketId(raw: string): TicketId {
  if (raw === '') throw new Error('empty TicketId')
  return raw as TicketId
}

export const FIRST_PROJECT_ID = asProjectId('p-0')

export const DEFAULT_QUERY: BoardQuery = {
  projectId: FIRST_PROJECT_ID,
  status: 'todo',
  priority: 'all',
  search: '',
}

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
})

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const ticketSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assigneeId: z.string(),
  title: z.string(),
  status: z.enum(['todo', 'doing', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  updatedAt: z.date(),
})

export function canComplete(status: Status): status is 'todo' | 'doing' {
  return status !== 'done'
}

export type Seed = {
  readonly projects: readonly Project[]
  readonly people: readonly Person[]
  readonly tickets: readonly Ticket[]
}

export type SeedSpec = {
  readonly ticketCount: number
  readonly rngSeed: number
}

export function parseSearch(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[%_]/g, '')
    .slice(0, SEARCH_MAX_LEN)
}

export function toLikePattern(search: string): `%${string}%` {
  return `%${search}%`
}

export function matchesFilter(ticket: Ticket, query: BoardQuery): boolean {
  if (query.projectId !== 'all' && ticket.projectId !== query.projectId) {
    return false
  }
  if (query.status !== 'all' && ticket.status !== query.status) {
    return false
  }
  if (query.priority !== 'all' && ticket.priority !== query.priority) {
    return false
  }
  const needle = query.search.trim().toLowerCase()
  if (needle !== '' && !ticket.title.toLowerCase().includes(needle)) {
    return false
  }
  return true
}

export function applyComplete(ticket: Ticket, now: Date): Ticket {
  if (ticket.status === 'done') return ticket
  const patch: TicketPatch = { status: 'done', updatedAt: now }
  return { ...ticket, ...patch }
}

export type Network = {
  readonly latencyMs: number
  setLatency(ms: number): void
}

export type SimulatedApi = {
  listProjects(): Promise<readonly Project[]>
  listPeople(): Promise<readonly Person[]>
  listTickets(): Promise<readonly Ticket[]>
  completeTicket(id: TicketId): Promise<Ticket>
}

export type WorldPair = {
  readonly db: SimulatedApi
  readonly naive: SimulatedApi
  reset(): void
}

export type BoardStatus = 'loading' | 'ready'

export type BoardSession = {
  readonly status: BoardStatus
  readonly rows: readonly TicketRow[]
  readonly matchedCount: number
  readonly lastError: Error | null
  complete(id: TicketId): void
  readonly probe: import('./probe.ts').Probe
}
