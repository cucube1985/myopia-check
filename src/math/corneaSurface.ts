import type {
  ColorScaleConfig,
  CorneaInputs,
  GeometryOptions,
  SurfaceField,
  TopoMode,
  TopographyMaps,
} from '../types/cornea'
import { paletteForMode, writeColor } from './colorMap'

/** 케라토메트리 지수 1.3375 기준. r(mm) = 337.5 / K(D) */
export const kToRadius = (k: number): number => 337.5 / k

/**
 * 좌표를 축 방향 기준으로 회전한다.
 * 반환된 xRot은 axisDeg 경선 방향 성분, yRot은 그와 직교하는 성분이다.
 */
export function rotatePoint(x: number, y: number, axisDeg: number) {
  const theta = (axisDeg * Math.PI) / 180
  return {
    xRot: x * Math.cos(theta) + y * Math.sin(theta),
    yRot: -x * Math.sin(theta) + y * Math.cos(theta),
  }
}

/**
 * 토릭면의 새그(sag, mm).
 *
 * 축 규약: axisDeg는 **가파른 경선**의 방위각이다(검안 관례).
 * 따라서 축 방향 성분(xRot)에 rSteep을, 직교 성분(yRot)에 rFlat을 적용한다.
 * axis 90 → 수직 경선이 가파름(직난시), axis 0 → 수평 경선이 가파름(도난시).
 *
 * 지형도 표면과 CorneaViewer의 구역 링이 같은 식을 쓰도록 여기서만 정의한다.
 */
export function toricSag(
  x: number,
  y: number,
  rFlat: number,
  rSteep: number,
  axisDeg: number,
): number {
  const { xRot, yRot } = rotatePoint(x, y, axisDeg)
  return xRot ** 2 / (2 * rSteep) + yRot ** 2 / (2 * rFlat)
}

/**
 * 위치 (x, y)에서 읽히는 경선 굴절력(D).
 *
 * 파워맵의 따뜻한 색(가파른 값) 나비넥타이 날개는 가파른 경선 위에 놓인다.
 * 즉 축 방향(φ = axis)에서 steepK, 직교 방향에서 flatK가 되어야 하므로 cos²를 쓴다.
 * toricSag와 동일한 축 규약을 공유한다.
 */
export function meridianPower(
  x: number,
  y: number,
  flatK: number,
  steepK: number,
  axisDeg: number,
): number {
  // 정점에서는 어느 경선에도 속하지 않아 atan2(0, 0)이 임의의 값(0)을 준다.
  // 그대로 두면 지도 중앙 한 점이 flatK 또는 steepK로 튀어 단면 그래프에
  // 뾰족한 스파이크가 생긴다. 관례대로 두 주경선의 평균을 쓴다.
  if (x === 0 && y === 0) return (flatK + steepK) / 2
  const theta = (axisDeg * Math.PI) / 180
  const angle = Math.atan2(y, x) - theta
  return flatK + (steepK - flatK) * Math.cos(angle) ** 2
}

export function generateGrid(gridSize: number, diameterMm: number) {
  return Array.from({ length: gridSize }, (_, row) =>
    Array.from({ length: gridSize }, (_, col) => ({
      x: (col / (gridSize - 1) - 0.5) * diameterMm,
      y: (0.5 - row / (gridSize - 1)) * diameterMm,
      row,
      col,
    })),
  )
}

/** 중심부 평균. radiusFraction은 정규화 반경(0–1) 기준. */
function centralMean(map: number[][], radiusFraction: number): number {
  const size = map.length
  let sum = 0
  let count = 0
  for (let r = 0; r < size; r += 1) {
    const y = (r / (size - 1)) * 2 - 1
    for (let c = 0; c < size; c += 1) {
      const x = (c / (size - 1)) * 2 - 1
      if (Math.hypot(x, y) <= radiusFraction) {
        sum += map[r][c]
        count += 1
      }
    }
  }
  return count ? sum / count : 0
}

/**
 * 파워맵 편차를 mm 변위로 바꾸는 시각화 계수.
 * 임상 재구성값이 아니며, 슬라이더 기본값은 0(적용 안 함)이다.
 */
const INFLUENCE_MM_PER_D = {
  tangential: 0.012,
  sagittal: 0.009,
  refractive: 0.01,
} as const

/** 중심부 기준 평균을 잡는 정규화 반경. 8 mm 구역에서 약 중심 1.6 mm. */
const CENTRAL_REFERENCE_RADIUS = 0.2

/**
 * 정점 위치·인덱스·변위장을 만든다. 색상과 색상범위에 의존하지 않으므로
 * Color range 슬라이더를 움직여도 이 단계는 재실행되지 않는다.
 */
export function buildSurfaceField(
  inputs: CorneaInputs,
  maps: TopographyMaps,
  options: GeometryOptions,
): SurfaceField {
  const size = inputs.gridResolution
  const rFlat = kToRadius(inputs.flatK)
  const rSteep = kToRadius(inputs.steepK)
  const half = inputs.opticalZoneDiameter / 2

  const means = {
    tangential: centralMean(maps.tangential, CENTRAL_REFERENCE_RADIUS),
    sagittal: centralMean(maps.sagittal, CENTRAL_REFERENCE_RADIUS),
    refractivePower: centralMean(maps.refractivePower, CENTRAL_REFERENCE_RADIUS),
  }

  const positions = new Float32Array(size * size * 3)
  const differences = Array.from({ length: size }, () => Array<number>(size).fill(0))
  const inside = new Uint8Array(size * size)

  for (let row = 0; row < size; row += 1) {
    const y = (0.5 - row / (size - 1)) * inputs.opticalZoneDiameter
    for (let col = 0; col < size; col += 1) {
      const x = (col / (size - 1) - 0.5) * inputs.opticalZoneDiameter
      const index = row * size + col

      const modifier =
        (maps.tangential[row][col] - means.tangential) *
          options.tangentialInfluence *
          INFLUENCE_MM_PER_D.tangential +
        (maps.sagittal[row][col] - means.sagittal) *
          options.sagittalInfluence *
          INFLUENCE_MM_PER_D.sagittal +
        (maps.refractivePower[row][col] - means.refractivePower) *
          options.refractiveInfluence *
          INFLUENCE_MM_PER_D.refractive

      const elevationMm = (maps.elevation[row][col] / 1000) * options.elevationScale
      differences[row][col] = elevationMm + modifier

      const z = toricSag(x, y, rFlat, rSteep, inputs.axis) + elevationMm + modifier
      positions[index * 3] = x
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = z * options.zScale
      inside[index] = Math.hypot(x, y) <= half + 1e-6 ? 1 : 0
    }
  }

  const indices: number[] = []
  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const a = row * size + col
      const b = a + 1
      const c = a + size
      const d = c + 1
      if (inside[a] && inside[b] && inside[c] && inside[d]) {
        indices.push(a, c, b, b, c, d)
      }
    }
  }

  return {
    positions,
    indices: new Uint32Array(indices),
    differences,
    gridSize: size,
  }
}

/**
 * 표시 모드에 해당하는 스칼라장을 반환한다(표시 단위).
 * differenceFromBase는 mm 변위를 µm로 환산한다.
 */
export function displayField(
  field: SurfaceField,
  maps: TopographyMaps,
  mode: TopoMode,
): number[][] {
  if (mode !== 'differenceFromBase') return maps[mode]
  return field.differences.map((row) => row.map((value) => value * 1000))
}

/** 색상만 갱신한다. 위치/인덱스는 건드리지 않는다. */
export function buildColors(
  values: number[][],
  mode: TopoMode,
  colorScale: Pick<ColorScaleConfig, 'min' | 'max'>,
  target?: Float32Array,
): Float32Array {
  const size = values.length
  const out = target && target.length === size * size * 3
    ? target
    : new Float32Array(size * size * 3)
  const palette = paletteForMode(mode)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      writeColor(
        out,
        (row * size + col) * 3,
        values[row][col],
        colorScale.min,
        colorScale.max,
        palette,
      )
    }
  }
  return out
}
