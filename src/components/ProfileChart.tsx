import type { TopoMode } from '../types/cornea'

interface ProfileChartProps {
  map: number[][]
  mode: TopoMode
  diameter: number
}

const modeLabels: Record<TopoMode, { label: string; unit: string }> = {
  tangential: { label: 'Tangential power profile', unit: 'D' },
  elevation: { label: 'Elevation profile', unit: 'µm' },
  sagittal: { label: 'Sagittal power profile', unit: 'D' },
  refractivePower: { label: 'Refractive power profile', unit: 'D' },
  differenceFromBase: { label: 'Surface difference profile', unit: 'µm' },
}

function createPath(values: number[], min: number, max: number, width: number, height: number) {
  const range = max - min || 1
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function ProfileChart({ map, mode, diameter }: ProfileChartProps) {
  const size = map.length
  const center = Math.floor(size / 2)
  const horizontal = map[center]
  const vertical = map.map((row) => row[center])
  let rawMin = Number.POSITIVE_INFINITY
  let rawMax = Number.NEGATIVE_INFINITY
  for (const value of horizontal) {
    if (value < rawMin) rawMin = value
    if (value > rawMax) rawMax = value
  }
  for (const value of vertical) {
    if (value < rawMin) rawMin = value
    if (value > rawMax) rawMax = value
  }
  const padding = Math.max((rawMax - rawMin) * 0.16, mode === 'elevation' ? 1 : 0.1)
  const min = rawMin - padding
  const max = rawMax + padding
  const width = 800
  const height = 128
  const meta = modeLabels[mode]

  return (
    <section className="profile-card">
      <div className="profile-card__header">
        <div>
          <span className="section-index">04</span>
          <h2>Meridian profile</h2>
          <p>{meta.label}</p>
        </div>
        <div className="profile-key">
          <span><i className="key-horizontal" /> Horizontal</span>
          <span><i className="key-vertical" /> Vertical</span>
        </div>
      </div>
      <div className="profile-chart">
        <div className="profile-axis profile-axis--top">
          {max.toFixed(1)} {meta.unit}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${meta.label}. 수평·수직 경선 단면, 범위 ${min.toFixed(1)}부터 ${max.toFixed(
            1,
          )} ${meta.unit}, 지름 ${diameter.toFixed(1)} mm`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((position) => (
            <line
              key={position}
              x1="0"
              x2={width}
              y1={height * position}
              y2={height * position}
              className="chart-gridline"
            />
          ))}
          <line x1={width / 2} x2={width / 2} y1="0" y2={height} className="chart-centerline" />
          <path
            d={createPath(horizontal, min, max, width, height)}
            className="chart-line chart-line--horizontal"
          />
          <path
            d={createPath(vertical, min, max, width, height)}
            className="chart-line chart-line--vertical"
          />
        </svg>
        <div className="profile-axis profile-axis--bottom">
          {min.toFixed(1)} {meta.unit}
        </div>
        <div className="profile-xaxis">
          <span>−{(diameter / 2).toFixed(1)} mm</span>
          <span>Center</span>
          <span>+{(diameter / 2).toFixed(1)} mm</span>
        </div>
      </div>
    </section>
  )
}
