// =================================================================
// Type Definitions and Constants (타입 정의 및 상수)
// =================================================================

console.log('👋 Background Service Worker (TypeScript) 시작됨.');

// chrome.storage.session에 사용될 키들을 상수로 정의하여 오타를 방지합니다.
const MACRO_Z_RUNNING_KEY_SESSION = 'dcinside_macro_z_running_session';
const MACRO_X_RUNNING_KEY_SESSION = 'dcinside_macro_x_running_session';
const MACRO_Z_TAB_ID_KEY_SESSION = 'dcinside_macro_z_tab_id_session';
const MACRO_X_TAB_ID_KEY_SESSION = 'dcinside_macro_x_tab_id_session';
const LEADER_TAB_ID_KEY_SESSION = 'dcinside_leader_tab_id_session';

// 매크로 타입을 'Z' 또는 'X'로 제한합니다.
type MacroType = 'Z' | 'X';

// =================================================================
// Leader Election and Tab Event Listeners (리더 선출 및 탭 이벤트 리스너)
// =================================================================

/**
 * 활성 창이 변경될 때 새로운 리더 탭을 선출합니다.
 */
chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        return;
    }
    try {
        const tabs = await chrome.tabs.query({ active: true, windowId });
        if (tabs.length > 0) {
            const activeTabInNewWindow = tabs[0];
            const tabId = activeTabInNewWindow.id; // [수정] id를 변수에 할당

            // [수정] 변수 tabId가 undefined가 아닌지 명확히 확인
            if (tabId !== undefined && activeTabInNewWindow.url?.includes('dcinside.com/board/')) {
                console.log(`[LeaderElection] 창 포커스 변경. 새 리더: 탭 ${tabId}`);
                await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: tabId });
                broadcastLeaderUpdate(tabId);
            }
        }
    } catch (error) {
        if (error instanceof Error) console.warn(`onFocusChanged 리스너 오류:`, error.message);
    }
});

/**
 * 같은 창 내에서 활성 탭이 변경될 때 리더를 갱신합니다.
 */
chrome.tabs.onActivated.addListener(async (activeInfo: chrome.tabs.TabActiveInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        // [수정] tab.id가 존재하는지 확인
        if (tab.id && tab.url?.includes('dcinside.com/board/')) {
            await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: tab.id });
            broadcastLeaderUpdate(tab.id);
        }
    } catch (error) {
        if (error instanceof Error) console.warn(`onActivated 리스너 오류:`, error.message);
    }
});

/**
 * 탭의 URL이 변경되거나 페이지 로딩이 완료될 때 리더 상태를 갱신합니다.
 */
chrome.tabs.onUpdated.addListener(async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    // 페이지 로딩이 완료되었고, URL 정보가 있을 때만 처리합니다.
    if (changeInfo.status === 'complete' && tab.url) {
        const isDcGalleryPage = tab.url.includes('dcinside.com/board/');
        const { [LEADER_TAB_ID_KEY_SESSION]: currentLeader } = await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);

        if (isDcGalleryPage) {
            // 갤러리 페이지로 이동했고, 현재 활성 탭이라면 리더로 선출합니다.
            if (tab.active) {
                console.log(`[LeaderElection] 탭 ${tabId} 업데이트 및 활성 상태. 리더로 설정.`);
                await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: tabId });
            broadcastLeaderUpdate(tabId);

            }
        } else {
            // 리더였던 탭이 갤러리가 아닌 다른 페이지로 이동한 경우, 리더 자격을 해제합니다.
            if (tabId === currentLeader) {
                console.log(`[LeaderElection] 리더 탭 ${tabId}이 다른 곳으로 이동. 리더 해제.`);
                await chrome.storage.session.set({ [LEADER_TAB_ID_KEY_SESSION]: null });
                broadcastLeaderUpdate(null);
            }
        }
    }
});

/**
 * 탭이 닫힐 때, 해당 탭이 매크로를 실행 중이었거나 리더였다면 상태를 정리합니다.
 */
chrome.tabs.onRemoved.addListener(async (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
    try {
        const result = await chrome.storage.session.get([
            MACRO_Z_TAB_ID_KEY_SESSION,
            MACRO_X_TAB_ID_KEY_SESSION,
            LEADER_TAB_ID_KEY_SESSION
        ]);

        const updates: Record<string, any> = {};
        let leaderStateChanged = false;

        // 닫힌 탭이 매크로를 실행 중이었는지 확인하고 상태를 초기화합니다.
        if (result[MACRO_Z_TAB_ID_KEY_SESSION] === tabId) {
            updates[MACRO_Z_RUNNING_KEY_SESSION] = false;
            updates[MACRO_Z_TAB_ID_KEY_SESSION] = null;
        }
        if (result[MACRO_X_TAB_ID_KEY_SESSION] === tabId) {
            updates[MACRO_X_RUNNING_KEY_SESSION] = false;
            updates[MACRO_X_TAB_ID_KEY_SESSION] = null;
        }

        // 닫힌 탭이 리더였는지 확인하고 상태를 초기화합니다.
        if (result[LEADER_TAB_ID_KEY_SESSION] === tabId) {
            updates[LEADER_TAB_ID_KEY_SESSION] = null;
            leaderStateChanged = true;
        }

        if (Object.keys(updates).length > 0) {
            await chrome.storage.session.set(updates);
            console.log(`탭 ${tabId} 닫힘으로 인한 세션 상태 업데이트 완료.`);
        }
        
        // 리더가 변경되었다면 모든 탭에 알립니다.
        if (leaderStateChanged) {
            broadcastLeaderUpdate(null);
        }

    } catch (error) {
        if (error instanceof Error) console.error(`탭 제거 처리 중 오류 (탭 ID: ${tabId}):`, error.message);
    }
});

/**
 * 모든 DC인사이드 탭에 리더 변경 사항을 브로드캐스팅합니다.
 * @param {number | null} newLeaderId - 새로운 리더 탭의 ID, 또는 리더가 없으면 null.
 */
async function broadcastLeaderUpdate(newLeaderId: number | null): Promise<void> {
    try {
        const tabs = await chrome.tabs.query({ url: "*://*.dcinside.com/*" });
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'leaderUpdate',
                        leaderTabId: newLeaderId
                    });
                } catch (e) {
                    // 콘텐츠 스크립트가 아직 주입되지 않았거나, 연결할 수 없는 탭은 무시합니다.
                }
            }
        }
    } catch (error) {
        if (error instanceof Error) console.error('리더 업데이트 브로드캐스팅 오류:', error.message);
    }
}


// =================================================================
// Command and Macro Logic (명령어 및 매크로 로직)
// =================================================================

/**
 * 단축키 명령(Command)을 수신하여 매크로 상태를 토글합니다.
 */
chrome.commands.onCommand.addListener(async (command: string) => {
    console.log(`명령어 수신: ${command}`);
    if (command === "01-toggle-z-macro") {
        await toggleMacroState('Z');
    } else if (command === "02-toggle-x-macro") {
        await toggleMacroState('X');
    }
});

/**
 * 매크로 상태를 켜거나 끕니다. 한 번에 하나의 매크로만 실행되도록 보장합니다.
 * @param {MacroType} macroType - 토글할 매크로의 타입 ('Z' 또는 'X').
 */
async function toggleMacroState(macroType: MacroType): Promise<void> {
    const currentKey = macroType === 'Z' ? MACRO_Z_RUNNING_KEY_SESSION : MACRO_X_RUNNING_KEY_SESSION;
    const currentTabIdKey = macroType === 'Z' ? MACRO_Z_TAB_ID_KEY_SESSION : MACRO_X_TAB_ID_KEY_SESSION;
    const otherKey = macroType === 'Z' ? MACRO_X_RUNNING_KEY_SESSION : MACRO_Z_RUNNING_KEY_SESSION;
    const otherTabIdKey = macroType === 'Z' ? MACRO_X_TAB_ID_KEY_SESSION : MACRO_Z_TAB_ID_KEY_SESSION;
    const otherMacroType: MacroType = macroType === 'Z' ? 'X' : 'Z';

    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true, url: "*://*.dcinside.com/*" });
        const activeTab = tabs.length > 0 ? tabs[0] : null;
        const activeTabId = activeTab?.id;

        const sessionData = await chrome.storage.session.get([currentKey, currentTabIdKey, otherKey, otherTabIdKey]);
        const isCurrentlyRunning = sessionData[currentKey] === true;

        if (isCurrentlyRunning) {
            // --- 매크로 끄기 ---
            await chrome.storage.session.set({ [currentKey]: false, [currentTabIdKey]: null });
            if (sessionData[currentTabIdKey]) {
                try {
                    await chrome.tabs.sendMessage(sessionData[currentTabIdKey], { action: 'stopMacro', type: macroType });
                } catch (e) { /* 탭이 이미 닫혔을 수 있음 */ }
            }
        } else {
            // --- 매크로 켜기 ---
            if (!activeTabId) {
                console.warn(`${macroType} 매크로 시작 불가: 활성화된 DC인사이드 탭 없음.`);
                return;
            }
            // 다른 매크로가 실행 중이었다면 끄고, 해당 탭에 중지 메시지를 보냅니다.
            if (sessionData[otherKey] === true && sessionData[otherTabIdKey]) {
                try {
                    await chrome.tabs.sendMessage(sessionData[otherTabIdKey], { action: 'stopMacro', type: otherMacroType });
                } catch (e) { /* 탭이 이미 닫혔을 수 있음 */ }
            }
            // 새 매크로 상태를 저장합니다.
            await chrome.storage.session.set({
                [currentKey]: true,
                [currentTabIdKey]: activeTabId,
                [otherKey]: false,
                [otherTabIdKey]: null,
            });
            // 새 매크로를 시작할 탭에 시작 메시지를 보냅니다.
            await chrome.tabs.sendMessage(activeTabId, { action: 'startMacro', type: macroType, expectedTabId: activeTabId });
        }
    } catch (error) {
        if (error instanceof Error) console.error(`${macroType} 매크로 상태 토글 오류:`, error.message);
    }
}


// =================================================================
// Message Handling (메시지 핸들링)
// =================================================================

/**
 * 콘텐츠 스크립트나 팝업 등 다른 컨텍스트로부터의 메시지를 처리합니다.
 */
chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
    // 비동기 응답을 위해 `return true;`를 사용합니다.
    switch (message.action) {
        case 'getMacroState':
            (async () => {
                const result = await chrome.storage.session.get([MACRO_Z_RUNNING_KEY_SESSION, MACRO_X_RUNNING_KEY_SESSION, MACRO_Z_TAB_ID_KEY_SESSION, MACRO_X_TAB_ID_KEY_SESSION]);
                sendResponse({
                    success: true,
                    zRunning: result[MACRO_Z_RUNNING_KEY_SESSION] === true,
                    xRunning: result[MACRO_X_RUNNING_KEY_SESSION] === true,
                    zTabId: result[MACRO_Z_TAB_ID_KEY_SESSION] || null,
                    xTabId: result[MACRO_X_TAB_ID_KEY_SESSION] || null
                });
            })();
            return true;

        case 'openShortcutsPage':
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
            sendResponse({ success: true });
            return false;

        case 'getMyTabId':
            if (sender.tab?.id) {
                sendResponse({ success: true, tabId: sender.tab.id });
            } else {
                sendResponse({ success: false, error: "Sender has no tab ID." });
            }
            return false;

        case 'getLeaderTabId':
            (async () => {
                const result = await chrome.storage.session.get(LEADER_TAB_ID_KEY_SESSION);
                sendResponse({ success: true, leaderTabId: result[LEADER_TAB_ID_KEY_SESSION] || null });
            })();
            return true;
    }
});


// =================================================================
// Initialization (초기화)
// =================================================================

/**
 * 브라우저 시작 또는 확장 프로그램 설치/업데이트 시 세션 상태를 초기화합니다.
 */
const initializeSessionState = (): void => {
    console.log('매크로 세션 상태를 초기화합니다 (실행: false, 탭 ID: null).');
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