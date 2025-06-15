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
  | 'getLeaderTabId';

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

// Pinia 스토어 인스턴스 생성
const favoritesStore = useFavoritesStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();

// Events 모듈에 모든 의존성 주입
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
            console.warn(`[startMacro] 탭 ID 불일치. 예상: ${expectedTabId}, 현재: ${currentTabId}. 무시.`);
            return sendResponse({ success: false, message: 'Mismatched Tab ID' });
          }
          const isUiEnabled = macroType === 'Z' ? settingsStore.macroZEnabled : settingsStore.macroXEnabled;
          if (!isUiEnabled) {
            console.log(`[startMacro] ${macroType} 매크로가 UI 설정에서 비활성화됨.`);
            return sendResponse({ success: false, message: 'UI setting is disabled.' });
          }
          await (macroType === 'Z' ? Events.navigatePrevPost() : Events.navigateNextPost());
          sendResponse({ success: true });
        } catch (error) {
          if (error instanceof Error) sendResponse({ success: false, message: error.message });
        }
      })();
      return true; // 비동기 응답

    case 'stopMacro':
        const { type, reason } = message as StopMacroMessage;
        Events.handleStopMacroCommand(type, reason);
        sendResponse({ success: true });
        break;

    case 'leaderUpdate':
        const { leaderTabId } = message as LeaderUpdateMessage;
        console.log(`[LeaderUpdate] 새 리더: ${leaderTabId}. 내 ID: ${myTabId}.`);
        handleAutoRefresherState();
        sendResponse({ success: true });
        break;

    default:
      sendResponse({ success: false, message: 'Unknown action' });
      break;
  }
  return false; // 동기 응답 (비동기 처리 시에는 true 반환)
});

// =================================================================
// Auto-Refresher Logic (자동 새로고침 로직)
// =================================================================

/** @description 현재 탭의 ID를 저장하는 변수 */
let myTabId: number | null = null;

/**
 * @description 현재 탭이 리더인지, 새로고침이 가능한 상태인지 등을 종합하여 AutoRefresher를 시작하거나 중지합니다.
 */
async function handleAutoRefresherState(): Promise<void> {
  if (myTabId === null) return; // 탭 ID가 없으면 실행 불가

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLeaderTabId' });
    if (!response?.success) {
      AutoRefresher.stop();
      return;
    }
    const leaderTabId = response.leaderTabId;
    const isEnabledInSettings = settingsStore.autoRefreshEnabled;
    const isRefreshable = Gallery.isRefreshablePage();

    if (myTabId === leaderTabId && isRefreshable && isEnabledInSettings) {
      AutoRefresher.start();
    } else {
      AutoRefresher.stop();
    }
  } catch (error) {
    AutoRefresher.stop();
  }
}

// `window` 객체에 전역 함수로 할당하여 다른 모듈에서도 호출 가능하게 함
window.handleAutoRefresherState = handleAutoRefresherState;
// AutoRefresher 모듈 자체도 전역으로 할당하여 Events 모듈 등에서 접근 가능하게 함
window.AutoRefresher = AutoRefresher;


// =================================================================
// Observers and Initialization (DOM 옵저버 및 초기화)
// =================================================================

/**
 * @description DOM 변경을 감지하여 UI를 업데이트하는 MutationObserver를 설정합니다.
 */
function setupObservers(): void {
  const listObserver = new MutationObserver(() => {
    setTimeout(() => {
      Posts.addNumberLabels();
      Posts.formatDates();
    }, 150);
  });

  const listTbody = document.querySelector('table.gall_list tbody');
  if (listTbody) {
    listObserver.observe(listTbody, { childList: true });
  }

  const bodyObserver = new MutationObserver(() => {
    Posts.adjustColgroupWidths();
    const currentListTbody = document.querySelector('table.gall_list tbody');
    if (currentListTbody) {
      Posts.addNumberLabels();
      Posts.formatDates();
    }
    setupTabFocus();
    addPrefetchHints();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * @description 콘텐츠 스크립트의 메인 초기화 함수.
 */
async function initialize(): Promise<void> {
  // 1. 현재 탭 ID 가져오기
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getMyTabId' });
    if (response?.success) {
      myTabId = response.tabId;
    } else {
      throw new Error(response.error || 'Failed to get Tab ID');
    }
  } catch (error) {
    console.error("치명적 오류: 자신의 탭 ID를 가져올 수 없습니다.", error);
    return; // 초기화 중단
  }

  console.log(`🔧 탭 ${myTabId}에 대한 초기 설정 실행 중...`);

  // 2. 설정 불러오기 및 AutoRefresher 초기화
  await settingsStore.loadSettings();
  AutoRefresher.init(settingsStore, Posts, Events);

  // 3. 설정 변경 감지 및 상태 업데이트
  settingsStore.$subscribe(() => {
    handleAutoRefresherState();
  });

  // 4. 페이지 가시성 변경 감지
  document.addEventListener('visibilitychange', () => {
    if (settingsStore.pauseOnInactiveEnabled) {
      document.visibilityState === 'visible' ? handleAutoRefresherState() : AutoRefresher.stop();
    }
  });
  
  // 5. 창 포커스 이벤트 감지 (새 글 하이라이트 등)
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

  // 6. 페이지별 기능 실행
  SearchPageEnhancer.init();
  Posts.adjustColgroupWidths();
  Posts.addNumberLabels();
  Posts.formatDates();
  setupTabFocus();
  focusSubjectInputOnWritePage();
  addPrefetchHints();
  handlePageLoadScroll();
  setupObservers();
  
  // 7. 페이지 로드 시 매크로 및 자동 새로고침 상태 확인
  await Events.triggerMacroNavigation();
  setTimeout(handleAutoRefresherState, 100);

  console.log('✅ DCInside ShortCut 준비 완료!');
}

// =================================================================
// App Mounting (Vue 앱 마운트)
// =================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}

// Vue 앱을 마운트할 DOM 요소를 생성하고 body에 추가합니다.
const mountPoint = document.createElement('div');
mountPoint.id = 'dc-ShortCut-app';
document.body.appendChild(mountPoint);
app.mount('#dc-ShortCut-app');