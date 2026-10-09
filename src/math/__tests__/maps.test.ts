import { describe, expect, it } from 'vitest'
import { checkMapShape, resizeMapBilinear, sampleMapBilinear } from '../interpolation'
import { calculateSummary, mapRange } from '../mapStats'
import { paletteForMode, valueToRgb } from '../colorMap'
import { axialRadius, radiusToPower, tangentialRadius } from '../curvature'
import { defaultAxisFor, generateSampleMaps } from '../../data/sampleMaps'
import type { CorneaInputs } from '../../types/cornea'

describe('checkMapShape', () => {
  it('정사각 숫자 격자를 통과시킨다', () => {
    const result = checkMapShape([
      [1, 2],
      [3, 4],
    ])
    expect(result.ok).toBe(true)
  })

  /** 회귀: 이전 validMap은 이 배열을 통과시켜 NaN 메시를 만들었다. */
  it('행 길이가 다른 배열을 거부한다', () => {
    const result = checkMapShape([[1, 2, 3], [4, 5], [6, 7, 8]])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('길이')
  })

  it('정사각이 아닌 격자를 거부한다', () => {
    const result = checkMapShape([
      [1, 2, 3],
      [4, 5, 6],
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('정사각')
  })

  it('NaN·Infinity·문자열을 거부한다', () => {
    expect(checkMapShape([[Number.NaN, 1], [2, 3]]).ok).toBe(false)
    expect(checkMapShape([[Number.POSITIVE_INFINITY, 1], [2, 3]]).ok).toBe(false)
    expect(checkMapShape([['a', 1], [2, 3]]).ok).toBe(false)
  })

  it('빈 값과 비배열을 거부한다', () => {
    expect(checkMapShape([]).ok).toBe(false)
    expect(checkMapShape([[]]).ok).toBe(false)
    expect(checkMapShape(null).ok).toBe(false)
    expect(checkMapShape('nope').ok).toBe(false)
    expect(checkMapShape([[1, 2], 'x']).ok).toBe(false)
  })
})

describe('sampleMapBilinear / resizeMapBilinear', () => {
  const map = [
    [0, 10],
    [20, 30],
  ]

  it('모서리를 정확히 집어낸다', () => {
    expect(sampleMapBilinear(map, 0, 0)).toBeCloseTo(0, 10)
    expect(sampleMapBilinear(map, 1, 0)).toBeCloseTo(10, 10)
    expect(sampleMapBilinear(map, 0, 1)).toBeCloseTo(20, 10)
    expect(sampleMapBilinear(map, 1, 1)).toBeCloseTo(30, 10)
  })

  it('중앙에서 네 값의 평균이다', () => {
    expect(sampleMapBilinear(map, 0.5, 0.5)).toBeCloseTo(15, 10)
  })

  it('범위를 벗어난 좌표를 잘라낸다', () => {
    expect(sampleMapBilinear(map, -1, -1)).toBeCloseTo(0, 10)
    expect(sampleMapBilinear(map, 2, 2)).toBeCloseTo(30, 10)
  })

  it('확대 후에도 유한한 값만 남는다', () => {
    const resized = resizeMapBilinear(map, 9, 9)
    expect(resized.length).toBe(9)
    expect(resized.every((row) => row.length === 9)).toBe(true)
    expect(resized.flat().every(Number.isFinite)).toBe(true)
  })

  it('상수 지도는 확대해도 상수다', () => {
    const constant = Array.from({ length: 5 }, () => Array<number>(5).fill(7))
    expect(resizeMapBilinear(constant, 11, 11).flat().every((v) => v === 7)).toBe(true)
  })
})

describe('mapRange', () => {
  it('원형 구역 안의 최소·최대를 찾는다', () => {
    const size = 21
    const map = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => r * size + c),
    )
    const { min, max } = mapRange(map)
    expect(Number.isFinite(min)).toBe(true)
    expect(Number.isFinite(max)).toBe(true)
    expect(min).toBeLessThan(max)
  })

  /** 회귀: Math.min(...values) 스프레드는 큰 격자에서 인수 한도를 넘을 수 있다. */
  it('151² 격자에서도 동작한다', () => {
    const size = 151
    const map = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => Math.sin(r) + Math.cos(c)),
    )
    const { min, max } = mapRange(map)
    expect(Number.isFinite(min)).toBe(true)
    expect(Number.isFinite(max)).toBe(true)
  })
})

describe('colorMap', () => {
  it('모드별 팔레트를 고른다', () => {
    expect(paletteForMode('elevation')).not.toBe(paletteForMode('tangential'))
    expect(paletteForMode('tangential')).toBe(paletteForMode('sagittal'))
    expect(paletteForMode('sagittal')).toBe(paletteForMode('refractivePower'))
  })

  it('모든 채널이 0–1이다', () => {
    for (const value of [-100, 38, 45, 52, 1000]) {
      const rgb = valueToRgb(value, 38, 52, paletteForMode('tangential'))
      expect(rgb.every((c) => c >= 0 && c <= 1)).toBe(true)
    }
  })

  it('min == max에서도 유한한 색을 준다', () => {
    const rgb = valueToRgb(42, 42, 42, paletteForMode('tangential'))
    expect(rgb.every(Number.isFinite)).toBe(true)
  })

  it('범위를 벗어난 값은 양 끝 색으로 고정된다', () => {
    const palette = paletteForMode('tangential')
    expect(valueToRgb(-999, 38, 52, palette)).toEqual(valueToRgb(38, 38, 52, palette))
    expect(valueToRgb(999, 38, 52, palette)).toEqual(valueToRgb(52, 38, 52, palette))
  })
})

describe('curvature', () => {
  it('구면에서 축성 반경이 구면 반경과 같다', () => {
    const R = 7.8
    for (const r of [0.5, 1.5, 2.5, 3.5]) {
      const dzdr = r / Math.sqrt(R * R - r * r)
      expect(axialRadius(r, dzdr)).toBeCloseTo(R, 8)
    }
  })

  it('구면에서 접선 반경도 구면 반경과 같다', () => {
    const R = 7.8
    for (const r of [0.5, 2.5]) {
      const dzdr = r / Math.sqrt(R * R - r * r)
      const d2zdr2 = (R * R) / Math.pow(R * R - r * r, 1.5)
      expect(tangentialRadius(dzdr, d2zdr2)).toBeCloseTo(R, 8)
    }
  })

  it('반경과 굴절력이 서로 역변환된다', () => {
    expect(radiusToPower(337.5 / 43)).toBeCloseTo(43, 10)
    expect(radiusToPower(Number.POSITIVE_INFINITY)).toBe(0)
    expect(radiusToPower(0)).toBe(0)
  })
})

const inputs = (patch: Partial<CorneaInputs> = {}): CorneaInputs => ({
  flatK: 42,
  steepK: 44,
  axis: 90,
  opticalZoneDiameter: 8,
  gridResolution: 31,
  eye: 'OD',
  ...patch,
})

describe('generateSampleMaps', () => {
  it('네 지도를 모두 정사각으로 만든다', () => {
    const maps = generateSampleMaps('normal', 31, 8, inputs())
    for (const key of ['tangential', 'elevation', 'sagittal', 'refractivePower'] as const) {
      expect(maps[key].length).toBe(31)
      expect(maps[key].every((row) => row.length === 31)).toBe(true)
      expect(maps[key].flat().every(Number.isFinite)).toBe(true)
    }
  })

  it('프리셋 기본 축이 난시 유형과 맞는다', () => {
    expect(defaultAxisFor('withTheRule')).toBe(90)
    expect(defaultAxisFor('againstTheRule')).toBe(0)
    expect(defaultAxisFor('oblique')).toBe(45)
  })

  /** 회귀: 직난시 프리셋은 수직 경선이 가파르게 보여야 한다. */
  it('직난시 프리셋에서 12시가 3시보다 가파르다', () => {
    const size = 31
    const maps = generateSampleMaps('withTheRule', size, 8, inputs({ axis: 90 }))
    const center = Math.floor(size / 2)
    const top = maps.tangential[2][center]
    const side = maps.tangential[center][2]
    expect(top).toBeGreaterThan(side)
  })

  it('도난시 프리셋에서 3시가 12시보다 가파르다', () => {
    const size = 31
    const maps = generateSampleMaps('againstTheRule', size, 8, inputs({ axis: 0 }))
    const center = Math.floor(size / 2)
    expect(maps.tangential[center][2]).toBeGreaterThan(maps.tangential[2][center])
  })

  it('K값을 바꾸면 중심 굴절력이 따라간다', () => {
    const size = 31
    const center = Math.floor(size / 2)
    const flat = generateSampleMaps('normal', size, 8, inputs({ flatK: 40, steepK: 40 }))
    const steep = generateSampleMaps('normal', size, 8, inputs({ flatK: 46, steepK: 46 }))
    expect(steep.tangential[center][center]).toBeGreaterThan(flat.tangential[center][center])
  })

  /** OD/OS에 따라 편심 패턴이 좌우 대칭으로 뒤집혀야 한다(하이측 유지). */
  it('원추각막 돌출부가 눈에 따라 반대쪽에 놓인다', () => {
    const size = 41
    const od = generateSampleMaps('keratoconus', size, 8, inputs({ gridResolution: size, eye: 'OD' }))
    const os = generateSampleMaps('keratoconus', size, 8, inputs({ gridResolution: size, eye: 'OS' }))
    const peakCol = (maps: { elevation: number[][] }) => {
      let best = { value: Number.NEGATIVE_INFINITY, col: -1 }
      maps.elevation.forEach((row) =>
        row.forEach((value, col) => {
          if (value > best.value) best = { value, col }
        }),
      )
      return best.col
    }
    const center = Math.floor(size / 2)
    expect(peakCol(od)).toBeLessThan(center)
    expect(peakCol(os)).toBeGreaterThan(center)
  })

  it('회전 대칭 프리셋은 눈에 따라 달라지지 않는다', () => {
    const od = generateSampleMaps('postLasik', 31, 8, inputs({ eye: 'OD' }))
    const os = generateSampleMaps('postLasik', 31, 8, inputs({ eye: 'OS' }))
    expect(od.elevation).toEqual(os.elevation)
  })
})

describe('calculateSummary', () => {
  it('난시량은 steep - flat이다', () => {
    const config = inputs({ flatK: 42, steepK: 45.5 })
    const maps = generateSampleMaps('normal', 31, 8, config)
    expect(calculateSummary(config, maps).astigmatism).toBeCloseTo(3.5, 10)
  })

  it('반경이 K값과 대응한다', () => {
    const config = inputs()
    const summary = calculateSummary(config, generateSampleMaps('normal', 31, 8, config))
    expect(summary.rFlat).toBeCloseTo(337.5 / 42, 10)
    expect(summary.rSteep).toBeCloseTo(337.5 / 44, 10)
    expect(summary.rSteep).toBeLessThan(summary.rFlat)
  })

  it('모든 통계가 유한하다', () => {
    const config = inputs()
    const summary = calculateSummary(config, generateSampleMaps('irregular', 31, 8, config))
    expect(Object.values(summary).every(Number.isFinite)).toBe(true)
  })

  it('하부 융기 프리셋에서 I–S 지수가 양수다', () => {
    const config = inputs()
    const summary = calculateSummary(
      config,
      generateSampleMaps('inferiorSteepening', 41, 8, { ...config, gridResolution: 41 }),
    )
    expect(summary.inferiorSuperiorIndex).toBeGreaterThan(0)
  })

  it('광학구역이 3 mm보다 작아도 중심 평균이 유한하다', () => {
    const config = inputs({ opticalZoneDiameter: 2 })
    const summary = calculateSummary(config, generateSampleMaps('normal', 31, 2, config))
    expect(Number.isFinite(summary.central3mmMean)).toBe(true)
  })
})
