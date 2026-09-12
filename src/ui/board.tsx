import {
  canComplete,
  type BoardSession,
  type RowChrome,
  type TicketRow,
} from '../domain.ts'
import { UI_COPY } from '../lessons.ts'
import { useRenderProbe, type Probe } from '../probe.ts'

export type BoardProps = {
  readonly session: BoardSession
}

export function Board({ session }: BoardProps) {
  useRenderProbe(session.probe)
  if (session.status === 'loading') {
    return <p className="loading">{UI_COPY.loading}</p>
  }
  return (
    <>
      <p className="matched">
        {UI_COPY.matched(session.matchedCount, session.rows.length)}
      </p>
      {session.lastError ? (
        <p className="error" role="alert">
          {session.lastError.message}
        </p>
      ) : null}
      <ul className="tickets">
        {session.rows.map((row) => (
          <TicketRowView
            key={row.id}
            row={row}
            chrome={chromeOf(row, session.probe)}
            onComplete={() => session.complete(row.id)}
          />
        ))}
      </ul>
    </>
  )
}

function chromeOf(row: TicketRow, probe: Probe): RowChrome {
  if (!probe.isPersisting(row.id)) return 'idle'
  if (row.status === 'done') return 'syncing'
  return 'blocked'
}

export function TicketRowView({
  row,
  chrome,
  onComplete,
}: {
  row: TicketRow
  chrome: RowChrome
  onComplete: () => void
}) {
  const canClick = chrome === 'idle' && canComplete(row.status)
  return (
    <li className={`ticket chrome-${chrome}`}>
      <span
        className="swatch"
        style={{ background: row.project.color }}
        aria-hidden="true"
      />
      <div className="ticket-body">
        <p className="ticket-title">{row.title}</p>
        <p className="ticket-meta">
          {row.project.name} · {row.assignee.name} · {statusLabel(row.status)} ·{' '}
          {priorityLabel(row.priority)}
          {chrome === 'syncing' ? ` · ${UI_COPY.syncing}` : null}
          {chrome === 'blocked' ? ` · ${UI_COPY.blocked}` : null}
        </p>
      </div>
      {canComplete(row.status) ? (
        <button
          type="button"
          className="complete"
          disabled={!canClick}
          onClick={onComplete}
        >
          {UI_COPY.complete}
        </button>
      ) : null}
    </li>
  )
}

function statusLabel(status: TicketRow['status']): string {
  if (status === 'todo') return UI_COPY.statusTodo
  if (status === 'doing') return UI_COPY.statusDoing
  return UI_COPY.statusDone
}

function priorityLabel(priority: TicketRow['priority']): string {
  if (priority === 'low') return UI_COPY.priorityLow
  if (priority === 'medium') return UI_COPY.priorityMedium
  return UI_COPY.priorityHigh
}
