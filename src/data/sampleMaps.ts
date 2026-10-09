import type { CorneaInputs, Eye, SamplePreset, TopographyMaps } from '../types/cornea'
import { meridianPower } from '../math/corneaSurface'

type Pattern = {
  power: (x: number, y: number, radius: number, angle: number) => number
  elevation: (x: number, y: number, radius: number, angle: number) => number
}

/**
 * 지도 생성에 필요한 것은 K값·축·눈뿐이다. 호출부가 CorneaInputs 전체를 그대로
 * 넘길 수 있도록 나머지 필드도 받아들이고 무시한다.
 */
type PresetInputs = Pick<CorneaInputs, 'flatK' | 'steepK' | 'axis'> &
  Partial<Omit<CorneaInputs, 'flatK' | 'steepK' | 'axis'>> & { eye?: Eye }

const gaussian = (x: number, y: number, cx: number, cy: number, spread: number) =>
  Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * spread ** 2))

/**
 * 축성 굴절력(sagittal/tangential)과 굴절력맵(refractive power map)의 차이를 대신하는
 * 단순 상수 오프셋(D).
 *
 * 실제 굴절력맵은 Snell 법칙에 따른 광선 추적으로 산출되며 상수 오프셋으로 환원되지
 * 않는다. 이 값은 네 지도를 시각적으로 구분하기 위한 교육용 근사이며, 장비의
 * refractive power map을 재현하지 않는다.
 */
export const REFRACTIVE_MAP_OFFSET_D = 0.55

/** OD는 코방향이 화면 오른쪽, OS는 왼쪽이므로 편심 패턴의 x를 눈에 따라 뒤집는다. */
const mirrorFor = (eye: Eye | undefined) => (eye === 'OD' ? -1 : 1)

function generateMaps(
  gridSize: number,
  diameter: number,
  inputs: PresetInputs,
  pattern: Pattern,
): TopographyMaps {
  const modes: TopographyMaps = {
    tangential: [],
    elevation: [],
    sagittal: [],
    refractivePower: [],
  }
  const half = diameter / 2
  const mirror = mirrorFor(inputs.eye)
  for (let row = 0; row < gridSize; row += 1) {
    const tangentialRow: number[] = []
    const elevationRow: number[] = []
    const sagittalRow: number[] = []
    const refractiveRow: number[] = []
    for (let col = 0; col < gridSize; col += 1) {
      const x = (col / (gridSize - 1) - 0.5) * diameter
      const y = (0.5 - row / (gridSize - 1)) * diameter
      const radius = Math.hypot(x, y) / half
      const angle = Math.atan2(y, x)
      const base = meridianPower(x, y, inputs.flatK, inputs.steepK, inputs.axis)
      const nx = (x / half) * mirror
      const ny = y / half
      const delta = pattern.power(nx, ny, radius, angle)
      const edgeFalloff = Math.max(0.55, 1 - Math.max(0, radius - 0.72) * 0.45)
      tangentialRow.push(base + delta * 1.15 * edgeFalloff)
      sagittalRow.push(base + delta * 0.78 * edgeFalloff)
      refractiveRow.push(base + REFRACTIVE_MAP_OFFSET_D + delta * 0.92 * edgeFalloff)
      elevationRow.push(pattern.elevation(nx, ny, radius, angle))
    }
    modes.tangential.push(tangentialRow)
    modes.elevation.push(elevationRow)
    modes.sagittal.push(sagittalRow)
    modes.refractivePower.push(refractiveRow)
  }
  return modes
}

const normalPattern: Pattern = {
  power: (_x, _y, radius) => 0.12 * radius ** 2,
  elevation: (x, y) => 1.6 * Math.sin(x * Math.PI) * Math.cos(y * Math.PI),
}

const patterns: Record<SamplePreset, Pattern> = {
  normal: normalPattern,
  withTheRule: normalPattern,
  againstTheRule: normalPattern,
  oblique: normalPattern,
  inferiorSteepening: {
    power: (x, y) => 3.8 * gaussian(x, y, 0, -0.58, 0.34),
    elevation: (x, y) => 22 * gaussian(x, y, 0, -0.55, 0.36) - 3,
  },
  keratoconus: {
    // 기준 좌표는 OS(측방 = 화면 오른쪽). OD는 mirrorFor가 뒤집어 하이측을 유지한다.
    power: (x, y) => 8.4 * gaussian(x, y, 0.28, -0.32, 0.22),
    elevation: (x, y) => 48 * gaussian(x, y, 0.28, -0.32, 0.25) - 4,
  },
  postLasik: {
    power: (x, y) =>
      -4.2 * gaussian(x, y, 0, 0, 0.32) + 1.3 * gaussian(Math.hypot(x, y), 0, 0.58, 0, 0.16),
    elevation: (x, y) =>
      -27 * gaussian(x, y, 0, 0, 0.34) + 8 * gaussian(Math.hypot(x, y), 0, 0.62, 0, 0.17),
  },
  irregular: {
    power: (x, y) =>
      3.1 * gaussian(x, y, -0.38, 0.22, 0.2) -
      2.3 * gaussian(x, y, 0.34, 0.12, 0.24) +
      2.6 * gaussian(x, y, 0.18, -0.48, 0.18),
    elevation: (x, y) =>
      18 * gaussian(x, y, -0.38, 0.22, 0.2) -
      15 * gaussian(x, y, 0.34, 0.12, 0.24) +
      12 * gaussian(x, y, 0.18, -0.48, 0.18),
  },
}

/** 프리셋이 기준으로 삼는 축. 사용자가 축을 바꾸면 재기준화(re-basing)한다. */
export function defaultAxisFor(preset: SamplePreset): number {
  if (preset === 'againstTheRule') return 0
  if (preset === 'oblique') return 45
  return 90
}

const BASE_FLAT_K = 42
const BASE_STEEP_K = 44
const FLAT_PATTERN: Pattern = { power: () => 0, elevation: () => 0 }

export function generateSampleMaps(
  preset: SamplePreset,
  gridSize: number,
  diameter: number,
  inputs?: PresetInputs,
): TopographyMaps {
  const eye = inputs?.eye
  const defaultAxis = defaultAxisFor(preset)
  const generated = generateMaps(
    gridSize,
    diameter,
    { flatK: BASE_FLAT_K, steepK: BASE_STEEP_K, axis: defaultAxis, eye },
    patterns[preset],
  )
  if (!inputs) return generated

  // 프리셋의 기준 토릭 성분을 빼고 사용자가 지정한 K/축 성분을 더한다.
  const baseline = generateMaps(
    gridSize,
    diameter,
    { flatK: BASE_FLAT_K, steepK: BASE_STEEP_K, axis: defaultAxis, eye },
    FLAT_PATTERN,
  )
  const target = generateMaps(gridSize, diameter, { ...inputs, eye }, FLAT_PATTERN)
  const rebase = (key: 'tangential' | 'sagittal' | 'refractivePower') =>
    generated[key].map((row, r) =>
      row.map((value, c) => value - baseline[key][r][c] + target[key][r][c]),
    )

  return {
    tangential: rebase('tangential'),
    elevation: generated.elevation,
    sagittal: rebase('sagittal'),
    refractivePower: rebase('refractivePower'),
  }
}

export const presetLabels: Record<SamplePreset, string> = {
  normal: 'Normal astigmatism',
  withTheRule: 'With-the-rule',
  againstTheRule: 'Against-the-rule',
  oblique: 'Oblique astigmatism',
  inferiorSteepening: 'Inferior steepening',
  keratoconus: 'Keratoconus-like cone',
  postLasik: 'Post-LASIK-like',
  irregular: 'Irregular astigmatism',
}
