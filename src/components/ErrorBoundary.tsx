import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

interface Props {
  children: ReactNode
  /** 실패 시 보여줄 안내. 3D 렌더링처럼 부분 실패가 가능한 영역에 쓴다. */
  title: string
  hint?: string
}

interface State {
  message: string | null
}

/**
 * 3D 캔버스가 WebGL 미지원·드라이버 문제로 던지는 예외를 가둔다.
 * 이전 구현은 경계가 없어 캔버스 실패 시 화면 전체가 비었다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : '알 수 없는 오류' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.message === null) return this.props.children
    return (
      <div className="error-fallback" role="alert">
        <TriangleAlert size={26} />
        <strong>{this.props.title}</strong>
        {this.props.hint && <p>{this.props.hint}</p>}
        <code>{this.state.message}</code>
        <button type="button" onClick={() => this.setState({ message: null })}>
          다시 시도
        </button>
      </div>
    )
  }
}
