import { createApp } from 'vue';
import { createPinia } from 'pinia';

// Vue App and Components
import App from '@/App.vue';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';

// Service Modules
import Storage from '@/services/Storage';
import Posts from '@/services/Posts';
import UI from '@/services/UI';
import Events from '@/services/Events';
import Gallery from '@/services/Gallery';
import AutoRefresher from '@/services/AutoRefresher';
import SearchPageEnhancer from '@/services/SearchPageEnhancer';
import DcconAlias from '@/services/DcconAlias';
import { UI_PORTAL_TARGET_KEY } from '@/services/UiPortal';
import {
  FAVORITE_GALLERIES_KEY,
  ACTIVE_FAVORITES_PROFILE_KEY,
  THEME_MODE_KEY,
  addPrefetchHints,
  handlePageLoadScroll,
  setupTabFocus,
  focusSubjectInputOnWritePage,
} from '@/services/Global';
import type { PageNavigationMode, ThemeMode } from '@/types';

console.log('👋 DCInside ShortCut 콘텐츠 스크립트 (TS) 로드됨!');

// =================================================================
// Type Definitions for Message Passing (메시지 타입 정의)
// =================================================================
type MessageAction =
  | 'openFavoritesModal'
  | 'openShortcutManagerModal'
  | 'showGlobalFavoritesModal'
  | 'showGlobalShortcutManagerModal'
  | 'getDcTabContext'
  | 'startMacro'
  | 'stopMacro'
  | 'leaderUpdate'
  | 'getMyTabId'
  | 'getLeaderTabId'
  | 'contentScriptLoaded';

interface BaseMessage {
  action: MessageAction;
}
interface StartMacroMessage extends BaseMessage {
  action: 'startMacro';
  type: 'Z' | 'X';
  expectedTabId: number;
}
interface StopMacroMessage extends BaseMessage {
  action: 'stopMacro';
  type: 'Z' | 'X';
  reason?: string;
}
interface LeaderUpdateMessage extends BaseMessage {
  action: 'leaderUpdate';
  leaderTabId: number | null;
}
interface ShowGlobalUiMessage extends BaseMessage {
  action: 'showGlobalFavoritesModal' | 'showGlobalShortcutManagerModal';
  mode?: 'open' | 'toggle';
}
type RuntimeMessage =
  | BaseMessage
  | StartMacroMessage
  | StopMacroMessage
  | LeaderUpdateMessage
  | ShowGlobalUiMessage;

function isPageNavigationMode(value: unknown): value is PageNavigationMode {
  return value === 'ajax' || value === 'full' || value === 'infinite';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

type AppliedTheme = 'light' | 'dark';

// =================================================================
// Global State
// =================================================================

let myTabId: number | null = null;
let knownLeaderId: number | null = null;
let shouldRunImmediateRefreshOnNextStart = false;
const systemThemeMediaQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;
let appHostElement: HTMLElement | null = null;
let appMountElement: HTMLElement | null = null;
let appPortalElement: HTMLElement | null = null;
const isDcInsidePage =
  window.location.hostname === 'dcinside.com' || window.location.hostname.endsWith('.dcinside.com');

function resolveAppliedTheme(mode: ThemeMode): AppliedTheme {
  if (mode === 'system') {
    return systemThemeMediaQuery?.matches ? 'dark' : 'light';
  }
  return mode;
}

function setSystemThemeListenerEnabled(enabled: boolean): void {
  if (!systemThemeMediaQuery) return;

  if (!enabled && systemThemeListener) {
    if (typeof systemThemeMediaQuery.removeEventListener === 'function') {
      systemThemeMediaQuery.removeEventListener('change', systemThemeListener);
    } else {
      systemThemeMediaQuery.removeListener(systemThemeListener);
    }
    systemThemeListener = null;
    return;
  }

  if (enabled && !systemThemeListener) {
    systemThemeListener = () => {
      if (settingsStore.themeMode === 'system') {
        applyThemeMode(settingsStore.themeMode);
      }
    };
    if (typeof systemThemeMediaQuery.addEventListener === 'function') {
      systemThemeMediaQuery.addEventListener('change', systemThemeListener);
    } else {
      systemThemeMediaQuery.addListener(systemThemeListener);
    }
  }
}

function applyThemeMode(mode: ThemeMode): void {
  const appliedTheme = resolveAppliedTheme(mode);
  for (const element of [appHostElement, appMountElement, appPortalElement]) {
    element?.setAttribute('data-dc-theme', appliedTheme);
  }
  // 디시콘 별칭 팝업 등 DC 페이지의 body 직속 요소도 동일 테마를 참조합니다.
  // 일반 사이트에서는 호스트 문서의 html 속성을 변경하지 않습니다.
  if (isDcInsidePage) {
    document.documentElement.setAttribute('data-dc-theme', appliedTheme);
  }
  setSystemThemeListenerEnabled(mode === 'system');
}

// =================================================================
// Vue & Pinia Initialization (Vue 및 Pinia 초기화)
// =================================================================

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();
if (isDcInsidePage) {
  Events.setup(Storage, Posts, UI, Gallery, favoritesStore, settingsStore, uiStore);
}

// =================================================================
// [추가] Storage Listener for Real-time Sync (실시간 동기화를 위한 스토리지 리스너)
// =================================================================

/**
 * chrome.storage의 변경 사항을 감지하여 다른 탭의 설정을 실시간으로 동기화합니다.
 */
function setupStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    // 'local' 스토리지 영역의 변경만 감지합니다.
    if (areaName !== 'local') return;

    console.log('[Storage Listener] 설정 변경 감지:', changes);

    // 구버전 백업은 활성 폴더를 ID가 아닌 이름으로 저장합니다.
    // 목록을 먼저 변환해야 이어지는 활성 폴더 이름을 새 폴더에 연결할 수 있습니다.
    if (Object.prototype.hasOwnProperty.call(changes, FAVORITE_GALLERIES_KEY)) {
      console.log('[Sync] 즐겨찾기 목록 변경됨. 상태를 동기화합니다.');
      favoritesStore.syncFavoritesFromStorage(changes[FAVORITE_GALLERIES_KEY].newValue);
    }
    if (Object.prototype.hasOwnProperty.call(changes, ACTIVE_FAVORITES_PROFILE_KEY)) {
      const activeFolder = changes[ACTIVE_FAVORITES_PROFILE_KEY].newValue;
      console.log(`[Sync] 활성 폴더 변경됨: ${activeFolder}`);
      favoritesStore.syncActiveFolderFromStorage(activeFolder);
    }

    // 변경된 각 키에 대해 처리
    for (const key in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        const { newValue } = changes[key];

        // 1. 즐겨찾기 데이터 동기화
        if (key === FAVORITE_GALLERIES_KEY) {
          continue;
        }
        if (key === ACTIVE_FAVORITES_PROFILE_KEY) {
          continue;
        }

        // 2. 설정(settingsStore) 동기화
        // 각 키에 맞춰 settingsStore의 상태를 직접 업데이트합니다.
        switch (key) {
          case 'pageNavigationMode':
          case 'dcinside_page_navigation_mode':
            if (isPageNavigationMode(newValue)) {
              settingsStore.pageNavigationMode = newValue;
              if (isDcInsidePage) Events.setPageNavigationMode(newValue);
            }
            break;
          case 'altNumberEnabled':
            settingsStore.altNumberEnabled = newValue;
            break;
          case 'numberNavigationEnabled':
            settingsStore.numberNavigationEnabled = newValue;
            break;
          case 'showDateInListEnabled':
            settingsStore.showDateInListEnabled = newValue;
            if (isDcInsidePage) Posts.formatDates(newValue);
            break;
          case 'numberLabelsEnabled':
            settingsStore.numberLabelsEnabled = newValue;
            if (isDcInsidePage) Posts.addNumberLabels(newValue);
            break;
          case 'shortcutDRefreshCommentEnabled':
            settingsStore.shortcutDRefreshCommentEnabled = newValue;
            break;
          case 'macroInterval':
            settingsStore.macroInterval = Number(newValue);
            break;
          case 'favoritesOpenInNewTab':
            settingsStore.favoritesOpenInNewTab = newValue === true;
            break;
          case 'favoritesPreviewEnabled':
            settingsStore.favoritesPreviewEnabled = newValue;
            break;
          case 'favoritesPreviewOpacity':
            settingsStore.favoritesPreviewOpacity = Number(newValue);
            break;
          case 'autoRefreshEnabled':
            settingsStore.autoRefreshEnabled = newValue === true;
            break;
          case 'autoRefreshInterval':
            {
              const parsed = Number(newValue);
              settingsStore.autoRefreshInterval =
                Number.isFinite(parsed) && parsed >= 1 ? parsed : 10;
            }
            break;
          case 'autoRefreshAllTabsEnabled':
            settingsStore.autoRefreshAllTabsEnabled = newValue === true;
            break;
          case 'autoRefreshHighlightColor':
            settingsStore.autoRefreshHighlightColor =
              typeof newValue === 'string' && /^#[0-9A-Fa-f]{6}$/.test(newValue)
                ? newValue
                : '#ffeb3b';
            break;
          case 'autoRefreshHighlightDuration':
            {
              const parsed = Number(newValue);
              settingsStore.autoRefreshHighlightDuration =
                Number.isFinite(parsed) && parsed >= -1 ? parsed : 2.5;
            }
            break;
          case 'pauseOnInactiveEnabled':
            settingsStore.pauseOnInactiveEnabled = newValue === true;
            break;
          case THEME_MODE_KEY:
            settingsStore.themeMode = isThemeMode(newValue) ? newValue : 'system';
            applyThemeMode(settingsStore.themeMode);
            break;
          default:
            // 단축키 키/활성화 여부 같이 패턴이 있는 경우 처리
            if (key.startsWith('shortcut') && key.endsWith('Key')) {
              settingsStore.shortcutKeys[key] = newValue;
            } else if (key.startsWith('shortcut') && key.endsWith('Enabled')) {
              if (typeof newValue === 'boolean') {
                settingsStore.shortcutEnabled[key] = newValue;
              } else {
                delete settingsStore.shortcutEnabled[key];
              }
            }
            break;
        }

        if (
          ['autoRefreshEnabled', 'autoRefreshInterval', 'autoRefreshAllTabsEnabled', 'pauseOnInactiveEnabled'].includes(
            key
          )
        ) {
          if (isDcInsidePage) handleAutoRefresherState();
        }

        if (
          isDcInsidePage &&
          ['autoRefreshHighlightColor', 'autoRefreshHighlightDuration'].includes(key)
        ) {
          AutoRefresher.applyPendingHighlights();
        }
      }
    }
  });
}

// =================================================================
// Chrome Runtime Message Listener (메시지 리스너)
// =================================================================

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  switch (message.action) {
    case 'openFavoritesModal':
      uiStore.openFavoritesModal();
      sendResponse({ success: true });
      break;

    case 'openShortcutManagerModal':
      uiStore.openShortcutManagerModal();
      sendResponse({ success: true });
      break;

    case 'showGlobalFavoritesModal': {
      const { mode } = message as ShowGlobalUiMessage;
      mode === 'toggle' ? uiStore.toggleFavorites() : uiStore.openFavoritesModal();
      sendResponse({ success: true, uiReady: true });
      break;
    }

    case 'showGlobalShortcutManagerModal': {
      const { mode } = message as ShowGlobalUiMessage;
      mode === 'toggle' ? uiStore.toggleShortcuts() : uiStore.openShortcutManagerModal();
      sendResponse({ success: true, uiReady: true });
      break;
    }

    case 'getDcTabContext':
      sendResponse({
        success: true,
        isDcInsidePage,
        isRefreshablePage: isDcInsidePage && Gallery.isRefreshablePage(),
      });
      break;

    case 'startMacro':
      (async () => {
        const { type: macroType, expectedTabId } = message as StartMacroMessage;
        try {
          const currentTabId = await Events.getCurrentTabId();
          if (currentTabId !== expectedTabId) {
            return sendResponse({ success: false, message: 'Mismatched Tab ID' });
          }
          const isUiEnabled =
            settingsStore.shortcutEnabled[`shortcutMacro${macroType}Enabled`];
          if (!isUiEnabled) {
            return sendResponse({ success: false, message: 'UI setting is disabled.' });
          }
          await (macroType === 'Z' ? Events.navigatePrevPost() : Events.navigateNextPost());
          sendResponse({ success: true });
        } catch (error) {
          if (error instanceof Error) sendResponse({ success: false, message: error.message });
        }
      })();
      return true;

    case 'stopMacro':
      const { type, reason } = message as StopMacroMessage;
      Events.handleStopMacroCommand(type, reason);
      sendResponse({ success: true });
      break;

    case 'leaderUpdate':
      const { leaderTabId } = message as LeaderUpdateMessage;
      console.log(`[LeaderUpdate] 새 리더 정보 수신: ${leaderTabId}. (내 탭 ID: ${myTabId})`);

      const wasLeader = myTabId !== null && knownLeaderId === myTabId;
      const becameLeader = myTabId !== null && leaderTabId === myTabId;
      if (
        settingsStore.pauseOnInactiveEnabled &&
        !settingsStore.autoRefreshAllTabsEnabled &&
        !wasLeader &&
        becameLeader
      ) {
        shouldRunImmediateRefreshOnNextStart = true;
      }

      knownLeaderId = leaderTabId;
      handleAutoRefresherState();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, message: 'Unknown action' });
      break;
  }
  return false;
});

// =================================================================
// Auto-Refresher Logic (자동 새로고침 로직)
// =================================================================

/**
 * [핵심] 자동 새로고침의 시작/중지를 결정하는 함수.
 * "모든 탭 갱신" 모드가 꺼져 있을 때는 리더 탭에서만 동작합니다.
 */
function handleAutoRefresherState(): void {
  if (!isDcInsidePage) return;
  const refreshAllTabs = settingsStore.autoRefreshAllTabsEnabled;
  const amITheLeader = myTabId !== null && myTabId === knownLeaderId;
  const isEnabledInSettings = settingsStore.autoRefreshEnabled;
  const isRefreshable = Gallery.isRefreshablePage();
  const shouldStart = isEnabledInSettings && isRefreshable && (refreshAllTabs || amITheLeader);

  console.log(
    `[AutoRefresher] 상태 확인: 모든 탭 모드? ${refreshAllTabs}, 리더? ${amITheLeader}, 설정 활성화? ${isEnabledInSettings}, 새로고침 가능? ${isRefreshable} -> 최종 결정: ${shouldStart ? '시작' : '중지'}`
  );

  if (shouldStart) {
    AutoRefresher.start(shouldRunImmediateRefreshOnNextStart);
    shouldRunImmediateRefreshOnNextStart = false;
  } else {
    AutoRefresher.stop();
    shouldRunImmediateRefreshOnNextStart = false;
  }
}

window.handleAutoRefresherState = handleAutoRefresherState;
window.AutoRefresher = AutoRefresher;

// =================================================================
// Observers and Initialization (DOM 옵저버 및 초기화)
// =================================================================

function setupObservers(): void {
  const listObserver = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
      Posts.addNumberLabels(settingsStore.numberLabelsEnabled);
      Posts.formatDates(settingsStore.showDateInListEnabled);
    }
  });

  const bodyObserver = new MutationObserver(() => {
    const currentListTbody = document.querySelector('table.gall_list tbody');
    if (currentListTbody) {
      listObserver.disconnect();
      listObserver.observe(currentListTbody, { childList: true });
      Posts.adjustColgroupWidths();
      Posts.addNumberLabels(settingsStore.numberLabelsEnabled);
      Posts.formatDates(settingsStore.showDateInListEnabled);
      addPrefetchHints();
    }
    setupTabFocus();
  });

  const initialListTbody = document.querySelector('table.gall_list tbody');
  if (initialListTbody) {
    listObserver.observe(initialListTbody, { childList: true });
  }
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

async function initialize(): Promise<void> {
  try {
    await Promise.all([settingsStore.loadSettings(), favoritesStore.loadProfiles()]);
    console.log('[Main] 설정 및 즐겨찾기 로드 완료.');
    applyThemeMode(settingsStore.themeMode);
    setupStorageListener();

    if (!isDcInsidePage) {
      console.log('✅ DCInside ShortCut 전역 UI 준비 완료!');
      return;
    }

    const response = await chrome.runtime.sendMessage({ action: 'getMyTabId' });
    if (response?.success) {
      myTabId = response.tabId;
    } else {
      throw new Error(response.error || 'Failed to get Tab ID');
    }

    console.log(`🔧 탭 ${myTabId}에 대한 초기 설정 실행 중...`);

    const leaderResponse = await chrome.runtime.sendMessage({ action: 'getLeaderTabId' });
    if (leaderResponse?.success) {
      knownLeaderId = leaderResponse.leaderTabId;
      console.log(`[Init] 현재 리더는 탭 ${knownLeaderId} 입니다.`);
    }

    AutoRefresher.init(settingsStore, Posts, Events);

    Posts.adjustColgroupWidths();
    Posts.addNumberLabels(settingsStore.numberLabelsEnabled);
    Posts.formatDates(settingsStore.showDateInListEnabled);
    setupTabFocus();
    focusSubjectInputOnWritePage();
    addPrefetchHints();
    handlePageLoadScroll();
    SearchPageEnhancer.init();
    DcconAlias.init();
    Events.setPageNavigationMode(settingsStore.pageNavigationMode);

    setupObservers();

    await Events.triggerMacroNavigation();

    // [수정] 설정 변경 시 자동 새로고침 상태 및 테마를 동기화합니다.
    settingsStore.$subscribe(() => {
      handleAutoRefresherState();
      applyThemeMode(settingsStore.themeMode);
    });

    // visibilitychange 리스너는 이제 필요 없습니다.
    // document.removeEventListener('visibilitychange', ...);

    window.addEventListener('focus', () => {
      // 포커스가 돌아오면 background.ts가 리더를 재선출하고, leaderUpdate 메시지를 보낼 것입니다.
      // 여기서는 UI 효과만 처리합니다.
      AutoRefresher.restoreOriginalTitle(true);
      AutoRefresher.applyPendingHighlights();
    });

    void chrome.runtime.sendMessage({ action: 'contentScriptLoaded' }).catch((error) => {
      console.warn('[LeaderElection] 콘텐츠 스크립트 준비 알림 실패:', error);
    });

    handleAutoRefresherState();

    console.log('✅ DCInside ShortCut 준비 완료!');
  } catch (error) {
    console.error('[Main] 초기화 중 심각한 오류 발생:', error);
  }
}

// =================================================================
// App Mounting (Vue 앱 마운트)
// =================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

const UI_HOST_ID = 'dc-ShortCut-host';
const SHADOW_STYLESHEET_PATH = 'content-script.css';

function loadShadowStylesheet(shadowRoot: ShadowRoot): Promise<void> {
  return new Promise((resolve, reject) => {
    const stylesheet = document.createElement('link');
    const timeoutId = window.setTimeout(
      () => reject(new Error('Shadow DOM 스타일시트 로드 시간이 초과되었습니다.')),
      3000
    );
    const finish = (callback: () => void): void => {
      window.clearTimeout(timeoutId);
      callback();
    };
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL(SHADOW_STYLESHEET_PATH);
    stylesheet.addEventListener('load', () => finish(resolve), { once: true });
    stylesheet.addEventListener(
      'error',
      () =>
        finish(() =>
          reject(new Error(`Shadow DOM 스타일시트를 불러오지 못했습니다: ${stylesheet.href}`))
        ),
      { once: true }
    );
    shadowRoot.appendChild(stylesheet);
  });
}

const mountApplication = async (): Promise<void> => {
  if (document.getElementById(UI_HOST_ID) || !document.body) return;

  // 호스트 페이지의 div/button/input 전역 규칙이 확장 UI로 전파되지 않도록
  // 전용 커스텀 요소와 Shadow DOM 경계를 사용합니다. 호스트 요소 자체에는
  // 인라인 important 초기화를 적용해 '*' 같은 규칙까지 차단합니다.
  const host = document.createElement('dc-shortcut-ui');
  host.id = UI_HOST_ID;
  host.style.setProperty('all', 'initial', 'important');
  host.style.setProperty('display', 'block', 'important');
  host.style.setProperty('position', 'static', 'important');
  host.style.setProperty('opacity', '1', 'important');
  host.style.setProperty('visibility', 'visible', 'important');
  host.style.setProperty('filter', 'none', 'important');
  host.style.setProperty('transform', 'none', 'important');

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  mountPoint.id = 'dc-ShortCut-app';
  const portalPoint = document.createElement('div');
  portalPoint.id = 'dc-ShortCut-portal';

  const stylesheetReady = loadShadowStylesheet(shadowRoot);
  shadowRoot.append(mountPoint, portalPoint);
  document.body.appendChild(host);

  appHostElement = host;
  appMountElement = mountPoint;
  appPortalElement = portalPoint;
  applyThemeMode(settingsStore.themeMode);

  try {
    await stylesheetReady;
  } catch (error) {
    console.error('[Main] Shadow DOM 스타일 초기화 실패:', error);
  }

  app.provide(UI_PORTAL_TARGET_KEY, portalPoint);
  app.mount(mountPoint);
};

if (document.body) {
  void mountApplication();
} else {
  document.addEventListener('DOMContentLoaded', () => void mountApplication(), { once: true });
}
