import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide } from 'three'
import { Rotate3D } from 'lucide-react'
import type { CorneaInputs, SurfaceField } from '../types/cornea'
import { kToRadius, toricSag } from '../math/corneaSurface'
import { applyColors, applyField } from '../three/corneaGeometry'

interface CorneaMeshProps {
  field: SurfaceField
  colors: Float32Array
  inputs: CorneaInputs
  zScale: number
  wireframe: boolean
  showRings: boolean
}

function CorneaMesh({
  field,
  colors,
  inputs,
  zScale,
  wireframe,
  showRings,
}: CorneaMeshProps) {
  // 지오메트리를 이 컴포넌트가 소유하고, 위치와 색상을 각각 필요한 때만 갱신한다.
  const geometry = useMemo(() => new BufferGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => applyField(geometry, field), [geometry, field])
  useEffect(() => applyColors(geometry, colors), [geometry, colors])

  // 링은 표면과 같은 toricSag를 쓴다. 식이 두 곳에 복제돼 어긋나는 일을 막는다.
  const rings = useMemo(() => {
    const rFlat = kToRadius(inputs.flatK)
    const rSteep = kToRadius(inputs.steepK)
    return [1.5, 2.5, 3.5]
      .filter((radius) => radius <= inputs.opticalZoneDiameter / 2)
      .map((radius) =>
        Array.from({ length: 97 }, (_, index) => {
          const angle = (index / 96) * Math.PI * 2
          const x = radius * Math.cos(angle)
          const y = radius * Math.sin(angle)
          const z = toricSag(x, y, rFlat, rSteep, inputs.axis) * zScale + 0.025
          return [x, y, z] as [number, number, number]
        }),
      )
  }, [inputs.axis, inputs.flatK, inputs.opticalZoneDiameter, inputs.steepK, zScale])

  return (
    <group rotation={[-0.56, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          roughness={0.64}
          metalness={0.04}
          side={DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      {showRings &&
        rings.map((points, index) => (
          <Line
            key={`ring-${index}`}
            points={points}
            color="#f8fbf5"
            opacity={0.52}
            transparent
            lineWidth={0.7}
          />
        ))}
      {showRings && (
        <>
          <Line points={[[-0.12, 0, 0.03], [0.12, 0, 0.03]]} color="#ffffff" lineWidth={1} />
          <Line points={[[0, -0.12, 0.03], [0, 0.12, 0.03]]} color="#ffffff" lineWidth={1} />
        </>
      )}
    </group>
  )
}

export function CorneaViewer(props: CorneaMeshProps) {
  // 검사자 시점 표시. OD는 코방향이 화면 오른쪽, OS는 왼쪽이다.
  const nasalIsEast = props.inputs.eye === 'OD'

  return (
    <div className="viewer">
      <Canvas
        camera={{ position: [0, -6.8, 7.6], fov: 37, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.75]}
      >
        <ambientLight intensity={1.7} />
        <directionalLight position={[4, -3, 8]} intensity={2.8} />
        <directionalLight position={[-5, 2, 4]} intensity={1.2} color="#73d9cb" />
        <CorneaMesh {...props} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={15}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI - 0.25}
        />
      </Canvas>
      <div className="viewer__hint">
        <Rotate3D size={14} />
        드래그하여 회전 · 스크롤하여 확대
      </div>
      <div
        className="viewer__orientation"
        aria-label={`방위 표기, ${props.inputs.eye} 검사자 시점. 상 S, 하 I, 코방향 N, 측방 T`}
      >
        <span className="orientation__n">S</span>
        <span className="orientation__s">I</span>
        <span className="orientation__e">{nasalIsEast ? 'N' : 'T'}</span>
        <span className="orientation__w">{nasalIsEast ? 'T' : 'N'}</span>
        <i aria-hidden="true" />
      </div>
      <div className="viewer__scale">{props.inputs.eye} · geometry mm</div>
    </div>
  )
}
