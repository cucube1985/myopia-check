import {
  koreanReference,
  referenceAgeMax,
  referenceAgeMin,
  referenceExamType,
  type AgeReference,
} from '../data/koreanReference'

export type ExamType = 'cycloplegic' | 'auto' | 'glasses'
export type Sex = 'unknown' | 'male' | 'female'
export type ParentMyopia = 'unknown' | 'none' | 'one' | 'both'

export type Patient = {
  /**
   * 인쇄물 식별용 자유 입력(차트번호 등). 저장·전송되지 않고 화면과 인쇄물에만 쓰인다.
   * 인쇄물이 여러 장 섞이는 것을 막기 위한 항목이며 비워 둘 수 있다.
   */
  label: string
  birth: string
  examDate: string
  sex: Sex
  examType: ExamType
  rs: string
  rc: string
  ls: string
  lc: string
  /** 오른눈(OD) 안축장, mm */
  axialR: string
  /** 왼눈(OS) 안축장, mm */
  axialL: string
  axialLimit: string
  axialSource: string
  parents: ParentMyopia
  /** 직접 입력한 연간 SE 변화. 이전 검사(history)가 있으면 쓰지 않는다. */
  progression: string
  /** 이전 검사 목록(추적 관찰). 입력 순서대로 두고, 계산할 때 날짜순으로 정렬한다. */
  history: PriorExam[]
  /** 저장 기록에서 불러온 경우 그 기록의 id. 저장하면 이 기록을 덮어쓴다. 계산에는 쓰지 않는다. */
  recordId: string | null
}

/** 추적 관찰용 이전 검사 한 건. 현재 검사와 같은 형식의 문자열 입력을 받는다. */
export type PriorExam = {
  /** 목록 렌더링용 키. 표시하지 않는다. */
  id: string
  date: string
  examType: ExamType
  rs: string
  rc: string
  ls: string
  lc: string
  axialR: string
  axialL: string
}

export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const emptyPatient = (): Patient => ({
  label: '',
  birth: '',
  examDate: today(),
  sex: 'unknown',
  examType: 'cycloplegic',
  rs: '',
  rc: '',
  ls: '',
  lc: '',
  axialR: '',
  axialL: '',
  axialLimit: '',
  axialSource: '',
  parents: 'unknown',
  progression: '',
  history: [],
  recordId: null,
})

let priorExamSeq = 0

export const emptyPriorExam = (examType: ExamType = 'cycloplegic'): PriorExam => ({
  id: `prior-${++priorExamSeq}`,
  date: '',
  examType,
  rs: '',
  rc: '',
  ls: '',
  lc: '',
  axialR: '',
  axialL: '',
})

/**
 * 이전 검사와 현재 검사 사이의 최소 간격(일).
 * 간격이 너무 짧으면 측정 오차(±0.25 D 수준)가 연간 환산 시 몇 배로 부풀어
 * 진행 경고가 잘못 뜬다.
 */
export const MIN_FOLLOW_UP_DAYS = 90

const DAYS_PER_YEAR = 365.25
const DAY_MS = 86_400_000

/**
 * 최소제곱 기울기(단위/년). 점이 2개면 두 점을 잇는 기울기와 같다.
 * 점이 2개 미만이거나 시점이 모두 같으면 null.
 */
export function slopePerYear(points: { t: number; v: number }[]) {
  if (points.length < 2) return null
  const tMean = points.reduce((sum, p) => sum + p.t, 0) / points.length
  const vMean = points.reduce((sum, p) => sum + p.v, 0) / points.length
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.t - tMean) * (p.v - vMean)
    den += (p.t - tMean) ** 2
  }
  return den === 0 ? null : num / den
}

export function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const result = new Date(Date.UTC(y, m - 1, d))
  return result.getUTCFullYear() === y &&
    result.getUTCMonth() === m - 1 &&
    result.getUTCDate() === d
    ? result
    : null
}

/**
 * date에서 years년 전의 같은 날짜. 2월 29일은 평년이면 2월 28일로 맞춘다.
 * 예시 환자처럼 «오늘 기준 만 N세» 생년월일을 만들 때 쓴다.
 */
export function yearsBefore(date: string, years: number) {
  const d = parseDate(date)
  if (!d) return ''
  const y = d.getUTCFullYear() - years
  const m = d.getUTCMonth()
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const day = Math.min(d.getUTCDate(), lastDay)
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function ageAt(birth: string, exam: string) {
  const b = parseDate(birth)
  const e = parseDate(exam)
  if (!b || !e || e < b) return null
  let years = e.getUTCFullYear() - b.getUTCFullYear()
  const anniversary = (year: number) =>
    new Date(
      Date.UTC(
        year,
        b.getUTCMonth(),
        Math.min(
          b.getUTCDate(),
          new Date(Date.UTC(year, b.getUTCMonth() + 1, 0)).getUTCDate(),
        ),
      ),
    )
  if (e < anniversary(b.getUTCFullYear() + years)) years -= 1
  const previous = anniversary(b.getUTCFullYear() + years)
  const next = anniversary(b.getUTCFullYear() + years + 1)
  return {
    years,
    decimal: years + (e.getTime() - previous.getTime()) / (next.getTime() - previous.getTime()),
  }
}

export function numeric(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
}

/**
 * 소수 입력칸 정리. 일부 로캘의 쉼표 소수점을 점으로 바꾸고,
 * 유니코드 마이너스(−)는 -로 바꾸고, 부호(맨 앞 한 번)·숫자·소수점(한 번) 외의 문자는 버린다.
 * 입력 중간 상태(«-», «-2.»)는 그대로 둔다.
 */
export function sanitizeDecimal(value: string) {
  const cleaned = value.replace(/,/g, '.').replace(/[−–]/g, '-').replace(/[^\d.+-]/g, '')
  const sign = /^[+-]/.test(cleaned) ? cleaned[0] : ''
  const body = cleaned.slice(sign.length).replace(/[+-]/g, '')
  const dot = body.indexOf('.')
  return sign + (dot < 0 ? body : body.slice(0, dot + 1) + body.slice(dot + 1).replace(/\./g, ''))
}

/**
 * 부호 전환. 일부 안드로이드 키보드(숫자·소수 자판)에는 − 키가 없어서
 * 입력칸 옆 ± 버튼으로 부호를 바꾼다. 빈 칸이면 «-»로 시작한다.
 */
export function toggleSign(value: string) {
  const v = value.trim()
  if (v.startsWith('-')) return v.slice(1)
  if (v.startsWith('+')) return `-${v.slice(1)}`
  return `-${v}`
}

/** 사용자가 무언가 입력을 시작했는지. 빈 화면에서 오류 목록을 미리 보여 주지 않기 위해 쓴다. */
export function hasInput(p: Patient) {
  return (
    p.history.length > 0 ||
    [p.birth, p.rs, p.rc, p.ls, p.lc, p.axialR, p.axialL, p.axialLimit, p.progression].some(
      (v) => v.trim() !== '',
    )
  )
}

export function category(se: number) {
  return se > -0.5 ? '비근시' : se > -3 ? '경도 근시' : se > -6 ? '중등도 근시' : '고도 근시'
}

export function signed(n: number, digits = 2) {
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
}

/** Zelen & Severo 근사. |오차| < 7.5e-8. */
export function normalCDF(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const tail =
    ((Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * t) *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z >= 0 ? 1 - tail : tail
}

/**
 * 검사 방식 차이를 가정할 때 쓰는 굴절값 폭(D).
 *
 * 소아에서 조절마비 굴절값은 비조절마비 자동굴절검사보다 덜 근시로 읽히며,
 * 통상 0.5 D 이상 차이가 보고된다. 참고 분포는 비조절마비 자료이므로,
 * 조절마비 값을 그대로 비교하면 백분위가 낮게(덜 근시인 쪽으로) 나온다.
 *
 * 이 값은 보정 계수가 아니라 **민감도 분석용 가정폭**이다.
 * 화면에도 가정폭을 함께 표시하고, 수치를 자동 보정하지 않는다.
 */
export const METHOD_ASSUMED_OFFSET_D = 0.5

/** 참고 분포 대비 근시 방향 z-score. 값이 클수록 기준 평균보다 근시. */
export const zScoreFor = (se: number, ref: AgeReference) => (ref.mean - se) / ref.sd

/** 근시가 큰 쪽에서의 백분위(0–100). */
export const percentileFor = (se: number, ref: AgeReference) =>
  normalCDF(zScoreFor(se, ref)) * 100

/** 또래 100명 중 근시가 심한 쪽으로 몇 번째인지. 1 = 가장 근시. */
export function rankOutOf100(percentile: number): number {
  return Math.max(1, Math.min(100, Math.round(100 - percentile) || 1))
}

export type PercentileBand = {
  /** 입력값 그대로 계산한 백분위 */
  point: number
  /** 검사 방식 가정을 반영한 범위. 방식이 일치하면 null. */
  range: { low: number; high: number } | null
  /** 참고 분포와 검사 방식이 일치하는지 */
  methodMatches: boolean
  assumedOffsetD: number
}

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  cycloplegic: '조절마비 굴절검사',
  auto: '비조절마비 자동굴절검사',
  glasses: '안경 처방전',
}

export const examTypeLabel = (type: ExamType) => EXAM_TYPE_LABEL[type]

/**
 * 백분위와 그 민감도 범위를 계산한다.
 *
 * 조절마비 검사와 안경 처방전은 모두 참고 분포(비조절마비)보다 덜 근시인 쪽으로
 * 읽히므로, 실제 위치는 계산값과 "가정폭만큼 더 근시인 값으로 계산한 값" 사이에 있다.
 */
export function percentileBand(se: number, ref: AgeReference, examType: ExamType): PercentileBand {
  const point = percentileFor(se, ref)
  const methodMatches = examType === referenceExamType
  if (methodMatches) {
    return { point, range: null, methodMatches, assumedOffsetD: 0 }
  }
  const shifted = percentileFor(se - METHOD_ASSUMED_OFFSET_D, ref)
  return {
    point,
    range: { low: Math.min(point, shifted), high: Math.max(point, shifted) },
    methodMatches,
    assumedOffsetD: METHOD_ASSUMED_OFFSET_D,
  }
}

export function analyze(p: Patient) {
  const age = ageAt(p.birth, p.examDate)
  const errors: string[] = []

  if (!age || age.years < referenceAgeMin || age.years > referenceAgeMax) {
    errors.push(
      `생년월일과 검사일을 확인해 주세요. 분석 대상은 만 ${referenceAgeMin}–${referenceAgeMax}세입니다.`,
    )
  }
  if (p.examDate > today()) errors.push('검사일은 오늘 이후일 수 없습니다.')

  const vals = [p.rs, p.rc, p.ls, p.lc].map(numeric)
  if (vals.some((v) => v === null)) {
    errors.push('양쪽 눈의 SPH와 CYL을 모두 입력해 주세요. 난시가 없으면 CYL에 0을 입력합니다.')
  }
  if (vals.some((v, i) => v !== null && Math.abs(v) > (i % 2 ? 12 : 30))) {
    errors.push('굴절값 범위를 확인해 주세요. SPH ±30 D, CYL ±12 D 이내로 입력합니다.')
  }
  for (const [value, label, low, high] of [
    [p.axialR, '오른눈 안축장', 15, 40],
    [p.axialL, '왼눈 안축장', 15, 40],
    [p.axialLimit, '연령별 안축장 상한', 15, 40],
    // 이전 검사가 있으면 직접 입력한 연간 변화는 쓰지 않으므로 검사하지 않는다.
    [p.history.length ? '' : p.progression, '연간 변화', -10, 10],
  ] as const) {
    if (value && (numeric(value) === null || Number(value) < low || Number(value) > high)) {
      errors.push(`${label} 입력 범위를 확인해 주세요 (${low}–${high}).`)
    }
  }
  if (p.axialLimit && !p.axialSource.trim()) {
    errors.push('안축장 상한을 사용하려면 해당 연령·성별 기준의 출처를 입력해 주세요.')
  }

  const exam = parseDate(p.examDate)
  const birth = parseDate(p.birth)
  p.history.forEach((h, i) => {
    const name = `이전 검사 ${i + 1}`
    const date = parseDate(h.date)
    if (!date) {
      errors.push(`${name}: 검사일을 입력해 주세요.`)
    } else {
      if (birth && date < birth) errors.push(`${name}: 검사일이 생년월일보다 앞섭니다.`)
      if (exam && (exam.getTime() - date.getTime()) / DAY_MS < MIN_FOLLOW_UP_DAYS) {
        errors.push(
          `${name}: 현재 검사일보다 ${MIN_FOLLOW_UP_DAYS}일(약 3개월) 이상 앞선 검사만 연간 변화 계산에 씁니다.`,
        )
      }
    }
    const hv = [h.rs, h.rc, h.ls, h.lc].map(numeric)
    if (hv.some((v) => v === null)) {
      errors.push(`${name}: 양쪽 눈의 SPH와 CYL을 모두 입력해 주세요.`)
    } else if (hv.some((v, j) => Math.abs(v!) > (j % 2 ? 12 : 30))) {
      errors.push(`${name}: 굴절값 범위를 확인해 주세요 (SPH ±30 D, CYL ±12 D).`)
    }
    if (
      [h.axialR, h.axialL].some(
        (v) => v && (numeric(v) === null || Number(v) < 15 || Number(v) > 40),
      )
    ) {
      errors.push(`${name}: 안축장 입력 범위를 확인해 주세요 (15–40).`)
    }
  })

  if (errors.length || !age || !exam) return { errors, result: null }

  const [rs, rc, ls, lc] = vals as number[]
  const right = rs + rc / 2
  const left = ls + lc / 2
  const worst = Math.min(right, left)
  const mean = (right + left) / 2
  const ref = koreanReference[age.years]
  const z = zScoreFor(worst, ref)
  const band = percentileBand(worst, ref, p.examType)
  const followUp = buildFollowUp(p, exam, { right, left, worst })
  /** 진행 속도. 이전 검사가 있으면 그것으로 계산하고, 없으면 직접 입력값을 쓴다. */
  const progression = followUp
    ? { value: followUp.rateFastest, source: 'history' as const }
    : p.progression
      ? { value: Number(p.progression), source: 'manual' as const }
      : null

  const warnings: string[] = []
  if (worst <= -6) {
    warnings.push(
      '고도 근시 범위입니다. 안과에서 안축장과 안저를 포함한 평가 및 관리 계획을 상담하세요.',
    )
  }
  if (progression && progression.value <= -0.5) {
    warnings.push(
      progression.source === 'history'
        ? `이전 검사 대비 연간 근시성 변화가 ${signed(progression.value)} D/년으로 0.50 D 이상입니다. 진행 억제 치료를 상담하세요.`
        : '연간 근시성 변화가 0.50 D 이상입니다. 이전 검사와 검사 방식이 같은지 확인하고 진행 억제 치료를 상담하세요.',
    )
  }
  if (progression?.source === 'manual' && progression.value > 0) {
    warnings.push(
      `연간 변화가 양수(${signed(progression.value)} D/년, 원시 방향)로 입력되었습니다. 근시가 늘어난 경우라면 − 부호를 붙여 입력하세요.`,
    )
  }
  if (p.axialLimit) {
    for (const [value, eye] of [
      [p.axialR, '오른눈'],
      [p.axialL, '왼눈'],
    ] as const) {
      if (value && Number(value) > Number(p.axialLimit)) {
        warnings.push(
          `${eye} 안축장 ${value} mm가 입력된 연령별 상한 ${p.axialLimit} mm를 넘습니다. 기준 출처를 진료 시 확인하세요.`,
        )
      }
    }
  }
  if (Math.abs(right - left) > 1.5) {
    warnings.push('양안 SE 차이가 1.50 D를 넘습니다. 양쪽 눈의 교정 상태를 따로 평가하세요.')
  }

  /** 해석의 한계 — 임상 경고가 아니라 이 숫자를 얼마나 믿을 수 있는지에 관한 것. */
  const caveats: string[] = []
  if (!band.methodMatches) {
    caveats.push(
      `입력 검사 종류는 ${examTypeLabel(p.examType)}이고 참고 분포는 ${examTypeLabel(
        referenceExamType,
      )}입니다. 방식 차이 ${METHOD_ASSUMED_OFFSET_D.toFixed(2)} D를 가정하면 위치가 범위로 넓어집니다.`,
    )
  }
  if (p.examType === 'glasses') {
    caveats.push(
      '안경 처방값은 착용 적응을 고려해 조정되므로 굴절검사값과 다를 수 있습니다.',
    )
  }
  if (followUp?.mixedMethods) {
    caveats.push(
      '이전 검사와 현재 검사의 방식이 달라 변화량에 검사 방식 차이(조절마비 여부 등)가 섞일 수 있습니다.',
    )
  }
  if (followUp && followUp.spanYears < 0.5) {
    caveats.push(
      `추적 기간이 약 ${Math.round(followUp.spanYears * 12)}개월로 짧아 연간 환산값의 오차가 큽니다. 6개월 이상 간격의 검사로 다시 확인하세요.`,
    )
  }
  if (age.years >= 15) {
    caveats.push('만 15–18세는 하나의 통합 기준을 사용하므로 연령별 구분이 없습니다.')
  }
  if (worst <= -6 || worst >= 1.5) {
    caveats.push(
      '분포의 양 끝에서는 정규분포 가정의 오차가 커집니다. 이 구간의 백분위는 순서 참고용으로만 보세요.',
    )
  }

  return {
    errors,
    result: {
      age,
      right,
      left,
      worst,
      mean,
      ref,
      z,
      band,
      percentile: band.point,
      followUp,
      progression,
      warnings,
      caveats,
      category: category(worst),
      worseEye: (right === left ? 'both' : right < left ? 'OD' : 'OS') as
        | 'OD'
        | 'OS'
        | 'both',
    },
  }
}

export type FollowUpPoint = {
  date: string
  /** 현재 검사일 기준 시점(년). 이전 검사는 음수. */
  t: number
  /** 검사 당시 나이(소수). */
  ageDecimal: number | null
  examType: ExamType
  right: number
  left: number
  worst: number
  axialR: number | null
  axialL: number | null
  current: boolean
}

/**
 * 이전 검사와 현재 검사로 연간 변화를 계산한다. 이전 검사가 없으면 null.
 * analyze()에서 입력 검증을 통과한 뒤에만 호출하므로 값은 모두 유효하다.
 *
 * 점이 3개 이상이면 양 끝 두 점이 아니라 최소제곱 기울기를 쓴다.
 * 한 번의 측정 오차가 속도를 크게 흔들지 않게 하기 위해서다.
 */
function buildFollowUp(
  p: Patient,
  exam: Date,
  current: { right: number; left: number; worst: number },
) {
  if (!p.history.length) return null
  const yearsFromExam = (date: string) =>
    (parseDate(date)!.getTime() - exam.getTime()) / DAY_MS / DAYS_PER_YEAR
  const optional = (v: string) => (v.trim() === '' ? null : Number(v))

  const points: FollowUpPoint[] = [
    ...p.history.map((h) => {
      const right = Number(h.rs) + Number(h.rc) / 2
      const left = Number(h.ls) + Number(h.lc) / 2
      return {
        date: h.date,
        t: yearsFromExam(h.date),
        ageDecimal: ageAt(p.birth, h.date)?.decimal ?? null,
        examType: h.examType,
        right,
        left,
        worst: Math.min(right, left),
        axialR: optional(h.axialR),
        axialL: optional(h.axialL),
        current: false,
      }
    }),
    {
      date: p.examDate,
      t: 0,
      ageDecimal: ageAt(p.birth, p.examDate)?.decimal ?? null,
      examType: p.examType,
      ...current,
      axialR: optional(p.axialR),
      axialL: optional(p.axialL),
      current: true,
    },
  ].sort((a, b) => a.t - b.t)

  // 이전 검사는 모두 현재보다 90일 이상 앞서므로 시점이 둘 이상이고 기울기가 존재한다.
  const rateRight = slopePerYear(points.map((x) => ({ t: x.t, v: x.right })))!
  const rateLeft = slopePerYear(points.map((x) => ({ t: x.t, v: x.left })))!
  /** 안축장은 그 눈의 값이 있는 시점끼리, 기간이 최소 간격 이상일 때만 계산한다. */
  const axialRate = (key: 'axialR' | 'axialL') => {
    const usable = points.filter((x) => x[key] !== null)
    if (usable.length < 2) return null
    if ((usable.at(-1)!.t - usable[0].t) * DAYS_PER_YEAR < MIN_FOLLOW_UP_DAYS) return null
    return slopePerYear(usable.map((x) => ({ t: x.t, v: x[key]! })))
  }

  return {
    points,
    spanYears: -points[0].t,
    rateRight,
    rateLeft,
    /** 근시 쪽으로 더 빠르게 변하는 눈의 속도. 진행 경고에 쓴다. */
    rateFastest: Math.min(rateRight, rateLeft),
    axialRateRight: axialRate('axialR'),
    axialRateLeft: axialRate('axialL'),
    mixedMethods: points.some((x) => x.examType !== p.examType),
  }
}

export type FollowUp = NonNullable<ReturnType<typeof buildFollowUp>>

/**
 * 연간 SE 변화의 말 표현. −0.50 D/년은 analyze()의 진행 경고 기준과 같다.
 * ±0.25 D/년 이내는 측정 오차 범위와 겹치므로 «변화 작음»으로만 표현한다.
 */
export function rateLabel(rate: number) {
  if (rate >= 0.25) return '원시 방향 변화'
  if (rate > -0.25) return '변화 작음'
  if (rate > -0.5) return '근시 진행 중'
  return '빠른 진행'
}

export type MyopiaResult = NonNullable<ReturnType<typeof analyze>['result']>
export type WorseEye = MyopiaResult['worseEye']
