import { describe, expect, it } from 'vitest'
import { emptyPatient, type Patient } from '../../math/myopia'
import {
  BackupError,
  backupFileName,
  backupNeedsPassword,
  mergeRecords,
  parseBackup,
  serializeBackup,
} from '../backup'
import { recordFromPatient, type ChildRecord, type SavedExam } from '../records'

const patient = (patch: Partial<Patient> = {}): Patient => ({
  ...emptyPatient(),
  label: '김OO',
  birth: '2017-03-10',
  examDate: '2026-09-01',
  rs: '-2.00',
  rc: '-0.50',
  ls: '-1.75',
  lc: '-0.50',
  ...patch,
})

const record = (patch: Partial<Patient> = {}, at = '2026-09-01T09:00:00.000Z') =>
  recordFromPatient(patient(patch), null, at)

const exam = (date: string, rs: string): SavedExam => ({
  date,
  examType: 'cycloplegic',
  rs,
  rc: '-0.50',
  ls: '-1.50',
  lc: '-0.50',
  axialR: '',
  axialL: '',
})

const withExams = (r: ChildRecord, exams: SavedExam[], updatedAt = r.updatedAt): ChildRecord => ({
  ...r,
  exams,
  updatedAt,
})

/** 기대한 BackupError 코드로 거부되는지 */
async function rejectsWith(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackupError)
  await promise.catch((e: BackupError) => expect(e.code).toBe(code))
}

describe('백업 파일 만들기·읽기', () => {
  const records = [record(), record({ label: '이OO', birth: '2015-01-01' })]

  it('암호 없는 백업은 그대로 다시 읽힌다', async () => {
    const text = await serializeBackup(records, '')
    expect(backupNeedsPassword(text)).toBe(false)
    expect(JSON.parse(text).records).toHaveLength(2)
    expect(await parseBackup(text)).toEqual(records)
  })

  it('암호 백업은 내용이 보이지 않고, 맞는 암호로만 열린다', async () => {
    const text = await serializeBackup(records, '1234 abcd')
    expect(backupNeedsPassword(text)).toBe(true)
    expect(text).not.toContain('김OO')
    expect(text).not.toContain('2017-03-10')
    expect(await parseBackup(text, '1234 abcd')).toEqual(records)
  })

  it('암호가 없거나 틀리면 거부한다', async () => {
    const text = await serializeBackup(records, 'right')
    await rejectsWith(parseBackup(text), 'needs-password')
    await rejectsWith(parseBackup(text, 'wrong'), 'wrong-password')
  })

  it('같은 암호라도 매번 다른 암호문이 나온다(솔트·IV 무작위)', async () => {
    const a = JSON.parse(await serializeBackup(records, 'pw'))
    const b = JSON.parse(await serializeBackup(records, 'pw'))
    expect(a.data).not.toBe(b.data)
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
  })

  it('이 앱의 백업이 아니면 형식 오류', async () => {
    await rejectsWith(parseBackup('not json'), 'format')
    await rejectsWith(parseBackup('{"kind":"other"}'), 'format')
    await rejectsWith(parseBackup('{"kind":"myopia-backup","version":99}'), 'format')
  })

  it('반복 횟수가 비정상인 암호 백업은 열지 않는다', async () => {
    const tampered = JSON.parse(await serializeBackup(records, 'pw'))
    tampered.kdf.iterations = 1e9
    await rejectsWith(parseBackup(JSON.stringify(tampered), 'pw'), 'format')
  })

  it('형식이 틀린 기록만 버린다', async () => {
    const text = JSON.stringify({
      kind: 'myopia-backup',
      version: 1,
      exportedAt: '2026-09-01',
      encrypted: false,
      records: [records[0], { id: 'broken' }],
    })
    expect(await parseBackup(text)).toEqual([records[0]])
  })

  it('파일 이름에 날짜가 들어간다', () => {
    expect(backupFileName('2026-10-09')).toBe('myopia-backup-2026-10-09.json')
  })
})

describe('mergeRecords', () => {
  it('없는 아이는 새로 추가한다', () => {
    const a = record()
    const b = record({ label: '이OO', birth: '2015-01-01' })
    const { records, added, merged } = mergeRecords([a], [b])
    expect(records.map((r) => r.label)).toEqual(['김OO', '이OO'])
    expect([added, merged]).toEqual([1, 0])
  })

  it('같은 아이는 검사를 날짜별로 합치고 지우지 않는다', () => {
    const base = record()
    const mine = withExams(base, [exam('2025-09-01', '-1.50'), exam('2026-09-01', '-2.00')])
    // 다른 휴대폰에서 같은 기록에 2024년 검사를 더한 백업
    const theirs = withExams(
      { ...base },
      [exam('2024-09-01', '-1.00'), exam('2025-09-01', '-1.50')],
      '2026-08-01T00:00:00.000Z',
    )
    const { records, added, merged } = mergeRecords([mine], [theirs])
    expect([added, merged]).toEqual([0, 1])
    expect(records[0].exams.map((e) => e.date)).toEqual(['2024-09-01', '2025-09-01', '2026-09-01'])
  })

  it('같은 날짜 검사는 더 최근에 저장된 쪽 값을 쓴다', () => {
    const base = record()
    const old = withExams(base, [exam('2026-09-01', '-2.00')], '2026-09-01T00:00:00.000Z')
    const fixed = withExams(base, [exam('2026-09-01', '-2.25')], '2026-09-05T00:00:00.000Z')
    expect(mergeRecords([old], [fixed]).records[0].exams[0].rs).toBe('-2.25')
    expect(mergeRecords([fixed], [old]).records[0].exams[0].rs).toBe('-2.25')
  })

  it('id가 달라도 이름·생년월일이 같으면 같은 아이로 본다', () => {
    const a = record()
    const b = record() // 다른 기기에서 따로 만든 같은 아이
    expect(a.id).not.toBe(b.id)
    const { records, merged } = mergeRecords([a], [b])
    expect(merged).toBe(1)
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe(a.id)
  })

  it('이름만 같고 생년월일이 다르면 다른 아이로 추가하고 이름을 구분한다', () => {
    const a = record()
    const b = record({ birth: '2018-05-05' })
    const c = record({ birth: '2019-05-05' })
    const { records, added } = mergeRecords([a], [b, c])
    expect(added).toBe(2)
    expect(records.map((r) => r.label)).toEqual(['김OO', '김OO (가져옴)', '김OO (가져옴 2)'])
  })

  it('같은 백업을 두 번 가져와도 늘어나지 않는다', () => {
    const a = record()
    const once = mergeRecords([], [a]).records
    const twice = mergeRecords(once, [a]).records
    expect(twice).toEqual(once)
  })

  it('기존 목록을 바꾸지 않는다(새 배열을 돌려준다)', () => {
    const a = record()
    const list = [a]
    mergeRecords(list, [withExams(a, [exam('2024-01-01', '-1')], '2027-01-01T00:00:00.000Z')])
    expect(list[0]).toBe(a)
    expect(a.exams).toHaveLength(1)
  })
})
