import { felt, type Contrast } from './probe.ts'

export type LessonId = 'collections' | 'live-queries' | 'optimistic-writes'

export type Lesson = {
  readonly id: LessonId
  readonly titleJa: string
  readonly bodyJa: string
  readonly focus: 'load' | 'filter' | 'complete'
  readonly sourceFile: 'src/db-session.ts' | 'src/naive-session.ts' | 'src/world.ts'
}

export type UiCopy = {
  readonly dbPane: string
  readonly naivePane: string
  readonly complete: string
  readonly reset: string
  readonly matched: (matched: number, shown: number) => string
  readonly loading: string
  readonly syncing: string
  readonly blocked: string
  readonly all: string
  readonly project: string
  readonly status: string
  readonly priority: string
  readonly search: string
  readonly latency: string
  readonly statusTodo: string
  readonly statusDoing: string
  readonly statusDone: string
  readonly priorityLow: string
  readonly priorityMedium: string
  readonly priorityHigh: string
  readonly meterFilter: string
  readonly meterUi: string
  readonly meterPersist: string
  readonly meterRenders: string
  readonly awaiting: string
  readonly title: string
  readonly lead: string
}

export const UI_COPY: UiCopy = {
  dbPane: 'TanStack DB',
  naivePane: 'useState / useMemo / await',
  complete: '完了',
  reset: 'リセット',
  matched: (matched, shown) => `${matched} 件中 ${shown} 件を表示`,
  loading: '読み込み中…',
  syncing: '同期中',
  blocked: '通信待ち',
  all: 'すべて',
  project: 'プロジェクト',
  status: '状態',
  priority: '優先度',
  search: '検索',
  latency: '通信遅延',
  statusTodo: '未着手',
  statusDoing: '進行中',
  statusDone: '完了',
  priorityLow: '低',
  priorityMedium: '中',
  priorityHigh: '高',
  meterFilter: '絞り込み',
  meterUi: '画面に反映',
  meterPersist: '保存完了',
  meterRenders: '再描画',
  awaiting: 'まだ測っていません',
  title: 'TanStack DB 実習',
  lead: '同じ課題トラッカーを左右で同時に動かします。左はコレクションとライブクエリと楽観的更新、右は配列スキャンと await です。',
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'collections',
    titleJa: 'コレクション',
    bodyJa:
      '左の src/db-session.ts は collectionOptions と queryCollectionOptions で tickets / projects / people を載せます。queryFn が SimulatedApi の list を呼び、通信遅延のあとコレクションが ready になります。右は同じ 3 本の list を Promise.all して useState に入れます。まだ行は結合していません。最初の待ちはどちらも遅延スライダーに近いです。',
    focus: 'load',
    sourceFile: 'src/db-session.ts',
  },
  {
    id: 'live-queries',
    titleJa: 'ライブクエリ',
    bodyJa:
      'フィルタを変えると、左は useLiveQuery が inner join と where をコレクション上で再計算します。右は scanBoard が配列の filter / find / sort を毎回走らせます。下の絞り込み ms がその差です。表示は先頭 50 件だけです。計測はマッチした全件です。',
    focus: 'filter',
    sourceFile: 'src/db-session.ts',
  },
  {
    id: 'optimistic-writes',
    titleJa: '楽観的更新',
    bodyJa:
      '未着手を完了すると、左は collection.update がすぐ done を塗り、フィルタが未着手なら行が消えます。onUpdate が completeTicket を待ち、PersistMailbox が保存完了時刻を残します。右は await completeTicket が終わるまで行が残ります。失敗時は TanStack DB が楽観状態をロールバックします。この画面には失敗させるボタンはありません。',
    focus: 'complete',
    sourceFile: 'src/db-session.ts',
  },
]

const LESSON_IDS: readonly LessonId[] = [
  'collections',
  'live-queries',
  'optimistic-writes',
]

export function lessonById(id: LessonId): Lesson {
  const lesson = LESSONS.find((item) => item.id === id)
  if (!lesson) throw new Error(`unknown lesson ${id}`)
  return lesson
}

function isLessonId(raw: string | null): raw is LessonId {
  return raw !== null && (LESSON_IDS as readonly string[]).includes(raw)
}

export function readLessonFromUrl(): LessonId {
  if (typeof window === 'undefined') return 'collections'
  const raw = new URL(window.location.href).searchParams.get('lesson')
  return isLessonId(raw) ? raw : 'collections'
}

export function writeLessonToUrl(id: LessonId): void {
  const url = new URL(window.location.href)
  url.searchParams.set('lesson', id)
  history.replaceState(null, '', url)
}

function msJa(ms: number | null): string {
  if (ms === null) return UI_COPY.awaiting
  if (ms < 10) return `${ms.toFixed(1)} ms`
  return `${Math.round(ms)} ms`
}

function feltJa(ms: number): string {
  const kind = felt(ms)
  if (kind === 'instant') return '瞬間'
  if (kind === 'noticeable') return 'わかる遅さ'
  return '遅い'
}

export function explain(lesson: Lesson, contrast: Contrast): string {
  if (lesson.focus === 'filter') {
    const dbMs = contrast.db.filterMs
    const naiveMs = contrast.naive.filterMs
    if (dbMs === null || naiveMs === null || contrast.filterRatio === null) {
      return `絞り込みを変えると、両ペインの絞り込み ms が揃った時点で比が出ます。いまは ${UI_COPY.awaiting}。`
    }
    return `絞り込みは DB が ${msJa(dbMs)}（${feltJa(dbMs)}）、naive が ${msJa(naiveMs)}（${feltJa(naiveMs)}）です。比は ${contrast.filterRatio.toFixed(1)} 倍です。DB はライブクエリ、naive は毎回 filter / find / sort です。再描画は DB ${contrast.db.renderCount} 回、naive ${contrast.naive.renderCount} 回です。`
  }
  if (lesson.focus === 'complete') {
    const dbUi = contrast.db.mutationUiMs
    const naiveUi = contrast.naive.mutationUiMs
    if (dbUi === null || naiveUi === null || contrast.uiWaitDeltaMs === null) {
      return `左右で 1 件ずつ完了すると、画面反映と保存完了が揃った時点で差が出ます。いまは ${UI_COPY.awaiting}。`
    }
    return `画面反映は DB が ${msJa(dbUi)}（${feltJa(dbUi)}）、naive が ${msJa(naiveUi)}（${feltJa(naiveUi)}）です。差は ${Math.round(contrast.uiWaitDeltaMs)} ms です。保存完了は DB ${msJa(contrast.db.mutationPersistMs)}、naive ${msJa(contrast.naive.mutationPersistMs)} です。naive は画面反映と保存が同じ待ちです。`
  }
  return `${lesson.bodyJa} 通信遅延を動かしても、進行中のリクエストは開始時の値を使います。`
}
