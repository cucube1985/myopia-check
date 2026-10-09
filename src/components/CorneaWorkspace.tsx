import { useMemo, useState } from 'react'
import { Info, Microscope, PanelTop } from 'lucide-react'
import { ControlPanel } from './ControlPanel'
import { CorneaViewer } from './CorneaViewer'
import { ErrorBoundary } from './ErrorBoundary'
import { Legend } from './Legend'
import { ProfileChart } from './ProfileChart'
import { SummaryPanel } from './SummaryPanel'
import { TopoPanel } from './TopoPanel'
import { defaultAxisFor, generateSampleMaps, presetLabels } from '../data/sampleMaps'
import { buildColors, buildSurfaceField, displayField } from '../math/corneaSurface'
import { checkMapShape, resizeMapBilinear } from '../math/interpolation'
import { calculateSummary, mapRange } from '../math/mapStats'
import type {
  ColorScaleConfig,
  CorneaInputs,
  DataTopoMode,
  ImportedCorneaData,
  SamplePreset,
  SurfaceOptions,
  TopographyMaps,
} from '../types/cornea'

const defaultInputs: CorneaInputs = {
  flatK: 42,
  steepK: 44,
  axis: 90,
  opticalZoneDiameter: 8,
  gridResolution: 121,
  eye: 'OD',
}

const defaultOptions: SurfaceOptions = {
  activeMode: 'tangential',
  elevationScale: 1,
  tangentialInfluence: 0,
  sagittalInfluence: 0,
  refractiveInfluence: 0,
  zScale: 1,
}

const modes: DataTopoMode[] = ['tangential', 'elevation', 'sagittal', 'refractivePower']
const allowedGridSizes = [81, 101, 121, 151]

export function CorneaWorkspace() {
  const [inputs, setInputs] = useState(defaultInputs)
  const [preset, setPreset] = useState<SamplePreset>('keratoconus')
  const [options, setOptions] = useState(defaultOptions)
  const [manualScale, setManualScale] = useState<ColorScaleConfig>({
    min: 38,
    max: 52,
    auto: true,
  })
  const [wireframe, setWireframe] = useState(false)
  const [showRings, setShowRings] = useState(true)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [customMaps, setCustomMaps] = useState<TopographyMaps | null>(null)
  const [dataLabel, setDataLabel] = useState(presetLabels.keratoconus)

  const maps = useMemo(() => {
    if (customMaps) {
      return Object.fromEntries(
        modes.map((mode) => [
          mode,
          resizeMapBilinear(customMaps[mode], inputs.gridResolution, inputs.gridResolution),
        ]),
      ) as unknown as TopographyMaps
    }
    return generateSampleMaps(preset, inputs.gridResolution, inputs.opticalZoneDiameter, inputs)
  }, [customMaps, inputs, preset])

  // 정점 위치·인덱스. 색상 설정이나 표시 모드에 의존하지 않는다.
  const field = useMemo(
    () =>
      buildSurfaceField(inputs, maps, {
        elevationScale: options.elevationScale,
        tangentialInfluence: options.tangentialInfluence,
        sagittalInfluence: options.sagittalInfluence,
        refractiveInfluence: options.refractiveInfluence,
        zScale: options.zScale,
      }),
    [
      inputs,
      maps,
      options.elevationScale,
      options.refractiveInfluence,
      options.sagittalInfluence,
      options.tangentialInfluence,
      options.zScale,
    ],
  )

  // 표시할 스칼라장(표시 단위). Difference 모드는 실제 변위를 µm로 환산한 값이다.
  const values = useMemo(
    () => displayField(field, maps, options.activeMode),
    [field, maps, options.activeMode],
  )

  /**
   * Auto 범위를 실제 표시값에서 뽑는다.
   * 이전 구현은 Difference 모드에서 원본 elevation 범위만 써서
   * Elevation displacement를 올리면 색이 포화됐다.
   */
  const autoRange = useMemo(() => {
    const range = mapRange(values)
    const step = options.activeMode === 'tangential' ||
      options.activeMode === 'sagittal' ||
      options.activeMode === 'refractivePower'
      ? 0.5
      : 5
    const min = Math.floor(range.min / step) * step
    const max = Math.ceil(range.max / step) * step
    return { min, max: max > min ? max : min + step }
  }, [options.activeMode, values])

  // 객체가 아니라 숫자에 의존하게 둔다. 그래야 Auto 범위가 매 렌더 새 객체여도
  // 값이 같으면 색을 다시 만들지 않는다.
  const scaleMin = manualScale.auto ? autoRange.min : manualScale.min
  const scaleMax = manualScale.auto ? autoRange.max : manualScale.max
  const colorScale: ColorScaleConfig = { min: scaleMin, max: scaleMax, auto: manualScale.auto }

  const colors = useMemo(
    () => buildColors(values, options.activeMode, { min: scaleMin, max: scaleMax }),
    [options.activeMode, scaleMax, scaleMin, values],
  )

  const summary = useMemo(() => calculateSummary(inputs, maps), [inputs, maps])

  const handleInputsChange = (patch: Partial<CorneaInputs>) => {
    setInputs((current) => ({ ...current, ...patch }))
  }

  const handlePresetChange = (nextPreset: SamplePreset) => {
    setInputs((current) => ({ ...current, axis: defaultAxisFor(nextPreset) }))
    setPreset(nextPreset)
    setCustomMaps(null)
    setDataLabel(presetLabels[nextPreset])
    setManualScale((current) => ({ ...current, auto: true }))
  }

  const handleImport = () => {
    let parsed: ImportedCorneaData
    try {
      parsed = JSON.parse(jsonText) as ImportedCorneaData
    } catch {
      setJsonError('JSON 형식을 읽을 수 없습니다. 괄호와 쉼표를 확인해 주세요.')
      return
    }

    const fallback = generateSampleMaps(
      preset,
      inputs.gridResolution,
      inputs.opticalZoneDiameter,
      inputs,
    )
    const imported: Partial<Record<DataTopoMode, number[][]>> = {}
    for (const mode of modes) {
      const values = parsed.maps?.[mode]?.values
      if (values === undefined) {
        imported[mode] = fallback[mode]
        continue
      }
      const shape = checkMapShape(values)
      if (!shape.ok) {
        setJsonError(`${mode} 지도를 사용할 수 없습니다. ${shape.reason}`)
        return
      }
      imported[mode] = values as number[][]
    }

    setInputs((current) => ({
      ...current,
      flatK: Number.isFinite(parsed.flatK) ? (parsed.flatK as number) : current.flatK,
      steepK: Number.isFinite(parsed.steepK) ? (parsed.steepK as number) : current.steepK,
      axis: Number.isFinite(parsed.axis) ? (parsed.axis as number) : current.axis,
      opticalZoneDiameter: Number.isFinite(parsed.diameterMm)
        ? (parsed.diameterMm as number)
        : current.opticalZoneDiameter,
      gridResolution: allowedGridSizes.includes(parsed.gridSize ?? 0)
        ? (parsed.gridSize as number)
        : current.gridResolution,
    }))
    setCustomMaps(imported as TopographyMaps)
    setDataLabel(parsed.patientLabel || 'Imported dataset')
    setJsonError('')
    setManualScale((current) => ({ ...current, auto: true }))
  }

  const handleReset = () => {
    setInputs(defaultInputs)
    setPreset('keratoconus')
    setOptions(defaultOptions)
    setCustomMaps(null)
    setDataLabel(presetLabels.keratoconus)
    setJsonText('')
    setJsonError('')
    setManualScale({ min: 38, max: 52, auto: true })
    setWireframe(false)
    setShowRings(true)
  }

  return (
    <>
      <div className="tool-subhead">
        <div className="dataset-chip">
          <span>Active dataset</span>
          <strong>{dataLabel}</strong>
        </div>
        <div className="header-meta">
          <span><Microscope size={15} /> 교육·연구용 시각화</span>
        </div>
      </div>

      <div className="workspace">
        <ControlPanel
          inputs={inputs}
          preset={preset}
          jsonText={jsonText}
          jsonError={jsonError}
          onInputsChange={handleInputsChange}
          onPresetChange={handlePresetChange}
          onJsonTextChange={setJsonText}
          onImport={handleImport}
          onReset={handleReset}
        />

        <section className="center-stage">
          <div className="stage-card" id="cornea-surface-panel" role="tabpanel">
            <div className="stage-card__header">
              <div>
                <span className="section-index">SURFACE / 3D</span>
                <h1>Anterior corneal surface</h1>
              </div>
              <div className="stage-badges">
                <span><PanelTop size={13} /> {inputs.gridResolution}² mesh</span>
                <span>Ø {inputs.opticalZoneDiameter.toFixed(1)} mm</span>
              </div>
            </div>
            <ErrorBoundary
              title="3D 표면을 그릴 수 없습니다"
              hint="브라우저의 WebGL 지원이나 그래픽 드라이버를 확인해 주세요. 왼쪽 수치와 아래 단면 그래프는 계속 사용할 수 있습니다."
            >
              <CorneaViewer
                field={field}
                colors={colors}
                inputs={inputs}
                zScale={options.zScale}
                wireframe={wireframe}
                showRings={showRings}
              />
            </ErrorBoundary>
            <Legend mode={options.activeMode} min={colorScale.min} max={colorScale.max} />
          </div>
          <TopoPanel
            options={options}
            colorScale={colorScale}
            wireframe={wireframe}
            showRings={showRings}
            onOptionsChange={(patch) => {
              setOptions((current) => ({ ...current, ...patch }))
              if (patch.activeMode) setManualScale((current) => ({ ...current, auto: true }))
            }}
            onColorScaleChange={(patch) =>
              setManualScale((current) => ({ ...current, ...patch }))
            }
            onAutoScale={() => setManualScale((current) => ({ ...current, auto: true }))}
            onWireframeChange={setWireframe}
            onShowRingsChange={setShowRings}
          />
        </section>

        <SummaryPanel inputs={inputs} summary={summary} />
      </div>

      <ProfileChart
        map={values}
        mode={options.activeMode}
        diameter={inputs.opticalZoneDiameter}
      />

      <footer className="disclaimer">
        <Info size={16} />
        <p>
          <strong>교육 및 시각화 목적의 모델입니다.</strong> 실제 Pentacam, Orbscan, Galilei,
          Sirius, CASIA 등 장비의 진단 결과를 대체하지 않으며 임상적 판단에 사용할 수
          없습니다. 기저 곡면은 정점 부근에서만 입력 K값과 일치하는 포물면 근사이고,
          Refractive 지도는 상수 오프셋을 쓴 단순 근사입니다. Power influence는 형태 차이를
          이해하기 위한 시각 보정입니다.
        </p>
      </footer>
    </>
  )
}
