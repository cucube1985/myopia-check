import { MyopiaPanel } from './MyopiaPanel'
import { emptyPatient, emptyPriorExam, yearsBefore, type Patient, type PriorExam } from '../math/myopia'

/**
 * 예시 입력. 만 9세, 양안 경도 근시, 1년 간격 이전 검사 2회.
 * 오른눈 SE −1.00 → −1.75 → −2.25 로 최소제곱 기울기 약 −0.62 D/년(빠른 진행).
 */
function demoPatient(): Patient {
  const base = emptyPatient()
  const prior = (
    years: number,
    v: Pick<PriorExam, 'rs' | 'rc' | 'ls' | 'lc' | 'axialR' | 'axialL'>,
  ): PriorExam => ({
    ...emptyPriorExam('cycloplegic'),
    date: yearsBefore(base.examDate, years),
    ...v,
  })
  return {
    ...base,
    label: '예시',
    birth: yearsBefore(base.examDate, 9),
    examType: 'cycloplegic',
    rs: '-2.00',
    rc: '-0.50',
    ls: '-1.75',
    lc: '-0.50',
    axialR: '24.10',
    axialL: '23.95',
    parents: 'one',
    history: [
      prior(2, { rs: '-0.75', rc: '-0.50', ls: '-0.75', lc: '-0.25', axialR: '23.45', axialL: '23.40' }),
      prior(1, { rs: '-1.50', rc: '-0.50', ls: '-1.25', lc: '-0.50', axialR: '23.80', axialL: '23.70' }),
    ],
  }
}

interface MyopiaWorkspaceProps {
  patient: Patient
  onPatientChange: (next: Patient) => void
  onShowResult: () => void
  onShowInput: () => void
}

/**
 * 환자 입력 상태는 App이 보관한다.
 * 진료 중에 각막 탭을 잠깐 열었다 돌아와도 입력값이 남아 있어야 하기 때문이다.
 * 값을 비우는 것은 «새 환자» 버튼으로만 한다.
 */
export function MyopiaWorkspace({ patient, onPatientChange, onShowResult, onShowInput }: MyopiaWorkspaceProps) {
  return (
    <MyopiaPanel
      patient={patient}
      onChange={(patch) => onPatientChange({ ...patient, ...patch })}
      onClear={() => { onPatientChange(emptyPatient()); onShowInput() }}
      onDemo={() => { onPatientChange(demoPatient()); onShowResult() }}
      onShowResult={onShowResult}
    />
  )
}
