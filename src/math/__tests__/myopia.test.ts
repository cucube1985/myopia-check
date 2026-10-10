import { describe, expect, it } from 'vitest'
import {
  ageAt,
  analyze,
  category,
  emptyPatient,
  emptyPriorExam,
  examTypeLabel,
  hasInput,
  METHOD_ASSUMED_OFFSET_D,
  normalCDF,
  numeric,
  parseDate,
  percentileBand,
  percentileFor,
  rankOutOf100,
  rateLabel,
  sanitizeDecimal,
  slopePerYear,
  signed,
  today,
  toggleSign,
  yearsBefore,
  zScoreFor,
  type Patient,
  type PriorExam,
} from '../myopia'
import { koreanReference, referencePooled, referenceTotalN } from '../../data/koreanReference'

describe('parseDate', () => {
  it('형식이 맞지 않으면 null', () => {
    expect(parseDate('2020-1-1')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('20200101')).toBeNull()
  })

  it('존재하지 않는 날짜를 거른다', () => {
    expect(parseDate('2021-02-30')).toBeNull()
    expect(parseDate('2021-02-29')).toBeNull()
    expect(parseDate('2020-02-29')).not.toBeNull()
  })
})

describe('ageAt', () => {
  it('생일 전날과 생일에 한 살 차이가 난다', () => {
    expect(ageAt('2015-06-15', '2026-06-14')?.years).toBe(10)
    expect(ageAt('2015-06-15', '2026-06-15')?.years).toBe(11)
  })

  /**
   * 민법 제160조: 해당 일이 없는 달에는 그 달의 말일을 기일로 본다.
   * 따라서 2월 29일생은 비윤년에 2월 28일에 나이를 더한다.
   */
  it('2월 29일생은 비윤년에 2월 28일을 생일로 본다', () => {
    expect(ageAt('2016-02-29', '2026-02-27')?.years).toBe(9)
    expect(ageAt('2016-02-29', '2026-02-28')?.years).toBe(10)
    expect(ageAt('2016-02-29', '2026-03-01')?.years).toBe(10)
  })

  it('윤년에는 2월 29일에 나이를 더한다', () => {
    expect(ageAt('2016-02-29', '2028-02-28')?.years).toBe(11)
    expect(ageAt('2016-02-29', '2028-02-29')?.years).toBe(12)
  })

  it('31일생은 말일이 짧은 달에도 처리된다', () => {
    expect(ageAt('2015-01-31', '2026-01-30')?.years).toBe(10)
    expect(ageAt('2015-01-31', '2026-01-31')?.years).toBe(11)
  })

  it('소수 나이는 만 나이와 다음 생일 사이에 있다', () => {
    const age = ageAt('2015-06-15', '2026-12-15')
    expect(age?.years).toBe(11)
    expect(age?.decimal).toBeGreaterThan(11)
    expect(age?.decimal).toBeLessThan(12)
  })

  it('검사일이 생년월일보다 이르면 null', () => {
    expect(ageAt('2026-01-01', '2025-01-01')).toBeNull()
  })
})

describe('normalCDF', () => {
  const known: Array<[number, number]> = [
    [0, 0.5],
    [1, 0.8413447461],
    [1.96, 0.9750021049],
    [-1.96, 0.0249978951],
    [-1, 0.1586552539],
    [3, 0.9986501020],
  ]

  it('알려진 값과 1e-6 이내로 일치한다', () => {
    for (const [z, truth] of known) {
      expect(Math.abs(normalCDF(z) - truth)).toBeLessThan(1e-6)
    }
  })

  it('대칭이다', () => {
    for (const z of [0.3, 1.1, 2.4]) {
      expect(normalCDF(z) + normalCDF(-z)).toBeCloseTo(1, 6)
    }
  })

  it('단조증가한다', () => {
    let previous = 0
    for (let z = -4; z <= 4; z += 0.25) {
      const value = normalCDF(z)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })
})

describe('category', () => {
  it('경계값을 정의대로 분류한다', () => {
    expect(category(0.5)).toBe('비근시')
    expect(category(-0.49)).toBe('비근시')
    expect(category(-0.5)).toBe('경도 근시')
    expect(category(-2.99)).toBe('경도 근시')
    expect(category(-3)).toBe('중등도 근시')
    expect(category(-5.99)).toBe('중등도 근시')
    expect(category(-6)).toBe('고도 근시')
    expect(category(-9)).toBe('고도 근시')
  })
})

describe('signed / numeric', () => {
  it('양수에만 부호를 붙인다', () => {
    expect(signed(1.5)).toBe('+1.50')
    expect(signed(-1.5)).toBe('-1.50')
    expect(signed(0)).toBe('0.00')
  })

  it('빈 문자열과 숫자가 아닌 값을 null로', () => {
    expect(numeric('')).toBeNull()
    expect(numeric('  ')).toBeNull()
    expect(numeric('abc')).toBeNull()
    expect(numeric('0')).toBe(0)
    expect(numeric('-2.25')).toBe(-2.25)
  })
})

describe('참고 분포', () => {
  it('만 5–18세를 모두 덮는다', () => {
    for (let age = 5; age <= 18; age += 1) {
      expect(koreanReference[age]).toBeDefined()
      expect(koreanReference[age].sd).toBeGreaterThan(0)
    }
  })

  it('15–18세는 같은 통합 기준이다', () => {
    const pooled = koreanReference[15]
    for (const age of [16, 17, 18]) {
      expect(koreanReference[age]).toEqual(pooled)
    }
  })

  it('표본 수 합계가 명시된 총원과 같다', () => {
    const counted =
      Object.entries(koreanReference)
        .filter(([age]) => Number(age) <= 15)
        .reduce((sum, [, ref]) => sum + ref.n, 0)
    expect(counted).toBe(referenceTotalN)
  })

  it('연령별 값이 보충표 1(More myopic eye, KNHANES 열)과 한 줄씩 같다', () => {
    // 원문: Sci Rep 2026, 41598_2026_53576_MOESM5_ESM.docx. 행 순서: 나이, n, SE mean, SE Std
    const supplementaryTable1 = [
      [5, 99, -0.25, 0.88],
      [6, 107, -0.17, 1.11],
      [7, 107, -0.57, 1.11],
      [8, 107, -0.85, 1.34],
      [9, 99, -1.23, 1.49],
      [10, 82, -1.71, 1.78],
      [11, 89, -2.36, 2.07],
      [12, 75, -2.54, 2.08],
      [13, 93, -3.09, 2.58],
      [14, 82, -2.91, 2.13],
      [15, 284, -3.45, 2.47], // 보충표의 «15» 행 = 15–18세 통합
    ]
    for (const [age, n, mean, sd] of supplementaryTable1) {
      expect(koreanReference[age], `${age}세`).toMatchObject({ n, mean, sd })
    }
  })

  it('연령별 표를 합치면 논문 Table 1의 전체 평균·SD(−1.93 ± 2.27)와 같다', () => {
    // 15–18세 통합 행은 한 번만 센다.
    const groups = Object.entries(koreanReference)
      .filter(([age]) => Number(age) <= 15)
      .map(([, ref]) => ref)
    const n = groups.reduce((sum, g) => sum + g.n, 0)
    const mean = groups.reduce((sum, g) => sum + g.mean * g.n, 0) / n
    // 전체 분산 = 집단 내 제곱합 + 집단 간 제곱합 (표본 SD)
    const ss = groups.reduce((sum, g) => sum + (g.n - 1) * g.sd ** 2 + g.n * (g.mean - mean) ** 2, 0)
    const sd = Math.sqrt(ss / (n - 1))
    expect(n).toBe(referencePooled.n)
    // 표의 값이 소수 둘째 자리로 반올림되어 있으므로 반올림 오차만 허용한다.
    expect(mean).toBeCloseTo(referencePooled.mean, 2)
    expect(sd).toBeCloseTo(referencePooled.sd, 2)
  })
})

describe('zScoreFor / percentileFor', () => {
  const ref = koreanReference[9]

  it('기준 평균에서 백분위 50', () => {
    expect(percentileFor(ref.mean, ref)).toBeCloseTo(50, 5)
  })

  it('더 근시일수록 백분위가 높다', () => {
    expect(percentileFor(-3, ref)).toBeGreaterThan(percentileFor(-1, ref))
    expect(zScoreFor(-3, ref)).toBeGreaterThan(zScoreFor(-1, ref))
  })

  it('1 SD만큼 근시면 약 84 백분위', () => {
    expect(percentileFor(ref.mean - ref.sd, ref)).toBeCloseTo(84.13, 1)
  })
})

describe('rankOutOf100', () => {
  it('백분위를 또래 100명 중 순위로 바꾼다', () => {
    expect(rankOutOf100(99)).toBe(1)
    expect(rankOutOf100(50)).toBe(50)
    expect(rankOutOf100(2)).toBe(98)
  })

  it('1–100 범위를 벗어나지 않는다', () => {
    expect(rankOutOf100(100)).toBe(1)
    expect(rankOutOf100(0)).toBe(100)
    expect(rankOutOf100(99.99)).toBe(1)
  })
})

describe('percentileBand', () => {
  const ref = koreanReference[9]

  it('검사 방식이 참고 분포와 같으면 범위를 만들지 않는다', () => {
    const band = percentileBand(-2.25, ref, 'auto')
    expect(band.methodMatches).toBe(true)
    expect(band.range).toBeNull()
    expect(band.assumedOffsetD).toBe(0)
  })

  it('조절마비 검사는 더 근시인 쪽으로 범위를 넓힌다', () => {
    const band = percentileBand(-2.25, ref, 'cycloplegic')
    expect(band.methodMatches).toBe(false)
    expect(band.range).not.toBeNull()
    expect(band.range!.low).toBeCloseTo(band.point, 6)
    expect(band.range!.high).toBeGreaterThan(band.point)
    expect(band.range!.high).toBeCloseTo(
      percentileFor(-2.25 - METHOD_ASSUMED_OFFSET_D, ref),
      6,
    )
  })

  it('안경 처방전도 같은 방향으로 처리한다', () => {
    const band = percentileBand(-2.25, ref, 'glasses')
    expect(band.range).not.toBeNull()
    expect(band.range!.high).toBeGreaterThan(band.range!.low)
  })

  /**
   * 가정폭 0.50 D는 헤드라인 숫자를 임상적으로 의미 있게 움직인다.
   * 소수점 한 자리로 백분위를 표시하면 안 되는 근거이므로 수치를 고정해 둔다.
   */
  it('0.50 D 가정이 만 9세에서 백분위를 8점 이상 움직인다', () => {
    const band = percentileBand(-2.25, ref, 'cycloplegic')
    expect(band.range!.high - band.range!.low).toBeGreaterThan(8)
    expect(band.point).toBeCloseTo(75.3, 0)
    expect(band.range!.high).toBeCloseTo(84.6, 0)
  })

  it('평균 부근에서 가정폭의 영향이 가장 크다', () => {
    const nearMean = percentileBand(ref.mean, ref, 'cycloplegic')
    const farTail = percentileBand(-9, ref, 'cycloplegic')
    const width = (b: ReturnType<typeof percentileBand>) => b.range!.high - b.range!.low
    expect(width(nearMean)).toBeGreaterThan(width(farTail))
  })
})

const patient = (patch: Partial<Patient> = {}): Patient => ({
  ...emptyPatient(),
  birth: '2017-03-10',
  examDate: '2026-09-01',
  rs: '-2.00',
  rc: '-0.50',
  ls: '-1.75',
  lc: '-0.50',
  ...patch,
})

describe('analyze — 검증', () => {
  it('빈 입력은 오류를 반환한다', () => {
    const { errors, result } = analyze(emptyPatient())
    expect(result).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })

  it('만 5세 미만·18세 초과를 거른다', () => {
    expect(analyze(patient({ birth: '2023-01-01' })).result).toBeNull()
    expect(analyze(patient({ birth: '2000-01-01' })).result).toBeNull()
  })

  it('검사일이 미래면 거른다', () => {
    const future = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10)
    expect(analyze(patient({ examDate: future })).result).toBeNull()
  })

  it('CYL이 비어 있으면 거른다 — 0은 허용한다', () => {
    expect(analyze(patient({ rc: '' })).result).toBeNull()
    expect(analyze(patient({ rc: '0', lc: '0' })).result).not.toBeNull()
  })

  it('SPH ±30 / CYL ±12 범위를 넘으면 거른다', () => {
    expect(analyze(patient({ rs: '-31' })).result).toBeNull()
    expect(analyze(patient({ rc: '-13' })).result).toBeNull()
    expect(analyze(patient({ rs: '-30' })).result).not.toBeNull()
  })

  it('안축장 상한만 있고 출처가 없으면 거른다', () => {
    expect(analyze(patient({ axialLimit: '24.5' })).result).toBeNull()
    expect(
      analyze(patient({ axialLimit: '24.5', axialSource: '자체 기준표' })).result,
    ).not.toBeNull()
  })

  it('안축장 범위를 벗어나면 거른다', () => {
    expect(analyze(patient({ axialR: '14' })).result).toBeNull()
    expect(analyze(patient({ axialL: '41' })).result).toBeNull()
    expect(analyze(patient({ axialR: '24.1', axialL: '23.9' })).result).not.toBeNull()
  })

  it('입력 중간 상태(«-», «.»)는 숫자로 보지 않는다', () => {
    expect(analyze(patient({ rs: '-' })).result).toBeNull()
    expect(analyze(patient({ lc: '.' })).result).toBeNull()
    expect(analyze(patient({ rs: '-2.' })).result).not.toBeNull()
  })
})

describe('analyze — 계산', () => {
  it('SE = SPH + CYL / 2', () => {
    const { result } = analyze(patient())
    expect(result!.right).toBeCloseTo(-2.25, 10)
    expect(result!.left).toBeCloseTo(-2.0, 10)
  })

  it('더 근시인 눈을 기준으로 삼는다', () => {
    const { result } = analyze(patient())
    expect(result!.worst).toBeCloseTo(-2.25, 10)
    expect(result!.worseEye).toBe('OD')
  })

  it('양안이 같으면 both', () => {
    const { result } = analyze(patient({ ls: '-2.00', lc: '-0.50' }))
    expect(result!.worseEye).toBe('both')
  })

  it('양안 평균을 따로 계산한다', () => {
    const { result } = analyze(patient())
    expect(result!.mean).toBeCloseTo(-2.125, 10)
  })

  it('기본 검사 종류(조절마비)에서는 민감도 범위가 생긴다', () => {
    const { result } = analyze(patient())
    expect(result!.band.methodMatches).toBe(false)
    expect(result!.band.range).not.toBeNull()
    expect(result!.caveats.some((c) => c.includes('조절마비'))).toBe(true)
  })

  it('비조절마비 자동굴절검사에서는 범위가 없다', () => {
    const { result } = analyze(patient({ examType: 'auto' }))
    expect(result!.band.range).toBeNull()
  })
})

describe('analyze — 경고', () => {
  it('고도 근시를 경고한다', () => {
    const { result } = analyze(patient({ rs: '-6.50', rc: '0', ls: '-6.00', lc: '0' }))
    expect(result!.warnings.some((w) => w.includes('고도 근시'))).toBe(true)
  })

  it('연간 0.50 D 이상 진행을 경고한다', () => {
    const { result } = analyze(patient({ progression: '-0.75' }))
    expect(result!.warnings.some((w) => w.includes('진행 억제'))).toBe(true)
  })

  it('연간 0.25 D 진행은 경고하지 않는다', () => {
    const { result } = analyze(patient({ progression: '-0.25' }))
    expect(result!.warnings.some((w) => w.includes('진행 억제'))).toBe(false)
  })

  it('양안 차이 1.50 D 초과를 경고한다', () => {
    const { result } = analyze(patient({ ls: '0', lc: '0' }))
    expect(result!.warnings.some((w) => w.includes('양안 SE 차이'))).toBe(true)
  })

  it('안축장이 입력 상한을 넘으면 경고한다', () => {
    const { result } = analyze(
      patient({ axialR: '25.5', axialL: '23.8', axialLimit: '24.0', axialSource: '자체 기준표' }),
    )
    const axialWarnings = result!.warnings.filter((w) => w.includes('안축장'))
    expect(axialWarnings).toHaveLength(1)
    expect(axialWarnings[0]).toContain('오른눈')
  })

  it('양안 모두 상한을 넘으면 눈마다 경고한다', () => {
    const { result } = analyze(
      patient({ axialR: '25.5', axialL: '25.0', axialLimit: '24.0', axialSource: '자체 기준표' }),
    )
    expect(result!.warnings.filter((w) => w.includes('안축장'))).toHaveLength(2)
  })

  it('연간 변화가 양수면 부호 확인을 안내한다', () => {
    const { result } = analyze(patient({ progression: '0.5' }))
    expect(result!.warnings.some((w) => w.includes('− 부호'))).toBe(true)
    expect(result!.warnings.some((w) => w.includes('진행 억제'))).toBe(false)
  })

  it('상한이 없으면 안축장으로 경고하지 않는다', () => {
    const { result } = analyze(patient({ axialR: '26.0', axialL: '26.0' }))
    expect(result!.warnings.some((w) => w.includes('안축장'))).toBe(false)
  })

  it('분포 양 끝에서 정규분포 가정 한계를 덧붙인다', () => {
    const { result } = analyze(patient({ rs: '-7.00', rc: '0', ls: '-7.00', lc: '0' }))
    expect(result!.caveats.some((c) => c.includes('정규분포'))).toBe(true)
  })
})

describe('보조', () => {
  it('오늘 날짜가 ISO 형식이다', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('검사 종류 라벨이 모두 있다', () => {
    expect(examTypeLabel('cycloplegic')).toBe('조절마비 굴절검사')
    expect(examTypeLabel('auto')).toBe('비조절마비 자동굴절검사')
    expect(examTypeLabel('glasses')).toBe('안경 처방전')
  })

  it('emptyPatient는 오늘 날짜와 조절마비 기본값을 가진다', () => {
    const p = emptyPatient()
    expect(p.examDate).toBe(today())
    expect(p.examType).toBe('cycloplegic')
    expect(p.rs).toBe('')
  })
})

describe('입력 보조', () => {
  it('yearsBefore는 2월 29일을 평년 2월 28일로 맞춘다', () => {
    expect(yearsBefore('2028-02-29', 9)).toBe('2019-02-28')
    expect(yearsBefore('2028-02-29', 8)).toBe('2020-02-29')
    expect(yearsBefore('2026-10-09', 9)).toBe('2017-10-09')
    expect(yearsBefore('잘못된 날짜', 9)).toBe('')
  })

  it('윤년 예시 환자도 만 9세로 분석된다', () => {
    const birth = yearsBefore('2028-02-29', 9)
    expect(ageAt(birth, '2028-02-29')!.years).toBe(9)
  })

  it('toggleSign은 부호를 바꾸고 빈 칸은 «-»로 시작한다', () => {
    expect(toggleSign('2.00')).toBe('-2.00')
    expect(toggleSign('-2.00')).toBe('2.00')
    expect(toggleSign('+1.25')).toBe('-1.25')
    expect(toggleSign('')).toBe('-')
    expect(toggleSign('-')).toBe('')
  })

  it('sanitizeDecimal은 쉼표를 점으로, 잘못된 문자는 버린다', () => {
    expect(sanitizeDecimal('-2,25')).toBe('-2.25')
    expect(sanitizeDecimal('−2.00a')).toBe('-2.00')
    expect(sanitizeDecimal('1.2.3')).toBe('1.23')
    expect(sanitizeDecimal('2-')).toBe('2')
    expect(sanitizeDecimal('-')).toBe('-')
    expect(sanitizeDecimal('+0.5')).toBe('+0.5')
  })

  it('hasInput은 첫 화면(기본값만 있음)을 입력 전으로 본다', () => {
    expect(hasInput(emptyPatient())).toBe(false)
    expect(hasInput({ ...emptyPatient(), rs: '-1' })).toBe(true)
    expect(hasInput({ ...emptyPatient(), birth: '2017-01-01' })).toBe(true)
  })
})

describe('추적 관찰', () => {
  const prior = (patch: Partial<PriorExam>): PriorExam => ({
    ...emptyPriorExam('cycloplegic'),
    rs: '-1.50',
    rc: '-0.50',
    ls: '-1.25',
    lc: '-0.50',
    ...patch,
  })

  it('slopePerYear는 두 점이면 두 점 사이 기울기, 세 점이면 최소제곱 기울기다', () => {
    expect(slopePerYear([{ t: -1, v: -1.75 }, { t: 0, v: -2.25 }])).toBeCloseTo(-0.5, 10)
    expect(
      slopePerYear([{ t: -2, v: -1.0 }, { t: -1, v: -1.75 }, { t: 0, v: -2.25 }]),
    ).toBeCloseTo(-0.625, 10)
    expect(slopePerYear([{ t: 0, v: 1 }])).toBeNull()
    expect(slopePerYear([{ t: 0, v: 1 }, { t: 0, v: 2 }])).toBeNull()
  })

  it('이전 검사가 없으면 followUp은 null이고 직접 입력한 변화를 쓴다', () => {
    const { result } = analyze(patient({ progression: '-0.75' }))
    expect(result!.followUp).toBeNull()
    expect(result!.progression).toEqual({ value: -0.75, source: 'manual' })
  })

  it('1년 전 검사로 양안 연간 변화를 계산한다', () => {
    // 현재 OD −2.25, OS −2.00 / 1년 전 OD −1.75, OS −1.50 → 양안 −0.50 D/년
    const { result } = analyze(patient({ history: [prior({ date: '2025-09-01' })] }))
    const f = result!.followUp!
    expect(f.rateRight).toBeCloseTo(-0.5, 2)
    expect(f.rateLeft).toBeCloseTo(-0.5, 2)
    expect(f.spanYears).toBeCloseTo(1, 2)
    expect(f.points.map((x) => x.current)).toEqual([false, true])
    expect(result!.progression!.source).toBe('history')
    expect(result!.warnings.some((w) => w.includes('이전 검사 대비'))).toBe(true)
  })

  it('이전 검사가 있으면 직접 입력한 연간 변화는 무시하고 검증하지도 않는다', () => {
    const { result } = analyze(
      patient({ progression: '99', history: [prior({ date: '2025-09-01', rs: '-2.00', ls: '-1.75' })] }),
    )
    expect(result).not.toBeNull()
    expect(result!.progression!.source).toBe('history')
    expect(result!.warnings.some((w) => w.includes('진행 억제'))).toBe(false)
  })

  it('입력 순서와 관계없이 날짜순으로 정렬한다', () => {
    const { result } = analyze(
      patient({
        history: [
          prior({ date: '2025-09-01' }),
          prior({ date: '2024-09-01', rs: '-0.75', ls: '-0.75', lc: '-0.25' }),
        ],
      }),
    )
    expect(result!.followUp!.points.map((x) => x.date)).toEqual([
      '2024-09-01',
      '2025-09-01',
      '2026-09-01',
    ])
  })

  it('더 빠르게 진행하는 눈을 진행 속도로 쓴다', () => {
    // OD 1년간 −0.25, OS 1년간 −1.00
    const { result } = analyze(
      patient({ history: [prior({ date: '2025-09-01', rs: '-1.75', ls: '-0.75' })] }),
    )
    expect(result!.followUp!.rateFastest).toBeCloseTo(result!.followUp!.rateLeft, 10)
    expect(result!.followUp!.rateLeft).toBeCloseTo(-1.0, 2)
  })

  it('현재 검사일과 90일 미만 차이면 거른다', () => {
    expect(analyze(patient({ history: [prior({ date: '2026-07-01' })] })).result).toBeNull()
    expect(analyze(patient({ history: [prior({ date: '2026-06-01' })] })).result).not.toBeNull()
  })

  it('검사일이 없거나 생년월일보다 앞서면 거른다', () => {
    expect(analyze(patient({ history: [prior({ date: '' })] })).result).toBeNull()
    expect(analyze(patient({ history: [prior({ date: '2016-01-01' })] })).result).toBeNull()
  })

  it('굴절값이 비었거나 범위를 넘으면 거른다', () => {
    expect(analyze(patient({ history: [prior({ date: '2025-09-01', lc: '' })] })).result).toBeNull()
    expect(analyze(patient({ history: [prior({ date: '2025-09-01', rs: '-31' })] })).result).toBeNull()
    expect(
      analyze(patient({ history: [prior({ date: '2025-09-01', axialR: '41' })] })).result,
    ).toBeNull()
  })

  it('검사 방식이 섞이면 한계를 덧붙인다', () => {
    const same = analyze(patient({ history: [prior({ date: '2025-09-01' })] })).result!
    expect(same.followUp!.mixedMethods).toBe(false)
    const mixed = analyze(
      patient({ history: [prior({ date: '2025-09-01', examType: 'auto' })] }),
    ).result!
    expect(mixed.followUp!.mixedMethods).toBe(true)
    expect(mixed.caveats.some((c) => c.includes('검사 방식 차이'))).toBe(true)
  })

  it('추적 기간이 6개월 미만이면 한계를 덧붙인다', () => {
    const { result } = analyze(patient({ history: [prior({ date: '2026-05-01' })] }))
    expect(result!.caveats.some((c) => c.includes('추적 기간'))).toBe(true)
  })

  it('안축장 변화는 값이 있는 시점끼리만 계산한다', () => {
    const { result } = analyze(
      patient({
        axialR: '24.10',
        history: [prior({ date: '2025-09-01', axialR: '23.80', axialL: '23.70' })],
      }),
    )
    expect(result!.followUp!.axialRateRight).toBeCloseTo(0.3, 2)
    // 현재 왼눈 안축장이 없어 한 시점뿐이다.
    expect(result!.followUp!.axialRateLeft).toBeNull()
  })

  it('rateLabel은 경고 기준(−0.50 D/년)과 맞물린다', () => {
    expect(rateLabel(-0.5)).toBe('빠른 진행')
    expect(rateLabel(-0.3)).toBe('근시 진행 중')
    expect(rateLabel(-0.1)).toBe('변화 작음')
    expect(rateLabel(0.1)).toBe('변화 작음')
    expect(rateLabel(0.3)).toBe('원시 방향 변화')
  })

  it('hasInput은 이전 검사 줄만 추가해도 입력 시작으로 본다', () => {
    expect(hasInput({ ...emptyPatient(), history: [emptyPriorExam()] })).toBe(true)
  })
})
