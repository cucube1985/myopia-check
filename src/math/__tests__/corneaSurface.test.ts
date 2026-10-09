import { describe, expect, it } from 'vitest'
import {
  buildColors,
  buildSurfaceField,
  displayField,
  kToRadius,
  meridianPower,
  rotatePoint,
  toricSag,
} from '../corneaSurface'
import { findPrincipalMeridians } from '../curvature'
import { generateSampleMaps } from '../../data/sampleMaps'
import type { CorneaInputs } from '../../types/cornea'

const FLAT_K = 42
const STEEP_K = 44
const rFlat = kToRadius(FLAT_K)
const rSteep = kToRadius(STEEP_K)

describe('kToRadius', () => {
  it('케라토메트리 지수 1.3375를 쓴다', () => {
    expect(kToRadius(43.5)).toBeCloseTo(337.5 / 43.5, 12)
    expect(kToRadius(43.5)).toBeCloseTo(7.759, 3)
  })

  it('가파른 K가 더 작은 반경을 준다', () => {
    expect(rSteep).toBeLessThan(rFlat)
  })
})

describe('rotatePoint', () => {
  it('xRot은 축 방향 성분이다', () => {
    expect(rotatePoint(0, 3, 90).xRot).toBeCloseTo(3, 12)
    expect(rotatePoint(3, 0, 0).xRot).toBeCloseTo(3, 12)
    expect(rotatePoint(1, 1, 45).xRot).toBeCloseTo(Math.SQRT2, 12)
  })
})

/**
 * 축 규약 회귀 테스트.
 * 이전 구현은 axis 90에서 수평 경선을 가파르게 만들어 직난시/도난시를 뒤바꿨다.
 */
describe('축 규약: axis = 가파른 경선의 방위각', () => {
  it('axis 90(직난시)에서 수직 경선이 steep K로 읽힌다', () => {
    expect(meridianPower(0, 3, FLAT_K, STEEP_K, 90)).toBeCloseTo(STEEP_K, 10)
    expect(meridianPower(0, -3, FLAT_K, STEEP_K, 90)).toBeCloseTo(STEEP_K, 10)
    expect(meridianPower(3, 0, FLAT_K, STEEP_K, 90)).toBeCloseTo(FLAT_K, 10)
    expect(meridianPower(-3, 0, FLAT_K, STEEP_K, 90)).toBeCloseTo(FLAT_K, 10)
  })

  it('axis 0(도난시)에서 수평 경선이 steep K로 읽힌다', () => {
    expect(meridianPower(3, 0, FLAT_K, STEEP_K, 0)).toBeCloseTo(STEEP_K, 10)
    expect(meridianPower(0, 3, FLAT_K, STEEP_K, 0)).toBeCloseTo(FLAT_K, 10)
  })

  /** 회귀: 정점은 어느 경선에도 속하지 않으므로 한 점만 튀면 안 된다. */
  it('정점에서 두 주경선의 평균을 쓴다', () => {
    for (const axis of [0, 45, 90, 137]) {
      expect(meridianPower(0, 0, FLAT_K, STEEP_K, axis)).toBeCloseTo(43, 10)
    }
  })

  it('정점 바로 옆 값들이 정점 값을 사이에 두고 갈라진다', () => {
    const e = 1e-6
    const apex = meridianPower(0, 0, FLAT_K, STEEP_K, 90)
    expect(meridianPower(0, e, FLAT_K, STEEP_K, 90)).toBeGreaterThan(apex)
    expect(meridianPower(e, 0, FLAT_K, STEEP_K, 90)).toBeLessThan(apex)
  })

  it('axis 45(사난시)에서 45도 경선이 steep K로 읽힌다', () => {
    const r = 3 / Math.SQRT2
    expect(meridianPower(r, r, FLAT_K, STEEP_K, 45)).toBeCloseTo(STEEP_K, 10)
    expect(meridianPower(r, -r, FLAT_K, STEEP_K, 45)).toBeCloseTo(FLAT_K, 10)
  })

  it('파워맵과 표면 새그가 같은 경선을 가파르다고 본다', () => {
    for (const axis of [0, 30, 45, 90, 120, 180]) {
      const theta = (axis * Math.PI) / 180
      const alongAxis = toricSag(3 * Math.cos(theta), 3 * Math.sin(theta), rFlat, rSteep, axis)
      const acrossAxis = toricSag(
        3 * Math.cos(theta + Math.PI / 2),
        3 * Math.sin(theta + Math.PI / 2),
        rFlat,
        rSteep,
        axis,
      )
      // 가파른 경선은 같은 거리에서 새그가 더 크다
      expect(alongAxis).toBeGreaterThan(acrossAxis)
    }
  })

  /**
   * 파워맵 생성 코드를 거치지 않고 형상만으로 축을 되찾는 독립 검증.
   * meridianPower에 버그가 있어도 이 테스트는 통과하지 않는다.
   */
  it('형상에서 역산한 가파른 경선이 입력 축과 일치한다', () => {
    for (const axis of [0, 20, 45, 90, 135, 160]) {
      const sag = (x: number, y: number) => toricSag(x, y, rFlat, rSteep, axis)
      const found = findPrincipalMeridians(sag, 2.5)
      const diff = Math.min(
        Math.abs(found.steepAxisDeg - axis),
        180 - Math.abs(found.steepAxisDeg - axis),
      )
      expect(diff).toBeLessThanOrEqual(1)
      expect(found.steepPowerD).toBeGreaterThan(found.flatPowerD)
    }
  })

  it('정점 근처에서 역산한 주경선 굴절력이 입력 K값과 일치한다', () => {
    const sag = (x: number, y: number) => toricSag(x, y, rFlat, rSteep, 90)
    const found = findPrincipalMeridians(sag, 0.05)
    expect(found.steepPowerD).toBeCloseTo(STEEP_K, 2)
    expect(found.flatPowerD).toBeCloseTo(FLAT_K, 2)
  })
})

/**
 * 기저 곡면의 모델 한계를 문서화한다.
 *
 * toricSag는 z = x²/2R 형태의 포물면(원뿔상수 Q = −1)이다. 정점에서는 입력 K값과
 * 정확히 일치하지만 주변부로 갈수록 실제 각막(Q ≈ −0.26)보다 빠르게 편평해진다.
 * 따라서 주변부 굴절력을 장비값과 직접 비교하면 안 된다.
 * 비구면도(Q)를 입력으로 받는 것은 향후 개선 사항이다.
 */
describe('기저 곡면은 포물면 근사다', () => {
  const sag = (x: number, y: number) => toricSag(x, y, rFlat, rSteep, 90)

  it('정점에서 멀어질수록 역산 굴절력이 낮아진다', () => {
    const apex = findPrincipalMeridians(sag, 0.05).steepPowerD
    const mid = findPrincipalMeridians(sag, 1.5).steepPowerD
    const edge = findPrincipalMeridians(sag, 3).steepPowerD
    expect(apex).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(edge)
    expect(apex).toBeCloseTo(STEEP_K, 2)
  })

  it('주변부 편평화 폭이 알려진 수준이다', () => {
    // 3 mm 지점에서 입력 K값보다 2–4 D 낮게 역산된다
    const edge = findPrincipalMeridians(sag, 3).steepPowerD
    expect(STEEP_K - edge).toBeGreaterThan(2)
    expect(STEEP_K - edge).toBeLessThan(4)
  })

  it('축을 바꿔도 주변부 편평화 정도는 같다', () => {
    const at = (axis: number) =>
      findPrincipalMeridians((x, y) => toricSag(x, y, rFlat, rSteep, axis), 3).steepPowerD
    expect(at(0)).toBeCloseTo(at(90), 6)
    expect(at(45)).toBeCloseTo(at(90), 6)
  })
})

describe('toricSag', () => {
  it('정점에서 0이다', () => {
    expect(toricSag(0, 0, rFlat, rSteep, 90)).toBe(0)
  })

  it('구면(rFlat = rSteep)에서는 축과 무관하다', () => {
    const a = toricSag(2, 1, 8, 8, 0)
    const b = toricSag(2, 1, 8, 8, 73)
    expect(a).toBeCloseTo(b, 12)
  })
})

const baseInputs: CorneaInputs = {
  flatK: FLAT_K,
  steepK: STEEP_K,
  axis: 90,
  opticalZoneDiameter: 8,
  gridResolution: 41,
  eye: 'OD',
}

describe('buildSurfaceField', () => {
  const maps = generateSampleMaps('normal', 41, 8, baseInputs)
  const field = buildSurfaceField(baseInputs, maps, {
    elevationScale: 1,
    tangentialInfluence: 0,
    sagittalInfluence: 0,
    refractiveInfluence: 0,
    zScale: 1,
  })

  it('격자 크기만큼의 정점을 만든다', () => {
    expect(field.positions.length).toBe(41 * 41 * 3)
    expect(field.gridSize).toBe(41)
  })

  it('유한하지 않은 좌표를 만들지 않는다', () => {
    expect(field.positions.every((value) => Number.isFinite(value))).toBe(true)
  })

  it('광학구역 밖 삼각형을 제외한다', () => {
    expect(field.indices.length).toBeGreaterThan(0)
    expect(field.indices.length % 3).toBe(0)
    // 원형으로 잘라내므로 정사각 격자 전체보다 적어야 한다
    expect(field.indices.length).toBeLessThan(40 * 40 * 6)
  })

  it('영향도 0에서 변위는 elevation만 반영한다', () => {
    const r = 20
    const c = 12
    expect(field.differences[r][c]).toBeCloseTo(maps.elevation[r][c] / 1000, 12)
  })

  it('zScale은 z만 배율한다', () => {
    const scaled = buildSurfaceField(baseInputs, maps, {
      elevationScale: 1,
      tangentialInfluence: 0,
      sagittalInfluence: 0,
      refractiveInfluence: 0,
      zScale: 2,
    })
    const index = (20 * 41 + 12) * 3
    expect(scaled.positions[index]).toBeCloseTo(field.positions[index], 12)
    expect(scaled.positions[index + 2]).toBeCloseTo(field.positions[index + 2] * 2, 6)
  })
})

describe('displayField / buildColors', () => {
  const maps = generateSampleMaps('keratoconus', 21, 8, { ...baseInputs, gridResolution: 21 })
  const field = buildSurfaceField(
    { ...baseInputs, gridResolution: 21 },
    maps,
    {
      elevationScale: 3,
      tangentialInfluence: 0,
      sagittalInfluence: 0,
      refractiveInfluence: 0,
      zScale: 1,
    },
  )

  it('differenceFromBase는 elevationScale을 반영한 µm 값을 준다', () => {
    const values = displayField(field, maps, 'differenceFromBase')
    // elevationScale 3배가 표시값에 실제로 들어가 있어야 한다
    expect(values[10][10]).toBeCloseTo(maps.elevation[10][10] * 3, 6)
  })

  it('데이터 모드는 원본 지도를 그대로 쓴다', () => {
    expect(displayField(field, maps, 'tangential')).toBe(maps.tangential)
  })

  it('색상 배열은 정점당 3채널이고 0–1 범위다', () => {
    const values = displayField(field, maps, 'tangential')
    const colors = buildColors(values, 'tangential', { min: 38, max: 52 })
    expect(colors.length).toBe(21 * 21 * 3)
    expect(colors.every((c) => c >= 0 && c <= 1)).toBe(true)
  })

  it('전달된 버퍼를 재사용한다', () => {
    const values = displayField(field, maps, 'tangential')
    const buffer = new Float32Array(21 * 21 * 3)
    const result = buildColors(values, 'tangential', { min: 38, max: 52 }, buffer)
    expect(result).toBe(buffer)
  })
})
