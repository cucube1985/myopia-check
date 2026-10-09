import { sanitizeDecimal, toggleSign } from '../math/myopia'

interface DecimalInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 부호가 필요한 칸(굴절값·연간 변화)에 ± 버튼을 붙인다. */
  signable?: boolean
  /** 화면 낭독기용 ± 버튼 이름 앞에 붙일 말(«오른눈 » 등). 라벨이 같은 칸을 구분한다. */
  ariaPrefix?: string
}

/**
 * 소수 입력칸. type="number"는 일부 안드로이드 키보드에서 − 키가 없고
 * «-»만 입력한 중간 상태를 지워 버리므로 text + inputMode="decimal"을 쓰고,
 * 부호가 필요한 칸에는 ± 버튼을 붙인다. 범위 검사는 analyze()가 한다.
 */
export function DecimalInput({
  id,
  label,
  value,
  onChange,
  placeholder = '0.00',
  signable = false,
  ariaPrefix = '',
}: DecimalInputProps) {
  return (
    <div className="clinic-field">
      <label htmlFor={id}>{label}</label>
      <div className="signed-input">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(sanitizeDecimal(e.target.value))}
        />
        {signable && (
          <button
            type="button"
            className="sign-toggle"
            aria-label={`${ariaPrefix}${label} 부호 바꾸기`}
            onClick={() => {
              onChange(toggleSign(value))
              // 부호를 바꾼 뒤 바로 숫자를 이어서 입력할 수 있게 한다.
              document.getElementById(id)?.focus()
            }}
          >
            ±
          </button>
        )}
      </div>
    </div>
  )
}
