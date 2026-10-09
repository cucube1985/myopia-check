import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { sameLabel, validRecords, type ChildRecord, type SavedExam } from './records'

/**
 * 저장 기록의 백업 파일(JSON) 만들기·읽기·합치기.
 *
 * 앱을 지우면 앱 전용 저장소의 기록도 사라지므로, 사용자가 직접 파일로 내보내
 * Drive·메일 등 원하는 곳에 보관하게 한다. 파일은 앱 밖으로 나가므로
 * 선택적으로 암호를 걸 수 있다(PBKDF2-SHA256 → AES-GCM, Web Crypto).
 */

const BACKUP_KIND = 'myopia-backup'
const BACKUP_VERSION = 1
/** OWASP 권고(2023) 수준. 저가형 휴대폰에서도 1초 안팎이다. */
const PBKDF2_ITERATIONS = 310_000

type PlainBackup = {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  exportedAt: string
  encrypted: false
  records: ChildRecord[]
}

type EncryptedBackup = {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  exportedAt: string
  encrypted: true
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  /** records 배열 JSON을 암호화한 값(base64) */
  data: string
}

export type BackupErrorCode = 'format' | 'needs-password' | 'wrong-password' | 'no-crypto'

export class BackupError extends Error {
  readonly code: BackupErrorCode
  constructor(code: BackupErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

function subtle() {
  const s = globalThis.crypto?.subtle
  if (!s) throw new BackupError('no-crypto', '이 환경에서는 암호화 기능을 쓸 수 없습니다.')
  return s
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** 백업 파일 내용(JSON 문자열)을 만든다. 암호가 비어 있으면 암호화하지 않는다. */
export async function serializeBackup(
  records: ChildRecord[],
  password: string,
  now = new Date().toISOString(),
): Promise<string> {
  if (!password) {
    const plain: PlainBackup = {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exportedAt: now,
      encrypted: false,
      records,
    }
    return JSON.stringify(plain, null, 2)
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const cipherText = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(records)),
  )
  const encrypted: EncryptedBackup = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipherText)),
  }
  return JSON.stringify(encrypted, null, 2)
}

/** 파일이 암호화되어 있는지. 형식이 틀리면 BackupError('format'). */
export function backupNeedsPassword(text: string) {
  return readEnvelope(text).encrypted === true
}

function readEnvelope(text: string): PlainBackup | EncryptedBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('format', '백업 파일 형식이 아닙니다. 이 앱에서 만든 .json 파일을 골라 주세요.')
  }
  const d = data as { kind?: unknown; version?: unknown } | null
  if (!d || d.kind !== BACKUP_KIND) {
    throw new BackupError('format', '이 앱의 백업 파일이 아닙니다.')
  }
  if (d.version !== BACKUP_VERSION) {
    throw new BackupError('format', '지원하지 않는 백업 버전입니다. 앱을 최신 버전으로 업데이트해 주세요.')
  }
  return d as PlainBackup | EncryptedBackup
}

/**
 * 백업 파일을 읽어 기록 목록을 돌려준다. 형식이 틀린 기록은 버린다.
 * 암호화된 파일인데 암호가 없거나 틀리면 BackupError.
 */
export async function parseBackup(text: string, password = ''): Promise<ChildRecord[]> {
  const envelope = readEnvelope(text)
  if (!envelope.encrypted) return validRecords(envelope.records)
  if (!password) throw new BackupError('needs-password', '암호가 걸린 백업입니다. 암호를 입력해 주세요.')
  const { kdf, cipher, data } = envelope
  if (
    kdf?.name !== 'PBKDF2' ||
    cipher?.name !== 'AES-GCM' ||
    typeof data !== 'string' ||
    // 비정상적으로 큰 반복 횟수로 앱이 멈추지 않게 한다.
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < 10_000 ||
    kdf.iterations > 5_000_000
  ) {
    throw new BackupError('format', '백업 파일이 손상되었습니다.')
  }
  try {
    const key = await deriveKey(password, fromBase64(kdf.salt), kdf.iterations)
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(cipher.iv) as BufferSource },
      key,
      fromBase64(data) as BufferSource,
    )
    return validRecords(JSON.parse(new TextDecoder().decode(plain)))
  } catch (e) {
    if (e instanceof BackupError) throw e
    // AES-GCM은 암호가 틀리면 인증 실패로 복호화 자체가 거부된다.
    throw new BackupError('wrong-password', '암호가 맞지 않거나 파일이 손상되었습니다.')
  }
}

export type MergeResult = { records: ChildRecord[]; added: number; merged: number }

/**
 * 가져온 기록을 기존 기록과 합친다. 어떤 검사도 지우지 않는 것이 원칙이다.
 *
 * - 같은 id, 또는 이름과 생년월일이 같은 기록은 같은 아이로 보고 검사를 날짜별로 합친다.
 *   같은 날짜의 검사는 더 최근에 저장된 기록의 값을 쓴다.
 * - 이름만 같고 생년월일이 다르면 다른 아이로 보고 «(가져옴)»을 붙여 새로 추가한다.
 */
export function mergeRecords(existing: ChildRecord[], incoming: ChildRecord[]): MergeResult {
  const result = [...existing]
  let added = 0
  let merged = 0

  for (const inc of incoming) {
    const i = result.findIndex(
      (r) => r.id === inc.id || (sameLabel(r.label, inc.label) && r.birth === inc.birth),
    )
    if (i < 0) {
      let label = inc.label
      for (let n = 1; result.some((r) => sameLabel(r.label, label)); n++) {
        label = `${inc.label} (가져옴${n > 1 ? ` ${n}` : ''})`
      }
      result.push({ ...inc, label })
      added++
      continue
    }

    const cur = result[i]
    const incomingNewer = inc.updatedAt > cur.updatedAt
    const [older, newer] = incomingNewer ? [cur, inc] : [inc, cur]
    const byDate = new Map<string, SavedExam>()
    for (const e of older.exams) byDate.set(e.date, e)
    for (const e of newer.exams) byDate.set(e.date, e)
    result[i] = {
      ...newer,
      // 목록의 다른 기록과 이름이 겹치지 않도록 기존 id·이름은 유지한다.
      id: cur.id,
      label: cur.label,
      exams: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      createdAt: cur.createdAt < inc.createdAt ? cur.createdAt : inc.createdAt,
      updatedAt: incomingNewer ? inc.updatedAt : cur.updatedAt,
    }
    merged++
  }
  return { records: result, added, merged }
}

export const backupFileName = (date: string) => `myopia-backup-${date}.json`

/**
 * 백업 파일을 내보낸다.
 * Android: 앱 캐시에 쓰고 공유 창을 띄운다(받을 곳은 사용자가 고른다).
 * 웹(개발용): 파일로 내려받는다.
 * 사용자가 공유 창을 닫으면 false.
 */
export async function exportBackupFile(text: string, fileName: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  }
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  try {
    await Share.share({ title: fileName, files: [uri], dialogTitle: '백업 파일 보내기' })
    return true
  } catch (e) {
    // 공유 창을 닫으면 «Share canceled»로 거부된다. 오류가 아니다.
    if (e instanceof Error && /cancel/i.test(e.message)) return false
    throw e
  }
}
