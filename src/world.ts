import {
  applyComplete,
  asPersonId,
  asProjectId,
  asTicketId,
  type Network,
  type Person,
  type PersonId,
  type Project,
  type ProjectId,
  type Seed,
  type SeedSpec,
  SEED_TICKET_COUNT,
  type SimulatedApi,
  type Ticket,
  type TicketId,
  type WorldPair,
} from './domain.ts'

export type { Network, SimulatedApi, WorldPair }

type World = {
  projects: Map<ProjectId, Project>
  people: Map<PersonId, Person>
  tickets: Map<TicketId, Ticket>
}

const PROJECTS: readonly Omit<Project, 'id'>[] = [
  { name: '基盤', color: '#7aa2ff' },
  { name: 'モバイル', color: '#8fd4a8' },
  { name: '課金', color: '#e2c06e' },
  { name: '成長', color: '#d4a0ff' },
  { name: 'データ', color: '#8fd0e8' },
  { name: '信頼と安全', color: '#f0a4a4' },
]

const PEOPLE = [
  '佐藤 葵',
  '鈴木 蓮',
  '高橋 陽菜',
  '田中 大和',
  '伊藤 結衣',
  '渡辺 颯',
  '山本 美月',
  '中村 樹',
  '小林 杏',
  '加藤 悠真',
  '吉田 咲',
  '山田 湊',
] as const

const TITLE_JA = ['ログイン', '通知', '請求', '検索', '権限', '同期'] as const
const TITLE_EN = ['API', 'latency', 'webhook', 'cache', 'retry', 'queue'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)]
  if (item === undefined) throw new Error('empty pick')
  return item
}

export function createSeed(spec?: SeedSpec): Seed {
  const ticketCount = spec?.ticketCount ?? SEED_TICKET_COUNT
  const rng = mulberry32(spec?.rngSeed ?? 1)
  const projects: Project[] = PROJECTS.map((project, i) => ({
    id: asProjectId(`p-${i}`),
    name: project.name,
    color: project.color,
  }))
  const people: Person[] = PEOPLE.map((name, i) => ({
    id: asPersonId(`h-${i}`),
    name,
  }))
  const tickets: Ticket[] = []
  const origin = Date.UTC(2026, 0, 1)
  for (let i = 0; i < ticketCount; i++) {
    const roll = rng()
    const status = roll < 0.62 ? 'todo' : roll < 0.85 ? 'doing' : 'done'
    tickets.push({
      id: asTicketId(`t-${i}`),
      projectId: pick(rng, projects).id,
      assigneeId: pick(rng, people).id,
      title: `${pick(rng, TITLE_JA)} ${pick(rng, TITLE_EN)} #${i}`,
      status,
      priority: pick(rng, PRIORITIES),
      updatedAt: new Date(origin + Math.floor(rng() * 40) * 86_400_000 + i),
    })
  }
  const seed: Seed = { projects, people, tickets }
  assertSeedInvariants(seed)
  for (const ticket of tickets) Object.freeze(ticket)
  Object.freeze(projects)
  Object.freeze(people)
  Object.freeze(tickets)
  return Object.freeze(seed)
}

export function assertSeedInvariants(seed: Seed): void {
  const projectIds = new Set(seed.projects.map((p) => p.id))
  const personIds = new Set(seed.people.map((p) => p.id))
  const ticketIds = new Set<TicketId>()
  if (projectIds.size !== seed.projects.length) {
    throw new Error('duplicate project id')
  }
  if (personIds.size !== seed.people.length) {
    throw new Error('duplicate person id')
  }
  for (const ticket of seed.tickets) {
    if (ticketIds.has(ticket.id)) throw new Error(`duplicate ticket ${ticket.id}`)
    ticketIds.add(ticket.id)
    if (!projectIds.has(ticket.projectId)) {
      throw new Error(`ticket ${ticket.id} has unknown project`)
    }
    if (!personIds.has(ticket.assigneeId)) {
      throw new Error(`ticket ${ticket.id} has unknown assignee`)
    }
  }
}

export function createNetwork(latencyMs: number): Network {
  let current = latencyMs
  return {
    get latencyMs() {
      return current
    },
    setLatency(ms: number) {
      current = ms
    },
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function cloneWorld(seed: Seed): World {
  return {
    projects: new Map(seed.projects.map((p) => [p.id, p])),
    people: new Map(seed.people.map((p) => [p.id, p])),
    tickets: new Map(
      seed.tickets.map((t) => [
        t.id,
        { ...t, updatedAt: new Date(t.updatedAt.getTime()) },
      ]),
    ),
  }
}

function copyTicket(ticket: Ticket): Ticket {
  return { ...ticket, updatedAt: new Date(ticket.updatedAt.getTime()) }
}

function createApi(world: World, network: Network): SimulatedApi {
  const delay = async () => {
    const ms = network.latencyMs
    await sleep(ms)
  }
  return {
    async listProjects() {
      await delay()
      return Array.from(world.projects.values())
    },
    async listPeople() {
      await delay()
      return Array.from(world.people.values())
    },
    async listTickets() {
      await delay()
      return Array.from(world.tickets.values(), copyTicket)
    },
    async completeTicket(id: TicketId) {
      await delay()
      const ticket = world.tickets.get(id)
      if (!ticket) throw new Error(`ticket ${id} not found`)
      const next = applyComplete(ticket, new Date())
      world.tickets.set(id, next)
      return copyTicket(next)
    },
  }
}

export function createWorldPair(seed: Seed, network: Network): WorldPair {
  const dbWorld = cloneWorld(seed)
  const naiveWorld = cloneWorld(seed)
  const db = createApi(dbWorld, network)
  const naive = createApi(naiveWorld, network)
  return {
    db,
    naive,
    reset() {
      const nextDb = cloneWorld(seed)
      const nextNaive = cloneWorld(seed)
      dbWorld.projects = nextDb.projects
      dbWorld.people = nextDb.people
      dbWorld.tickets = nextDb.tickets
      naiveWorld.projects = nextNaive.projects
      naiveWorld.people = nextNaive.people
      naiveWorld.tickets = nextNaive.tickets
    },
  }
}
