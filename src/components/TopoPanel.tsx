import { SlidersHorizontal, Sparkles } from 'lucide-react'
import type { ColorScaleConfig, SurfaceOptions, TopoMode } from '../types/cornea'

const mapOptions: Array<{ value: TopoMode; label: string; unit: string }> = [
  { value: 'tangential', label: 'Tangential', unit: 'D' },
  { value: 'elevation', label: 'Elevation', unit: 'µm' },
  { value: 'sagittal', label: 'Sagittal', unit: 'D' },
  { value: 'refractivePower', label: 'Refractive', unit: 'D' },
  { value: 'differenceFromBase', label: 'Difference', unit: 'µm' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <label className="slider">
      <span>
        {label}
        <output>
          {value.toFixed(step < 0.1 ? 2 : 1)}
          {unit}
        </output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        style={{ '--progress': `${percent}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

interface TopoPanelProps {
  options: SurfaceOptions
  colorScale: ColorScaleConfig
  wireframe: boolean
  showRings: boolean
  onOptionsChange: (patch: Partial<SurfaceOptions>) => void
  onColorScaleChange: (patch: Partial<ColorScaleConfig>) => void
  onAutoScale: () => void
  onWireframeChange: (value: boolean) => void
  onShowRingsChange: (value: boolean) => void
}

export function TopoPanel({
  options,
  colorScale,
  wireframe,
  showRings,
  onOptionsChange,
  onColorScaleChange,
  onAutoScale,
  onWireframeChange,
  onShowRingsChange,
}: TopoPanelProps) {
  return (
    <section className="panel topo-panel">
      <div className="panel__title-row">
        <div>
          <span className="section-index">02</span>
          <h2>Topography</h2>
        </div>
        <SlidersHorizontal size={17} />
      </div>

      <div className="map-tabs" role="tablist" aria-label="활성 지도">
        {mapOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`map-tab-${item.value}`}
            aria-selected={options.activeMode === item.value}
            aria-controls="cornea-surface-panel"
            tabIndex={options.activeMode === item.value ? 0 : -1}
            className={options.activeMode === item.value ? 'is-active' : ''}
            onClick={() => onOptionsChange({ activeMode: item.value })}
          >
            {item.label}
            <small>{item.unit}</small>
          </button>
        ))}
      </div>

      <div className="slider-stack">
        <Slider
          label="Elevation displacement"
          value={options.elevationScale}
          min={0}
          max={3}
          step={0.1}
          unit="×"
          onChange={(elevationScale) => onOptionsChange({ elevationScale })}
        />
        <Slider
          label="Tangential influence"
          value={options.tangentialInfluence}
          min={0}
          max={1}
          step={0.05}
          onChange={(tangentialInfluence) => onOptionsChange({ tangentialInfluence })}
        />
        <Slider
          label="Sagittal influence"
          value={options.sagittalInfluence}
          min={0}
          max={1}
          step={0.05}
          onChange={(sagittalInfluence) => onOptionsChange({ sagittalInfluence })}
        />
        <Slider
          label="Refractive influence"
          value={options.refractiveInfluence}
          min={0}
          max={1}
          step={0.05}
          onChange={(refractiveInfluence) => onOptionsChange({ refractiveInfluence })}
        />
        <Slider
          label="Geometry Z scale"
          value={options.zScale}
          min={0.2}
          max={4}
          step={0.1}
          unit="×"
          onChange={(zScale) => onOptionsChange({ zScale })}
        />
      </div>

      <div className="scale-controls">
        <div className="scale-controls__header">
          <span>Color range</span>
          <button type="button" onClick={onAutoScale} aria-pressed={colorScale.auto}>
            <Sparkles size={13} /> Auto
          </button>
        </div>
        <div className="scale-inputs">
          <label>
            Min
            <input
              type="number"
              value={Number(colorScale.min.toFixed(1))}
              step={0.5}
              onChange={(event) =>
                onColorScaleChange({ min: Number(event.target.value), auto: false })
              }
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            Max
            <input
              type="number"
              value={Number(colorScale.max.toFixed(1))}
              step={0.5}
              onChange={(event) =>
                onColorScaleChange({ max: Number(event.target.value), auto: false })
              }
            />
          </label>
        </div>
      </div>

      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(event) => onWireframeChange(event.target.checked)}
          />
          <i aria-hidden="true" />
          Wireframe
        </label>
        <label>
          <input
            type="checkbox"
            checked={showRings}
            onChange={(event) => onShowRingsChange(event.target.checked)}
          />
          <i aria-hidden="true" />
          Zone rings
        </label>
      </div>
    </section>
  )
}
