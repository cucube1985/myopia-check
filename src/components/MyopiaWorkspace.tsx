import { MyopiaPanel } from './MyopiaPanel'
import { emptyPatient, yearsBefore, type Patient } from '../math/myopia'

/** 예시 입력. 만 9세, 양안 경도 근시, 진행 속도가 관찰되는 경우. */
function demoPatient(): Patient {
  const base = emptyPatient()
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
    progression: '-0.62',
    parents: 'one',
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
