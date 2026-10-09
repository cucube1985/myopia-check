import { RotateCcw, Upload } from 'lucide-react'
import type { CorneaInputs, Eye, SamplePreset } from '../types/cornea'
import { presetLabels } from '../data/sampleMaps'

const quickPresets: Array<{ key: SamplePreset; shortLabel: string }> = [
  { key: 'normal', shortLabel: '정상 난시' },
  { key: 'withTheRule', shortLabel: '직난시' },
  { key: 'keratoconus', shortLabel: '원추각막' },
  { key: 'postLasik', shortLabel: '라식 후' },
]

const presetDescriptions: Record<SamplePreset, string> = {
  normal: '대칭적인 기본 각막 형태에서 시작합니다.',
  withTheRule: '수직 경선이 더 가파른 직난시 패턴입니다. 축 90°.',
  againstTheRule: '수평 경선이 더 가파른 도난시 패턴입니다. 축 0°.',
  oblique: '주 경선이 비스듬한 사난시 패턴입니다. 축 45°.',
  inferiorSteepening: '각막 하부가 국소적으로 가파른 패턴입니다.',
  keratoconus: '하이측에 치우친 원추각막 유사 패턴입니다. 선택한 눈에 맞춰 좌우가 바뀝니다.',
  postLasik: '중심부가 편평해진 굴절교정술 후 유사 패턴입니다.',
  irregular: '여러 국소 변화가 섞인 불규칙 난시 패턴입니다.',
}

const eyeOptions: Array<{ key: Eye; label: string; hint: string }> = [
  { key: 'OD', label: 'OD 오른눈', hint: '코방향이 화면 오른쪽' },
  { key: 'OS', label: 'OS 왼눈', hint: '코방향이 화면 왼쪽' },
]

interface ControlPanelProps {
  inputs: CorneaInputs
  preset: SamplePreset
  jsonText: string
  jsonError: string
  onInputsChange: (patch: Partial<CorneaInputs>) => void
  onPresetChange: (preset: SamplePreset) => void
  onJsonTextChange: (value: string) => void
  onImport: () => void
  onReset: () => void
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  hint?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field__control">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          title={hint}
          onChange={(event) =>
            onChange(Math.max(min, Math.min(max, Number(event.target.value))))
          }
        />
        <em>{unit}</em>
      </div>
    </label>
  )
}

export function ControlPanel({
  inputs,
  preset,
  jsonText,
  jsonError,
  onInputsChange,
  onPresetChange,
  onJsonTextChange,
  onImport,
  onReset,
}: ControlPanelProps) {
  return (
    <aside className="panel control-panel">
      <div className="panel__title-row">
        <div>
          <span className="section-index">01</span>
          <h2>Model input</h2>
          <p className="panel-lead">패턴을 고른 뒤 필요한 값만 조정하세요.</p>
        </div>
        <button className="icon-button" type="button" onClick={onReset} title="초기화">
          <RotateCcw size={16} />
        </button>
      </div>

      <section className="quick-start" aria-labelledby="quick-start-title">
        <div className="quick-start__heading">
          <span id="quick-start-title">빠른 시작</span>
          <small>자주 쓰는 패턴</small>
        </div>
        <div className="preset-shortcuts">
          {quickPresets.map((item) => (
            <button
              type="button"
              key={item.key}
              className={preset === item.key ? 'is-active' : ''}
              aria-pressed={preset === item.key}
              onClick={() => onPresetChange(item.key)}
            >
              {item.shortLabel}
            </button>
          ))}
        </div>
        <p className="preset-description">{presetDescriptions[preset]}</p>
      </section>

      <fieldset className="eye-switch">
        <legend>검사 대상 눈</legend>
        {eyeOptions.map((item) => (
          <button
            type="button"
            key={item.key}
            className={inputs.eye === item.key ? 'is-active' : ''}
            aria-pressed={inputs.eye === item.key}
            title={item.hint}
            onClick={() => onInputsChange({ eye: item.key })}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      <div className="field-grid">
        <NumberField
          label="Flat K"
          value={inputs.flatK}
          min={35}
          max={50}
          step={0.1}
          unit="D"
          onChange={(flatK) => onInputsChange({ flatK })}
        />
        <NumberField
          label="Steep K"
          value={inputs.steepK}
          min={35}
          max={55}
          step={0.1}
          unit="D"
          onChange={(steepK) => onInputsChange({ steepK })}
        />
        <NumberField
          label="Steep axis"
          value={inputs.axis}
          min={0}
          max={180}
          step={1}
          unit="°"
          hint="가파른 경선의 방위각. 90° = 직난시, 0° = 도난시"
          onChange={(axis) => onInputsChange({ axis })}
        />
        <NumberField
          label="Optical zone"
          value={inputs.opticalZoneDiameter}
          min={4}
          max={12}
          step={0.5}
          unit="mm"
          onChange={(opticalZoneDiameter) => onInputsChange({ opticalZoneDiameter })}
        />
      </div>
      <p className="field-note">
        Steep axis는 <strong>가파른 경선</strong>의 방위각입니다. 90°는 수직 경선이 가파른
        직난시, 0°는 수평 경선이 가파른 도난시입니다.
      </p>

      <div className="divider" />
      <label className="field field--full">
        <span>전체 샘플 패턴</span>
        <select
          value={preset}
          onChange={(event) => onPresetChange(event.target.value as SamplePreset)}
        >
          {(Object.keys(presetLabels) as SamplePreset[]).map((key) => (
            <option key={key} value={key}>
              {presetLabels[key]}
            </option>
          ))}
        </select>
      </label>

      <details className="advanced-inputs">
        <summary>고급 설정 및 데이터 가져오기</summary>
        <div className="advanced-inputs__content">
          <label className="field field--full">
            <span>Grid resolution</span>
            <select
              value={inputs.gridResolution}
              onChange={(event) => onInputsChange({ gridResolution: Number(event.target.value) })}
            >
              {[81, 101, 121, 151].map((size) => (
                <option key={size} value={size}>
                  {size} × {size}
                </option>
              ))}
            </select>
          </label>

          <div className="json-import">
            <span className="advanced-label">JSON 데이터</span>
            <textarea
              value={jsonText}
              onChange={(event) => onJsonTextChange(event.target.value)}
              placeholder={'{"flatK": 42.0, "maps": { ... }}'}
              spellCheck={false}
              aria-label="JSON 데이터"
              aria-invalid={jsonError !== ''}
              aria-describedby={jsonError ? 'json-import-error' : undefined}
            />
            {jsonError && (
              <p className="form-error" id="json-import-error" role="alert">
                {jsonError}
              </p>
            )}
            <button type="button" className="secondary-button" onClick={onImport}>
              <Upload size={15} />
              JSON 불러오기
            </button>
            <p className="help">
              지도 값은 행과 열 개수가 같은 정사각 배열이어야 하며, 모든 행의 길이가
              같아야 합니다.
            </p>
          </div>
        </div>
      </details>
    </aside>
  )
}
