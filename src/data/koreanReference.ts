/**
 * 연령별 구면대응치(SE) 참고 분포 — 한국 일반인 표본.
 *
 * 출처: Kim 등, "Characteristics of refractive errors in children with intermittent
 * exotropia compared with the general population", Scientific Reports (2026),
 * 보충표 1(Supplementary Table 1).
 * https://doi.org/10.1038/s41598-026-53576-3
 *
 * 사용한 대조군은 제7기 국민건강영양조사(KNHANES, 2016)의 만 5–18세 1,224명이며,
 * 사시 환자군(KIEMS)이 아니다. 비조절마비 자동굴절검사(Topcon KR-8800),
 * 더 근시인 눈, 성별 통합. 마지막 구간은 만 15–18세 통합(n=284)이므로
 * 연령별 개별 추정치로 제시하지 않는다.
 *
 * ── 원문 대조 기록 (2026-10-10) ──────────────────────────────────────
 * 논문: Kim DH, Chung SA, Choi J 외, Sci Rep 2026 (PMC13448085, PMID 42209568).
 * - 아래 11개 행(5–14세, 15–18세 통합)의 n·mean·sd를 보충표 1
 *   (41598_2026_53576_MOESM5_ESM.docx, «More myopic eye», KNHANES 열)과
 *   한 줄씩 대조했다: 모두 일치. 보충표의 «15» 행(n=284)이 15–18세 통합이다.
 * - 본문 Methods: «7th KNHANES (2016)», 만 5–18세, 비조절마비 자동굴절검사
 *   (KR-8800, Topcon), SE = 구면 + 0.5 × 원주.
 * - 본문 Table 1의 KNHANES 더 근시인 눈 SE −1.93 ± 2.27 D(n=1,224)와
 *   이 표를 합친 값(−1.931 ± 2.269)이 일치한다. 테스트에서 이를 확인한다.
 * ─────────────────────────────────────────────────────────────────────
 */
export const referenceSource = 'https://www.nature.com/articles/s41598-026-53576-3'

/**
 * 참고 분포의 기준 연도. 이 표본은 2016년 조사다.
 *
 * 같은 KNHANES를 2016년과 2021년으로 비교한 연구는 연령대응 비교에서도
 * 유의한 차이를 보고한다(Jpn J Ophthalmol, 2026;
 * https://doi.org/10.1007/s10384-026-01379-4). 2021년 또래가 더 근시라면
 * 2016년 기준과 비교한 백분위는 실제보다 높게(더 근시인 쪽으로) 나온다.
 */
export const referenceYear = 2016
export const referenceTrendSource = 'https://doi.org/10.1007/s10384-026-01379-4'

/** 참고 분포의 굴절검사 방식. 입력 검사 종류가 이것과 같을 때만 직접 비교가 성립한다. */
export const referenceExamType = 'auto' as const

export interface AgeReference {
  mean: number
  sd: number
  n: number
  group: string
}

export const koreanReference: Record<number, AgeReference> = {
  5: { mean: -0.25, sd: 0.88, n: 99, group: '5세' },
  6: { mean: -0.17, sd: 1.11, n: 107, group: '6세' },
  7: { mean: -0.57, sd: 1.11, n: 107, group: '7세' },
  8: { mean: -0.85, sd: 1.34, n: 107, group: '8세' },
  9: { mean: -1.23, sd: 1.49, n: 99, group: '9세' },
  10: { mean: -1.71, sd: 1.78, n: 82, group: '10세' },
  11: { mean: -2.36, sd: 2.07, n: 89, group: '11세' },
  12: { mean: -2.54, sd: 2.08, n: 75, group: '12세' },
  13: { mean: -3.09, sd: 2.58, n: 93, group: '13세' },
  14: { mean: -2.91, sd: 2.13, n: 82, group: '14세' },
  15: { mean: -3.45, sd: 2.47, n: 284, group: '15–18세 통합' },
  16: { mean: -3.45, sd: 2.47, n: 284, group: '15–18세 통합' },
  17: { mean: -3.45, sd: 2.47, n: 284, group: '15–18세 통합' },
  18: { mean: -3.45, sd: 2.47, n: 284, group: '15–18세 통합' },
}

/**
 * 논문 본문 Table 1의 KNHANES 전체(더 근시인 눈) 요약값.
 * 연령별 표를 옮겨 적다 생기는 오타를 테스트로 잡기 위한 대조값이다.
 */
export const referencePooled = { mean: -1.93, sd: 2.27, n: 1224 }

export const referenceAgeMin = 5
export const referenceAgeMax = 18
export const referenceTotalN = 1224
