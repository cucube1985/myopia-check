import type { TopoMode } from '../types/cornea'

export type Rgb = [number, number, number]
type HexStop = readonly [number, string]
type RgbStop = readonly [number, Rgb]

const hexPalettes: Record<'elevation' | 'power' | 'difference', readonly HexStop[]> = {
  elevation: [
    [0, '#16367a'],
    [0.22, '#1f8ed0'],
    [0.46, '#b9edf0'],
    [0.5, '#f5f7e9'],
    [0.72, '#f4b740'],
    [1, '#cc3a37'],
  ],
  power: [
    [0, '#25346f'],
    [0.18, '#2169b2'],
    [0.37, '#28b8ba'],
    [0.51, '#9ed467'],
    [0.66, '#f1cf42'],
    [0.82, '#f17d38'],
    [1, '#b62335'],
  ],
  difference: [
    [0, '#49307f'],
    [0.35, '#9d82c1'],
    [0.5, '#f6f2e9'],
    [0.72, '#e5a14a'],
    [1, '#b95224'],
  ],
}

/** sRGB 16진 문자열을 0–1 선형 채널값으로. three.Color의 기본(sRGB) 해석과 같다. */
function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/**
 * 팔레트를 모듈 로드 시 한 번만 RGB로 변환한다.
 * 이전 구현은 정점마다 Color 객체를 두 개씩 만들어(151² 그리드에서 재빌드당 45,602개)
 * 슬라이더 드래그 중 GC 압력을 유발했다.
 */
const rgbPalettes = {
  elevation: hexPalettes.elevation.map(([p, h]) => [p, hexToRgb(h)] as RgbStop),
  power: hexPalettes.power.map(([p, h]) => [p, hexToRgb(h)] as RgbStop),
  difference: hexPalettes.difference.map(([p, h]) => [p, hexToRgb(h)] as RgbStop),
} as const

export type Palette = readonly RgbStop[]

function paletteKey(mode: TopoMode): keyof typeof rgbPalettes {
  if (mode === 'elevation') return 'elevation'
  if (mode === 'differenceFromBase') return 'difference'
  return 'power'
}

export function paletteForMode(mode: TopoMode): Palette {
  return rgbPalettes[paletteKey(mode)]
}

/** 할당 없이 out[offset..offset+2]에 색을 써 넣는다. */
export function writeColor(
  out: Float32Array,
  offset: number,
  value: number,
  min: number,
  max: number,
  palette: Palette,
): void {
  const normalized =
    max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  let left = palette[0]
  let right = palette[palette.length - 1]
  for (let index = 1; index < palette.length; index += 1) {
    if (normalized <= palette[index][0]) {
      left = palette[index - 1]
      right = palette[index]
      break
    }
  }
  const span = right[0] - left[0]
  const t = span === 0 ? 0 : (normalized - left[0]) / span
  out[offset] = left[1][0] + (right[1][0] - left[1][0]) * t
  out[offset + 1] = left[1][1] + (right[1][1] - left[1][1]) * t
  out[offset + 2] = left[1][2] + (right[1][2] - left[1][2]) * t
}

/** 테스트와 범례 미리보기용 단일 색 조회. */
export function valueToRgb(
  value: number,
  min: number,
  max: number,
  palette: Palette,
): Rgb {
  const out = new Float32Array(3)
  writeColor(out, 0, value, min, max, palette)
  return [out[0], out[1], out[2]]
}

export function cssGradientForMode(mode: TopoMode): string {
  return `linear-gradient(90deg, ${hexPalettes[paletteKey(mode)]
    .map(([position, color]) => `${color} ${position * 100}%`)
    .join(', ')})`
}
