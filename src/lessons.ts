import { felt, type Contrast } from './probe.ts'

export type LessonId = 'collections' | 'live-queries' | 'optimistic-writes'

export type Lesson = {
  readonly id: LessonId
  readonly titleJa: string
  readonly tryJa: string
  readonly whyJa: string
  readonly focus: 'load' | 'filter' | 'complete'
  readonly sourceFile: 'src/db-session.ts' | 'src/naive-session.ts' | 'src/world.ts'
}

export type UiCopy = {
  readonly dbPane: string
  readonly naivePane: string
  readonly dbBadge: string
  readonly naiveBadge: string
  readonly dbHint: string
  readonly naiveHint: string
  readonly complete: string
  readonly reset: string
  readonly matched: (matched: number, shown: number) => string
  readonly empty: string
  readonly loading: string
  readonly syncing: string
  readonly blocked: string
  readonly all: string
  readonly project: string
  readonly status: string
  readonly priority: string
  readonly search: string
  readonly latency: string
  readonly latencyHint: string
  readonly statusTodo: string
  readonly statusDoing: string
  readonly statusDone: string
  readonly priorityLow: string
  readonly priorityMedium: string
  readonly priorityHigh: string
  readonly meterTitle: string
  readonly meterLead: string
  readonly meterFilter: string
  readonly meterUi: string
  readonly meterPersist: string
  readonly meterRenders: string
  readonly awaiting: string
  readonly kicker: string
  readonly title: string
  readonly lead: string
  readonly howTo: readonly string[]
  readonly tryLabel: string
  readonly vs: string
}

export const UI_COPY: UiCopy = {
  dbPane: 'TanStack DB',
  naivePane: 'useState / useMemo / await',
  dbBadge: 'すぐ消える',
  naiveBadge: '通信待ち',
  dbHint: '「完了」を押すと、通信を待たずに行が消えます。保存は裏で進みます。',
  naiveHint: '「完了」を押しても、遅延スライダーの時間だけ行が残ります。',
  complete: '完了',
  reset: '最初からやり直す',
  matched: (matched, shown) => `${matched} 件中 ${shown} 件を表示`,
  empty: 'この条件に合うチケットはありません。状態を「すべて」にするか、最初からやり直してください。',
  loading: '読み込み中… 最初の通信を待っています。',
  syncing: '保存中',
  blocked: '通信待ち',
  all: 'すべて',
  project: 'プロジェクト',
  status: '状態',
  priority: '優先度',
  search: 'タイトル検索',
  latency: '通信遅延',
  latencyHint: '右の「完了」で体感できます。800ms のままで差がわかりやすいです。',
  statusTodo: '未着手',
  statusDoing: '進行中',
  statusDone: '完了',
  priorityLow: '低',
  priorityMedium: '中',
  priorityHigh: '高',
  meterTitle: '体感の差',
  meterLead: '左右で同じ操作をしたあと、数字が揃うと差が出ます。',
  meterFilter: '絞り込み',
  meterUi: '画面に反映',
  meterPersist: '保存完了',
  meterRenders: '再描画',
  awaiting: 'まだ測っていません',
  kicker: 'ハンズオン',
  title: 'TanStack DB 実習',
  lead: '同じ課題トラッカーを左右で同時に動かします。左は TanStack DB、右はふつうの React です。データは別世界なので、片方を完了してももう片方は変わりません。',
  howTo: [
    '通信遅延は 800ms のままにしてください。差が手でわかります。',
    '左の「完了」を押すと、行がすぐ消えます。',
    '右の「完了」を押すと、遅延のあいだ行が残ります。下の表で ms を見比べます。',
  ],
  tryLabel: 'やってみよう',
  vs: '対',
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'collections',
    titleJa: 'コレクション',
    tryJa:
      '左右の件数が揃うまで待ってください。最初の読み込みはどちらも SimulatedApi の遅延です。',
    whyJa:
      '左は tickets / projects / people を別々のコレクションに載せ、ライブクエリで結合します。右は 3 本の list を Promise.all してから配列で結合します。差が出る操作はフィルタと完了です。',
    focus: 'load',
    sourceFile: 'src/db-session.ts',
  },
  {
    id: 'live-queries',
    titleJa: 'ライブクエリ',
    tryJa:
      'プロジェクトや検索を変えて、下の「絞り込み」ms を見てください。表示は先頭 50 件、計測はマッチした全件です。',
    whyJa:
      '左は useLiveQuery が inner join と where をコレクション上で再計算します。右は配列の filter / find / sort を毎回走らせます。5000 件ではスキャンも 1ms 前後なので、手で差がわかるのは次の「楽観的更新」です。',
    focus: 'filter',
    sourceFile: 'src/db-session.ts',
  },
  {
    id: 'optimistic-writes',
    titleJa: '楽観的更新',
    tryJa:
      '状態は「未着手」のまま、左右で 1 件ずつ「完了」を押してください。左はすぐ消え、右は遅延のあいだ残ります。',
    whyJa:
      '左は collection.update がすぐ done を塗るので、未着手フィルタなら行が消えます。右は await が終わるまで行が残ります。保存そのものの待ちはどちらも同じです。この画面には失敗させるボタンはありません。',
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
      return `プロジェクトや検索を変えると、両側の絞り込み ms が揃った時点で数字が出ます。いまは ${UI_COPY.awaiting}。`
    }
    return `絞り込みは左が ${msJa(dbMs)}、右が ${msJa(naiveMs)} です。5000 件の配列スキャンはまだ 1ms 前後です。左の数字はクエリ再構築の時間です。手で差がわかるのは完了です。再描画は左 ${contrast.db.renderCount} 回、右 ${contrast.naive.renderCount} 回です。`
  }
  if (lesson.focus === 'complete') {
    const dbUi = contrast.db.mutationUiMs
    const naiveUi = contrast.naive.mutationUiMs
    if (dbUi === null || naiveUi === null || contrast.uiWaitDeltaMs === null) {
      return `左右で 1 件ずつ完了すると、画面反映と保存完了が揃った時点で差が出ます。いまは ${UI_COPY.awaiting}。`
    }
    return `画面反映は左が ${msJa(dbUi)}（${feltJa(dbUi)}）、右が ${msJa(naiveUi)}（${feltJa(naiveUi)}）です。差は ${Math.round(contrast.uiWaitDeltaMs)} ms です。保存完了は左 ${msJa(contrast.db.mutationPersistMs)}、右 ${msJa(contrast.naive.mutationPersistMs)} です。右は画面反映と保存が同じ待ちです。`
  }
  return `最初の待ちはどちらも SimulatedApi の遅延です。差が出る操作はフィルタと完了です。上の「やってみよう」から始めてください。`
}
