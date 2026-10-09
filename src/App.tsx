import { useCallback, useEffect, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ClipboardPenLine, ChartNoAxesCombined, Eye, FolderHeart, Info } from 'lucide-react'
import { MyopiaWorkspace } from './components/MyopiaWorkspace'
import { RecordsPanel } from './components/RecordsPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { analyze, emptyPatient, today, type Patient } from './math/myopia'
import {
  clearRecords,
  loadRecords,
  patientForNewExam,
  patientFromLatestExam,
  recordFromPatient,
  saveBlocker,
  writeRecords,
  type ChildRecord,
  type SaveOutcome,
} from './storage/records'

type Screen = 'input' | 'result' | 'records'

export default function App() {
  const [patient, setPatient] = useState<Patient>(emptyPatient)
  const [screen, setScreen] = useState<Screen>('input')
  const [records, setRecords] = useState<ChildRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const ready = analyze(patient).result !== null

  useEffect(() => {
    loadRecords()
      .then(setRecords)
      .catch(() => setRecordsError('저장 기록을 읽지 못했습니다. 앱을 다시 열어 주세요.'))
      .finally(() => setRecordsLoading(false))
  }, [])

  const navigate = useCallback((next: Screen) => {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = NativeApp.addListener('backButton', () => {
      if (screen !== 'input') navigate('input')
      else void NativeApp.minimizeApp()
    })
    return () => { void listener.then(handle => handle.remove()) }
  }, [screen, navigate])

  /** 저장 목록 전체를 바꾸고 기기에 쓴다. 실패하면 화면 목록은 바꾸지 않는다. */
  const persist = async (next: ChildRecord[]) => {
    await writeRecords(next)
    setRecords(next)
    setRecordsError(null)
  }

  const save = async (): Promise<SaveOutcome> => {
    const blocker = saveBlocker(patient, records)
    if (blocker) return { ok: false, message: blocker }
    const existing = records.find((r) => r.id === patient.recordId) ?? null
    const record = recordFromPatient(patient, existing, new Date().toISOString())
    try {
      await persist([...records.filter((r) => r.id !== record.id), record])
    } catch {
      return { ok: false, message: '저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.' }
    }
    setPatient({ ...patient, label: record.label, recordId: record.id })
    return {
      ok: true,
      message: `«${record.label}» 기록에 ${existing ? '저장했습니다' : '새로 저장했습니다'} · 검사 ${record.exams.length}회`,
    }
  }

  const remove = async (target: ChildRecord | 'all') => {
    const question =
      target === 'all'
        ? `저장된 기록 ${records.length}명을 모두 삭제할까요? 되돌릴 수 없습니다.`
        : `«${target.label}» 기록(검사 ${target.exams.length}회)을 삭제할까요? 되돌릴 수 없습니다.`
    if (!window.confirm(question)) return
    try {
      if (target === 'all') {
        await clearRecords()
        setRecords([])
      } else {
        await persist(records.filter((r) => r.id !== target.id))
      }
    } catch {
      setRecordsError('삭제하지 못했습니다. 다시 시도해 주세요.')
      return
    }
    // 지금 화면의 입력이 지운 기록에서 온 것이면 연결만 끊는다. 입력값은 남긴다.
    if (target === 'all' || patient.recordId === target.id) {
      setPatient((p) => ({ ...p, recordId: null }))
    }
  }

  const linkedRecord = records.find((r) => r.id === patient.recordId) ?? null

  return (
    <main className="app-shell myopia-prototype" data-screen={screen}>
      <header className="prototype-header">
        <div className="brand">
          <span className="brand__mark"><Eye size={23} /></span>
          <div><strong>우리 아이 근시</strong><span>만 5–18세 · 근시 정도 알아보기</span></div>
        </div>
        <span className="prototype-badge">TEST · 0.1.0</span>
      </header>
      <div className="prototype-intro">
        <span className="eyebrow">MYOPIA CHECK</span>
        <h1>
          {screen === 'input'
            ? '검사 결과를 쉽게 이해해요.'
            : screen === 'result'
              ? '우리 아이의 근시 위치는?'
              : '저장한 아이 기록'}
        </h1>
        <p>생년월일과 양쪽 눈의 검사값으로 현재 근시 정도를 살펴보세요.</p>
      </div>
      <ErrorBoundary title="화면을 표시하지 못했습니다." hint="앱을 다시 열어 주세요. 저장하지 않은 입력값은 사라질 수 있습니다.">
        {screen === 'records' ? (
          <RecordsPanel
            records={records}
            loading={recordsLoading}
            error={recordsError}
            onNewExam={(r) => { setPatient(patientForNewExam(r, today())); navigate('input') }}
            onOpenLatest={(r) => { setPatient(patientFromLatestExam(r)); navigate('result') }}
            onDelete={(r) => void remove(r)}
            onDeleteAll={() => void remove('all')}
          />
        ) : (
          <MyopiaWorkspace
            patient={patient}
            linkedRecordLabel={linkedRecord?.label ?? null}
            onPatientChange={setPatient}
            onSave={save}
            onShowResult={() => navigate('result')}
            onShowInput={() => navigate('input')}
          />
        )}
      </ErrorBoundary>
      <footer className="prototype-disclaimer">
        <Info size={18} aria-hidden="true" />
        <p>교육 및 상담 보조용 테스트 앱입니다. 조절마비 굴절검사와 안과 전문의 평가를 대신하지 않습니다. 백분위는 정규분포를 가정한 근사값이며 진단이나 미래 예측이 아닙니다.</p>
      </footer>
      <nav className="prototype-nav" aria-label="화면 선택">
        <button type="button" aria-current={screen === 'input' ? 'page' : undefined} onClick={() => navigate('input')}><ClipboardPenLine size={21} /><span>검사값 입력</span></button>
        <button type="button" aria-current={screen === 'result' ? 'page' : undefined} onClick={() => navigate('result')}><ChartNoAxesCombined size={21} /><span>{ready ? '분석 결과 보기' : '결과 안내'}</span>{ready && <i aria-hidden="true" />}</button>
        <button type="button" aria-current={screen === 'records' ? 'page' : undefined} onClick={() => navigate('records')}><FolderHeart size={21} /><span>저장 기록</span></button>
      </nav>
    </main>
  )
}
