import { koreanReference, referenceYear } from '../data/koreanReference'
import { rankOutOf100, signed, type MyopiaResult } from '../math/myopia'

/**
 * 연령별 참고 분포 위에 아이의 위치를 얹은 그래프.
 *
 * 곡선 라벨은 "P90" 같은 백분위 표기를 쓰지 않는다. 성장도표에 익숙한 보호자는
 * 높은 백분위를 "큰 값"으로 읽는데, 여기서 높은 백분위는 "더 근시"를 뜻해
 * 방향이 반대이기 때문이다. 대신 근시 정도로 직접 이름을 붙인다.
 */
const curves = [
  { label: '근시 심한 5%', z: 1.64485, color: '#ee8f97', weight: 1.5 },
  { label: '근시 심한 10%', z: 1.28155, color: '#eab663', weight: 1.5 },
  { label: '또래 평균', z: 0, color: '#54d5c3', weight: 2.5 },
  { label: '근시 약한 10%', z: -1.28155, color: '#8d9cba', weight: 1.5 },
]

const AGE_MIN = 5
const AGE_MAX = 19

export function GrowthChart({ r }: { r: MyopiaResult }) {
  const width = 820
  const height = 360
  const left = 62
  const right = 676
  const top = 34
  const bottom = 286

  /** 이전 검사의 «각 시점에서 더 근시인 눈» 경로. 그래프 나이 범위(5세~) 안의 점만 그린다. */
  const trail = (r.followUp?.points ?? []).filter(
    (pt): pt is typeof pt & { ageDecimal: number } => pt.ageDecimal !== null && pt.ageDecimal >= AGE_MIN,
  )
  const trailSE = trail.map((pt) => pt.worst)

  const min = Math.min(-9, Math.floor(Math.min(r.worst, ...trailSE) - 1))
  const max = Math.max(3, Math.ceil(r.right + 1), Math.ceil(r.left + 1), ...trailSE.map((v) => Math.ceil(v + 1)))
  const x = (age: number) => left + ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * (right - left)
  const y = (se: number) => top + ((max - se) / (max - min)) * (bottom - top)

  const bandTop = r.band.range ? y(r.worst - r.band.assumedOffsetD) : null
  const bandHeight = bandTop !== null ? Math.abs(y(r.worst) - bandTop) : 0

  const rankText = r.band.range
    ? `${rankOutOf100(r.band.range.high)}~${rankOutOf100(r.band.range.low)}번째`
    : `약 ${rankOutOf100(r.band.point)}번째`

  return (
    <svg
      className="growth-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`연령별 참고 분포와 아이의 위치. 만 ${r.age.years}세, 더 근시인 눈 ${signed(
        r.worst,
      )} 디옵터. 또래 100명 중 근시가 심한 쪽으로 ${rankText}. ${trail.length > 1 ? `점선은 이전 검사 ${trail.length - 1}회부터 이어진 변화 경로입니다. ` : ''}곡선은 ${referenceYear}년 한국 표본의 연령군 평균과 표준편차에 정규분포를 가정한 참고선입니다.`}
    >
      <text x={left} y={16} className="chart-caption">
        SE (D) · 아래로 갈수록 근시가 큼
      </text>

      {Array.from({ length: Math.floor((max - min) / 2) + 1 }, (_, i) => max - i * 2).map((v) => (
        <g key={`grid-${v}`}>
          <line x1={left} x2={right} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={left - 10} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}

      {[5, 7, 9, 11, 13, 15, 17, 19].map((v) => (
        <g key={`age-${v}`}>
          <line x1={x(v)} x2={x(v)} y1={top} y2={bottom} className="chart-grid" />
          <text x={x(v)} y={bottom + 24} textAnchor="middle">
            {v === 19 ? '19세 미만' : `${v}세`}
          </text>
        </g>
      ))}

      {/* 15–18세는 하나의 통합 기준을 쓴다는 표시 */}
      <rect
        x={x(15)}
        y={top}
        width={x(19) - x(15)}
        height={bottom - top}
        fill="#a2a2db"
        opacity="0.05"
      />
      <text x={(x(15) + x(19)) / 2} y={top + 14} textAnchor="middle" className="chart-note">
        15–18세 통합 기준
      </text>

      {curves.map((curve) => {
        const points = Object.entries(koreanReference).flatMap(([age, ref]) => [
          [Number(age), ref.mean - curve.z * ref.sd],
          [Number(age) + 1, ref.mean - curve.z * ref.sd],
        ])
        return (
          <g key={curve.label}>
            <polyline
              points={points.map(([age, se]) => `${x(age)},${y(se)}`).join(' ')}
              fill="none"
              stroke={curve.color}
              strokeWidth={curve.weight}
              opacity="0.85"
            />
            <text x={right + 9} y={y(points.at(-1)![1]) + 4} fill={curve.color}>
              {curve.label}
            </text>
          </g>
        )
      })}

      {/* 검사 방식 차이를 가정했을 때 아이의 위치가 놓일 수 있는 구간 */}
      {bandTop !== null && (
        <rect
          x={x(r.age.decimal) - 9}
          y={bandTop}
          width={18}
          height={bandHeight}
          fill="#54d5c3"
          opacity="0.22"
          rx="4"
        />
      )}

      {trail.length > 1 && (
        <g className="chart-trail">
          <polyline
            points={trail.map((pt) => `${x(pt.ageDecimal)},${y(pt.worst)}`).join(' ')}
            fill="none"
            stroke="#54d5c3"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.75"
          />
          {trail
            .filter((pt) => !pt.current)
            .map((pt) => (
              <circle
                key={pt.date}
                cx={x(pt.ageDecimal)}
                cy={y(pt.worst)}
                r="4.5"
                fill="#071014"
                stroke="#54d5c3"
                strokeWidth="2"
              />
            ))}
        </g>
      )}

      <line
        x1={x(r.age.decimal)}
        x2={x(r.age.decimal)}
        y1={top}
        y2={bottom}
        stroke="#fff"
        strokeDasharray="4 5"
        opacity="0.28"
      />
      <circle
        cx={x(r.age.decimal)}
        cy={y(r.mean)}
        r="5"
        fill="#071014"
        stroke="#bfc9de"
        strokeWidth="2"
      />
      <circle
        cx={x(r.age.decimal)}
        cy={y(r.worst)}
        r="8.5"
        fill="#54d5c3"
        stroke="#fff"
        strokeWidth="2"
      />
    </svg>
  )
}
