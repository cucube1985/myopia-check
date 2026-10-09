import {
  Baby,
  ChartNoAxesCombined,
  Copy,
  FlaskConical,
  Info,
  Printer,
  ShieldCheck,
  TriangleAlert,
  UserRoundPlus,
} from 'lucide-react'
import {
  koreanReference,
  referenceSource,
  referenceTotalN,
  referenceTrendSource,
  referenceYear,
} from '../data/koreanReference'
import {
  ageAt,
  analyze,
  category,
  examTypeLabel,
  hasInput,
  rankOutOf100,
  sanitizeDecimal,
  signed,
  today,
  toggleSign,
  type ExamType,
  type ParentMyopia,
  type Patient,
  type Sex,
  type WorseEye,
} from '../math/myopia'
import { GrowthChart } from './GrowthChart'
import { Capacitor } from '@capacitor/core'

interface MyopiaPanelProps {
  patient: Patient
  onChange: (patch: Partial<Patient>) => void
  onClear: () => void
  onDemo: () => void
  onShowResult: () => void
}

/** 좌우 칸의 라벨이 같아서, 화면 낭독기용 버튼 이름에 눈을 덧붙인다. */
const EYE_PREFIX: Partial<Record<string, string>> = { rs: '오른눈 ', rc: '오른눈 ', ls: '왼눈 ', lc: '왼눈 ' }

const numericPositive = (value: string) => value.trim() !== '' && Number(value) > 0

const worseEyeLabel = (worseEye: WorseEye) =>
  worseEye === 'both' ? '양안 동일' : worseEye === 'OD' ? '오른눈 OD' : '왼눈 OS'

export function MyopiaPanel({ patient: p, onChange, onClear, onDemo, onShowResult }: MyopiaPanelProps) {
  const { result: r, errors } = analyze(p)
  const age = ageAt(p.birth, p.examDate)
  /** 아무것도 입력하지 않은 첫 화면에서는 오류 목록을 보여 주지 않는다. */
  const shownErrors = hasInput(p) ? errors : []

  /**
   * 소수 입력칸. type="number"는 일부 안드로이드 키보드에서 − 키가 없고
   * «-»만 입력한 중간 상태를 지워 버리므로 text + inputMode="decimal"을 쓰고,
   * 부호가 필요한 칸에는 ± 버튼을 붙인다. 범위 검사는 analyze()가 한다.
   */
  const field = (
    key: 'rs' | 'rc' | 'ls' | 'lc' | 'axialR' | 'axialL' | 'axialLimit' | 'progression',
    label: string,
    placeholder = '0.00',
    signable = false,
  ) => {
    const id = `myopia-${key}`
    return (
      <div className="clinic-field">
        <label htmlFor={id}>{label}</label>
        <div className="signed-input">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={p[key]}
            placeholder={placeholder}
            onChange={(e) => onChange({ [key]: sanitizeDecimal(e.target.value) })}
          />
          {signable && (
            <button
              type="button"
              className="sign-toggle"
              aria-label={`${EYE_PREFIX[key] ?? ''}${label} 부호 바꾸기`}
              onClick={() => {
                onChange({ [key]: toggleSign(p[key]) })
                // 부호를 바꾼 뒤 바로 숫자를 이어서 입력할 수 있게 한다.
                document.getElementById(id)?.focus()
              }}
            >
              ±
            </button>
          )}
        </div>
      </div>
    )
  }

  const rankLabel = r
    ? r.band.range
      ? `${rankOutOf100(r.band.range.high)}~${rankOutOf100(r.band.range.low)}`
      : `약 ${rankOutOf100(r.band.point)}`
    : ''

  const percentileLabel = r
    ? r.band.range
      ? `P${Math.round(r.band.range.low)}~P${Math.round(r.band.range.high)}`
      : `P${Math.round(r.band.point)}`
    : ''

  return (
    <div className="clinical-layout">
      <section className="clinic-card input-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">01 / REFRACTION</span>
            <h2>
              <Baby size={21} /> 아이의 검사 정보
            </h2>
          </div>
          <div className="card-heading__actions">
            <button type="button" className="text-button" onClick={onDemo}>
              <FlaskConical size={15} /> 예시
            </button>
            <button type="button" className="text-button" onClick={onClear}>
              <UserRoundPlus size={15} /> 새 환자
            </button>
          </div>
        </div>

        <label className="clinic-field">
          <span>검사 식별 (선택)</span>
          <input
            value={p.label}
            maxLength={40}
            placeholder="차트번호 등 · 저장되지 않습니다"
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </label>

        <div className="form-grid">
          <label className="clinic-field">
            <span>생년월일</span>
            <input
              type="date"
              value={p.birth}
              max={p.examDate || today()}
              onChange={(e) => onChange({ birth: e.target.value })}
            />
          </label>
          <label className="clinic-field">
            <span>
              검사일{' '}
              <button
                type="button"
                className="text-button inline"
                onClick={() => onChange({ examDate: today() })}
              >
                오늘
              </button>
            </span>
            <input
              type="date"
              max={today()}
              value={p.examDate}
              onChange={(e) => onChange({ examDate: e.target.value })}
            />
          </label>
        </div>

        <div className="age-banner">
          {age
            ? `검사일 기준 만 ${age.years}세 · ${age.decimal.toFixed(2)}세`
            : '생년월일을 입력하면 만 나이를 계산합니다.'}
        </div>

        <div className="form-grid">
          <label className="clinic-field">
            <span>성별</span>
            <select value={p.sex} onChange={(e) => onChange({ sex: e.target.value as Sex })}>
              <option value="unknown">미상</option>
              <option value="male">남아</option>
              <option value="female">여아</option>
            </select>
            <small className="field-note">참고 분포가 성별 통합이라 계산에 반영하지 않습니다.</small>
          </label>
          <label className="clinic-field">
            <span>검사 종류</span>
            <select
              value={p.examType}
              onChange={(e) => onChange({ examType: e.target.value as ExamType })}
            >
              <option value="cycloplegic">조절마비 굴절검사</option>
              <option value="auto">비조절마비 자동굴절검사</option>
              <option value="glasses">안경 처방전</option>
            </select>
          </label>
        </div>
        <p className="help">
          참고 분포는 <strong>비조절마비 자동굴절검사</strong> 자료입니다. 다른 방식을 고르면
          또래 비교를 범위로 표시합니다.
        </p>

        <div className="eye-entry">
          <h3>
            오른눈 <small>OD</small>
          </h3>
          <div className="form-grid">
            {field('rs', '구면 SPH (D)', '예: -2.00', true)}
            {field('rc', '난시 CYL (D)', '예: -0.50', true)}
          </div>
        </div>

        <div className="eye-entry">
          <h3>
            왼눈 <small>OS</small>
            <button
              type="button"
              className="text-button"
              onClick={() => onChange({ ls: p.rs, lc: p.rc })}
            >
              <Copy size={13} /> 오른눈 복사
            </button>
          </h3>
          <div className="form-grid">
            {field('ls', '구면 SPH (D)', '예: -1.75', true)}
            {field('lc', '난시 CYL (D)', '예: -0.50', true)}
          </div>
        </div>

        <p className="help">
          처방전에 적힌 + / − 부호 그대로 입력하세요. 키보드에 − 키가 없으면 ± 버튼을
          누릅니다. SE = SPH + CYL ÷ 2
        </p>

        <details className="clinic-details">
          <summary>추가 정보 · 안축장 / 가족력 / 진행 속도</summary>
          <div className="form-grid">
            {field('axialR', '오른눈 안축장 (mm)', '선택 사항')}
            {field('axialL', '왼눈 안축장 (mm)', '선택 사항')}
          </div>
          {field('progression', '연간 SE 변화 (D/년)', '예: -0.50', true)}
          <p className="help">근시가 0.50 D 증가했다면 −0.50을 입력합니다.</p>
          {numericPositive(p.progression) && (
            <p className="help field-warning" role="status">
              양수는 원시 방향 변화를 뜻합니다. 근시가 늘었다면 ± 버튼으로 − 부호를 붙여 주세요.
            </p>
          )}
          <label className="clinic-field">
            <span>부모 근시</span>
            <select
              value={p.parents}
              onChange={(e) => onChange({ parents: e.target.value as ParentMyopia })}
            >
              <option value="unknown">모름 / 미입력</option>
              <option value="none">없음</option>
              <option value="one">한 분</option>
              <option value="both">두 분 모두</option>
            </select>
          </label>
          <div className="form-grid">
            {field('axialLimit', '의료진 지정 연령별 AL 상한 (mm)', '자동 기준 없음')}
            <label className="clinic-field">
              <span>상한 기준 출처 · 연령/성별</span>
              <input
                value={p.axialSource}
                onChange={(e) => onChange({ axialSource: e.target.value })}
                placeholder="의료진 기준 또는 참고표"
              />
            </label>
          </div>
          <p className="help">
            검증된 한국 소아 연령별 안축장 상한은 내장하지 않았습니다. 상한이 없으면 길고
            짧음을 자동 판정하지 않습니다.
          </p>
        </details>

        <p className="privacy-note">
          <ShieldCheck size={14} /> 입력값은 이 화면에서만 계산되며 저장·전송되지 않습니다.
          화면을 새로 고치거나 «새 환자»를 누르면 모두 지워집니다.
        </p>
        <button type="button" className="primary-action result-jump" disabled={!r} onClick={onShowResult}>
          {r ? '근시 분석 결과 보기' : '생년월일과 양안 검사값을 입력하세요'}
        </button>
        {!r && shownErrors.length > 0 && (
          <ul className="input-errors">{shownErrors.map(error => <li key={error}>{error}</li>)}</ul>
        )}
      </section>

      <div className="result-column" aria-live="polite">
        {!r ? (
          <section className="clinic-card empty-result">
            <ChartNoAxesCombined size={44} />
            <h2>
              검사값을 입력하면
              <br />
              아이의 근시 위치가 보입니다.
            </h2>
            <p>
              양안 결과와 또래 비교를 한눈에 확인하고
              <br />
              보호자에게 그대로 보여 주거나 인쇄할 수 있습니다.
            </p>
            <ul>
              {shownErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <button type="button" className="primary-action" onClick={onDemo}>
              예시로 먼저 둘러보기
            </button>
          </section>
        ) : (
          <>
            <div className="print-header">
              <strong>근시 평가 요약</strong>
              <span>
                {p.label ? `${p.label} · ` : ''}
                검사일 {p.examDate} · 만 {r.age.years}세 · {examTypeLabel(p.examType)}
              </span>
            </div>

            <section className="clinic-card result-hero">
              <div>
                <span className="eyebrow">
                  더 근시인 눈 기준 · {worseEyeLabel(r.worseEye)}
                </span>
                <h2>{r.category}</h2>
                <div className="big-reading">
                  {signed(r.worst)} <small>D</small>
                </div>
                <p>비근시 &gt; −0.50 · 경도 &gt; −3.00 · 중등도 &gt; −6.00 · 고도 ≤ −6.00</p>
              </div>
              <div className="percentile-result">
                <span>또래 100명 중 근시가 심한 쪽으로</span>
                <strong>
                  {rankLabel}
                  <em>번째</em>
                </strong>
                <span className="percentile-result__meta">
                  {referenceYear}년 한국 표본 · 정규분포 가정 · {percentileLabel}
                </span>
                <small>실측 백분위나 미래 예측이 아닙니다.</small>
                <small>근시가 큰 쪽에서 상위 약 {r.percentile > 99.9 ? '0.1% 미만' : r.percentile < 0.1 ? '99.9% 초과' : `${(100 - r.percentile).toFixed(1)}%`} (입력값 기준)</small>
              </div>
            </section>

            {r.caveats.length > 0 && (
              <div className="caveat-strip">
                <Info size={16} />
                <ul>
                  {r.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="metric-grid">
              <div className="metric">
                <span>오른눈 SE</span>
                <strong>
                  {signed(r.right)} <small>D</small>
                </strong>
                <small>{category(r.right)}</small>
              </div>
              <div className="metric">
                <span>왼눈 SE</span>
                <strong>
                  {signed(r.left)} <small>D</small>
                </strong>
                <small>{category(r.left)}</small>
              </div>
              <div className="metric">
                <span>양안 평균</span>
                <strong>
                  {signed(r.mean)} <small>D</small>
                </strong>
                <small>또래 비교는 더 근시인 눈 사용</small>
              </div>
              <div className="metric">
                <span>근시 방향 z-score</span>
                <strong>{signed(r.z)}</strong>
                <small>양수일수록 기준 평균보다 근시</small>
              </div>
            </div>

            {r.warnings.map((w) => (
              <div className="notice warning" key={w} role="status">
                <TriangleAlert size={16} />
                <span>{w}</span>
              </div>
            ))}

            <section className="clinic-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">AGE REFERENCE / 연령별 참고 분포</span>
                  <h2>또래 사이, 우리 아이의 위치</h2>
                </div>
                <span className="pill">근사 곡선</span>
              </div>
              <GrowthChart r={r} />
              <details className="clinic-details chart-zoom">
                <summary>그래프 확대해서 보기 · 좌우로 밀어 확인</summary>
                <div className="chart-zoom__scroll" tabIndex={0} aria-label="확대 그래프, 좌우로 스크롤 가능"><GrowthChart r={r} /></div>
              </details>
              <div className="chart-key">
                <span>● 더 근시인 눈</span>
                <span>○ 양안 평균 (위치만 표시)</span>
                {r.band.range && (
                  <span>▯ 검사 방식 차이 {r.band.assumedOffsetD.toFixed(2)} D 가정 구간</span>
                )}
              </div>
              <p className="help">
                곡선은 {referenceYear}년 한국 표본의 연령군 평균·표준편차에 정규분포를 가정한
                참고선입니다. 실제 근시 분포는 비대칭일 수 있으며, 개인의 성장이나 치료 후
                진행을 예측하지 않습니다. 15–18세는 동일한 통합 기준을 사용합니다.
              </p>
            </section>

            <section className="clinic-card parent-note">
              <h2>보호자께 쉽게 설명하면</h2>
              <p>
                아이의 더 근시인 눈은 <strong>{signed(r.worst)} D</strong>로, 입력값 기준{' '}
                <strong>{r.category}</strong>에 해당합니다. 한국 {r.ref.group} 표본
                평균({signed(r.ref.mean)} D)보다{' '}
                {r.worst < r.ref.mean ? '근시 쪽' : '원시 쪽'}에 있습니다.
                또래 100명을 근시가 심한 순서로 세웠을 때 대략{' '}
                <strong>{rankLabel}번째</strong> 위치입니다.
              </p>
              <p>
                이 위치는 통계 가정으로 계산한 대략적인 순서이며, 눈의 건강 상태나 치료
                필요성을 뜻하지 않습니다. 관리 방향은 안축장·진행 속도·생활 습관을 함께 보고
                결정합니다.
              </p>
              {(p.parents === 'both' || p.parents === 'one') && (
                <p>
                  부모 근시 정보는 상담 시 함께 참고하되, 이 계산에서 순위에 반영하지
                  않습니다.
                </p>
              )}
              {(p.axialR || p.axialL) && (
                <p>
                  안축장 오른눈 {p.axialR || '—'} mm · 왼눈 {p.axialL || '—'} mm
                  {p.axialLimit
                    ? ` · 입력된 상한 ${p.axialLimit} mm (${p.axialSource})`
                    : ' · 연령별 상한 미지정으로 길이 판정 보류'}
                </p>
              )}
              {!Capacitor.isNativePlatform() && <button type="button" className="primary-action no-print" onClick={() => window.print()}>
                <Printer size={17} /> 이 결과 인쇄
              </button>}
            </section>

            <details className="clinic-card clinic-details">
              <summary>기준 자료와 계산의 한계</summary>
              <p>
                <a href={referenceSource} target="_blank" rel="noreferrer">
                  Kim 등, Scientific Reports (2026), 보충표 1
                </a>
                의 일반인 KNHANES {referenceYear} 표본({referenceTotalN.toLocaleString()}명)을
                사용합니다. 사시 환자군 자료는 사용하지 않습니다. 현재 연령군 n=
                {r.ref.n}, 평균 {signed(r.ref.mean)} D, SD {r.ref.sd} D. 성별 통합 자료이므로
                성별 보정은 하지 않습니다.
              </p>
              <p>
                z = (기준 평균 − 더 근시인 눈 SE) ÷ SD, 백분위 = Φ(z) × 100. 양안 평균의 SD는
                제공되지 않아 양안 평균의 순위는 계산하지 않습니다. 정규분포 가정은 분포의 양
                끝에서 오차가 커집니다.
              </p>
              <p>
                기준 표본은 {referenceYear}년 조사입니다. 같은 조사를 2016년과 2021년으로 비교한{' '}
                <a href={referenceTrendSource} target="_blank" rel="noreferrer">
                  연구
                </a>
                는 연령대응 비교에서도 유의한 차이를 보고합니다. 최근 또래가 더 근시라면 이
                순위는 실제보다 «근시가 심한 쪽»으로 나옵니다.
              </p>
              <p>
                {p.examType === 'auto'
                  ? '입력 검사 종류가 기준 연구의 비조절마비 자동굴절검사와 같습니다.'
                  : `입력 검사 종류(${examTypeLabel(
                      p.examType,
                    )})는 기준 연구의 비조절마비 자동굴절검사와 다릅니다. 수치를 자동 보정하지 않고, 방식 차이 ${r.band.assumedOffsetD.toFixed(
                      2,
                    )} D를 가정한 범위로만 표시합니다.`}{' '}
                안경 처방이나 치료 후 굴절값을 치료 전 근시 정도로 해석하지 마세요.
              </p>
              <p className="reference-table-note">
                연령별 기준(평균±SD, D):{' '}
                {Object.entries(koreanReference)
                  .filter(([key]) => Number(key) <= 15)
                  .map(([key, ref]) => {
                    const label = Number(key) === 15 ? '15–18세' : `${key}세`
                    return `${label} ${signed(ref.mean)}±${ref.sd.toFixed(2)}`
                  })
                  .join(' · ')}
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  )
}
