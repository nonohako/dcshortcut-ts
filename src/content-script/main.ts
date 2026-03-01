import { createApp } from 'vue';
import { createPinia } from 'pinia';
import './style.css';

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
type RuntimeMessage = BaseMessage | StartMacroMessage | StopMacroMessage | LeaderUpdateMessage;

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
  const mountEl = document.getElementById('dc-ShortCut-app');
  if (mountEl) {
    mountEl.setAttribute('data-dc-theme', appliedTheme);
  }
  // 디시콘 별칭 팝업 등 body 직속 요소도 동일 테마를 참조할 수 있도록 html에도 반영
  document.documentElement.setAttribute('data-dc-theme', appliedTheme);
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
Events.setup(Storage, Posts, UI, Gallery, favoritesStore, settingsStore, uiStore);

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

    // 변경된 각 키에 대해 처리
    for (const key in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, key)) {
        const { newValue } = changes[key];

        // 1. 즐겨찾기 데이터 동기화
        if (key === FAVORITE_GALLERIES_KEY) {
          console.log('[Sync] 즐겨찾기 목록 변경됨. 다시 로드합니다.');
          // 복잡한 객체는 전체를 다시 로드하는 것이 가장 안전합니다.
          favoritesStore.loadProfiles();
          continue; // 다음 변경 사항으로 넘어감
        }
        if (key === ACTIVE_FAVORITES_PROFILE_KEY) {
            console.log(`[Sync] 활성 프로필 변경됨: ${newValue}`);
            favoritesStore.activeProfileName = newValue;
            continue;
        }

        // 2. 설정(settingsStore) 동기화
        // 각 키에 맞춰 settingsStore의 상태를 직접 업데이트합니다.
        switch (key) {
          case 'pageNavigationMode':
          case 'dcinside_page_navigation_mode':
            if (isPageNavigationMode(newValue)) {
              settingsStore.pageNavigationMode = newValue;
              Events.setPageNavigationMode(newValue);
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
            Posts.formatDates(newValue);
            break;
          case 'numberLabelsEnabled':
            settingsStore.numberLabelsEnabled = newValue;
            Posts.addNumberLabels(newValue);
            break;
          case 'macroZEnabled':
            settingsStore.macroZEnabled = newValue;
            break;
          case 'macroXEnabled':
            settingsStore.macroXEnabled = newValue;
            break;
          case 'shortcutDRefreshCommentEnabled':
            settingsStore.shortcutDRefreshCommentEnabled = newValue;
            break;
          case 'macroInterval':
            settingsStore.macroInterval = Number(newValue);
            break;
          case 'favoritesPreviewEnabled':
            settingsStore.favoritesPreviewEnabled = newValue;
            break;
          case 'favoritesPreviewOpacity':
            settingsStore.favoritesPreviewOpacity = Number(newValue);
            break;
          case 'autoRefreshEnabled':
            settingsStore.autoRefreshEnabled = newValue;
            break;
          case 'autoRefreshInterval':
            settingsStore.autoRefreshInterval = Number(newValue);
            break;
          case 'autoRefreshAllTabsEnabled':
            settingsStore.autoRefreshAllTabsEnabled = newValue;
            break;
          case 'autoRefreshHighlightColor':
            settingsStore.autoRefreshHighlightColor = newValue;
            break;
          case 'autoRefreshHighlightDuration':
            settingsStore.autoRefreshHighlightDuration = Number(newValue);
            break;
          case 'shortcutSubmitCommentKeyEnabled':
            settingsStore.shortcutSubmitCommentKeyEnabled = newValue;
            break;
          case 'shortcutSubmitImagePostKeyEnabled':
            settingsStore.shortcutSubmitImagePostKeyEnabled = newValue;
            break;
          case 'shortcutToggleModalKeyEnabled':
            settingsStore.shortcutToggleModalKeyEnabled = newValue;
            break;
          case 'pauseOnInactiveEnabled':
            settingsStore.pauseOnInactiveEnabled = newValue;
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
              settingsStore.shortcutEnabled[key] = newValue;
            }
            break;
        }

        if (
          ['autoRefreshEnabled', 'autoRefreshInterval', 'autoRefreshAllTabsEnabled', 'pauseOnInactiveEnabled'].includes(
            key
          )
        ) {
          handleAutoRefresherState();
        }

        if (['autoRefreshHighlightColor', 'autoRefreshHighlightDuration'].includes(key)) {
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

    case 'startMacro':
      (async () => {
        const { type: macroType, expectedTabId } = message as StartMacroMessage;
        try {
          const currentTabId = await Events.getCurrentTabId();
          if (currentTabId !== expectedTabId) {
            return sendResponse({ success: false, message: 'Mismatched Tab ID' });
          }
          const isUiEnabled =
            macroType === 'Z' ? settingsStore.macroZEnabled : settingsStore.macroXEnabled;
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

    await Promise.all([settingsStore.loadSettings(), favoritesStore.loadProfiles()]);
    console.log('[Main] 설정 및 즐겨찾기 로드 완료.');
    applyThemeMode(settingsStore.themeMode);

    setupStorageListener();

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

    chrome.runtime.sendMessage({ action: 'contentScriptLoaded' });

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

const mountPoint = document.createElement('div');
mountPoint.id = 'dc-ShortCut-app';
document.body.appendChild(mountPoint);
applyThemeMode(settingsStore.themeMode);
app.mount('#dc-ShortCut-app');
