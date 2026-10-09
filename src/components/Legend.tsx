import type { TopoMode } from '../types/cornea'
import { cssGradientForMode } from '../math/colorMap'

const modeMeta: Record<TopoMode, { label: string; unit: string }> = {
  tangential: { label: 'Tangential', unit: 'D' },
  elevation: { label: 'Elevation', unit: 'µm' },
  sagittal: { label: 'Sagittal', unit: 'D' },
  refractivePower: { label: 'Refractive power', unit: 'D' },
  differenceFromBase: { label: 'Difference from base', unit: 'µm' },
}

interface LegendProps {
  mode: TopoMode
  min: number
  max: number
}

export function Legend({ mode, min, max }: LegendProps) {
  const meta = modeMeta[mode]
  const midpoint = (min + max) / 2
  return (
    <div
      className="legend"
      aria-label={`${meta.label} 색상 범례, ${min.toFixed(1)}부터 ${max.toFixed(1)} ${meta.unit}`}
    >
      <div className="legend__header">
        <span>{meta.label}</span>
        <span className="unit-pill">{meta.unit}</span>
      </div>
      <div
        className="legend__bar"
        style={{ background: cssGradientForMode(mode) }}
        aria-hidden="true"
      />
      <div className="legend__ticks" aria-hidden="true">
        <span>{min.toFixed(1)}</span>
        <span>{midpoint.toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
    </div>
  )
}
