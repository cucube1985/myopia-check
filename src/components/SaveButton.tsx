import { useState } from 'react'
import { Save } from 'lucide-react'
import type { SaveOutcome } from '../storage/records'

interface SaveButtonProps {
  onSave: () => Promise<SaveOutcome>
  /** 저장 기록과 연결되어 있으면 «덮어쓰기»임을 버튼에 표시한다. */
  linked: boolean
  className?: string
}

/** «이 기기에 저장» 버튼과 결과 안내. 저장은 이 버튼을 누를 때만 일어난다. */
export function SaveButton({ onSave, linked, className = '' }: SaveButtonProps) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)

  return (
    <div className={`save-action ${className}`}>
      <button
        type="button"
        className="secondary-action"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setOutcome(await onSave())
          setBusy(false)
        }}
      >
        <Save size={16} /> {linked ? '저장 기록에 업데이트' : '이 기기에 저장'}
      </button>
      {outcome && (
        <p className={`save-action__message${outcome.ok ? '' : ' is-error'}`} role="status">
          {outcome.message}
        </p>
      )}
    </div>
  )
}
