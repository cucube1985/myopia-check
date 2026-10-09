import { useRef, useState } from 'react'
import { DatabaseBackup, Download, Upload } from 'lucide-react'
import { today } from '../math/myopia'
import {
  BackupError,
  backupFileName,
  backupNeedsPassword,
  exportBackupFile,
  parseBackup,
  serializeBackup,
} from '../storage/backup'
import type { ChildRecord } from '../storage/records'

interface BackupSectionProps {
  records: ChildRecord[]
  /** 가져온 기록을 합쳐 저장하고 결과 안내 문구를 돌려준다. */
  onImport: (records: ChildRecord[]) => Promise<string>
}

type Status = { ok: boolean; message: string } | null

/** 저장 기록 화면 아래의 백업 내보내기·가져오기. */
export function BackupSection({ records, onImport }: BackupSectionProps) {
  const [exportPassword, setExportPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  /** 암호가 걸린 파일을 고른 뒤 암호 입력을 기다리는 동안의 파일 내용 */
  const [pending, setPending] = useState<{ name: string; text: string } | null>(null)
  const [importPassword, setImportPassword] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const run = async (task: () => Promise<Status>) => {
    setBusy(true)
    try {
      setStatus(await task())
    } catch (e) {
      setStatus({
        ok: false,
        message: e instanceof BackupError ? e.message : '처리하지 못했습니다. 다시 시도해 주세요.',
      })
    } finally {
      setBusy(false)
    }
  }

  const exportNow = () =>
    run(async () => {
      const text = await serializeBackup(records, exportPassword)
      const sent = await exportBackupFile(text, backupFileName(today()))
      if (!sent) return null
      return {
        ok: true,
        message: `${records.length}명의 기록을 ${exportPassword ? '암호를 걸어 ' : ''}백업 파일로 만들었습니다.`,
      }
    })

  const importText = (text: string, password: string) =>
    run(async () => {
      const incoming = await parseBackup(text, password)
      setPending(null)
      setImportPassword('')
      if (!incoming.length) return { ok: false, message: '백업 파일에 가져올 기록이 없습니다.' }
      return { ok: true, message: await onImport(incoming) }
    })

  const pickFile = async (file: File) => {
    setStatus(null)
    const text = await file.text()
    try {
      if (backupNeedsPassword(text)) {
        setPending({ name: file.name, text })
        return
      }
    } catch (e) {
      setStatus({ ok: false, message: e instanceof BackupError ? e.message : '파일을 읽지 못했습니다.' })
      return
    }
    void importText(text, '')
  }

  return (
    <section className="backup-section" aria-labelledby="backup-heading">
      <h3 id="backup-heading">
        <DatabaseBackup size={16} /> 백업
      </h3>
      <p className="help">
        앱을 지우거나 휴대폰을 바꾸면 기록이 사라집니다. 백업 파일을 만들어 Drive·메일 등
        원하는 곳에 보관하세요. 백업 파일은 앱 밖으로 나가므로 암호를 거는 것을 권합니다.
      </p>

      {records.length > 0 && (
        <div className="backup-section__row">
          <div className="clinic-field">
            <label htmlFor="backup-export-password">백업 암호 (선택)</label>
            <input
              id="backup-export-password"
              type="password"
              autoComplete="new-password"
              value={exportPassword}
              placeholder="비워 두면 암호 없이 저장"
              onChange={(e) => setExportPassword(e.target.value)}
            />
          </div>
          <p className="help">
            {exportPassword
              ? '이 암호를 잊으면 백업을 열 수 없습니다. 따로 적어 두세요.'
              : '암호가 없으면 파일을 받은 누구나 내용을 볼 수 있습니다.'}
          </p>
          <button type="button" className="secondary-action" disabled={busy} onClick={() => void exportNow()}>
            <Download size={16} /> 백업 파일 만들기 ({records.length}명)
          </button>
        </div>
      )}

      <div className="backup-section__row">
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // 같은 파일을 다시 고를 수 있게 비운다.
            if (file) void pickFile(file)
          }}
        />
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={16} /> 백업 파일 가져오기
        </button>
        <p className="help">
          가져온 기록은 지금 기록과 합칩니다. 같은 아이(이름·생년월일 일치)는 검사 날짜별로
          합치고, 지금 있는 검사는 지우지 않습니다.
        </p>
      </div>

      {pending && (
        <form
          className="backup-section__row"
          onSubmit={(e) => {
            e.preventDefault()
            void importText(pending.text, importPassword)
          }}
        >
          <div className="clinic-field">
            <label htmlFor="backup-import-password">«{pending.name}» 암호</label>
            <input
              id="backup-import-password"
              type="password"
              autoComplete="current-password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
            />
          </div>
          <div className="backup-section__actions">
            <button type="submit" className="secondary-action" disabled={busy || !importPassword}>
              암호 확인 후 가져오기
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setPending(null)
                setImportPassword('')
              }}
            >
              취소
            </button>
          </div>
        </form>
      )}

      {busy && <p className="help" role="status">처리 중…</p>}
      {status && (
        <p className={`save-action__message${status.ok ? '' : ' is-error'}`} role="status">
          {status.message}
        </p>
      )}
    </section>
  )
}
