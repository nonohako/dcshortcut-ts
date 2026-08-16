# HANDOFF.md

## 현재 상태

- 버전: `0.4.1`
- 개발 빌드: 통과
- TypeScript 검사: 통과
- `activeTab` 백그라운드 회귀 검사: 통과
- 실제 Chrome 테스트: 통과
- 기본 전역 즐겨찾기 단축키: `Alt+Q`

## 최근 완료한 작업

외부 사이트의 전역 CSS가 즐겨찾기와 설정 UI에 침범하던 문제를 수정했습니다.

- `src/content-script/main.ts`에서 확장 UI를 `dc-shortcut-ui#dc-ShortCut-host`의 open Shadow DOM에 마운트합니다.
- 호스트 요소에는 인라인 `all: initial !important`와 표시 관련 초기값을 적용합니다.
- Vue 앱과 툴팁 포털을 같은 Shadow DOM 내부에 배치합니다.
- `TooltipBase.vue`의 Teleport 대상은 `body`가 아니라 `UI_PORTAL_TARGET_KEY` 전용 포털입니다.
- `App.vue` 테마 변수는 `:host`와 `#dc-ShortCut-app`에서도 적용됩니다.
- `vite.config.ts`는 개발/프로덕션 모두 `content-script.css`를 최소 web-accessible resource로 포함합니다.

실제 Chrome의 Example Domain에서 확인한 값:

- 호스트 페이지 `div` 불투명도: `0.8`
- 확장 즐겨찾기 모달 불투명도: `1`
- 확장 설정 모달 불투명도: `1`
- 확장 모달 기본 글자 크기: `16px`
- 단축키 선택 글자 크기: `13px`
- 다크 테마 배경, 검색, 설정 모달 전환 정상

## 현재 아키텍처

```text
Chrome command Alt+Q
  -> background.ts
  -> activeTab + scripting으로 현재 일반 탭에 CSS/JS 주입
  -> content-script/main.ts
  -> dc-shortcut-ui#dc-ShortCut-host
  -> ShadowRoot
      |- content-script.css
      |- #dc-ShortCut-app
      |   `- Vue/Pinia UI
      `- #dc-ShortCut-portal
          `- Tooltip Teleport
```

DCInside 페이지에서는 manifest 콘텐츠 스크립트가 자동 로드됩니다. 일반 사이트에서는 사용자 동작으로 현재 탭에만 전역 UI를 주입합니다. DC 전용 `Events`, `Posts`, `AutoRefresher`, `DcconAlias` 초기화는 DCInside 호스트에서만 실행됩니다.

## 권한 상태

```json
{
  "permissions": ["storage", "commands", "scripting", "activeTab"]
}
```

- `tabs` 권한 없음
- 광범위한 `host_permissions` 없음
- manifest 콘텐츠 스크립트는 `*://*.dcinside.com/*`만 사용
- `content-script.css`는 Shadow DOM 내부 스타일 로드를 위해 `<all_urls>` 대상 web-accessible resource로 선언

## 검증 명령

개발 중:

```powershell
pnpm run build:dev
pnpm run verify:active-tab
```

릴리스 직전:

```powershell
pnpm run build
```

PowerShell의 현재 경로는 `\\?\C:\...`가 아니라 일반 `C:\Users\mqpow\dcshortcut\dcshortcut-ts` 경로를 사용해야 합니다.

## 다음 작업 시 주의사항

- Shadow DOM을 제거하면 외부 사이트에서 글자 크기, 불투명도, 색상 등이 다시 깨집니다.
- `content-script.css`를 web-accessible resources에서 제거하면 Shadow DOM 내부 스타일 로드가 실패합니다.
- 툴팁을 다시 `body`로 Teleport하면 외부 사이트 CSS와 다른 확장의 z-index 영향을 받습니다.
- `dc-content.css`는 DC 페이지 본문 기능용이므로 Shadow DOM 전용 CSS와 합치지 않습니다.
- 즐겨찾기 검색은 현재 갤러리 이름, 갤러리 ID, 폴더 이름을 모두 검색합니다. `ㅌ` 검색 시 `테스트` 폴더의 항목이 모두 검색되는 UX는 추후 조정 후보입니다.
- 네이티브 HTML5 드래그의 실시간 순서 변경은 자동화만으로 완전 검증하기 어려우므로 변경 후 사람이 직접 확인해야 합니다.
- 다른 확장 프로그램의 최상위 오버레이(`dcpeek` 계열 등)는 DCShortcut 내부 요소가 아닐 수 있으므로 DOM 출처를 확인한 뒤 수정합니다.

## 릴리스 체크리스트

1. `package.json` 버전을 변경합니다.
2. README 변경 내역과 권한 설명을 갱신합니다.
3. `pnpm run build`를 실행합니다.
4. `dist/manifest.json`의 버전과 권한을 확인합니다.
5. Chrome 확장 관리 화면에서 `dist`를 다시 로드합니다.
6. DC 페이지와 일반 사이트에서 `Alt+Q`를 확인합니다.
7. 검색, 폴더 이동, 드래그, 다중 선택, 크기 조절, 설정 저장을 확인합니다.
8. 콘솔 오류와 백그라운드 자동 새로고침을 확인합니다.

