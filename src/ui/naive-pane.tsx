import type { BoardQuery } from '../domain.ts'
import { useNaiveSession } from '../naive-session.ts'
import type { Probe } from '../probe.ts'
import type { SimulatedApi } from '../world.ts'
import { Board } from './board.tsx'

export type NaivePaneProps = {
  readonly api: SimulatedApi
  readonly query: BoardQuery
  readonly probe: Probe
}

export function NaivePane({ api, query, probe }: NaivePaneProps) {
  const session = useNaiveSession(api, query, probe)
  return <Board session={session} />
}
