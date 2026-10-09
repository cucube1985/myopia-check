import { useEffect, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ClipboardPenLine, ChartNoAxesCombined, Eye, Info } from 'lucide-react'
import { MyopiaWorkspace } from './components/MyopiaWorkspace'
import { ErrorBoundary } from './components/ErrorBoundary'
import { analyze, emptyPatient, type Patient } from './math/myopia'

export default function App() {
  const [patient, setPatient] = useState<Patient>(emptyPatient)
  const [screen, setScreen] = useState<'input' | 'result'>('input')
  const ready = analyze(patient).result !== null
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = NativeApp.addListener('backButton', () => {
      if (screen === 'result') {
        setScreen('input')
        window.scrollTo({ top: 0, behavior: 'instant' })
      } else {
        void NativeApp.minimizeApp()
      }
    })
    return () => { void listener.then(handle => handle.remove()) }
  }, [screen])
  const navigate = (next: 'input' | 'result') => {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

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
        <h1>{screen === 'input' ? '검사 결과를 쉽게 이해해요.' : '우리 아이의 근시 위치는?'}</h1>
        <p>생년월일과 양쪽 눈의 검사값으로 현재 근시 정도를 살펴보세요.</p>
      </div>
      <ErrorBoundary title="화면을 표시하지 못했습니다." hint="앱을 다시 열어 주세요. 입력값은 별도로 저장되지 않습니다.">
        <MyopiaWorkspace patient={patient} onPatientChange={setPatient} onShowResult={() => navigate('result')} onShowInput={() => navigate('input')} />
      </ErrorBoundary>
      <footer className="prototype-disclaimer">
        <Info size={18} aria-hidden="true" />
        <p>교육 및 상담 보조용 테스트 앱입니다. 조절마비 굴절검사와 안과 전문의 평가를 대신하지 않습니다. 백분위는 정규분포를 가정한 근사값이며 진단이나 미래 예측이 아닙니다.</p>
      </footer>
      <nav className="prototype-nav" aria-label="화면 선택">
        <button type="button" aria-current={screen === 'input' ? 'page' : undefined} onClick={() => navigate('input')}><ClipboardPenLine size={21} /><span>검사값 입력</span></button>
        <button type="button" aria-current={screen === 'result' ? 'page' : undefined} onClick={() => navigate('result')}><ChartNoAxesCombined size={21} /><span>{ready ? '분석 결과 보기' : '결과 안내'}</span>{ready && <i aria-hidden="true" />}</button>
      </nav>
    </main>
  )
}
