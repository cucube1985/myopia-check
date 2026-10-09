import { FolderOpen, PlusCircle, ShieldCheck, Trash2, Users } from 'lucide-react'
import { ageAt, category, signed, today } from '../math/myopia'
import { canStartNewExam, type ChildRecord } from '../storage/records'
import { BackupSection } from './BackupSection'

interface RecordsPanelProps {
  records: ChildRecord[]
  /** 저장소를 읽는 중이면 true */
  loading: boolean
  /** 저장소 읽기·쓰기 오류 안내 */
  error: string | null
  onNewExam: (record: ChildRecord) => void
  onOpenLatest: (record: ChildRecord) => void
  onDelete: (record: ChildRecord) => void
  onDeleteAll: () => void
  onImport: (records: ChildRecord[]) => Promise<string>
}

const seOf = (rs: string, rc: string) => Number(rs) + Number(rc) / 2

export function RecordsPanel({
  records,
  loading,
  error,
  onNewExam,
  onOpenLatest,
  onDelete,
  onDeleteAll,
  onImport,
}: RecordsPanelProps) {
  const sorted = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const now = today()

  return (
    <section className="clinic-card records-panel">
      <div className="card-heading">
        <div>
          <span className="eyebrow">SAVED / 이 기기에 저장된 기록</span>
          <h2>
            <Users size={21} /> 저장 기록
          </h2>
        </div>
        {records.length > 0 && <span className="pill">{records.length}명</span>}
      </div>

      <p className="privacy-note">
        <ShieldCheck size={14} /> 이 휴대폰의 앱 전용 저장 공간에만 있으며 외부로 전송되지
        않습니다. 앱을 삭제하면 기록도 함께 지워지므로 아래 «백업»으로 파일을 만들어 두세요.
      </p>

      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="help">불러오는 중…</p>
      ) : sorted.length === 0 ? (
        <div className="records-empty">
          <FolderOpen size={36} />
          <p>
            저장된 기록이 없습니다.
            <br />
            검사값을 입력한 뒤 «이 기기에 저장»을 누르면 여기에 모입니다.
          </p>
        </div>
      ) : (
        <ul className="records-list">
          {sorted.map((r) => {
            const last = r.exams.at(-1)
            const age = ageAt(r.birth, now)
            const worst = last ? Math.min(seOf(last.rs, last.rc), seOf(last.ls, last.lc)) : null
            const canNew = canStartNewExam(r, now)
            return (
              <li key={r.id} className="record-item">
                <div className="record-item__head">
                  <strong>{r.label}</strong>
                  <span>
                    {r.birth}
                    {age ? ` · 현재 만 ${age.years}세` : ''}
                  </span>
                </div>
                <p className="record-item__meta">
                  검사 {r.exams.length}회
                  {last && ` · 마지막 ${last.date}`}
                  {worst !== null && ` · ${signed(worst)} D ${category(worst)}`}
                </p>
                <div className="record-item__actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={!canNew}
                    onClick={() => onNewExam(r)}
                  >
                    <PlusCircle size={14} /> 오늘 새 검사
                  </button>
                  <button type="button" className="text-button" onClick={() => onOpenLatest(r)}>
                    <FolderOpen size={14} /> 마지막 검사 열기
                  </button>
                  <button
                    type="button"
                    className="text-button record-item__delete"
                    aria-label={`${r.label} 기록 삭제`}
                    onClick={() => onDelete(r)}
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
                {!canNew && (
                  <p className="help">
                    마지막 검사가 3개월 이내라 새 검사로 이어 붙일 수 없습니다. 같은 시기의
                    값을 고치려면 «마지막 검사 열기»를 쓰세요.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {records.length > 0 && (
        <button type="button" className="text-button records-panel__clear" onClick={onDeleteAll}>
          <Trash2 size={14} /> 저장 기록 모두 삭제
        </button>
      )}

      {!loading && <BackupSection records={records} onImport={onImport} />}
    </section>
  )
}
