export type MapShapeError =
  | { ok: true; rows: number; cols: number }
  | { ok: false; reason: string }

/**
 * 2차원 숫자 배열이 지형도로 쓸 수 있는 모양인지 검사한다.
 *
 * 이전 구현은 행 길이가 다른 배열(ragged array)을 통과시켰고,
 * resizeMapBilinear이 undefined를 읽어 NaN을 만들면서
 * 오류 메시지 없이 3D 메시가 사라졌다.
 */
export function checkMapShape(value: unknown): MapShapeError {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, reason: '값이 비어 있지 않은 배열이어야 합니다.' }
  }
  const rows = value.length
  const first = value[0]
  if (!Array.isArray(first) || first.length === 0) {
    return { ok: false, reason: '각 행이 비어 있지 않은 배열이어야 합니다.' }
  }
  const cols = first.length
  for (let r = 0; r < rows; r += 1) {
    const row = value[r]
    if (!Array.isArray(row)) {
      return { ok: false, reason: `${r + 1}번째 행이 배열이 아닙니다.` }
    }
    if (row.length !== cols) {
      return {
        ok: false,
        reason: `모든 행의 길이가 같아야 합니다. 1번째 행은 ${cols}개, ${r + 1}번째 행은 ${row.length}개입니다.`,
      }
    }
    for (let c = 0; c < cols; c += 1) {
      if (!Number.isFinite(row[c])) {
        return {
          ok: false,
          reason: `${r + 1}행 ${c + 1}열의 값이 유한한 숫자가 아닙니다.`,
        }
      }
    }
  }
  if (rows !== cols) {
    return { ok: false, reason: `정사각 격자여야 합니다. 현재 ${rows} × ${cols}입니다.` }
  }
  return { ok: true, rows, cols }
}

export function sampleMapBilinear(map: number[][], u: number, v: number): number {
  if (!map.length || !map[0]?.length) return 0
  const rows = map.length
  const cols = map[0].length
  const x = Math.max(0, Math.min(cols - 1, u * (cols - 1)))
  const y = Math.max(0, Math.min(rows - 1, v * (rows - 1)))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)
  const tx = x - x0
  const ty = y - y0
  const top = map[y0][x0] * (1 - tx) + map[y0][x1] * tx
  const bottom = map[y1][x0] * (1 - tx) + map[y1][x1] * tx
  return top * (1 - ty) + bottom * ty
}

export function resizeMapBilinear(
  map: number[][],
  targetRows: number,
  targetCols: number,
): number[][] {
  return Array.from({ length: targetRows }, (_, row) =>
    Array.from({ length: targetCols }, (_, col) =>
      sampleMapBilinear(
        map,
        targetCols === 1 ? 0 : col / (targetCols - 1),
        targetRows === 1 ? 0 : row / (targetRows - 1),
      ),
    ),
  )
}
