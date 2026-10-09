import { History, Plus, Trash2 } from 'lucide-react'
import { emptyPriorExam, type ExamType, type PriorExam } from '../math/myopia'
import { DecimalInput } from './DecimalInput'

/** 화면이 지나치게 길어지지 않게 하는 상한. 진료 상담에서는 몇 회분이면 충분하다. */
const MAX_PRIOR_EXAMS = 10

interface FollowUpInputProps {
  history: PriorExam[]
  /** 새로 추가하는 이전 검사의 기본 검사 종류. 현재 검사와 같게 맞춰 방식 차이를 줄인다. */
  defaultExamType: ExamType
  /** 이전 검사일 선택 상한(현재 검사일). */
  examDate: string
  onChange: (history: PriorExam[]) => void
}

export function FollowUpInput({ history, defaultExamType, examDate, onChange }: FollowUpInputProps) {
  const update = (id: string, patch: Partial<PriorExam>) =>
    onChange(history.map((h) => (h.id === id ? { ...h, ...patch } : h)))

  return (
    <section className="follow-up-input" aria-labelledby="follow-up-heading">
      <h3 id="follow-up-heading">
        <History size={16} /> 이전 검사 <small>추적 관찰</small>
      </h3>
      <p className="help">
        이전 검사값을 넣으면 연간 변화(D/년)를 자동으로 계산하고 그래프에 변화 경로를
        표시합니다. 현재 검사보다 3개월 이상 앞선 검사만 사용합니다.
      </p>

      {history.map((h, i) => {
        const name = `이전 검사 ${i + 1}`
        const field = (
          key: 'rs' | 'rc' | 'ls' | 'lc' | 'axialR' | 'axialL',
          label: string,
          ariaPrefix: string,
          signable: boolean,
          placeholder?: string,
        ) => (
          <DecimalInput
            id={`${h.id}-${key}`}
            label={label}
            value={h[key]}
            placeholder={placeholder}
            signable={signable}
            ariaPrefix={`${name} ${ariaPrefix}`}
            onChange={(value) => update(h.id, { [key]: value })}
          />
        )
        return (
          <fieldset className="prior-exam" key={h.id}>
            <legend>{name}</legend>
            <button
              type="button"
              className="text-button prior-exam__remove"
              aria-label={`${name} 삭제`}
              onClick={() => onChange(history.filter((x) => x.id !== h.id))}
            >
              <Trash2 size={13} /> 삭제
            </button>
            <div className="form-grid prior-exam__meta">
              <div className="clinic-field">
                <label htmlFor={`${h.id}-date`}>검사일</label>
                <input
                  id={`${h.id}-date`}
                  type="date"
                  value={h.date}
                  max={examDate || undefined}
                  onChange={(e) => update(h.id, { date: e.target.value })}
                />
              </div>
              <div className="clinic-field">
                <label htmlFor={`${h.id}-type`}>검사 종류</label>
                <select
                  id={`${h.id}-type`}
                  value={h.examType}
                  onChange={(e) => update(h.id, { examType: e.target.value as ExamType })}
                >
                  <option value="cycloplegic">조절마비 굴절검사</option>
                  <option value="auto">비조절마비 자동굴절검사</option>
                  <option value="glasses">안경 처방전</option>
                </select>
              </div>
            </div>
            <div className="prior-exam__eyes">
              <span className="prior-exam__eye">오른눈 OD</span>
              <div className="form-grid">
                {field('rs', 'SPH (D)', '오른눈 ', true, '예: -1.50')}
                {field('rc', 'CYL (D)', '오른눈 ', true, '예: -0.50')}
              </div>
              <span className="prior-exam__eye">왼눈 OS</span>
              <div className="form-grid">
                {field('ls', 'SPH (D)', '왼눈 ', true, '예: -1.25')}
                {field('lc', 'CYL (D)', '왼눈 ', true, '예: -0.50')}
              </div>
              <div className="form-grid">
                {field('axialR', '오른눈 안축장 (mm)', '', false, '선택')}
                {field('axialL', '왼눈 안축장 (mm)', '', false, '선택')}
              </div>
            </div>
          </fieldset>
        )
      })}

      {history.length < MAX_PRIOR_EXAMS && (
        <button
          type="button"
          className="text-button follow-up-input__add"
          onClick={() => onChange([...history, emptyPriorExam(defaultExamType)])}
        >
          <Plus size={14} /> 이전 검사 추가
        </button>
      )}
    </section>
  )
}
