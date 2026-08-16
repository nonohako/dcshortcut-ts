# AGENTS.md

이 문서는 이 저장소에서 작업하는 코딩 에이전트가 따라야 할 프로젝트 규칙입니다.

## 프로젝트 개요

- Vue 3, Pinia, TypeScript, Vite 기반 Chrome 확장 프로그램입니다.
- 현재 버전은 `0.4.1`입니다.
- DCInside 전용 기능과 일반 웹사이트에서도 사용할 수 있는 전역 즐겨찾기 UI를 분리합니다.
- 설정과 즐겨찾기 데이터는 `chrome.storage.local`을 사용합니다.

## 필수 작업 규칙

- 개발 중 검증에는 반드시 `pnpm run build:dev`를 사용합니다.
- `pnpm run build` 프로덕션 빌드는 릴리스 또는 사용자의 명시적인 요청이 있을 때만 실행합니다.
- 소스 수정 후 최소한 `pnpm run build:dev`와 `pnpm run verify:active-tab`을 실행합니다.
- 확장 프로그램의 실제 동작을 확인할 때는 `dist`를 Chrome에서 다시 로드한 뒤 테스트합니다.
- 기존 사용자 변경을 보존하고, 요청 범위와 무관한 파일은 되돌리거나 포맷하지 않습니다.
- `git reset --hard`, 강제 체크아웃 등 복구하기 어려운 명령은 사용하지 않습니다.
- Windows에서 `\\?\C:\...` 형태의 확장 경로를 현재 디렉터리로 사용하면 pnpm 스크립트가 CMD의 UNC 경로 제한에 걸릴 수 있습니다. 일반 경로인 `C:\Users\mqpow\dcshortcut\dcshortcut-ts`에서 실행합니다.

## 주요 명령어

```powershell
pnpm install --frozen-lockfile
pnpm run type-check
pnpm run build:dev
pnpm run verify:active-tab
```

릴리스용 빌드:

```powershell
pnpm run build
```

## 구조

- `src/background/background.ts`: Chrome commands, `activeTab` 기반 전역 UI 주입, 탭 리더 선출, 매크로 제어
- `src/content-script/main.ts`: Vue/Pinia 초기화, Shadow DOM UI 마운트, 스토리지 동기화, DC 전용 서비스 초기화
- `src/App.vue`: UI 테마 변수와 최상위 모달 구성
- `src/components/FavoritesModal.vue`: 즐겨찾기 폴더, 검색, 다중 선택, 드래그 이동, 크기 조절
- `src/components/ShortcutManagerModal.vue`: 단축키와 전체 설정 UI
- `src/config/shortcuts.ts`: 단축키 정의의 기준점
- `src/stores/`: 설정 및 즐겨찾기 상태의 기준점
- `src/services/`: DC 페이지 기능, 스토리지, 이벤트, 새로고침, 디시콘 별칭
- `src/content-script/style.css`: DC 페이지 DOM에 직접 적용해야 하는 전용 스타일
- `scripts/verify-active-tab-background.mjs`: `activeTab` 구조 회귀 검사

## 권한과 콘텐츠 스크립트 규칙

- 기본 권한은 `storage`, `commands`, `scripting`, `activeTab`입니다.
- 광범위한 `host_permissions` 또는 `tabs` 권한을 임의로 다시 추가하지 않습니다.
- manifest 콘텐츠 스크립트 범위는 `*://*.dcinside.com/*`로 유지합니다.
- 일반 사이트에서는 사용자가 명시적으로 실행한 전역 즐겨찾기/설정 UI만 주입합니다.
- 페이지 이동, 글쓰기, 댓글, 자동 새로고침, 디시콘 등 DC 전용 기능은 일반 사이트에서 초기화하지 않습니다.
- `content-script.js`는 classic content script입니다. 결과물에 ESM `import`가 생기지 않아야 하며 Vite의 guard를 유지합니다.

## UI 격리 규칙

- 확장 UI는 `#dc-ShortCut-host`의 Shadow DOM 내부에 렌더링합니다.
- 호스트 페이지 CSS 간섭을 막기 위해 Shadow DOM 마운트를 일반 DOM 마운트로 되돌리지 않습니다.
- 툴팁 등 Teleport UI는 `UI_PORTAL_TARGET_KEY`가 가리키는 Shadow DOM 내부 포털을 사용합니다. `body`로 Teleport하지 않습니다.
- Vue 컴포넌트 스타일은 `content-script.css`로 빌드되며 Shadow DOM 내부에서도 로드됩니다.
- `content-script.css`의 `web_accessible_resources` 항목은 Shadow DOM 스타일 로딩에 필요하므로 제거하지 않습니다.
- DC 게시판 자체 DOM을 꾸미는 스타일은 Shadow DOM에 넣지 말고 `dc-content.css`에 유지합니다.
- 외부 사이트에서 글자 크기, 불투명도, 색상, 버튼 스타일이 호스트 CSS를 상속하지 않는지 확인합니다.

## 상태와 저장소 규칙

- 설정과 즐겨찾기 변경은 Pinia 스토어를 거쳐 저장합니다.
- 동일 데이터를 여러 키나 여러 저장 함수에서 따로 관리하지 않습니다.
- 즐겨찾기 스토리지는 구버전 백업 형식을 계속 받아들여야 합니다.
- `chrome.storage.onChanged` 처리 시 자신이 저장한 값이 다시 들어와 상태를 덮어쓰는 순환 동기화를 주의합니다.
- 스토리지 구조를 바꿀 경우 이전 백업 복원과 기존 설치 데이터 마이그레이션을 함께 검증합니다.

## 단축키 규칙

- 기본 즐겨찾기 Chrome command는 `Alt+Q`입니다.
- 실제 Chrome command 지정값은 설정 UI에 표시합니다.
- 페이지 내부 단축키는 `src/config/shortcuts.ts`와 설정 스토어 구조를 재사용합니다.
- 새 단축키를 별도 하드코딩된 저장 키와 이벤트 분기로 추가하지 않습니다.
- 입력창, textarea, select, contenteditable에서는 페이지 단축키가 오작동하지 않아야 합니다.

## 수동 회귀 체크리스트

1. DC 페이지에서 `Alt+Q`로 즐겨찾기 창이 열리고 닫히는지 확인합니다.
2. 일반 사이트에서도 `Alt+Q`로 전역 즐겨찾기 UI가 열리는지 확인합니다.
3. 일반 사이트에서 DC 전용 단축키가 동작하지 않는지 확인합니다.
4. 초성 검색이 Enter 없이 실시간으로 반영되는지 확인합니다.
5. 폴더 이동, 즐겨찾기 순서 변경, 제자리 드롭, 다중 이동/삭제를 확인합니다.
6. 모달 및 폴더 패널 크기 조절과 크기 초기화를 확인합니다.
7. 단축키 선택 목록의 `Custom`과 가운데 정렬을 확인합니다.
8. 설정의 고급 탭 하단 `기타` 섹션에서 모두 켜기/끄기를 확인합니다.
9. 백그라운드 DC 탭의 자동 새로고침과 탭 제목 갱신이 유지되는지 확인합니다.
10. 외부 페이지의 전역 `div`, `button`, `input` CSS가 확장 UI에 영향을 주지 않는지 확인합니다.

## 버전 및 릴리스

- 버전의 기준은 `package.json`입니다.
- 빌드 전에 `scripts/sync-version.mjs`가 manifest와 관련 표시를 동기화합니다.
- 버전별 상세 변경 내역은 README에 누적하지 않고 GitHub Release notes에 작성합니다.
- README는 현재 기능, 설치 방법, 권한처럼 항상 유효한 정보가 달라질 때만 갱신합니다.
- 릴리스 직전에는 프로덕션 빌드, 실제 Chrome 로드, 주요 기능 수동 검증을 완료합니다.
