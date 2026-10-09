import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three'
import type { SurfaceField } from '../types/cornea'

/**
 * three.js 어댑터. 순수 수치 배열을 BufferGeometry에 옮긴다.
 *
 * src/math는 three.js에 의존하지 않으므로 단위 테스트가 가능하고,
 * 렌더러 관련 코드는 이 파일에만 모인다.
 *
 * 위치와 색상을 따로 갱신하는 것이 핵심이다. 이전 구현은 색상범위 슬라이더를
 * 한 칸 움직여도 정점 위치·인덱스·법선을 전부 다시 만들었다.
 */

/** 정점 위치와 인덱스를 반영하고 법선을 다시 계산한다. */
export function applyField(geometry: BufferGeometry, field: SurfaceField): void {
  const position = geometry.getAttribute('position') as BufferAttribute | undefined
  if (position && position.array.length === field.positions.length) {
    ;(position.array as Float32Array).set(field.positions)
    position.needsUpdate = true
  } else {
    geometry.setAttribute('position', new Float32BufferAttribute(field.positions, 3))
  }

  const index = geometry.getIndex()
  if (index && index.array.length === field.indices.length) {
    ;(index.array as Uint32Array).set(field.indices)
    index.needsUpdate = true
  } else {
    geometry.setIndex(new BufferAttribute(field.indices, 1))
  }

  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
}

/** 색상만 반영한다. 위치·인덱스·법선은 그대로 둔다. */
export function applyColors(geometry: BufferGeometry, colors: Float32Array): void {
  const attribute = geometry.getAttribute('color') as BufferAttribute | undefined
  if (attribute && attribute.array.length === colors.length) {
    ;(attribute.array as Float32Array).set(colors)
    attribute.needsUpdate = true
    return
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
}
