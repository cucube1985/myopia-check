import { Preferences } from '@capacitor/preferences'
import {
  analyze,
  emptyPatient,
  emptyPriorExam,
  MIN_FOLLOW_UP_DAYS,
  parseDate,
  type ExamType,
  type ParentMyopia,
  type Patient,
  type PriorExam,
  type Sex,
} from '../math/myopia'

/**
 * 아이별 검사 기록의 로컬 저장.
 *
 * Android에서는 Capacitor Preferences(앱 전용 SharedPreferences)에 저장한다.
 * 다른 앱은 읽을 수 없고 AndroidManifest의 allowBackup=false로 클라우드 백업에도
 * 포함되지 않는다. 암호화하지 않으므로 잠금이 풀린 휴대폰에서는 앱으로 볼 수 있다.
 * 웹(개발용)에서는 같은 API가 localStorage를 쓴다.
 *
 * 사용자가 «이 기기에 저장»을 누를 때만 쓰고, 자동 저장은 하지 않는다.
 */

export const STORAGE_KEY = 'myopia.records'
const SCHEMA_VERSION = 1

export type SavedExam = Omit<PriorExam, 'id'>

export type ChildRecord = {
  id: string
  /** 목록에 표시할 이름·차트번호. 기록 사이에 겹치지 않는다. */
  label: string
  birth: string
  sex: Sex
  parents: ParentMyopia
  axialLimit: string
  axialSource: string
  /** 날짜 오름차순. 같은 날짜는 하나만 둔다. */
  exams: SavedExam[]
  createdAt: string
  updatedAt: string
}

/** 저장 버튼을 누른 결과. 화면에 그대로 안내한다. */
export type SaveOutcome = { ok: boolean; message: string }

type StoredData = { version: typeof SCHEMA_VERSION; records: ChildRecord[] }

const newId = () => `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** 필요한 필드만 골라낸다. PriorExam의 id나 Patient의 다른 필드가 기록에 섞이지 않게 한다. */
const toSavedExam = ({ date, examType, rs, rc, ls, lc, axialR, axialL }: SavedExam): SavedExam => ({
  date,
  examType,
  rs,
  rc,
  ls,
  lc,
  axialR,
  axialL,
})

const toPriorExam = (exam: SavedExam): PriorExam => ({ ...emptyPriorExam(exam.examType), ...exam })

/** 이름 비교(대소문자·앞뒤 공백 무시). */
export const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** 화면의 입력(현재 검사 + 이전 검사)을 저장 기록으로 만든다. 날짜가 같으면 현재 검사가 남는다. */
export function recordFromPatient(p: Patient, existing: ChildRecord | null, now: string): ChildRecord {
  const byDate = new Map<string, SavedExam>()
  for (const h of p.history) byDate.set(h.date, toSavedExam(h))
  byDate.set(p.examDate, toSavedExam({ ...p, date: p.examDate }))
  return {
    id: existing?.id ?? newId(),
    label: p.label.trim(),
    birth: p.birth,
    sex: p.sex,
    parents: p.parents,
    axialLimit: p.axialLimit,
    axialSource: p.axialSource,
    exams: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

/** 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function saveBlocker(p: Patient, records: ChildRecord[]): string | null {
  if (!p.label.trim()) return '저장하려면 위쪽 «아이 이름·차트번호»를 입력해 주세요.'
  if (!analyze(p).result) return '검사값을 모두 올바르게 입력한 뒤 저장할 수 있습니다.'
  const clash = records.find((r) => r.id !== p.recordId && sameLabel(r.label, p.label))
  if (clash) {
    return `«${clash.label}» 기록이 이미 있습니다. 저장 기록에서 불러와 이어서 저장하거나 다른 이름을 쓰세요.`
  }
  return null
}

/** 공통 정보만 채운 환자 입력. 검사값은 호출하는 쪽에서 채운다. */
const basePatient = (r: ChildRecord): Patient => ({
  ...emptyPatient(),
  recordId: r.id,
  label: r.label,
  birth: r.birth,
  sex: r.sex,
  parents: r.parents,
  axialLimit: r.axialLimit,
  axialSource: r.axialSource,
})

const daysBetween = (from: string, to: string) => {
  const a = parseDate(from)
  const b = parseDate(to)
  return a && b ? (b.getTime() - a.getTime()) / 86_400_000 : 0
}

/**
 * 오늘 새 검사를 시작할 수 있는지. 마지막 검사가 추적 관찰 최소 간격(90일)보다
 * 가까우면 이전 검사로 넣을 수 없으므로 «마지막 검사 열기»로 고치게 한다.
 */
export function canStartNewExam(r: ChildRecord, todayDate: string) {
  const last = r.exams.at(-1)
  return !last || daysBetween(last.date, todayDate) >= MIN_FOLLOW_UP_DAYS
}

/** 다음 방문: 저장된 검사를 모두 이전 검사로 넣고, 오늘 날짜의 빈 검사를 연다. */
export function patientForNewExam(r: ChildRecord, todayDate: string): Patient {
  const last = r.exams.at(-1)
  return {
    ...basePatient(r),
    examDate: todayDate,
    examType: last?.examType ?? 'cycloplegic',
    history: r.exams.map(toPriorExam),
  }
}

/** 마지막 검사를 현재 검사로, 나머지를 이전 검사로 연다. 결과를 다시 보거나 고칠 때 쓴다. */
export function patientFromLatestExam(r: ChildRecord): Patient {
  const last = r.exams.at(-1)
  if (!last) return basePatient(r)
  const { date, examType, rs, rc, ls, lc, axialR, axialL } = last
  return {
    ...basePatient(r),
    examDate: date,
    examType,
    rs,
    rc,
    ls,
    lc,
    axialR,
    axialL,
    history: r.exams.slice(0, -1).map(toPriorExam),
  }
}

const isString = (v: unknown): v is string => typeof v === 'string'
const EXAM_TYPES: ExamType[] = ['cycloplegic', 'auto', 'glasses']
const SEXES: Sex[] = ['unknown', 'male', 'female']
const PARENTS: ParentMyopia[] = ['unknown', 'none', 'one', 'both']

function isSavedExam(v: unknown): v is SavedExam {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    ['date', 'rs', 'rc', 'ls', 'lc', 'axialR', 'axialL'].every((k) => isString(e[k])) &&
    EXAM_TYPES.includes(e.examType as ExamType)
  )
}

function isChildRecord(v: unknown): v is ChildRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    ['id', 'label', 'birth', 'axialLimit', 'axialSource', 'createdAt', 'updatedAt'].every((k) =>
      isString(r[k]),
    ) &&
    SEXES.includes(r.sex as Sex) &&
    PARENTS.includes(r.parents as ParentMyopia) &&
    Array.isArray(r.exams) &&
    r.exams.every(isSavedExam)
  )
}

/**
 * 저장된 JSON을 읽는다. 형식이 맞지 않는 기록은 버리고 나머지는 살린다.
 * 기록 하나가 깨졌다고 전체 목록을 잃지 않게 하기 위해서다.
 */
export function parseStored(raw: string | null): ChildRecord[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as Partial<StoredData>
    if (data?.version !== SCHEMA_VERSION) return []
    return validRecords(data.records)
  } catch {
    return []
  }
}

/** 형식이 맞는 기록만 남긴다. 백업 파일을 가져올 때도 같은 검사를 쓴다. */
export function validRecords(list: unknown): ChildRecord[] {
  return Array.isArray(list) ? list.filter(isChildRecord) : []
}

export async function loadRecords(): Promise<ChildRecord[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEY })
  return parseStored(value)
}

export async function writeRecords(records: ChildRecord[]) {
  const data: StoredData = { version: SCHEMA_VERSION, records }
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(data) })
}

export async function clearRecords() {
  await Preferences.remove({ key: STORAGE_KEY })
}
