import type { CorneaInputs, CorneaSummary, TopographyMaps } from '../types/cornea'
import { kToRadius } from './corneaSurface'

/**
 * 원형 구역(정규화 반경 ≤ 1) 안의 값을 순회한다.
 * 큰 격자에서 Math.min(...values) 스프레드가 인수 한도를 넘을 수 있어
 * 전 구간을 반복문으로 처리한다(151² = 22,801개).
 */
function forEachInCircle(
  map: number[][],
  visit: (value: number, x: number, y: number) => void,
): void {
  const size = map.length
  for (let row = 0; row < size; row += 1) {
    const y = 1 - (row / (size - 1)) * 2
    for (let col = 0; col < size; col += 1) {
      const x = (col / (size - 1)) * 2 - 1
      if (x * x + y * y <= 1) visit(map[row][col], x, y)
    }
  }
}

export function mapRange(map: number[][]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  forEachInCircle(map, (value) => {
    if (value < min) min = value
    if (value > max) max = value
  })
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 }
  return { min, max }
}

function meanInCircle(
  map: number[][],
  accept: (x: number, y: number) => boolean = () => true,
): number {
  let sum = 0
  let count = 0
  forEachInCircle(map, (value, x, y) => {
    if (accept(x, y)) {
      sum += value
      count += 1
    }
  })
  return count ? sum / count : 0
}

export function calculateSummary(
  inputs: CorneaInputs,
  maps: TopographyMaps,
): CorneaSummary {
  const zoneRadius = Math.min(1, 3 / inputs.opticalZoneDiameter)
  const elevation = mapRange(maps.elevation)

  return {
    astigmatism: inputs.steepK - inputs.flatK,
    rFlat: kToRadius(inputs.flatK),
    rSteep: kToRadius(inputs.steepK),
    meanTangential: meanInCircle(maps.tangential),
    meanSagittal: meanInCircle(maps.sagittal),
    meanRefractive: meanInCircle(maps.refractivePower),
    minElevation: elevation.min,
    maxElevation: elevation.max,
    central3mmMean: meanInCircle(
      maps.refractivePower,
      (x, y) => Math.hypot(x, y) <= zoneRadius,
    ),
    inferiorSuperiorIndex:
      meanInCircle(maps.refractivePower, (_x, y) => y < 0) -
      meanInCircle(maps.refractivePower, (_x, y) => y >= 0),
  }
}
