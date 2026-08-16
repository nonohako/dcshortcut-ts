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
  | 'getFavoritesCommand'
  | 'openShortcutsPage'
  | 'openGlobalUi'
  | 'toggleMacro'
  | 'getDcTabContext'
  | 'getMyTabId'
  | 'getLeaderTabId'
  | 'contentScriptLoaded'
  | 'startMacro'
  | 'stopMacro'
  | 'leaderUpdate';

interface BaseMessage {
  action: MessageAction;
}

interface OpenGlobalUiMessage extends BaseMessage {
  action: 'openGlobalUi';
  target: GlobalUiTarget;
  mode: GlobalUiMode;
}

interface ToggleMacroMessage extends BaseMessage {
  action: 'toggleMacro';
  type: MacroType;
}

interface DcTabContextResponse {
  success?: boolean;
  isDcInsidePage?: boolean;
  isRefreshablePage?: boolean;
}

const globalUiInjectionTasks = new Map<number, Promise<void>>();
let leaderElectionGeneration = 0;
let leaderTransitionQueue: Promise<void> = Promise.resolve();

const getGlobalUiAction = (target: GlobalUiTarget): string =>
  target === 'favorites' ? 'showGlobalFavoritesModal' : 'showGlobalShortcutManagerModal';

const isDcInsideUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'dcinside.com' || hostname.endsWith('.dcinside.com');
  } catch {
    return false;
  }
};

const waitForContentScript = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

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
  tab: chrome.tabs.Tab,
  target: GlobalUiTarget,
  mode: GlobalUiMode
): Promise<void> {
  const tabId = tab.id;
  if (typeof tabId !== 'number') throw new Error('활성 탭을 찾을 수 없습니다.');
  if (await dispatchGlobalUiAction(tabId, target, mode)) return;

  if (isDcInsideUrl(tab.url)) {
    // DC 페이지는 manifest 콘텐츠 스크립트가 담당합니다. 로딩 중 별도 주입하면
    // document_idle 시점에 중복 실행될 수 있으므로 잠시 기다렸다가 다시 전달합니다.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await waitForContentScript(100);
      if (await dispatchGlobalUiAction(tabId, target, mode)) return;
    }
    throw new Error('DCInside 페이지 로딩이 끝난 뒤 다시 시도해주세요.');
  }

  await injectGlobalUi(tabId);
  if (!(await dispatchGlobalUiAction(tabId, target, mode))) {
    throw new Error('주입된 UI 콘텐츠 스크립트가 응답하지 않습니다.');
  }
}

// =================================================================
// Leader Election and Tab Event Listeners (리더 선출 및 탭 이벤트 리스너)
// =================================================================

async function setLeaderState(nextLeaderId: number | null): Promise<void> {
  const transition = leaderTransitionQueue.then(async () => {
    const { [LEADER_TAB_ID_KEY_SESSION]: storedLeaderId } =
      await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);
    const currentLeaderId = typeof storedLeaderId === 'number' ? storedLeaderId : null;
    if (currentLeaderId === nextLeaderId) return;

    if (nextLeaderId === null) {
      console.log(`[LeaderElection] 리더 ${currentLeaderId}를 해제합니다.`);
    } else {
      console.log(`[LeaderElection] 새로운 리더 선출: 탭 ${nextLeaderId}`);
    }
    await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: nextLeaderId });
    await broadcastLeaderUpdate(nextLeaderId);
  });
  leaderTransitionQueue = transition.catch((error) => {
    console.warn('[LeaderElection] 리더 상태 전환 실패:', error);
  });
  await transition;
}

async function removeLeader(): Promise<void> {
  // 진행 중인 탭 판별 응답이 뒤늦게 도착해 리더를 다시 설정하지 못하게 합니다.
  leaderElectionGeneration += 1;
  await setLeaderState(null);
}

async function isAutoRefreshAllTabsEnabled(): Promise<boolean> {
  const settings = await chrome.storage.local.get(AUTO_REFRESH_ALL_TABS_KEY);
  return settings[AUTO_REFRESH_ALL_TABS_KEY] === true;
}

async function getDcTabContext(tabId: number): Promise<DcTabContextResponse | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'getDcTabContext' });
    if (response?.success !== true) return null;
    return response as DcTabContextResponse;
  } catch {
    // 콘텐츠 스크립트가 없는 일반 페이지이거나 아직 document_idle 이전입니다.
    return null;
  }
}

async function handleIneligibleActiveTab(tabId: number): Promise<void> {
  const settings = await chrome.storage.local.get(PAUSE_ON_INACTIVE_KEY);
  if (settings[PAUSE_ON_INACTIVE_KEY]) {
    console.log(
      `[LeaderElection] 새로고침할 수 없는 탭(${tabId}) 활성화 + "일시중지" ON -> 리더를 해제합니다.`
    );
    await removeLeader();
  } else {
    console.log(
      `[LeaderElection] 새로고침할 수 없는 탭(${tabId}) 활성화 + "일시중지" OFF -> 리더를 유지합니다.`
    );
  }
}

async function electNewLeader(newLeaderId: number): Promise<void> {
  const electionGeneration = ++leaderElectionGeneration;
  try {
    // "모든 탭 갱신"이 켜진 상태에서는 리더 개념이 불필요하므로 비활성화합니다.
    if (await isAutoRefreshAllTabsEnabled()) {
      await removeLeader();
      return;
    }

    const context = await getDcTabContext(newLeaderId);
    if (electionGeneration !== leaderElectionGeneration) return;

    if (!context?.isDcInsidePage || !context.isRefreshablePage) {
      await handleIneligibleActiveTab(newLeaderId);
      return;
    }

    if (electionGeneration !== leaderElectionGeneration) return;
    await setLeaderState(newLeaderId);
  } catch (e) {
    console.warn(`[LeaderElection] electNewLeader(${newLeaderId}) 실행 중 오류:`, e);
    if (electionGeneration === leaderElectionGeneration) {
      await handleIneligibleActiveTab(newLeaderId);
    }
  }
}

async function isFocusedWindow(windowId: number): Promise<boolean> {
  try {
    return (await chrome.windows.get(windowId)).focused;
  } catch {
    return false;
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
  if (!(await isFocusedWindow(activeInfo.windowId))) return;
  await electNewLeader(activeInfo.tabId);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;

  if (changes.shortcutMacroZEnabled?.newValue === false) {
    await stopMacroState('Z', '다음 글 자동 넘김이 비활성화되어 매크로를 중지했습니다.');
  }
  if (changes.shortcutMacroXEnabled?.newValue === false) {
    await stopMacroState('X', '이전 글 자동 넘김이 비활성화되어 매크로를 중지했습니다.');
  }

  if (!changes[AUTO_REFRESH_ALL_TABS_KEY]) return;

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

// URL을 읽지 않고 문서 로딩 시작만 감지합니다. DC 페이지라면 새 콘텐츠 스크립트가
// 준비된 뒤 contentScriptLoaded 메시지로 다시 리더가 됩니다.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } =
    await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);
  if (tabId !== currentLeader) return;

  console.log(`[LeaderElection] 리더 탭 ${tabId}의 문서 이동을 감지해 리더를 해제합니다.`);
  await removeLeader();
});

async function broadcastLeaderUpdate(newLeaderId: number | null): Promise<void> {
  // tabs 권한 없이 모든 탭의 기본 ID만 조회합니다. 메시지 수신기가 설치된 DC 탭과
  // 사용자가 직접 UI를 연 탭만 응답하며 나머지 오류는 무시합니다.
  const tabs = await chrome.tabs.query({});
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

chrome.commands.onCommand.addListener(async (command: string, tab: chrome.tabs.Tab) => {
  if (command !== 'toggle-favorites' || typeof tab.id !== 'number') return;

  try {
    await ensureGlobalUi(tab, 'favorites', 'toggle');
  } catch (error) {
    console.warn(`[Global UI] 탭 ${tab.id}에 즐겨찾기 창을 열지 못했습니다.`, error);
  }
});

async function stopMacroState(macroType: MacroType, reason?: string): Promise<void> {
  const runningKey =
    macroType === 'Z' ? MACRO_Z_RUNNING_KEY_SESSION : MACRO_X_RUNNING_KEY_SESSION;
  const tabIdKey =
    macroType === 'Z' ? MACRO_Z_TAB_ID_KEY_SESSION : MACRO_X_TAB_ID_KEY_SESSION;
  const sessionData = await chrome.storage.session.get([runningKey, tabIdKey]);
  const runningTabId = sessionData[tabIdKey];

  await chrome.storage.session.set({ [runningKey]: false, [tabIdKey]: null });
  if (sessionData[runningKey] !== true || typeof runningTabId !== 'number') return;

  try {
    await chrome.tabs.sendMessage(runningTabId, {
      action: 'stopMacro',
      type: macroType,
      reason,
    });
  } catch {
    // 탭이 닫혔거나 이동한 경우 세션 상태만 정리합니다.
  }
}

async function toggleMacroState(macroType: MacroType, activeTabId: number): Promise<boolean> {
  const currentKey = macroType === 'Z' ? MACRO_Z_RUNNING_KEY_SESSION : MACRO_X_RUNNING_KEY_SESSION;
  const currentTabIdKey =
    macroType === 'Z' ? MACRO_Z_TAB_ID_KEY_SESSION : MACRO_X_TAB_ID_KEY_SESSION;
  const otherKey = macroType === 'Z' ? MACRO_X_RUNNING_KEY_SESSION : MACRO_Z_RUNNING_KEY_SESSION;
  const otherTabIdKey = macroType === 'Z' ? MACRO_X_TAB_ID_KEY_SESSION : MACRO_Z_TAB_ID_KEY_SESSION;
  const otherMacroType: MacroType = macroType === 'Z' ? 'X' : 'Z';

  try {
    const sessionData = await chrome.storage.session.get([
      currentKey,
      currentTabIdKey,
      otherKey,
      otherTabIdKey,
    ]);
    const isCurrentlyRunning = sessionData[currentKey] === true;

    if (isCurrentlyRunning) {
      await stopMacroState(macroType);
    } else {
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
    return true;
  } catch (error) {
    if (error instanceof Error) console.error(`${macroType} 매크로 상태 토글 오류:`, error.message);
    return false;
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

      case 'getFavoritesCommand':
        (async () => {
          const commands = await chrome.commands.getAll();
          const favoritesCommand = commands.find((command) => command.name === 'toggle-favorites');
          sendResponse({ success: true, shortcut: favoritesCommand?.shortcut ?? '' });
        })();
        return true;

      case 'openShortcutsPage':
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        sendResponse({ success: true });
        return false;

      case 'openGlobalUi':
        (async () => {
          const { target, mode } = message as OpenGlobalUiMessage;
          if (
            (target !== 'favorites' && target !== 'shortcuts') ||
            (mode !== 'open' && mode !== 'toggle')
          ) {
            sendResponse({ success: false, error: 'Invalid global UI request.' });
            return;
          }

          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (typeof activeTab?.id !== 'number') {
            sendResponse({ success: false, error: '활성 탭을 찾을 수 없습니다.' });
            return;
          }

          try {
            await ensureGlobalUi(activeTab, target, mode);
            sendResponse({ success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`[Global UI] 탭 ${activeTab.id}에 UI를 열지 못했습니다.`, error);
            sendResponse({ success: false, error: errorMessage });
          }
        })();
        return true;

      case 'toggleMacro':
        (async () => {
          const { type } = message as ToggleMacroMessage;
          if (
            typeof senderTabId !== 'number' ||
            (type !== 'Z' && type !== 'X') ||
            !isDcInsideUrl(sender.url)
          ) {
            sendResponse({ success: false, error: 'Invalid macro request.' });
            return;
          }

          const success = await toggleMacroState(type, senderTabId);
          sendResponse({ success, error: success ? undefined : '매크로 상태를 변경하지 못했습니다.' });
        })();
        return true;

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
          try {
            if (typeof senderTabId !== 'number' || !isDcInsideUrl(sender.url)) {
              sendResponse({ success: false, error: 'Invalid DC content-script context.' });
              return;
            }

            try {
              const tab = await chrome.tabs.get(senderTabId);
              if (
                tab.active &&
                typeof tab.windowId === 'number' &&
                await isFocusedWindow(tab.windowId)
              ) {
                await electNewLeader(senderTabId);
              }
            } catch (e) {
              /* 탭이 닫히는 등의 경우 오류 발생 가능 */
            }
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
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
