// background.ts

console.log('👋 Background Service Worker (TypeScript) 시작됨.');

// =================================================================
// Type Definitions and Constants (타입 정의 및 상수)
// =================================================================

const MACRO_Z_RUNNING_KEY_SESSION = 'dcinside_macro_z_running_session';
const MACRO_X_RUNNING_KEY_SESSION = 'dcinside_macro_x_running_session';
const MACRO_Z_TAB_ID_KEY_SESSION = 'dcinside_macro_z_tab_id_session';
const MACRO_X_TAB_ID_KEY_SESSION = 'dcinside_macro_x_tab_id_session';
const LEADER_TAB_ID_KEY_SESSION = 'dcinside_leader_tab_id_session';
const PAUSE_ON_INACTIVE_KEY = 'pauseOnInactiveEnabled'; // 설정 키 추가
const AUTO_REFRESH_ALL_TABS_KEY = 'autoRefreshAllTabsEnabled';

type MacroType = 'Z' | 'X';
type GlobalUiTarget = 'favorites' | 'shortcuts';
type GlobalUiMode = 'open' | 'toggle';

type MessageAction =
  | 'getMacroState'
  | 'openShortcutsPage'
  | 'getMyTabId'
  | 'getLeaderTabId'
  | 'contentScriptLoaded'
  | 'ensureGlobalUi'
  | 'startMacro'
  | 'stopMacro'
  | 'leaderUpdate';

interface BaseMessage {
  action: MessageAction;
}

interface EnsureGlobalUiMessage extends BaseMessage {
  action: 'ensureGlobalUi';
  target: GlobalUiTarget;
  mode: GlobalUiMode;
}

const globalUiInjectionTasks = new Map<number, Promise<void>>();

const getGlobalUiAction = (target: GlobalUiTarget): string =>
  target === 'favorites' ? 'showGlobalFavoritesModal' : 'showGlobalShortcutManagerModal';

async function dispatchGlobalUiAction(
  tabId: number,
  target: GlobalUiTarget,
  mode: GlobalUiMode
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: getGlobalUiAction(target),
      mode,
    });
    return response?.success === true && response?.uiReady === true;
  } catch {
    return false;
  }
}

async function injectGlobalUi(tabId: number): Promise<void> {
  const runningTask = globalUiInjectionTasks.get(tabId);
  if (runningTask) return runningTask;

  const task = (async () => {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content-script.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
  })();
  globalUiInjectionTasks.set(tabId, task);

  try {
    await task;
  } finally {
    globalUiInjectionTasks.delete(tabId);
  }
}

async function ensureGlobalUi(
  tabId: number,
  target: GlobalUiTarget,
  mode: GlobalUiMode
): Promise<void> {
  if (await dispatchGlobalUiAction(tabId, target, mode)) return;
  await injectGlobalUi(tabId);
  if (!(await dispatchGlobalUiAction(tabId, target, mode))) {
    throw new Error('주입된 UI 콘텐츠 스크립트가 응답하지 않습니다.');
  }
}

// =================================================================
// Leader Election and Tab Event Listeners (리더 선출 및 탭 이벤트 리스너)
// =================================================================

async function removeLeader(): Promise<void> {
  const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } =
    await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);

  if (currentLeader !== null) {
    console.log(`[LeaderElection] 리더 ${currentLeader}를 해제합니다.`);
    await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: null });
    await broadcastLeaderUpdate(null);
  }
}

async function isAutoRefreshAllTabsEnabled(): Promise<boolean> {
  const settings = await chrome.storage.local.get(AUTO_REFRESH_ALL_TABS_KEY);
  return settings[AUTO_REFRESH_ALL_TABS_KEY] === true;
}

async function electNewLeader(newLeaderId: number): Promise<void> {
  try {
    // "모든 탭 갱신"이 켜진 상태에서는 리더 개념이 불필요하므로 비활성화합니다.
    if (await isAutoRefreshAllTabsEnabled()) {
      await removeLeader();
      return;
    }

    const tab = await chrome.tabs.get(newLeaderId);

    if (!tab.url || !tab.url.includes('/board/')) {
      // DC 탭이 아닌 탭이 활성화되면, "일시중지" 옵션이 켜져 있을 때만 리더를 해제
      const settings = await chrome.storage.local.get(PAUSE_ON_INACTIVE_KEY);
      if (settings[PAUSE_ON_INACTIVE_KEY]) {
        console.log(
          `[LeaderElection] 비-DC 탭(${newLeaderId}) 활성화 + "일시중지" 옵션 ON -> 리더를 해제합니다.`
        );
        await removeLeader();
      } else {
        console.log(
          `[LeaderElection] 비-DC 탭(${newLeaderId}) 활성화 + "일시중지" 옵션 OFF -> 리더를 유지합니다.`
        );
      }
      return;
    }

    const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } =
      await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);

    if (currentLeader !== newLeaderId) {
      console.log(`[LeaderElection] 새로운 리더 선출: 탭 ${newLeaderId}`);
      await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: newLeaderId });
      await broadcastLeaderUpdate(newLeaderId);
    }
  } catch (e) {
    console.warn(`[LeaderElection] electNewLeader(${newLeaderId}) 실행 중 오류:`, e);
    // 새 탭 등 오류 발생 시에도 "일시중지" 옵션에 따라 리더 해제
    const settings = await chrome.storage.local.get(PAUSE_ON_INACTIVE_KEY);
    if (settings[PAUSE_ON_INACTIVE_KEY]) {
      await removeLeader();
    }
  }
}

// 창 포커스 변경 리스너
chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // 창 포커스가 사라졌을 때, "일시중지" 옵션이 켜져있으면 리더를 해제
    const settings = await chrome.storage.local.get(PAUSE_ON_INACTIVE_KEY);
    if (settings[PAUSE_ON_INACTIVE_KEY]) {
      console.log(
        '[LeaderElection] 브라우저 창 포커스 상실 + "일시중지" 옵션 ON -> 리더를 해제합니다.'
      );
      await removeLeader();
    } else {
      console.log(
        '[LeaderElection] 브라우저 창 포커스 상실 + "일시중지" 옵션 OFF -> 리더를 유지합니다.'
      );
    }
  } else {
    // 창에 포커스가 돌아오면, 해당 창의 활성 탭으로 리더 선출 시도
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0 && typeof tabs[0].id === 'number') {
      await electNewLeader(tabs[0].id);
    }
  }
});

// 탭이 활성화되면 리더 선출을 시도
chrome.tabs.onActivated.addListener(async (activeInfo: chrome.tabs.TabActiveInfo) => {
  await electNewLeader(activeInfo.tabId);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !changes[AUTO_REFRESH_ALL_TABS_KEY]) return;

  const isEnabled = changes[AUTO_REFRESH_ALL_TABS_KEY].newValue === true;
  if (isEnabled) {
    console.log('[LeaderElection] "모든 탭 갱신" ON -> 리더 선출을 중지합니다.');
    await removeLeader();
    return;
  }

  console.log('[LeaderElection] "모든 탭 갱신" OFF -> 활성 탭 기준으로 리더를 재선출합니다.');
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (typeof activeTab?.id === 'number') {
    await electNewLeader(activeTab.id);
  }
});

// 리더 탭이 닫혔을 때 리더를 null로 설정
chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  try {
    const result = await chrome.storage.session.get([
      MACRO_Z_TAB_ID_KEY_SESSION,
      MACRO_X_TAB_ID_KEY_SESSION,
    ]);
    const updates: Record<string, any> = {};
    if (result[MACRO_Z_TAB_ID_KEY_SESSION] === tabId) {
      updates[MACRO_Z_RUNNING_KEY_SESSION] = false;
      updates[MACRO_Z_TAB_ID_KEY_SESSION] = null;
    }
    if (result[MACRO_X_TAB_ID_KEY_SESSION] === tabId) {
      updates[MACRO_X_RUNNING_KEY_SESSION] = false;
      updates[MACRO_X_TAB_ID_KEY_SESSION] = null;
    }
    if (Object.keys(updates).length > 0) {
      await chrome.storage.session.set(updates);
    }
  } catch (error) {
    if (error instanceof Error) console.error(`탭 제거 시 매크로 정리 중 오류:`, error.message);
  }

  const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } =
    await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);
  if (tabId === currentLeader) {
    console.log(`[LeaderElection] 리더 탭 ${tabId}이 닫혔습니다. 리더를 해제합니다.`);
    await removeLeader();
  }
});

// 리더 탭이 다른 URL로 이동하는 경우
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } =
      await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);

    if (tabId === currentLeader && !tab.url?.includes('/board/')) {
      console.log(
        `[LeaderElection] 리더 탭 ${tabId}이 DC 갤러리를 벗어났습니다. 리더를 해제합니다.`
      );
      await removeLeader();
    }
  }
});

async function broadcastLeaderUpdate(newLeaderId: number | null): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://*.dcinside.com/*' });
  console.log(
    `[Broadcast] 모든 탭(${tabs.length}개)에 새로운 리더 ${newLeaderId} 정보를 전파합니다.`
  );
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'leaderUpdate', leaderTabId: newLeaderId });
      } catch (e) {
        /* 무시 */
      }
    }
  }
}

// =================================================================
// Command and Macro Logic (명령어 및 매크로 로직)
// =================================================================

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command === '01-toggle-z-macro') {
    await toggleMacroState('Z');
  } else if (command === '02-toggle-x-macro') {
    await toggleMacroState('X');
  }
});

async function toggleMacroState(macroType: MacroType): Promise<void> {
  const currentKey = macroType === 'Z' ? MACRO_Z_RUNNING_KEY_SESSION : MACRO_X_RUNNING_KEY_SESSION;
  const currentTabIdKey =
    macroType === 'Z' ? MACRO_Z_TAB_ID_KEY_SESSION : MACRO_X_TAB_ID_KEY_SESSION;
  const otherKey = macroType === 'Z' ? MACRO_X_RUNNING_KEY_SESSION : MACRO_Z_RUNNING_KEY_SESSION;
  const otherTabIdKey = macroType === 'Z' ? MACRO_X_TAB_ID_KEY_SESSION : MACRO_Z_TAB_ID_KEY_SESSION;
  const otherMacroType: MacroType = macroType === 'Z' ? 'X' : 'Z';

  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: '*://*.dcinside.com/*',
    });
    const activeTab = tabs.length > 0 ? tabs[0] : null;
    const activeTabId = activeTab?.id;

    const sessionData = await chrome.storage.session.get([
      currentKey,
      currentTabIdKey,
      otherKey,
      otherTabIdKey,
    ]);
    const isCurrentlyRunning = sessionData[currentKey] === true;

    if (isCurrentlyRunning) {
      await chrome.storage.session.set({ [currentKey]: false, [currentTabIdKey]: null });
      if (sessionData[currentTabIdKey]) {
        try {
          await chrome.tabs.sendMessage(sessionData[currentTabIdKey], {
            action: 'stopMacro',
            type: macroType,
          });
        } catch (e) {
          /* 탭이 이미 닫혔을 수 있음 */
        }
      }
    } else {
      if (!activeTabId) return;
      if (sessionData[otherKey] === true && sessionData[otherTabIdKey]) {
        try {
          await chrome.tabs.sendMessage(sessionData[otherTabIdKey], {
            action: 'stopMacro',
            type: otherMacroType,
          });
        } catch (e) {
          /* 탭이 이미 닫혔을 수 있음 */
        }
      }
      await chrome.storage.session.set({
        [currentKey]: true,
        [currentTabIdKey]: activeTabId,
        [otherKey]: false,
        [otherTabIdKey]: null,
      });
      await chrome.tabs.sendMessage(activeTabId, {
        action: 'startMacro',
        type: macroType,
        expectedTabId: activeTabId,
      });
    }
  } catch (error) {
    if (error instanceof Error) console.error(`${macroType} 매크로 상태 토글 오류:`, error.message);
  }
}

// =================================================================
// Message Handling (메시지 핸들링)
// =================================================================

chrome.runtime.onMessage.addListener(
  (
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    const senderTabId = sender.tab?.id;

    switch (message.action) {
      case 'getMacroState':
        (async () => {
          const result = await chrome.storage.session.get([
            MACRO_Z_RUNNING_KEY_SESSION,
            MACRO_X_RUNNING_KEY_SESSION,
            MACRO_Z_TAB_ID_KEY_SESSION,
            MACRO_X_TAB_ID_KEY_SESSION,
          ]);
          sendResponse({
            success: true,
            zRunning: result[MACRO_Z_RUNNING_KEY_SESSION] === true,
            xRunning: result[MACRO_X_RUNNING_KEY_SESSION] === true,
            zTabId: result[MACRO_Z_TAB_ID_KEY_SESSION] || null,
            xTabId: result[MACRO_X_TAB_ID_KEY_SESSION] || null,
          });
        })();
        return true;

      case 'openShortcutsPage':
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        sendResponse({ success: true });
        return false;

      case 'getMyTabId':
        if (typeof senderTabId === 'number') {
          sendResponse({ success: true, tabId: senderTabId });
        } else {
          sendResponse({ success: false, error: 'Sender has no tab ID.' });
        }
        return false;

      case 'getLeaderTabId':
        (async () => {
          const result = await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);
          sendResponse({ success: true, leaderTabId: result[LEADER_TAB_ID_KEY_SESSION] || null });
        })();
        return true;

      case 'contentScriptLoaded':
        (async () => {
          if (typeof senderTabId === 'number') {
            try {
              const tab = await chrome.tabs.get(senderTabId);
              if (tab.active) {
                await electNewLeader(senderTabId);
              }
            } catch (e) {
              /* 탭이 닫히는 등의 경우 오류 발생 가능 */
            }
          }
        })();
        return false;

      case 'ensureGlobalUi':
        (async () => {
          if (typeof senderTabId !== 'number') {
            sendResponse({ success: false, error: 'Sender has no tab ID.' });
            return;
          }

          const { target, mode } = message as EnsureGlobalUiMessage;
          if (
            (target !== 'favorites' && target !== 'shortcuts') ||
            (mode !== 'open' && mode !== 'toggle')
          ) {
            sendResponse({ success: false, error: 'Invalid global UI request.' });
            return;
          }

          try {
            await ensureGlobalUi(senderTabId, target, mode);
            sendResponse({ success: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[Global UI] 탭 ${senderTabId}에 UI를 열지 못했습니다.`, error);
            sendResponse({ success: false, error: message });
          }
        })();
        return true;
    }
    return false;
  }
);

// =================================================================
// Initialization (초기화)
// =================================================================

const initializeSessionState = (): void => {
  console.log('세션 상태를 초기화합니다.');
  chrome.storage.session.set({
    [MACRO_Z_RUNNING_KEY_SESSION]: false,
    [MACRO_X_RUNNING_KEY_SESSION]: false,
    [MACRO_Z_TAB_ID_KEY_SESSION]: null,
    [MACRO_X_TAB_ID_KEY_SESSION]: null,
    [LEADER_TAB_ID_KEY_SESSION]: null,
  });
};

chrome.runtime.onStartup.addListener(initializeSessionState);
chrome.runtime.onInstalled.addListener(initializeSessionState);
