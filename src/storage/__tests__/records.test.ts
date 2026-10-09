import { describe, expect, it } from 'vitest'
import { analyze, emptyPatient, emptyPriorExam, type Patient } from '../../math/myopia'
import {
  canStartNewExam,
  parseStored,
  patientForNewExam,
  patientFromLatestExam,
  recordFromPatient,
  saveBlocker,
  type ChildRecord,
} from '../records'

const NOW = '2026-09-01T09:00:00.000Z'

const patient = (patch: Partial<Patient> = {}): Patient => ({
  ...emptyPatient(),
  label: '김OO',
  birth: '2017-03-10',
  examDate: '2026-09-01',
  rs: '-2.00',
  rc: '-0.50',
  ls: '-1.75',
  lc: '-0.50',
  axialR: '24.10',
  ...patch,
})

const prior = (date: string, rs = '-1.50') => ({
  ...emptyPriorExam(),
  date,
  rs,
  rc: '-0.50',
  ls: '-1.25',
  lc: '-0.50',
})

describe('recordFromPatient', () => {
  it('현재 검사와 이전 검사를 날짜순 기록으로 만든다', () => {
    const r = recordFromPatient(
      patient({ history: [prior('2025-09-01'), prior('2024-09-01', '-0.75')] }),
      null,
      NOW,
    )
    expect(r.exams.map((e) => e.date)).toEqual(['2024-09-01', '2025-09-01', '2026-09-01'])
    expect(r.exams[2]).toMatchObject({ rs: '-2.00', axialR: '24.10', examType: 'cycloplegic' })
    expect(r.label).toBe('김OO')
    expect(r.createdAt).toBe(NOW)
  })

  it('기록에 화면용 id나 다른 필드를 넣지 않는다', () => {
    const r = recordFromPatient(patient({ history: [prior('2025-09-01')] }), null, NOW)
    for (const e of r.exams) {
      expect(Object.keys(e).sort()).toEqual(
        ['axialL', 'axialR', 'date', 'examType', 'lc', 'ls', 'rc', 'rs'].sort(),
      )
    }
  })

  it('같은 날짜는 현재 검사로 덮는다', () => {
    const r = recordFromPatient(patient({ history: [prior('2026-09-01', '-9.00')] }), null, NOW)
    expect(r.exams).toHaveLength(1)
    expect(r.exams[0].rs).toBe('-2.00')
  })

  it('기존 기록을 덮어쓸 때 id와 생성 시각을 유지한다', () => {
    const first = recordFromPatient(patient(), null, NOW)
    const later = '2026-09-02T09:00:00.000Z'
    const second = recordFromPatient(patient({ recordId: first.id }), first, later)
    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(NOW)
    expect(second.updatedAt).toBe(later)
  })

  it('이름 앞뒤 공백을 지운다', () => {
    expect(recordFromPatient(patient({ label: '  김OO ' }), null, NOW).label).toBe('김OO')
  })
})

describe('saveBlocker', () => {
  it('이름이 없으면 막는다', () => {
    expect(saveBlocker(patient({ label: ' ' }), [])).toContain('이름')
  })

  it('분석이 안 되는 입력은 막는다', () => {
    expect(saveBlocker(patient({ rs: '' }), [])).toContain('검사값')
  })

  it('다른 기록과 이름이 겹치면 막고, 자기 기록이면 허용한다', () => {
    const existing = recordFromPatient(patient(), null, NOW)
    expect(saveBlocker(patient({ label: '김oo' }), [existing])).toContain('이미 있습니다')
    expect(saveBlocker(patient({ recordId: existing.id }), [existing])).toBeNull()
  })

  it('조건을 모두 갖추면 null', () => {
    expect(saveBlocker(patient(), [])).toBeNull()
  })
})

describe('기록 불러오기', () => {
  const record = recordFromPatient(
    patient({ sex: 'female', parents: 'both', history: [prior('2025-09-01')] }),
    null,
    NOW,
  )

  it('새 검사: 저장된 검사가 모두 이전 검사가 되고 현재 검사는 비어 있다', () => {
    const p = patientForNewExam(record, '2027-03-01')
    expect(p.recordId).toBe(record.id)
    expect(p.examDate).toBe('2027-03-01')
    expect(p.rs).toBe('')
    expect(p.history.map((h) => h.date)).toEqual(['2025-09-01', '2026-09-01'])
    expect(p).toMatchObject({ label: '김OO', birth: '2017-03-10', sex: 'female', parents: 'both' })
    // 이전 검사마다 화면용 id가 새로 붙는다.
    expect(new Set(p.history.map((h) => h.id)).size).toBe(2)
  })

  it('새 검사에 값을 채우면 추적 관찰이 그대로 계산된다', () => {
    // 검사일은 미래일 수 없으므로 과거 날짜로 만든 기록을 쓴다.
    const past = recordFromPatient(
      patient({ examDate: '2025-03-01', history: [prior('2024-03-01', '-1.00')] }),
      null,
      NOW,
    )
    const p = { ...patientForNewExam(past, '2026-03-01'), rs: '-2.50', rc: '-0.50', ls: '-2.25', lc: '-0.50' }
    const { result } = analyze(p)
    expect(result!.followUp!.points).toHaveLength(3)
  })

  it('마지막 검사 열기: 마지막 검사가 현재 검사, 나머지가 이전 검사', () => {
    const p = patientFromLatestExam(record)
    expect(p.examDate).toBe('2026-09-01')
    expect(p.rs).toBe('-2.00')
    expect(p.axialR).toBe('24.10')
    expect(p.history.map((h) => h.date)).toEqual(['2025-09-01'])
    expect(analyze(p).result).not.toBeNull()
    expect('date' in p).toBe(false)
  })

  it('불러온 뒤 다시 저장해도 검사가 늘거나 줄지 않는다', () => {
    const again = recordFromPatient(patientFromLatestExam(record), record, NOW)
    expect(again.exams).toEqual(record.exams)
  })

  it('마지막 검사가 90일 이내면 오늘 새 검사를 막는다', () => {
    expect(canStartNewExam(record, '2026-10-01')).toBe(false)
    expect(canStartNewExam(record, '2026-12-01')).toBe(true)
  })
})

describe('parseStored', () => {
  const good = recordFromPatient(patient(), null, NOW)

  it('비었거나 깨진 JSON이면 빈 목록', () => {
    expect(parseStored(null)).toEqual([])
    expect(parseStored('{')).toEqual([])
    expect(parseStored('{"version":99,"records":[]}')).toEqual([])
  })

  it('형식이 틀린 기록만 버리고 나머지는 살린다', () => {
    const broken = { ...good, id: 'x', exams: [{ date: '2026-01-01' }] }
    const raw = JSON.stringify({ version: 1, records: [good, broken, null, 'text'] })
    expect(parseStored(raw)).toEqual([good])
  })

  it('저장한 그대로 다시 읽힌다', () => {
    const raw = JSON.stringify({ version: 1, records: [good] })
    expect(parseStored(raw)).toEqual<ChildRecord[]>([good])
  })
})
