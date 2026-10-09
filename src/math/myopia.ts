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
  progression: string
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
})

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
  return [p.birth, p.rs, p.rc, p.ls, p.lc, p.axialR, p.axialL, p.axialLimit, p.progression].some(
    (v) => v.trim() !== '',
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
    [p.progression, '연간 변화', -10, 10],
  ] as const) {
    if (value && (numeric(value) === null || Number(value) < low || Number(value) > high)) {
      errors.push(`${label} 입력 범위를 확인해 주세요 (${low}–${high}).`)
    }
  }
  if (p.axialLimit && !p.axialSource.trim()) {
    errors.push('안축장 상한을 사용하려면 해당 연령·성별 기준의 출처를 입력해 주세요.')
  }
  if (errors.length || !age) return { errors, result: null }

  const [rs, rc, ls, lc] = vals as number[]
  const right = rs + rc / 2
  const left = ls + lc / 2
  const worst = Math.min(right, left)
  const mean = (right + left) / 2
  const ref = koreanReference[age.years]
  const z = zScoreFor(worst, ref)
  const band = percentileBand(worst, ref, p.examType)

  const warnings: string[] = []
  if (worst <= -6) {
    warnings.push(
      '고도 근시 범위입니다. 안과에서 안축장과 안저를 포함한 평가 및 관리 계획을 상담하세요.',
    )
  }
  if (p.progression && Number(p.progression) <= -0.5) {
    warnings.push(
      '연간 근시성 변화가 0.50 D 이상입니다. 이전 검사와 검사 방식이 같은지 확인하고 진행 억제 치료를 상담하세요.',
    )
  }
  if (p.progression && Number(p.progression) > 0) {
    warnings.push(
      `연간 변화가 양수(${signed(Number(p.progression))} D/년, 원시 방향)로 입력되었습니다. 근시가 늘어난 경우라면 − 부호를 붙여 입력하세요.`,
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

export type MyopiaResult = NonNullable<ReturnType<typeof analyze>['result']>
export type WorseEye = MyopiaResult['worseEye']
