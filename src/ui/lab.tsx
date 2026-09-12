import { useMemo, useState } from 'react'
import {
  asProjectId,
  DEFAULT_QUERY,
  parseSearch,
  type BoardQuery,
  type Priority,
  type Project,
  type Status,
} from '../domain.ts'
import type { Experiment } from '../experiment.ts'
import {
  LESSONS,
  readLessonFromUrl,
  UI_COPY,
  writeLessonToUrl,
  type LessonId,
} from '../lessons.ts'
import { createProbe } from '../probe.ts'
import { ContrastMeter } from './contrast-meter.tsx'
import { DbPane } from './db-pane.tsx'
import { NaivePane } from './naive-pane.tsx'

export type LabProps = {
  readonly experiment: Experiment
}

export function Lab({ experiment }: LabProps) {
  const [query, setQuery] = useState<BoardQuery>(DEFAULT_QUERY)
  const [lesson, setLesson] = useState<LessonId>(readLessonFromUrl)
  const [epoch, setEpoch] = useState(0)
  const [latencyMs, setLatencyMs] = useState(experiment.network.latencyMs)
  const dbProbe = useMemo(() => createProbe(), [epoch])
  const naiveProbe = useMemo(() => createProbe(), [epoch])

  const onLatency = (ms: number) => {
    experiment.network.setLatency(ms)
    setLatencyMs(ms)
  }

  const onReset = () => {
    experiment.pair.reset()
    setQuery(DEFAULT_QUERY)
    setEpoch((value) => value + 1)
  }

  const onLesson = (id: LessonId) => {
    writeLessonToUrl(id)
    setLesson(id)
  }

  const current = LESSONS.find((item) => item.id === lesson) ?? LESSONS[0]!

  return (
    <div className="lab">
      <header className="hero">
        <h1>{UI_COPY.title}</h1>
        <p>{UI_COPY.lead}</p>
      </header>
      <QueryBar
        query={query}
        projects={experiment.seed.projects}
        onChange={setQuery}
        latencyMs={latencyMs}
        onLatency={onLatency}
      />
      <LessonTabs lesson={lesson} onChange={onLesson} />
      <p className="lesson-body">{current.bodyJa}</p>
      <div className="split">
        <section className="pane" aria-label={UI_COPY.dbPane}>
          <h2>{UI_COPY.dbPane}</h2>
          <DbPane
            key={`db-${epoch}`}
            trackerDb={experiment.trackerDb}
            persist={experiment.dbPersist}
            query={query}
            probe={dbProbe}
          />
        </section>
        <section className="pane" aria-label={UI_COPY.naivePane}>
          <h2>{UI_COPY.naivePane}</h2>
          <NaivePane
            key={`naive-${epoch}`}
            api={experiment.pair.naive}
            query={query}
            probe={naiveProbe}
          />
        </section>
      </div>
      <ContrastMeter db={dbProbe} naive={naiveProbe} lesson={lesson} />
      <button type="button" className="reset" onClick={onReset}>
        {UI_COPY.reset}
      </button>
    </div>
  )
}

export function QueryBar({
  query,
  projects,
  onChange,
  latencyMs,
  onLatency,
}: {
  query: BoardQuery
  projects: readonly Project[]
  onChange: (q: BoardQuery) => void
  latencyMs: number
  onLatency: (ms: number) => void
}) {
  return (
    <form className="query-bar" onSubmit={(event) => event.preventDefault()}>
      <label>
        {UI_COPY.project}
        <select
          value={query.projectId}
          onChange={(event) => {
            const value = event.target.value
            onChange({
              ...query,
              projectId: value === 'all' ? 'all' : asProjectId(value),
            })
          }}
        >
          <option value="all">{UI_COPY.all}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {UI_COPY.status}
        <select
          value={query.status}
          onChange={(event) =>
            onChange({ ...query, status: event.target.value as Status | 'all' })
          }
        >
          <option value="all">{UI_COPY.all}</option>
          <option value="todo">{UI_COPY.statusTodo}</option>
          <option value="doing">{UI_COPY.statusDoing}</option>
          <option value="done">{UI_COPY.statusDone}</option>
        </select>
      </label>
      <label>
        {UI_COPY.priority}
        <select
          value={query.priority}
          onChange={(event) =>
            onChange({
              ...query,
              priority: event.target.value as Priority | 'all',
            })
          }
        >
          <option value="all">{UI_COPY.all}</option>
          <option value="low">{UI_COPY.priorityLow}</option>
          <option value="medium">{UI_COPY.priorityMedium}</option>
          <option value="high">{UI_COPY.priorityHigh}</option>
        </select>
      </label>
      <label className="search">
        {UI_COPY.search}
        <input
          type="search"
          value={query.search}
          onChange={(event) =>
            onChange({ ...query, search: parseSearch(event.target.value) })
          }
        />
      </label>
      <label className="latency">
        {UI_COPY.latency} {latencyMs} ms
        <input
          type="range"
          min={0}
          max={2000}
          step={50}
          value={latencyMs}
          onChange={(event) => onLatency(Number(event.target.value))}
        />
      </label>
    </form>
  )
}

export function LessonTabs({
  lesson,
  onChange,
}: {
  lesson: LessonId
  onChange: (id: LessonId) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {LESSONS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === lesson}
          className={item.id === lesson ? 'tab active' : 'tab'}
          onClick={() => onChange(item.id)}
        >
          {item.titleJa}
        </button>
      ))}
    </div>
  )
}
