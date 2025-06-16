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
  | 'claimLeadership';

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
          const isUiEnabled = macroType === 'Z' ? settingsStore.macroZEnabled : settingsStore.macroXEnabled;
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
        handleAutoRefresherState();
        sendResponse({ success: true });
        break;
    
    case 'claimLeadership':
        // 이 메시지는 background.ts에서만 처리하므로 content-script에서는 무시
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

let myTabId: number | null = null;

async function handleAutoRefresherState(): Promise<void> {
  if (myTabId === null) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLeaderTabId' });
    if (!response?.success) {
      AutoRefresher.stop();
      return;
    }
    let leaderTabId = response.leaderTabId;

    if (leaderTabId === null) {
        const claimResponse = await chrome.runtime.sendMessage({ action: 'claimLeadership' });
        if (claimResponse?.success && claimResponse.leader) {
            leaderTabId = myTabId;
        }
    }

    const isEnabledInSettings = settingsStore.autoRefreshEnabled;
    const isRefreshable = Gallery.isRefreshablePage();
    const amITheLeader = myTabId === leaderTabId;

    if (amITheLeader && isRefreshable && isEnabledInSettings) {
      AutoRefresher.start();
    } else {
      AutoRefresher.stop();
    }
  } catch (error) {
    AutoRefresher.stop();
  }
}

window.handleAutoRefresherState = handleAutoRefresherState;
window.AutoRefresher = AutoRefresher;

// =================================================================
// Observers and Initialization (DOM 옵저버 및 초기화)
// =================================================================

/**
 * DOM 변경을 감지하여 UI를 업데이트하는 MutationObserver를 설정합니다.
 * (원본 로직 복원)
 */
function setupObservers(): void {
  const listObserver = new MutationObserver(() => {
    setTimeout(() => {
      Posts.addNumberLabels();
      Posts.formatDates();
    }, 150);
  });

  const bodyObserver = new MutationObserver(() => {
    Posts.adjustColgroupWidths();
    const currentListTbody = document.querySelector('table.gall_list tbody');
    if (currentListTbody) {
      Posts.addNumberLabels();
      Posts.formatDates();
      // listObserver가 이미 연결되어 있고, tbody가 변경되지 않았다면 다시 연결하지 않음
      // 이 부분은 복잡성을 줄이기 위해 단순화: body 변경 시 항상 재연결 시도
      listObserver.disconnect();
      listObserver.observe(currentListTbody, { childList: true });
    }
    setupTabFocus();
    addPrefetchHints();
  });

  const initialListTbody = document.querySelector('table.gall_list tbody');
  if (initialListTbody) {
    listObserver.observe(initialListTbody, { childList: true });
  }
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * 콘텐츠 스크립트의 메인 초기화 함수 (원본 로직 순서 보존)
 */
async function initialize(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getMyTabId' });
    if (response?.success) {
      myTabId = response.tabId;
    } else {
      throw new Error(response.error || 'Failed to get Tab ID');
    }
  } catch (error) {
    console.error("치명적 오류: 자신의 탭 ID를 가져올 수 없습니다.", error);
    return;
  }

  console.log(`🔧 탭 ${myTabId}에 대한 초기 설정 실행 중...`);

  try {
    // 1. 설정과 즐겨찾기를 먼저 비동기적으로 불러옵니다.
    await settingsStore.loadSettings();
    await favoritesStore.loadProfiles();
    console.log('[Main] 설정 및 즐겨찾기 로드 완료.');

    // 2. 설정이 로드된 후, 다른 모듈들을 초기화합니다.
    AutoRefresher.init(settingsStore, Posts, Events);

    // 3. 페이지의 초기 UI 렌더링 및 기능 적용 (DOM 조작)
    Posts.adjustColgroupWidths();
    Posts.addNumberLabels();
    Posts.formatDates();
    setupTabFocus();
    focusSubjectInputOnWritePage();
    addPrefetchHints();
    handlePageLoadScroll();
    SearchPageEnhancer.init();
    
    // 4. DOM 변경 감지 옵저버 설정
    setupObservers();

    // 5. 페이지 로드 시 매크로 실행 여부 확인
    await Events.triggerMacroNavigation();

    // 6. 설정 변경 및 페이지 상태에 따른 리스너들을 등록합니다.
    settingsStore.$subscribe(() => {
        handleAutoRefresherState();
    });
    document.addEventListener('visibilitychange', () => {
        if (settingsStore.pauseOnInactiveEnabled) {
            document.visibilityState === 'visible' ? handleAutoRefresherState() : AutoRefresher.stop();
        }
    });
    window.addEventListener('focus', () => {
        if (AutoRefresher.timerId) AutoRefresher.restoreOriginalTitle();
        const newPosts = document.querySelectorAll<HTMLElement>('tr.new-post-highlight');
        if (newPosts.length > 0) {
            newPosts.forEach(post => {
                post.classList.add('highlight-start');
                setTimeout(() => post.classList.remove('new-post-highlight', 'highlight-start'), 2500);
            });
        }
    });

    // 7. 모든 설정이 끝난 후, 자동 새로고침 상태를 최종적으로 확인합니다.
    await handleAutoRefresherState();

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