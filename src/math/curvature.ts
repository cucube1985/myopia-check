/**
 * 표면 형상에서 곡률·굴절력을 역산한다.
 *
 * 이전 버전은 빈 배열을 돌려주는 스텁이었다. 지금은 실제 계산을 수행하며,
 * 주 용도는 회귀 테스트의 독립 검증자다. 즉 생성된 기하가 의도한 K값·축을
 * 실제로 가지는지를 파워맵 생성 코드와 무관한 경로로 확인한다.
 *
 * 규약: z(r)은 각막 정점을 원점으로 하는 새그(mm), 축은 z 방향.
 */

/** 케라토메트리 지수. r(mm) ↔ K(D) 환산에 쓴다. */
export const KERATOMETRIC_INDEX_MM_D = 337.5

/**
 * 축성(sagittal / axial) 곡률반경.
 *
 * 점의 법선이 광축과 만나는 지점까지의 거리로 정의된다.
 * 경사 tan θ = dz/dr 일 때 R = r · √(1 + (dz/dr)²) / (dz/dr).
 * 구면(반경 R)에서는 모든 r에서 정확히 R을 돌려준다.
 */
export function axialRadius(r: number, dzdr: number): number {
  if (r === 0 || dzdr === 0) return Number.POSITIVE_INFINITY
  return (r * Math.sqrt(1 + dzdr * dzdr)) / dzdr
}

/**
 * 접선(tangential / instantaneous) 곡률반경.
 * R = (1 + (dz/dr)²)^{3/2} / |d²z/dr²|
 */
export function tangentialRadius(dzdr: number, d2zdr2: number): number {
  if (d2zdr2 === 0) return Number.POSITIVE_INFINITY
  return Math.pow(1 + dzdr * dzdr, 1.5) / Math.abs(d2zdr2)
}

export const radiusToPower = (radiusMm: number): number =>
  radiusMm === 0 || !Number.isFinite(radiusMm) ? 0 : KERATOMETRIC_INDEX_MM_D / radiusMm

/**
 * 주어진 새그 함수의 한 경선을 따라 축성 굴절력(D)을 산출한다.
 * 미분은 중심차분으로 근사한다.
 *
 * @param sag      (x, y) → 새그(mm)
 * @param angleDeg 경선 방위각(도). 0 = 수평, 90 = 수직.
 * @param rMm      정점에서의 거리(mm). 0보다 커야 한다.
 * @param h        차분 간격(mm)
 */
export function axialPowerAlongMeridian(
  sag: (x: number, y: number) => number,
  angleDeg: number,
  rMm: number,
  h = 1e-4,
): number {
  const theta = (angleDeg * Math.PI) / 180
  const at = (r: number) => sag(r * Math.cos(theta), r * Math.sin(theta))
  const dzdr = (at(rMm + h) - at(rMm - h)) / (2 * h)
  return radiusToPower(axialRadius(rMm, dzdr))
}

/**
 * 새그 함수를 경선 방향으로 훑어 가장 가파른 경선의 방위각(도, 0–180)과
 * 그때의 굴절력, 가장 편평한 경선의 굴절력을 찾는다.
 *
 * 파워맵 생성 코드를 거치지 않고 형상만으로 축을 되찾으므로,
 * 축 규약이 어긋났는지 판별하는 데 쓸 수 있다.
 */
export function findPrincipalMeridians(
  sag: (x: number, y: number) => number,
  rMm: number,
  stepDeg = 0.5,
): { steepAxisDeg: number; steepPowerD: number; flatPowerD: number } {
  let steepAxisDeg = 0
  let steepPowerD = Number.NEGATIVE_INFINITY
  let flatPowerD = Number.POSITIVE_INFINITY
  for (let angle = 0; angle < 180; angle += stepDeg) {
    const power = axialPowerAlongMeridian(sag, angle, rMm)
    if (power > steepPowerD) {
      steepPowerD = power
      steepAxisDeg = angle
    }
    if (power < flatPowerD) flatPowerD = power
  }
  return { steepAxisDeg, steepPowerD, flatPowerD }
}
