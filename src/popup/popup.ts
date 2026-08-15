import type { ThemeMode } from '@/types';

// =================================================================
// Type Definitions and Constants (타입 정의 및 상수)
// =================================================================

console.log('👋 Popup script (TypeScript) loaded!');

const THEME_MODE_KEY = 'dcinside_theme_mode';

// 팝업과 content script가 런타임 모듈을 공유하면 Rollup이 ESM 공용 청크를 생성합니다.
// Chrome content script는 classic script이므로 팝업 표시용 데이터는 이 엔트리에 둡니다.
const POPUP_SHORTCUT_DEFINITIONS = [
  { action: 'W', defaultKey: 'W', label: '글쓰기' },
  { action: 'C', defaultKey: 'C', label: '댓글 입력' },
  { action: 'D', defaultKey: 'D', label: '댓글 이동' },
  { action: 'R', defaultKey: 'R', label: '새로고침' },
  { action: 'Q', defaultKey: 'Q', label: '최상단 스크롤' },
  { action: 'E', defaultKey: 'E', label: '글 목록 스크롤' },
  { action: 'F', defaultKey: 'F', label: '전체글' },
  { action: 'G', defaultKey: 'G', label: '개념글' },
  { action: 'A', defaultKey: 'A', label: '다음 페이지' },
  { action: 'S', defaultKey: 'S', label: '이전 페이지' },
  { action: 'GallerySearch', defaultKey: 'V', label: '갤러리 내부 검색' },
  { action: 'GlobalSearch', defaultKey: 'Alt+V', label: '통합 검색' },
  { action: 'Z', defaultKey: 'Z', label: '다음 글' },
  { action: 'X', defaultKey: 'X', label: '이전 글' },
  { action: 'PrevProfile', defaultKey: '[', label: '이전 폴더' },
  { action: 'NextProfile', defaultKey: ']', label: '다음 폴더' },
  { action: 'SubmitComment', defaultKey: 'Alt+D', label: '댓글 등록' },
  { action: 'SubmitImagePost', defaultKey: 'Alt+W', label: '글 등록' },
  { action: 'ToggleModal', defaultKey: 'Alt+`', label: '즐겨찾기창 열기' },
] as const;

const getPopupShortcutKeyStorageKey = (action: string): string => `shortcut${action}Key`;

const FIXED_SHORTCUTS: Record<string, string> = {
  'Alt + 0-9': '즐겨찾기 이동/등록',
  'Alt + Z / X': '자동 넘김 시작/중지',
  '` 또는 .': '글 번호로 이동',
  '0-9': '목록의 글 바로가기',
};

// =================================================================
// UI Element Selectors (UI 요소 선택)
// =================================================================

// 각 UI 요소들을 타입과 함께 선택하고, null일 수 있음을 명시합니다.
const customShortcutListEl = document.getElementById(
  'custom-shortcut-list'
) as HTMLUListElement | null;
const fixedShortcutListEl = document.getElementById(
  'fixed-shortcut-list'
) as HTMLUListElement | null;
const openFavoritesBtn = document.getElementById('open-favorites-btn') as HTMLButtonElement | null;
const openShortcutsBtn = document.getElementById('open-shortcuts-btn') as HTMLButtonElement | null;
const statusMessageEl = document.getElementById('status-message') as HTMLDivElement | null;

const systemThemeMediaQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
let currentThemeMode: ThemeMode = 'system';
let isSystemThemeListenerAttached = false;

function sanitizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function resolvePopupTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return systemThemeMediaQuery?.matches ? 'dark' : 'light';
  }
  return mode;
}

function applyPopupTheme(mode: ThemeMode): void {
  const resolvedTheme = resolvePopupTheme(mode);
  document.documentElement.setAttribute('data-dc-theme', resolvedTheme);
}

function onSystemThemeChange(): void {
  if (currentThemeMode === 'system') {
    applyPopupTheme(currentThemeMode);
  }
}

function setSystemThemeListener(enabled: boolean): void {
  if (!systemThemeMediaQuery) return;

  if (enabled) {
    if (isSystemThemeListenerAttached) return;
    if (typeof systemThemeMediaQuery.addEventListener === 'function') {
      systemThemeMediaQuery.addEventListener('change', onSystemThemeChange);
    } else {
      systemThemeMediaQuery.addListener(onSystemThemeChange);
    }
    isSystemThemeListenerAttached = true;
    return;
  }

  if (!isSystemThemeListenerAttached) return;
  if (typeof systemThemeMediaQuery.removeEventListener === 'function') {
    systemThemeMediaQuery.removeEventListener('change', onSystemThemeChange);
  } else {
    systemThemeMediaQuery.removeListener(onSystemThemeChange);
  }
  isSystemThemeListenerAttached = false;
}

async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const result = await chrome.storage.local.get({ [THEME_MODE_KEY]: 'system' });
    return sanitizeThemeMode(result[THEME_MODE_KEY]);
  } catch (error) {
    console.error('테마 설정 불러오기 실패:', error);
    return 'system';
  }
}

// =================================================================
// Helper Functions (헬퍼 함수)
// =================================================================

/**
 * chrome.storage.local에서 커스텀 단축키 설정을 불러옵니다.
 * @returns {Promise<Record<string, string>>} 저장된 설정을 담은 객체.
 */
async function loadSettings(): Promise<Record<string, string>> {
  // 불러올 키 목록을 생성합니다. (예: { shortcutWKey: 'W', shortcutCKey: 'C', ... })
  const keysToGet = Object.fromEntries(
    POPUP_SHORTCUT_DEFINITIONS.map(({ action, defaultKey }) => [
      getPopupShortcutKeyStorageKey(action),
      defaultKey,
    ])
  );

  try {
    return await chrome.storage.local.get(keysToGet);
  } catch (error) {
    console.error('설정 불러오기 실패:', error);
    return keysToGet; // 오류 발생 시 기본값 반환
  }
}

/**
 * 단축키 목록에 표시될 리스트 아이템(<li>)을 생성합니다.
 * @param {string} key - 단축키 (예: 'W', 'Alt + D')
 * @param {string} action - 단축키 설명 (예: '글쓰기')
 * @returns {HTMLLIElement} 생성된 리스트 아이템 요소.
 */
function createListItem(key: string, action: string): HTMLLIElement {
  const li = document.createElement('li');
  // innerHTML을 사용하여 간단하게 키와 액션 텍스트를 포함한 요소를 만듭니다.
  li.innerHTML = `<span class="key">${key}</span> <span class="action">${action}</span>`;
  return li;
}

/**
 * 현재 활성화된 탭에 메시지를 보냅니다.
 * @param {object} message - 보낼 메시지 객체 (예: { action: 'openFavoritesModal' }).
 * @returns {Promise<boolean>} 메시지 전송 성공 여부.
 */
async function sendMessageToActiveTab(message: { action: string }): Promise<boolean> {
  try {
    // 현재 활성화된 창의 활성 탭을 조회합니다.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // 해당 탭이 DC인사이드 페이지인지 확인합니다.
    if (tab?.id && tab.url?.includes('dcinside.com')) {
      await chrome.tabs.sendMessage(tab.id, message);
      return true; // 성공
    }
    throw new Error('Not a DCInside page.'); // DC인사이드 페이지가 아니면 에러 발생
  } catch (error) {
    if (statusMessageEl) {
      statusMessageEl.textContent = 'DCInside 페이지에서 사용해주세요.';
      statusMessageEl.style.display = 'block';
    }
    return false; // 실패
  }
}

// =================================================================
// Rendering Functions (렌더링 함수)
// =================================================================

/**
 * 불러온 설정을 기반으로 커스텀 단축키 목록을 화면에 렌더링합니다.
 * @param {Record<string, string>} settings - loadSettings로 불러온 설정 객체.
 */
function renderCustomShortcuts(settings: Record<string, string>): void {
  if (!customShortcutListEl) return;
  customShortcutListEl.innerHTML = ''; // 기존 목록 초기화

  for (const { action, defaultKey, label } of POPUP_SHORTCUT_DEFINITIONS) {
    const key = settings[getPopupShortcutKeyStorageKey(action)] || defaultKey;
    customShortcutListEl.appendChild(createListItem(key, label));
  }
}

/**
 * 고정 단축키 목록을 화면에 렌더링합니다.
 */
function renderFixedShortcuts(): void {
  if (!fixedShortcutListEl) return;
  fixedShortcutListEl.innerHTML = ''; // 기존 목록 초기화

  // fixed 객체를 순회하며 각 단축키에 대한 리스트 아이템을 생성하고 추가합니다.
  for (const key in FIXED_SHORTCUTS) {
    const label = FIXED_SHORTCUTS[key];
    fixedShortcutListEl.appendChild(createListItem(key, label));
  }
}

// =================================================================
// Main Logic (메인 로직)
// =================================================================

/**
 * DOM 콘텐츠가 모두 로드되면 실행되는 메인 함수.
 */
document.addEventListener('DOMContentLoaded', async () => {
  currentThemeMode = await loadThemeMode();
  applyPopupTheme(currentThemeMode);
  setSystemThemeListener(currentThemeMode === 'system');

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[THEME_MODE_KEY]) return;
    currentThemeMode = sanitizeThemeMode(changes[THEME_MODE_KEY].newValue);
    applyPopupTheme(currentThemeMode);
    setSystemThemeListener(currentThemeMode === 'system');
  });

  window.addEventListener('beforeunload', () => {
    setSystemThemeListener(false);
  });

  // 0. manifest 버전 표시 (단일 소스: manifest.json)
  const versionEl = document.getElementById('version-info');
  if (versionEl && typeof chrome?.runtime?.getManifest === 'function') {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = manifest.version ? `v${manifest.version}` : '';
  }

  // 1. 단축키 목록 렌더링
  renderFixedShortcuts();
  try {
    const settings = await loadSettings();
    renderCustomShortcuts(settings);
  } catch (e) {
    if (customShortcutListEl) {
      customShortcutListEl.innerHTML = '<li>설정 로딩에 실패했습니다.</li>';
    }
  }

  // 2. 버튼 이벤트 리스너 설정 (버튼 요소가 존재하는지 확인 후)
  if (openFavoritesBtn) {
    openFavoritesBtn.addEventListener('click', async () => {
      // 즐겨찾기 모달 열기 메시지를 보내고, 성공하면 팝업 창을 닫습니다.
      if (await sendMessageToActiveTab({ action: 'openFavoritesModal' })) {
        window.close();
      }
    });
  }

  if (openShortcutsBtn) {
    openShortcutsBtn.addEventListener('click', async () => {
      // 단축키 설정 모달 열기 메시지를 보내고, 성공하면 팝업 창을 닫습니다.
      if (await sendMessageToActiveTab({ action: 'openShortcutManagerModal' })) {
        window.close();
      }
    });
  }
});
