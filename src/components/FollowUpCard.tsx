import { examTypeLabel, rateLabel, signed, type FollowUp } from '../math/myopia'

const axialText = (rate: number | null) => (rate === null ? '—' : `${signed(rate)} mm/년`)
const seText = (v: number) => `${signed(v)} D`

export function FollowUpCard({ f }: { f: FollowUp }) {
  const months = Math.round(f.spanYears * 12)
  const span = months >= 24 ? `약 ${(f.spanYears).toFixed(1)}년` : `약 ${months}개월`
  const hasAxial = f.points.some((x) => x.axialR !== null || x.axialL !== null)

  return (
    <section className="clinic-card follow-up-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">FOLLOW-UP / 추적 관찰</span>
          <h2>근시 변화 속도</h2>
        </div>
        <span className="pill">
          {f.points.length}회 · {span}
        </span>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <span>오른눈 SE 변화</span>
          <strong>
            {signed(f.rateRight)} <small>D/년</small>
          </strong>
          <small>{rateLabel(f.rateRight)}</small>
        </div>
        <div className="metric">
          <span>왼눈 SE 변화</span>
          <strong>
            {signed(f.rateLeft)} <small>D/년</small>
          </strong>
          <small>{rateLabel(f.rateLeft)}</small>
        </div>
        {hasAxial && (
          <>
            <div className="metric">
              <span>오른눈 안축장 변화</span>
              <strong className="metric__small">{axialText(f.axialRateRight)}</strong>
              <small>{f.axialRateRight === null ? '두 시점 이상 필요' : '같은 장비 측정값끼리 비교'}</small>
            </div>
            <div className="metric">
              <span>왼눈 안축장 변화</span>
              <strong className="metric__small">{axialText(f.axialRateLeft)}</strong>
              <small>{f.axialRateLeft === null ? '두 시점 이상 필요' : '같은 장비 측정값끼리 비교'}</small>
            </div>
          </>
        )}
      </div>

      <div className="follow-up-table__scroll" tabIndex={0} aria-label="검사 이력 표, 좌우로 스크롤 가능">
        <table className="follow-up-table">
          <thead>
            <tr>
              <th scope="col">검사일</th>
              <th scope="col">나이</th>
              <th scope="col">오른눈 SE</th>
              <th scope="col">왼눈 SE</th>
              {hasAxial && <th scope="col">안축장 R / L</th>}
              <th scope="col">검사 종류</th>
            </tr>
          </thead>
          <tbody>
            {f.points.map((x) => (
              <tr key={`${x.date}-${x.current}`} className={x.current ? 'is-current' : undefined}>
                <th scope="row">
                  {x.date}
                  {x.current && <em> 현재</em>}
                </th>
                <td>{x.ageDecimal === null ? '—' : `${x.ageDecimal.toFixed(1)}세`}</td>
                <td>{seText(x.right)}</td>
                <td>{seText(x.left)}</td>
                {hasAxial && (
                  <td>
                    {x.axialR?.toFixed(2) ?? '—'} / {x.axialL?.toFixed(2) ?? '—'}
                  </td>
                )}
                <td>{examTypeLabel(x.examType)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="help">
        {f.points.length > 2
          ? '검사가 3회 이상이면 모든 시점을 지나는 직선(최소제곱)의 기울기로 연간 변화를 계산합니다.'
          : '두 검사 사이의 변화를 1년 기준으로 환산했습니다.'}{' '}
        굴절검사는 ±0.25 D 정도의 측정 오차가 있어, 기간이 짧을수록 연간 환산값이 크게 흔들립니다.
        음수(−)는 근시가 늘어난 방향입니다.
      </p>
    </section>
  )
}
