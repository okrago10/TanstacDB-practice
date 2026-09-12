import {
  DEFAULT_LATENCY_MS,
  SEED_TICKET_COUNT,
  type Seed,
} from './domain.ts'
import { createTrackerDb, type TrackerDb } from './db-session.ts'
import {
  createPersistMailbox,
  type PersistMailbox,
} from './probe.ts'
import {
  createNetwork,
  createSeed,
  createWorldPair,
  type Network,
  type WorldPair,
} from './world.ts'

export type Experiment = {
  readonly seed: Seed
  readonly network: Network
  readonly pair: WorldPair
  readonly trackerDb: TrackerDb
  readonly dbPersist: PersistMailbox
}

export function bootExperiment(): Experiment {
  const seed = createSeed({ ticketCount: SEED_TICKET_COUNT, rngSeed: 1 })
  const network = createNetwork(DEFAULT_LATENCY_MS)
  const pair = createWorldPair(seed, network)
  const dbPersist = createPersistMailbox()
  const trackerDb = createTrackerDb(pair.db, dbPersist)
  return { seed, network, pair, trackerDb, dbPersist }
}
