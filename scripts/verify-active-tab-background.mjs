import assert from 'node:assert/strict';

const createChromeEvent = () => {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    listeners,
  };
};

const sessionState = {};
const localState = {
  autoRefreshAllTabsEnabled: false,
  pauseOnInactiveEnabled: false,
};
const leaderUpdates = [];
const scriptInjections = [];
const styleInjections = [];
const sentMessages = [];

const windows = new Map([
  [10, { id: 10, focused: true }],
]);

const tabs = new Map([
  [1, {
    id: 1,
    windowId: 10,
    active: true,
    url: 'https://gall.dcinside.com/board/lists?id=test',
    hasContentScript: true,
    isDcInsidePage: true,
    isRefreshablePage: true,
  }],
  [2, {
    id: 2,
    windowId: 10,
    active: false,
    url: 'https://gall.dcinside.com/mgallery/board/lists?id=test2',
    hasContentScript: true,
    isDcInsidePage: true,
    isRefreshablePage: true,
  }],
  [3, {
    id: 3,
    windowId: 10,
    active: false,
    url: 'https://example.com/',
    hasContentScript: false,
    isDcInsidePage: false,
    isRefreshablePage: false,
  }],
  [4, {
    id: 4,
    windowId: 10,
    active: false,
    url: 'https://example.org/',
    hasContentScript: false,
    isDcInsidePage: false,
    isRefreshablePage: false,
    activeTabGranted: true,
  }],
  [5, {
    id: 5,
    windowId: 10,
    active: false,
    url: 'https://example.net/',
    hasContentScript: false,
    isDcInsidePage: false,
    isRefreshablePage: false,
    activeTabGranted: true,
  }],
]);

const readStorage = (state, keys) => {
  if (typeof keys === 'string') return { [keys]: state[keys] };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, state[key]]));
  if (keys && typeof keys === 'object') {
    return Object.fromEntries(
      Object.entries(keys).map(([key, defaultValue]) => [key, state[key] ?? defaultValue])
    );
  }
  return { ...state };
};

const toPublicTab = (tab, revealSensitiveProperties = false) => ({
  id: tab.id,
  windowId: tab.windowId,
  active: tab.active,
  ...(revealSensitiveProperties ? { url: tab.url, title: `Tab ${tab.id}` } : {}),
});

const runtimeOnMessage = createChromeEvent();
const commandsOnCommand = createChromeEvent();
const tabsOnActivated = createChromeEvent();
const tabsOnRemoved = createChromeEvent();
const tabsOnUpdated = createChromeEvent();
const windowsOnFocusChanged = createChromeEvent();
const storageOnChanged = createChromeEvent();

globalThis.chrome = {
  commands: {
    getAll: async () => [{ name: 'toggle-favorites', shortcut: 'Alt+Q' }],
    onCommand: commandsOnCommand,
  },
  runtime: {
    onMessage: runtimeOnMessage,
    onInstalled: createChromeEvent(),
    onStartup: createChromeEvent(),
  },
  scripting: {
    async executeScript({ target }) {
      scriptInjections.push(target.tabId);
      tabs.get(target.tabId).hasContentScript = true;
    },
    async insertCSS({ target }) {
      styleInjections.push(target.tabId);
    },
  },
  storage: {
    local: {
      get: async (keys) => readStorage(localState, keys),
    },
    session: {
      get: async (keys) => readStorage(sessionState, keys),
      set: async (updates) => Object.assign(sessionState, updates),
    },
    onChanged: storageOnChanged,
  },
  tabs: {
    async get(tabId) {
      const tab = tabs.get(tabId);
      if (!tab) throw new Error(`Missing tab ${tabId}`);
      // tabs 권한이 없는 상태를 모사하므로 URL과 제목은 반환하지 않습니다.
      return toPublicTab(tab, false);
    },
    async query(queryInfo = {}) {
      assert.equal('url' in queryInfo, false, 'tabs.query URL filter must not be used');
      let result = [...tabs.values()];
      if (queryInfo.active === true) result = result.filter((tab) => tab.active);
      if (typeof queryInfo.windowId === 'number') {
        result = result.filter((tab) => tab.windowId === queryInfo.windowId);
      }
      if (queryInfo.lastFocusedWindow === true) {
        const focusedWindow = [...windows.values()].find((window) => window.focused);
        result = result.filter((tab) => tab.windowId === focusedWindow?.id);
      }
      return result.map((tab) => toPublicTab(tab, tab.activeTabGranted === true));
    },
    async sendMessage(tabId, message) {
      const tab = tabs.get(tabId);
      if (!tab?.hasContentScript) throw new Error('Receiving end does not exist');
      sentMessages.push({ tabId, message });

      if (message.action === 'getDcTabContext') {
        if (tab.contextDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, tab.contextDelayMs));
        }
        return {
          success: true,
          isDcInsidePage: tab.isDcInsidePage,
          isRefreshablePage: tab.isRefreshablePage,
        };
      }
      if (message.action === 'leaderUpdate') {
        leaderUpdates.push({ tabId, leaderTabId: message.leaderTabId });
        return { success: true };
      }
      if (
        message.action === 'showGlobalFavoritesModal' ||
        message.action === 'showGlobalShortcutManagerModal'
      ) {
        return { success: true, uiReady: true };
      }
      if (message.action === 'startMacro' || message.action === 'stopMacro') {
        return { success: true };
      }
      return { success: true };
    },
    async create() {
      return undefined;
    },
    onActivated: tabsOnActivated,
    onRemoved: tabsOnRemoved,
    onUpdated: tabsOnUpdated,
  },
  windows: {
    async get(windowId) {
      const window = windows.get(windowId);
      if (!window) throw new Error(`Missing window ${windowId}`);
      return { ...window };
    },
    onFocusChanged: windowsOnFocusChanged,
    WINDOW_ID_NONE: -1,
  },
};

await import(`${new URL('../dist/background.js', import.meta.url).href}?test=${Date.now()}`);

assert.equal(runtimeOnMessage.listeners.length, 1);
assert.equal(commandsOnCommand.listeners.length, 1);
assert.equal(tabsOnActivated.listeners.length, 1);
assert.equal(tabsOnUpdated.listeners.length, 1);

const runtimeListener = runtimeOnMessage.listeners[0];
const dispatchRuntimeMessage = (message, sender = {}) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Message timed out: ${message.action}`)), 1000);
    const sendResponse = (response) => {
      clearTimeout(timeout);
      resolve(response);
    };
    const keepsChannelOpen = runtimeListener(message, sender, sendResponse);
    if (keepsChannelOpen !== true) {
      queueMicrotask(() => {
        clearTimeout(timeout);
        resolve(undefined);
      });
    }
  });

const activateTab = async (tabId) => {
  const tab = tabs.get(tabId);
  for (const candidate of tabs.values()) {
    if (candidate.windowId === tab.windowId) candidate.active = candidate.id === tabId;
  }
  await tabsOnActivated.listeners[0]({ tabId, windowId: tab.windowId });
};

const notifyContentScriptLoaded = (tabId) => {
  const tab = tabs.get(tabId);
  return dispatchRuntimeMessage(
    { action: 'contentScriptLoaded' },
    { tab: toPublicTab(tab, false), url: tab.url }
  );
};

// 활성 DC 탭의 콘텐츠 스크립트 준비 알림으로 리더가 선정됩니다.
assert.deepEqual(await notifyContentScriptLoaded(1), { success: true });
assert.equal(sessionState.dcinside_leader_tab_id_session, 1);
assert.ok(leaderUpdates.some((update) => update.tabId === 1 && update.leaderTabId === 1));

// 다른 DC 탭으로 전환하면 URL 조회 없이 콘텐츠 스크립트 상태만으로 리더가 바뀝니다.
await activateTab(2);
assert.equal(sessionState.dcinside_leader_tab_id_session, 2);

// 일시중지 OFF에서는 일반 탭으로 이동해도 기존 리더가 백그라운드에서 유지됩니다.
await activateTab(3);
assert.equal(sessionState.dcinside_leader_tab_id_session, 2);

// 일시중지 ON에서는 일반 탭 활성화 시 리더가 해제됩니다.
localState.pauseOnInactiveEnabled = true;
await tabsOnActivated.listeners[0]({ tabId: 3, windowId: 10 });
assert.equal(sessionState.dcinside_leader_tab_id_session, null);

// 모든 탭 갱신 모드에서는 리더 없이 각 콘텐츠 스크립트가 독립 실행됩니다.
localState.pauseOnInactiveEnabled = false;
localState.autoRefreshAllTabsEnabled = true;
await activateTab(1);
assert.equal(sessionState.dcinside_leader_tab_id_session, null);

// 모든 탭 모드를 끄면 현재 활성 DC 탭이 다시 리더가 됩니다.
localState.autoRefreshAllTabsEnabled = false;
await storageOnChanged.listeners[0](
  { autoRefreshAllTabsEnabled: { oldValue: true, newValue: false } },
  'local'
);
assert.equal(sessionState.dcinside_leader_tab_id_session, 1);

// 리더 문서가 이동하면 URL을 읽지 않고 로딩 시작에 해제하고, 새 문서 준비 후 재선출합니다.
await tabsOnUpdated.listeners[0](1, { status: 'loading' }, toPublicTab(tabs.get(1), false));
assert.equal(sessionState.dcinside_leader_tab_id_session, null);
assert.deepEqual(await notifyContentScriptLoaded(1), { success: true });
assert.equal(sessionState.dcinside_leader_tab_id_session, 1);

// DC 콘텐츠 스크립트가 요청한 매크로는 tabs 권한 없이 동일 탭에서 시작·중지됩니다.
assert.deepEqual(
  await dispatchRuntimeMessage(
    { action: 'toggleMacro', type: 'Z' },
    { tab: toPublicTab(tabs.get(1), false), url: tabs.get(1).url }
  ),
  { success: true, error: undefined }
);
assert.equal(sessionState.dcinside_macro_z_running_session, true);
assert.equal(sessionState.dcinside_macro_z_tab_id_session, 1);
assert.deepEqual(
  await dispatchRuntimeMessage(
    { action: 'toggleMacro', type: 'Z' },
    { tab: toPublicTab(tabs.get(1), false), url: tabs.get(1).url }
  ),
  { success: true, error: undefined }
);
assert.equal(sessionState.dcinside_macro_z_running_session, false);
assert.equal(sessionState.dcinside_macro_z_tab_id_session, null);

// commands 실행은 activeTab으로 전달된 URL을 사용해 일반 사이트에 UI만 주입합니다.
const generalTab = tabs.get(4);
await commandsOnCommand.listeners[0]('toggle-favorites', toPublicTab(generalTab, true));
assert.deepEqual(scriptInjections, [4]);
assert.deepEqual(styleInjections, [4]);
assert.ok(sentMessages.some(
  ({ tabId, message }) => tabId === 4 && message.action === 'showGlobalFavoritesModal'
));

// 팝업을 연 사용자 동작으로 받은 activeTab 권한도 일반 사이트 UI 주입에 사용됩니다.
await activateTab(5);
assert.deepEqual(
  await dispatchRuntimeMessage({ action: 'openGlobalUi', target: 'shortcuts', mode: 'open' }),
  { success: true }
);
assert.deepEqual(scriptInjections, [4, 5]);
assert.deepEqual(styleInjections, [4, 5]);

// DC 탭은 정적 콘텐츠 스크립트에 바로 전달하며 중복 주입하지 않습니다.
await commandsOnCommand.listeners[0]('toggle-favorites', toPublicTab(tabs.get(1), true));
assert.deepEqual(scriptInjections, [4, 5]);

// Chrome에 실제 지정된 command 조회는 tabs 권한과 무관하게 유지됩니다.
assert.deepEqual(
  await dispatchRuntimeMessage({ action: 'getFavoritesCommand' }),
  { success: true, shortcut: 'Alt+Q' }
);

// 빠른 탭 전환에서 늦게 도착한 이전 탭 응답이 최신 리더를 덮지 않습니다.
tabs.get(1).contextDelayMs = 25;
const slowElection = tabsOnActivated.listeners[0]({ tabId: 1, windowId: 10 });
await new Promise((resolve) => setTimeout(resolve, 1));
const fastElection = tabsOnActivated.listeners[0]({ tabId: 2, windowId: 10 });
await Promise.all([slowElection, fastElection]);
assert.equal(sessionState.dcinside_leader_tab_id_session, 2);

console.log('activeTab background regression checks passed');
