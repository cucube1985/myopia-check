export type TopoMode =
  | 'tangential'
  | 'elevation'
  | 'sagittal'
  | 'refractivePower'
  | 'differenceFromBase'

export type DataTopoMode = Exclude<TopoMode, 'differenceFromBase'>

/** 검사 대상 눈. 지형도 방위 표기(N/T)와 프리셋 편심 방향을 좌우한다. */
export type Eye = 'OD' | 'OS'

export interface CorneaInputs {
  flatK: number
  steepK: number
  /**
   * 가파른 경선(steep meridian)의 방위각(도).
   * 검안 관례와 동일하다: axis 90 = 수직 경선이 가파름 = 직난시(with-the-rule).
   */
  axis: number
  opticalZoneDiameter: number
  gridResolution: number
  eye: Eye
}

export interface TopographyMaps {
  tangential: number[][]
  elevation: number[][]
  sagittal: number[][]
  refractivePower: number[][]
}

export interface CorneaSurfacePoint {
  x: number
  y: number
  zBase: number
  z: number
  row: number
  col: number
}

export interface ColorScaleConfig {
  min: number
  max: number
  auto: boolean
}

/** 기하(정점 위치)에만 영향을 주는 옵션. 색상과 분리해 재계산 범위를 좁힌다. */
export interface GeometryOptions {
  elevationScale: number
  tangentialInfluence: number
  sagittalInfluence: number
  refractiveInfluence: number
  zScale: number
}

export interface SurfaceOptions extends GeometryOptions {
  activeMode: TopoMode
}

/** 정점 위치·인덱스와 색상 산출에 필요한 스칼라장. three.js에 의존하지 않는다. */
export interface SurfaceField {
  positions: Float32Array
  indices: Uint32Array
  /** 기준 토릭면으로부터의 변위(mm). 표시 단위는 µm이므로 1000배 해서 쓴다. */
  differences: number[][]
  gridSize: number
}

export interface CorneaSummary {
  astigmatism: number
  rFlat: number
  rSteep: number
  meanTangential: number
  meanSagittal: number
  meanRefractive: number
  minElevation: number
  maxElevation: number
  central3mmMean: number
  inferiorSuperiorIndex: number
}

export type SamplePreset =
  | 'normal'
  | 'withTheRule'
  | 'againstTheRule'
  | 'oblique'
  | 'inferiorSteepening'
  | 'keratoconus'
  | 'postLasik'
  | 'irregular'

export interface ImportedCorneaData {
  patientLabel?: string
  flatK?: number
  steepK?: number
  axis?: number
  diameterMm?: number
  gridSize?: number
  maps?: Partial<Record<DataTopoMode, { unit: string; values: number[][] }>>
}
