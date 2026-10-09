import { Activity, CircleGauge, ScanLine } from 'lucide-react'
import type { CorneaInputs, CorneaSummary } from '../types/cornea'

const format = (value: number, digits = 2) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—'

/** 축을 검안 표기로 적는다. 예: 42.00 @ 180 / 44.00 @ 90 */
function keratometryNotation(inputs: CorneaInputs): string {
  const flatAxis = (inputs.axis + 90) % 180
  return `${inputs.flatK.toFixed(2)} @ ${flatAxis.toFixed(0)} / ${inputs.steepK.toFixed(
    2,
  )} @ ${inputs.axis.toFixed(0)}`
}

function astigmatismType(axis: number): string {
  const normalized = ((axis % 180) + 180) % 180
  if (normalized >= 60 && normalized <= 120) return '직난시 (with-the-rule)'
  if (normalized <= 30 || normalized >= 150) return '도난시 (against-the-rule)'
  return '사난시 (oblique)'
}

interface SummaryPanelProps {
  inputs: CorneaInputs
  summary: CorneaSummary
}

export function SummaryPanel({ inputs, summary }: SummaryPanelProps) {
  const asymmetryAlert = Math.abs(summary.inferiorSuperiorIndex) > 1.2
  const hasAstigmatism = Math.abs(summary.astigmatism) >= 0.25

  return (
    <aside className="summary-panel">
      <div className="summary-panel__heading">
        <div>
          <span className="section-index">03</span>
          <h2>Analysis</h2>
        </div>
        <span className="live-badge">
          <i aria-hidden="true" /> LIVE
        </span>
      </div>

      <div className="result-hero-grid">
        <div className="primary-metric result-card--wide">
          <div className="primary-metric__icon">
            <Activity size={20} />
          </div>
          <div>
            <span>Corneal astigmatism</span>
            <strong>
              {format(summary.astigmatism, 2)} <small>D</small>
            </strong>
            <p>
              가파른 경선 {inputs.axis.toFixed(0)}°
              {hasAstigmatism ? ` · ${astigmatismType(inputs.axis)}` : ' · 난시 거의 없음'}
            </p>
          </div>
        </div>

        <div className="result-card">
          <span>Steep K</span>
          <strong>{format(inputs.steepK, 2)} <small>D</small></strong>
          <p>가장 가파른 경선</p>
        </div>

        <div className={`result-card ${asymmetryAlert ? 'is-alert' : ''}`}>
          <span>I–S asymmetry</span>
          <strong>
            {summary.inferiorSuperiorIndex >= 0 ? '+' : ''}
            {format(summary.inferiorSuperiorIndex)} <small>D</small>
          </strong>
          <p>{asymmetryAlert ? '주의 기준 초과' : '대칭 범위 참고'}</p>
        </div>
      </div>

      <div className="summary-section">
        <h3>
          <CircleGauge size={14} /> Keratometry
        </h3>
        <dl className="metric-list">
          <div>
            <dt>표기</dt>
            <dd className="mono-value">{keratometryNotation(inputs)}</dd>
          </div>
          <div>
            <dt>Flat K</dt>
            <dd>{format(inputs.flatK, 2)} D</dd>
          </div>
          <div>
            <dt>R flat</dt>
            <dd>{format(summary.rFlat, 2)} mm</dd>
          </div>
          <div>
            <dt>R steep</dt>
            <dd>{format(summary.rSteep, 2)} mm</dd>
          </div>
        </dl>
      </div>

      <div className="summary-section">
        <h3>
          <ScanLine size={14} /> Map statistics
        </h3>
        <dl className="metric-list">
          <div>
            <dt>Mean tangential</dt>
            <dd>{format(summary.meanTangential)} D</dd>
          </div>
          <div>
            <dt>Mean sagittal</dt>
            <dd>{format(summary.meanSagittal)} D</dd>
          </div>
          <div>
            <dt>Mean refractive</dt>
            <dd>{format(summary.meanRefractive)} D</dd>
          </div>
          <div>
            <dt>Elevation range</dt>
            <dd>
              {format(summary.minElevation, 1)} / {format(summary.maxElevation, 1)} µm
            </dd>
          </div>
          <div>
            <dt>Central 3 mm</dt>
            <dd>{format(summary.central3mmMean)} D</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
