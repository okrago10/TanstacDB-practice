import { useSyncExternalStore } from 'react'
import {
  explain,
  lessonById,
  UI_COPY,
  type LessonId,
} from '../lessons.ts'
import { contrastOf, type Probe } from '../probe.ts'

export type ContrastMeterProps = {
  readonly db: Probe
  readonly naive: Probe
  readonly lesson: LessonId
}

export function ContrastMeter({ db, naive, lesson }: ContrastMeterProps) {
  const dbSnap = useSyncExternalStore(db.subscribe, db.snapshot, db.snapshot)
  const naiveSnap = useSyncExternalStore(
    naive.subscribe,
    naive.snapshot,
    naive.snapshot,
  )
  const contrast = contrastOf(dbSnap, naiveSnap)
  const current = lessonById(lesson)
  return (
    <section className="meter" aria-label="計測">
      <h2>{UI_COPY.meterTitle}</h2>
      <p className="meter-lead">{UI_COPY.meterLead}</p>
      <table>
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">{UI_COPY.dbPane}</th>
            <th scope="col">{UI_COPY.naivePane}</th>
          </tr>
        </thead>
        <tbody>
          <MeterRow
            label={UI_COPY.meterFilter}
            db={dbSnap.filterMs}
            naive={naiveSnap.filterMs}
            focused={current.focus === 'filter' || current.focus === 'load'}
            kind="ms"
          />
          <MeterRow
            label={UI_COPY.meterUi}
            db={dbSnap.mutationUiMs}
            naive={naiveSnap.mutationUiMs}
            focused={current.focus === 'complete'}
            kind="ms"
          />
          <MeterRow
            label={UI_COPY.meterPersist}
            db={dbSnap.mutationPersistMs}
            naive={naiveSnap.mutationPersistMs}
            focused={current.focus === 'complete'}
            kind="ms"
          />
          <MeterRow
            label={UI_COPY.meterRenders}
            db={dbSnap.renderCount}
            naive={naiveSnap.renderCount}
            focused={current.focus === 'filter'}
            kind="count"
          />
        </tbody>
      </table>
      <p className="explain">{explain(current, contrast)}</p>
    </section>
  )
}

function MeterRow({
  label,
  db,
  naive,
  focused,
  kind,
}: {
  label: string
  db: number | null
  naive: number | null
  focused: boolean
  kind: 'ms' | 'count'
}) {
  return (
    <tr className={focused ? 'focus' : undefined}>
      <th scope="row">{label}</th>
      <td>{formatSlot(db, kind)}</td>
      <td>{formatSlot(naive, kind)}</td>
    </tr>
  )
}

function formatSlot(value: number | null, kind: 'ms' | 'count'): string {
  if (kind === 'count') return String(value ?? 0)
  if (value === null) return UI_COPY.awaiting
  if (value < 10) return `${value.toFixed(1)} ms`
  return `${Math.round(value)} ms`
}
