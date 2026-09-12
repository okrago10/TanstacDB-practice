import { useEffect, useState } from 'react'
import { QueryClient } from '@tanstack/query-core'
import { DbClient, DbProvider } from '@tanstack/react-db'
import type { BoardQuery } from '../domain.ts'
import { useDbSession, type TrackerDb } from '../db-session.ts'
import type { PersistMailbox, Probe } from '../probe.ts'
import { Board } from './board.tsx'

export type DbPaneProps = {
  readonly trackerDb: TrackerDb
  readonly persist: PersistMailbox
  readonly query: BoardQuery
  readonly probe: Probe
}

export function DbPane({ trackerDb, persist, query, probe }: DbPaneProps) {
  useEffect(() => {
    persist.bind(probe)
    return () => persist.unbind()
  }, [persist, probe])
  const [dbClient] = useState(
    () => new DbClient({ queryClient: new QueryClient() }),
  )
  return (
    <DbProvider client={dbClient}>
      <DbBoard trackerDb={trackerDb} query={query} probe={probe} />
    </DbProvider>
  )
}

function DbBoard({
  trackerDb,
  query,
  probe,
}: Omit<DbPaneProps, 'persist'>) {
  const session = useDbSession(trackerDb, query, probe)
  return <Board session={session} />
}
