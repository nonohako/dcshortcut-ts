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
import {
  addPrefetchHints,
  handlePageLoadScroll,
  setupTabFocus,
  focusSubjectInputOnWritePage,
} from '@/services/Global';

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

// =================================================================
// Global State
// =================================================================

let myTabId: number | null = null;
let knownLeaderId: number | null = null;

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
 * 이제 오직 백그라운드가 알려주는 리더 정보에만 의존합니다.
 */
function handleAutoRefresherState(): void {
  if (myTabId === null) return;

  const amITheLeader = myTabId === knownLeaderId;
  const isEnabledInSettings = settingsStore.autoRefreshEnabled;
  const isRefreshable = Gallery.isRefreshablePage();

  const shouldStart = amITheLeader && isEnabledInSettings && isRefreshable;

  console.log(
    `[AutoRefresher] 상태 확인: 리더? ${amITheLeader}, 설정 활성화? ${isEnabledInSettings}, 새로고침 가능? ${isRefreshable} -> 최종 결정: ${shouldStart ? '시작' : '중지'}`
  );

  if (shouldStart) {
    AutoRefresher.start();
  } else {
    AutoRefresher.stop();
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
      Posts.addNumberLabels();
      Posts.formatDates();
    }
  });

  const bodyObserver = new MutationObserver(() => {
    const currentListTbody = document.querySelector('table.gall_list tbody');
    if (currentListTbody) {
      listObserver.disconnect();
      listObserver.observe(currentListTbody, { childList: true });
      Posts.adjustColgroupWidths();
      Posts.addNumberLabels();
      Posts.formatDates();
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

    AutoRefresher.init(settingsStore, Posts, Events);

    Posts.adjustColgroupWidths();
    Posts.addNumberLabels();
    Posts.formatDates();
    setupTabFocus();
    focusSubjectInputOnWritePage();
    addPrefetchHints();
    handlePageLoadScroll();
    SearchPageEnhancer.init();

    setupObservers();

    await Events.triggerMacroNavigation();

    // [수정] 이벤트 리스너를 단순화합니다.
    settingsStore.$subscribe(handleAutoRefresherState);

    // visibilitychange 리스너는 이제 필요 없습니다.
    // document.removeEventListener('visibilitychange', ...);

    window.addEventListener('focus', () => {
      // 포커스가 돌아오면 background.ts가 리더를 재선출하고, leaderUpdate 메시지를 보낼 것입니다.
      // 여기서는 UI 효과만 처리합니다.
      if (AutoRefresher.timerId) AutoRefresher.restoreOriginalTitle();
      const newPosts = document.querySelectorAll<HTMLElement>('tr.new-post-highlight');
      if (newPosts.length > 0) {
        newPosts.forEach((post) => {
          post.classList.add('highlight-start');
          setTimeout(() => post.classList.remove('new-post-highlight', 'highlight-start'), 2500);
        });
      }
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
app.mount('#dc-ShortCut-app');
