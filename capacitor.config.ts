import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'kr.myopia.prototype',
  appName: '우리 아이 근시 테스트',
  webDir: 'dist',
  backgroundColor: '#071014',
  // WebView가 너무 오래되었을 때 흰 화면 대신 업데이트 안내를 보여 준다.
  server: { errorPath: 'webview-error.html' },
  android: {
    backgroundColor: '#071014',
    /**
     * Vite 6 기본 빌드 대상(chrome87, es2020)에 맞춘 최소 WebView 버전.
     * 이보다 낮으면 앱 스크립트가 해석되지 않으므로 errorPath 안내 페이지를 띄운다.
     * vite.config.ts의 build.target을 바꾸면 이 값도 함께 바꿀 것.
     */
    minWebViewVersion: 87,
  },
}

export default config
