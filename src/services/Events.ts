import { addPrefetchHints } from '@/services/Global';
import type Storage from './Storage';
import type Posts from './Posts';
import type UI from './UI';
import type Gallery from './Gallery';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

// 각 의존성 모듈 및 스토어의 타입을 정의합니다.
type StorageModule = typeof Storage;
type PostsModule = typeof Posts;
type UiModule = typeof UI;
type GalleryModule = typeof Gallery;
type FavoritesStore = ReturnType<typeof useFavoritesStore>;
type SettingsStore = ReturnType<typeof useSettingsStore>;
type UiStore = ReturnType<typeof useUiStore>;

// 백그라운드 스크립트와의 통신을 위한 타입들을 정의합니다.
interface MacroState {
    zRunning: boolean;
    xRunning: boolean;
    zTabId: number | null;
    xTabId: number | null;
}
type MacroStateResponse = ({ success: true } & MacroState) | { success: false; error?: string };
type TabIdResponse = { success: true; tabId: number } | { success: false; error?: string };

// 내부 상태 객체들의 타입을 정의합니다.
interface NumberInputState {
    mode: boolean;
    buffer: string;
    timeout: number | null;
    display: HTMLDivElement | null;
}
interface MacroTimeouts {
    Z: number | null;
    X: number | null;
}
interface FetchedPage {
    doc: Document;
    baseURI: string;
}
interface ValidPostFromDoc {
    num: number;
    link: string;
}

// =================================================================
// Constants (상수)
// =================================================================

const COMMON_FETCH_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Sec-CH-UA': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
};

// =================================================================
// Events Module (이벤트 모듈)
// =================================================================

const Events = {
    // --- 의존성 모듈 및 스토어 (초기값은 null) ---
    storage: null as StorageModule | null,
    posts: null as PostsModule | null,
    ui: null as UiModule | null,
    gallery: null as GalleryModule | null,
    favoritesStore: null as FavoritesStore | null,
    settingsStore: null as SettingsStore | null,
    uiStore: null as UiStore | null,

    // --- 내부 상태 ---
    _listenersAttached: false,
    _isAltPressed: false,
    isPageLoading: false,
    _currentTabId: null as number | null,
    _macroTimeouts: { Z: null, X: null } as MacroTimeouts,
    numberInput: {
        mode: false,
        buffer: '',
        timeout: null,
        display: null,
    } as NumberInputState,

    /**
     * Events 모듈을 초기화하고 모든 의존성을 주입합니다.
     */
    setup(
        storageInstance: StorageModule,
        postsInstance: PostsModule,
        uiInstance: UiModule,
        galleryInstance: GalleryModule,
        favStore: FavoritesStore,
        settStore: SettingsStore,
        uiStoreInstance: UiStore
    ): void {
        this.storage = storageInstance;
        this.posts = postsInstance;
        this.ui = uiInstance;
        this.gallery = galleryInstance;
        this.favoritesStore = favStore;
        this.settingsStore = settStore;
        this.uiStore = uiStoreInstance;
        console.log('Events 모듈이 모든 의존성과 함께 초기화되었습니다.');
        this._setupEventListeners();
    },

    /**
     * 이벤트 리스너를 설정합니다. 중복 설정을 방지합니다.
     */
    _setupEventListeners(): void {
        if (this._listenersAttached) return;
        console.log('이벤트 리스너를 설정합니다...');

        document.addEventListener('keydown', this.handleKeydown.bind(this));
        document.addEventListener('keyup', this.handleKeyup.bind(this));
        window.addEventListener('focus', this.handleWindowFocus.bind(this));
        window.addEventListener('blur', this.handleWindowBlur.bind(this));

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
            }
        });

        this._listenersAttached = true;
        console.log('이벤트 리스너 준비 완료!');
    },

    /**
     * 키보드 키를 뗄 때 호출되는 핸들러.
     */
    handleKeyup(event: KeyboardEvent): void {
        if (event.key === 'Alt') {
            this._isAltPressed = false;
            if (this.settingsStore?.favoritesPreviewEnabled) {
                this.uiStore?.hideFavoritesPreview();
            }
        }
    },

    /**
     * 브라우저 창이 포커스를 잃었을 때 Alt 키 상태를 초기화합니다.
     */
    handleWindowBlur(): void {
        if (this._isAltPressed) {
            this._isAltPressed = false;
            if (this.settingsStore?.favoritesPreviewEnabled) {
                this.uiStore?.hideFavoritesPreview();
            }
        }
    },

    /**
     * 브라우저 창이 다시 포커스를 얻었을 때 Alt 키 상태를 확인하고 초기화합니다.
     */
    handleWindowFocus(): void {
        if (this._isAltPressed) {
            this._isAltPressed = false;
            if (this.settingsStore?.favoritesPreviewEnabled) {
                this.uiStore?.hideFavoritesPreview();
            }
        }
    },

    /**
     * 백그라운드 스크립트로부터 현재 매크로 실행 상태를 가져옵니다.
     */
    async getMacroStateFromBackground(): Promise<MacroState> {
        const defaultState: MacroState = { zRunning: false, xRunning: false, zTabId: null, xTabId: null };
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getMacroState' }) as MacroStateResponse;
            if (response?.success) {
                return { zRunning: response.zRunning, xRunning: response.xRunning, zTabId: response.zTabId, xTabId: response.xTabId };
            }
            return defaultState;
        } catch (error) {
            return defaultState;
        }
    },

    /**
     * 백그라운드 스크립트로부터 현재 탭의 ID를 가져옵니다.
     */
    async getCurrentTabId(): Promise<number | null> {
        if (this._currentTabId) return this._currentTabId;
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getMyTabId' }) as TabIdResponse;
            if (response?.success) {
                this._currentTabId = response.tabId;
                return response.tabId;
            }
            return null;
        } catch (error) {
            return null;
        }
    },

    /**
     * 백그라운드로부터 매크로 중지 명령을 받았을 때 처리하는 함수.
     */
    handleStopMacroCommand(macroType: 'Z' | 'X', reason: string | null = null): void {
        const timeoutId = this._macroTimeouts[macroType];
        if (timeoutId !== null) { // [수정] null 체크 추가
            clearTimeout(timeoutId);
        }
        this._macroTimeouts[macroType] = null;
        const alertMessage = reason ?? `${macroType} 매크로가 중지되었습니다.`;
        this.ui?.showAlert(alertMessage);
    },

    /**
     * 매크로 상태를 확인하고, 조건이 맞으면 다음/이전 글로의 자동 이동을 예약합니다.
     */
    async triggerMacroNavigation(): Promise<void> {
        if (!this.ui || !this.posts || !this.settingsStore) return;

        const macroState = await this.getMacroStateFromBackground();
        const myTabId = await this.getCurrentTabId();
        if (!myTabId) return;

        const currentInterval = this.settingsStore.macroInterval;

        const processMacro = async (type: 'Z' | 'X'): Promise<void> => {
            const isRunning = type === 'Z' ? macroState.zRunning : macroState.xRunning;
            const targetTabId = type === 'Z' ? macroState.zTabId : macroState.xTabId;
            const isUiEnabled = type === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
            const navigateFn = type === 'Z' ? this.navigatePrevPost : this.navigateNextPost;
            const alertText = type === 'Z' ? '자동 다음 글' : '자동 이전 글';

            if (isRunning && myTabId === targetTabId && isUiEnabled) {
                this.ui!.showAlert(`${alertText} (${currentInterval / 1000}초 후)`, 500);
                const currentTimeout = this._macroTimeouts[type];
                if (currentTimeout !== null) clearTimeout(currentTimeout); // [수정] null 체크 추가
                
                this._macroTimeouts[type] = window.setTimeout(async () => {
                    this._macroTimeouts[type] = null;
                    const latestState = await this.getMacroStateFromBackground();
                    const latestTabId = await this.getCurrentTabId();
                    const latestUiEnabled = type === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
                    const latestIsRunning = type === 'Z' ? latestState.zRunning : latestState.xRunning;
                    if (latestIsRunning && latestTabId === targetTabId && latestUiEnabled) {
                        await navigateFn.call(this);
                    }
                }, currentInterval);
            }
        };
        await processMacro('Z');
        await processMacro('X');
    },

    /**
     * 모든 키 입력을 처리하는 메인 핸들러.
     */
    async handleKeydown(event: KeyboardEvent): Promise<void> {
        if (!this.favoritesStore || !this.settingsStore || !this.uiStore || !this.posts || !this.ui || !this.gallery) return;

        if (event.key === 'Alt' && !this._isAltPressed) {
            this._isAltPressed = true;
            if (this.settingsStore.favoritesPreviewEnabled) {
                await this.favoritesStore.loadProfiles();
                this.uiStore.showFavoritesPreview();
            }
        }

        if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
            const keyUpper = event.key.toUpperCase();
            const keys = this.settingsStore.shortcutKeys;
            const defaults = this.settingsStore.defaultShortcutKeys;

            const prevProfileKey = (keys.shortcutPrevProfileKey || defaults.PrevProfile).toUpperCase();
            const nextProfileKey = (keys.shortcutNextProfileKey || defaults.NextProfile).toUpperCase();

            if (keyUpper === prevProfileKey) {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.favoritesPreviewEnabled && this._isAltPressed) await this.cycleProfile('prev');
                return;
            }
            if (keyUpper === nextProfileKey) {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.favoritesPreviewEnabled && this._isAltPressed) await this.cycleProfile('next');
                return;
            }

            if (event.key >= '0' && event.key <= '9') {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.altNumberEnabled) {
                    await this.gallery.handleFavoriteKey(event.key, this.favoritesStore);
                }
                return;
            }

            const submitCommentKey = (keys.shortcutSubmitCommentKey || defaults.SubmitComment).toUpperCase();
            if (submitCommentKey && keyUpper === submitCommentKey) {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.shortcutSubmitCommentKeyEnabled) {
                    document.querySelector<HTMLButtonElement>('button.btn_svc.repley_add')?.click();
                }
                return;
            }

            const submitImagePostKey = (keys.shortcutSubmitImagePostKey || defaults.SubmitImagePost).toUpperCase();
            if (submitImagePostKey && keyUpper === submitImagePostKey) {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.shortcutSubmitImagePostKeyEnabled) {
                    document.querySelector<HTMLButtonElement>('button.btn_svc.write[type="image"]')?.click();
                }
                return;
            }

            const toggleModalKey = (keys.shortcutToggleModalKey || defaults.ToggleModal).toUpperCase();
            if (toggleModalKey && keyUpper === toggleModalKey) {
                event.preventDefault(); event.stopPropagation();
                if (this.settingsStore.shortcutToggleModalKeyEnabled) {
                    this.uiStore.activeModal === 'shortcuts' ? this.uiStore.closeModal() : this.uiStore.toggleFavorites();
                }
                return;
            }
        }

        if (!event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || (activeEl as HTMLElement).isContentEditable)) {
                return;
            }

            if (this.numberInput.mode) {
                this.handleNumberInput(event);
                return;
            }
            if (event.key === '.' || event.key === '`') {
                this.toggleNumberInput(event.key);
                return;
            }

            const keyUpper = event.key.toUpperCase();
            let targetAction: string | null = null;
            for (const action of this.settingsStore.customizableShortcutActions) {
                if (['SubmitComment', 'SubmitImagePost', 'ToggleModal'].includes(action)) continue;
                const assignedKey = (this.settingsStore.shortcutKeys[`shortcut${action}Key`] || this.settingsStore.defaultShortcutKeys[action as keyof typeof this.settingsStore.defaultShortcutKeys]).toUpperCase();
                if (assignedKey === keyUpper) {
                    targetAction = action;
                    break;
                }
            }

            if (targetAction) {
                if (this.settingsStore.shortcutEnabled[`shortcut${targetAction}Enabled`]) {
                    event.preventDefault();
                    event.stopPropagation();
                    await this.handleShortcuts(keyUpper, event);
                }
                return;
            }

            if (event.key >= '0' && event.key <= '9') {
                const { validPosts } = this.posts.getValidPosts();
                const index = event.key === '0' ? 9 : parseInt(event.key, 10) - 1;
                if (validPosts?.[index]?.link) {
                    event.preventDefault();
                    validPosts[index].link.click();
                }
            }
        }
    },
    
    async handleShortcuts(key: string, event: KeyboardEvent): Promise<void> {
        if (!this.settingsStore || !this.ui || !this.posts || !this.gallery) return;

        const isViewMode = window.location.pathname.includes('/board/view/');
        const baseListUrl = this.gallery.getBaseListUrl();
        const recommendListUrl = this.gallery.getRecommendListUrl();

        let actionForPressedKey: string | null = null;
        for (const action in this.settingsStore.defaultShortcutKeys) {
            const assignedKey = this.settingsStore.shortcutKeys[`shortcut${action}Key`] || this.settingsStore.defaultShortcutKeys[action as keyof typeof this.settingsStore.defaultShortcutKeys];
            if (assignedKey.toUpperCase() === key.toUpperCase()) {
                actionForPressedKey = action;
                break;
            }
        }

        if (window.location.hostname === 'search.dcinside.com' && (actionForPressedKey === 'A' || actionForPressedKey === 'S')) {
            const currentUrl = new URL(window.location.href);
            const pathParts = currentUrl.pathname.split('/').filter(p => p);
            let sortOrder = currentUrl.pathname.includes('/sort/accuracy') ? 'accuracy' : 'latest';
            let currentPage = 1;
            if (pathParts[0] === 'post' && pathParts[1] === 'p') {
                currentPage = parseInt(pathParts[2], 10);
            }
            const query = pathParts[pathParts.length - 1];
            if (actionForPressedKey === 'A') {
                if (currentPage <= 1) { this.ui.showAlert('첫 페이지입니다.'); return; }
                window.location.href = `https://search.dcinside.com/post/p/${currentPage - 1}/sort/${sortOrder}/q/${query}`;
            } else {
                const currentPageElement = document.querySelector('div.bottom_paging_box em');
                if (currentPageElement && !currentPageElement.nextElementSibling) { this.ui.showAlert('마지막 페이지입니다.'); return; }
                window.location.href = `https://search.dcinside.com/post/p/${currentPage + 1}/sort/${sortOrder}/q/${query}`;
            }
            return;
        }

        switch (actionForPressedKey) {
            case 'W': document.querySelector<HTMLButtonElement>('button#btn_write.write')?.click(); break;
            case 'C': event.preventDefault(); document.querySelector<HTMLTextAreaElement>('textarea[id^="memo_"]')?.focus(); break;
            case 'D':
                if (this.settingsStore.shortcutDRefreshCommentEnabled) document.querySelector<HTMLButtonElement>('button.btn_cmt_refresh')?.click();
                document.querySelector('.comment_count')?.scrollIntoView({ behavior: 'auto', block: 'center' });
                break;
            case 'R': location.reload(); break;
            case 'Q': window.scrollTo({ top: 0, behavior: 'auto' }); break;
            case 'E': document.querySelector('table.gall_list, .gall_listwrap')?.scrollIntoView({ behavior: 'auto', block: 'start' }); break;
            case 'F': if (baseListUrl) window.location.href = baseListUrl; break;
            case 'G': if (recommendListUrl) window.location.href = recommendListUrl; break;
            case 'A':
            case 'S': {
                const direction = actionForPressedKey === 'A' ? 'prev' : 'next';
                const targetLinkElement = this.findPaginationLink(direction);
                if (targetLinkElement) {
                    if (this.settingsStore.pageNavigationMode === 'ajax') {
                        await this.loadPageContentAjax(targetLinkElement.href);
                    } else {
                        sessionStorage.setItem('dcinside_navigated_by_as_full_load', 'true');
                        window.location.href = targetLinkElement.href;
                    }
                } else {
                    this.ui.showAlert(direction === 'prev' ? '첫 페이지입니다.' : '마지막 페이지입니다.');
                }
                break;
            }
            case 'Z': await this.navigatePrevPost(); break;
            case 'X': await this.navigateNextPost(); break;
            case 'PrevProfile': await this.cycleProfile('prev'); break;
            case 'NextProfile': await this.cycleProfile('next'); break;
        }
    },

    findPaginationLink(direction: 'prev' | 'next' = 'next'): HTMLAnchorElement | null {
        let targetPagingBox: Element | null = null;
        const exceptionPagingWrap = document.querySelector('.bottom_paging_wrap.re, .bottom_paging_wrapre');
        if (exceptionPagingWrap) {
            targetPagingBox = exceptionPagingWrap.querySelector('.bottom_paging_box');
        } else {
            const normalPagingWraps = document.querySelectorAll('.bottom_paging_wrap');
            targetPagingBox = normalPagingWraps.length > 1 ? normalPagingWraps[1]?.querySelector('.bottom_paging_box') : normalPagingWraps[0]?.querySelector('.bottom_paging_box');
        }

        if (targetPagingBox) {
            const currentPageElement = targetPagingBox.querySelector('em');
            let link: Element | null | undefined;
            if (direction === 'prev') {
                link = currentPageElement ? currentPageElement.previousElementSibling : targetPagingBox.querySelector('a.search_prev[href]');
            } else {
                link = currentPageElement ? currentPageElement.nextElementSibling : targetPagingBox.querySelector('a.search_next[href]');
            }
            if (link?.tagName === 'A' && (link as HTMLAnchorElement).href) {
                return link as HTMLAnchorElement;
            }
        }
        return null;
    },

    async fetchPage(url: string): Promise<FetchedPage> {
        try {
            const response = await fetch(url, { credentials: 'include', redirect: 'follow', headers: COMMON_FETCH_HEADERS });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            return { doc, baseURI: response.url };
        } catch (error) {
            this.ui?.showAlert('페이지 로딩 중 오류 발생');
            throw error;
        }
    },

    async cycleProfile(direction: 'prev' | 'next' = 'next'): Promise<void> {
        if (!this.favoritesStore || !this.ui) return;
        try {
            await this.favoritesStore.loadProfiles();
            const profiles = this.favoritesStore.profiles;
            if (!profiles) return;
            const profileNames = Object.keys(profiles);
            if (profileNames.length <= 1) { this.ui.showAlert('전환할 다른 프로필이 없습니다.'); return; }
            const currentIndex = profileNames.indexOf(this.favoritesStore.activeProfileName);
            const nextIndex = direction === 'next' ? (currentIndex + 1) % profileNames.length : (currentIndex - 1 + profileNames.length) % profileNames.length;
            const nextProfileName = profileNames[nextIndex];
            await this.favoritesStore.switchProfile(nextProfileName);
            this.ui.showAlert(`프로필: ${nextProfileName}`);
        } catch (error) {
            this.ui.showAlert("프로필 전환 중 오류가 발생했습니다.");
        }
    },

    getLastValidPostLink(doc: Document, baseURI: string): string | null {
        if (!this.posts) return null;
        const rows = Array.from(doc.querySelectorAll('table.gall_list tbody tr'));
        for (let i = rows.length - 1; i >= 0; i--) {
            const row = rows[i];
            if (this.posts.isValidPost(row.querySelector('td.gall_num') as HTMLElement, row.querySelector('td.gall_tit') as HTMLElement, row.querySelector('td.gall_subject') as HTMLElement)) {
                const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
                if (link?.href) return new URL(link.href, baseURI).href;
            }
        }
        return null;
    },

    getFirstValidPostLink(doc: Document, baseURI: string): string | null {
        if (!this.posts) return null;
        const rows = Array.from(doc.querySelectorAll('table.gall_list tbody tr')); // [수정] Array.from 사용
        for (const row of rows) {
            if (this.posts.isValidPost(row.querySelector('td.gall_num') as HTMLElement, row.querySelector('td.gall_tit') as HTMLElement, row.querySelector('td.gall_subject') as HTMLElement)) {
                const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
                if (link?.href) return new URL(link.href, baseURI).href;
            }
        }
        return null;
    },

    getValidPostsFromDoc(doc: Document, baseURI: string): ValidPostFromDoc[] {
        if (!this.posts) return [];
        return Array.from(doc.querySelectorAll('table.gall_list tbody tr')).map(row => {
            const numCell = row.querySelector('td.gall_num') as HTMLElement;
            const titleCell = row.querySelector('td.gall_tit') as HTMLElement;
            if (this.posts!.isValidPost(numCell, titleCell, row.querySelector('td.gall_subject') as HTMLElement)) {
                const numText = numCell!.textContent!.trim().replace(/\[.*?\]\s*/, '');
                const num = parseInt(numText, 10);
                const linkElement = titleCell!.querySelector<HTMLAnchorElement>('a:first-child');
                if (linkElement?.href) {
                    const link = new URL(linkElement.href, baseURI).href;
                    if (!isNaN(num) && link) return { num, link };
                }
            }
            return null;
        }).filter((p): p is ValidPostFromDoc => p !== null);
    },

    async loadPageContentAjax(targetLinkUrl: string): Promise<void> {
        if (this.isPageLoading) return;
        if (!this.ui || !this.posts) { window.location.href = targetLinkUrl; return; }

        this.isPageLoading = true;
        window.AutoRefresher?.stop();
        this.ui.showAlert('로딩 중...');

        try {
            const { doc } = await this.fetchPage(targetLinkUrl);
            const currentTbodies = document.querySelectorAll('table.gall_list tbody');
            const newTbodies = doc.querySelectorAll('table.gall_list tbody');
            let currentPagingWrap = document.querySelector('.bottom_paging_wrap.re, .bottom_paging_wrapre') || document.querySelectorAll('.bottom_paging_wrap')[1] || document.querySelectorAll('.bottom_paging_wrap')[0];
            let newPagingWrap = doc.querySelector('.bottom_paging_wrap.re, .bottom_paging_wrapre') || doc.querySelectorAll('.bottom_paging_wrap')[1] || doc.querySelectorAll('.bottom_paging_wrap')[0];

            if (currentTbodies.length > 0) {
                currentTbodies.forEach((tbody, index) => { tbody.innerHTML = newTbodies[index]?.innerHTML || ''; });
            }
            if (currentPagingWrap) {
                currentPagingWrap.innerHTML = newPagingWrap?.innerHTML || '';
            }

            this.posts.adjustColgroupWidths();
            this.posts.addNumberLabels();
            this.posts.formatDates();
            addPrefetchHints();

            history.pushState(null, '', targetLinkUrl);
            currentTbodies[0]?.closest('table.gall_list')?.scrollIntoView({ behavior: 'auto', block: 'start' });
            window.handleAutoRefresherState?.();
        } catch (error) {
            window.location.href = targetLinkUrl;
        } finally {
            this.isPageLoading = false;
            this.ui.removeAlert('로딩 중...');
        }
    },

    async checkUrlExists(url: string): Promise<boolean> {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.status !== 404;
        } catch (error) {
            return false;
        }
    },

    async navigatePrevPost(): Promise<void> { // Z 키
        if (!this.posts || !this.ui) return;
        const currentUrl = new URL(window.location.href);
        const currentPostNo = parseInt(currentUrl.searchParams.get('no') || '0', 10);
        if (!currentPostNo) { this.ui.showAlert("현재 글 번호를 찾을 수 없습니다."); return; }

        const crtIcon = document.querySelector('td.gall_num .sp_img.crt_icon');
        const { validPosts, currentIndex } = this.posts.getValidPosts();
        const isPageBoundary = currentIndex === 0;
        const shouldUseHeadFallback = !crtIcon || (isPageBoundary && !currentUrl.searchParams.has('s_keyword'));

        if (shouldUseHeadFallback) {
            for (let i = 1; i <= 5; i++) {
                const targetUrl = new URL(currentUrl);
                targetUrl.searchParams.set('no', (currentPostNo + i).toString());
                if (await this.checkUrlExists(targetUrl.toString())) { window.location.href = targetUrl.toString(); return; }
            }
            this.ui.showAlert('근처에서 다음 글을 찾지 못했습니다.');
            this.rescheduleMacroAttempt('Z');
            return;
        }

        let row = crtIcon!.closest('tr')?.previousElementSibling;
        while (row) {
            if (this.posts.isValidPost(row.querySelector('td.gall_num') as HTMLElement, row.querySelector('td.gall_tit') as HTMLElement, null)) {
                const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
                if (link?.href) { window.location.href = link.href; return; }
            }
            row = row.previousElementSibling;
        }

        const prevPageLink = this.findPaginationLink('prev');
        if (prevPageLink?.href) {
            const { doc, baseURI } = await this.fetchPage(prevPageLink.href);
            const finalPostLink = this.getLastValidPostLink(doc, baseURI);
            if (finalPostLink) { window.location.href = finalPostLink; return; }
        }

        this.ui.showAlert('첫 게시글입니다.');
        this.rescheduleMacroAttempt('Z');
    },

    async navigateNextPost(): Promise<void> { // X 키
        if (!this.posts || !this.ui) return;
        const currentUrl = new URL(window.location.href);
        const currentPostNo = parseInt(currentUrl.searchParams.get('no') || '0', 10);
        if (!currentPostNo) { this.ui.showAlert("현재 글 번호를 찾을 수 없습니다."); return; }

        const crtIcon = document.querySelector('td.gall_num .sp_img.crt_icon');
        const { validPosts, currentIndex } = this.posts.getValidPosts();
        const isPageBoundary = validPosts.length > 0 && currentIndex === validPosts.length - 1;
        const shouldUseHeadFallback = !crtIcon || (isPageBoundary && !currentUrl.searchParams.has('s_keyword'));

        if (shouldUseHeadFallback) {
            for (let i = 1; i <= 5; i++) {
                const targetUrl = new URL(currentUrl);
                const targetNo = currentPostNo - i;
                if (targetNo <= 0) break;
                targetUrl.searchParams.set('no', targetNo.toString());
                if (await this.checkUrlExists(targetUrl.toString())) { window.location.href = targetUrl.toString(); return; }
            }
            this.ui.showAlert('근처에서 이전 글을 찾지 못했습니다.');
            this.rescheduleMacroAttempt('X');
            return;
        }

        let row = crtIcon!.closest('tr')?.nextElementSibling;
        while (row) {
            if (this.posts.isValidPost(row.querySelector('td.gall_num') as HTMLElement, row.querySelector('td.gall_tit') as HTMLElement, null)) {
                const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
                if (link?.href) { window.location.href = link.href; return; }
            }
            row = row.nextElementSibling;
        }

        const nextPageLink = this.findPaginationLink('next');
        if (nextPageLink?.href) {
            const { doc, baseURI } = await this.fetchPage(nextPageLink.href);
            const firstPostLink = this.getFirstValidPostLink(doc, baseURI);
            if (firstPostLink) { window.location.href = firstPostLink; return; }
        }

        this.ui.showAlert('마지막 게시글입니다.');
        this.rescheduleMacroAttempt('X');
    },

    rescheduleMacroAttempt(macroType: 'Z' | 'X'): void {
        const navigateFn = macroType === 'Z' ? this.navigatePrevPost : this.navigateNextPost;
        const currentInterval = this.settingsStore!.macroInterval;
        const currentTimeout = this._macroTimeouts[macroType];
        if (currentTimeout !== null) clearTimeout(currentTimeout); // [수정] null 체크 추가

        this._macroTimeouts[macroType] = window.setTimeout(async () => {
            this._macroTimeouts[macroType] = null;
            const state = await this.getMacroStateFromBackground();
            const tabId = await this.getCurrentTabId();
            const uiEnabled = macroType === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
            const shouldRun = (macroType === 'Z' && state.zRunning && tabId === state.zTabId && uiEnabled) || (macroType === 'X' && state.xRunning && tabId === state.xTabId && uiEnabled);
            if (shouldRun) await navigateFn.call(this);
        }, currentInterval);
    },

    toggleNumberInput(key: string): void {
        if (!this.posts || !this.ui) return;
        if (this.numberInput.mode && this.numberInput.buffer) {
            this.posts.navigate(this.numberInput.buffer);
            this.exitNumberInput();
        } else {
            this.numberInput.mode = true;
            this.numberInput.buffer = '';
            this.updateNumberDisplay('Post number: ');
            this.resetNumberTimeout();
        }
    },

    handleNumberInput(event: KeyboardEvent): void {
        if (!this.posts || !this.ui) return;
        event.preventDefault();
        const key = event.key;
        if ((key === 'Enter' || key === '.' || key === '`') && this.numberInput.buffer) {
            this.posts.navigate(this.numberInput.buffer);
            this.exitNumberInput();
        } else if (key >= '0' && key <= '9' && this.numberInput.buffer.length < 3) {
            this.numberInput.buffer += key;
            this.updateNumberDisplay(`Post number: ${this.numberInput.buffer}`);
            this.resetNumberTimeout();
        } else if (key === 'Escape') {
            this.exitNumberInput();
        } else if (key === 'Backspace' && this.numberInput.buffer.length > 0) {
            this.numberInput.buffer = this.numberInput.buffer.slice(0, -1);
            this.updateNumberDisplay(`Post number: ${this.numberInput.buffer}`);
            this.resetNumberTimeout();
        }
    },

    updateNumberDisplay(text: string): void {
        if (!this.numberInput.display) {
            if (!this.ui) return;
            this.numberInput.display = this.ui.createElement('div', {
                position: 'fixed', bottom: '10px', right: '10px',
                backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                padding: '8px 12px', borderRadius: '5px', fontSize: '14px',
                fontWeight: 'bold', zIndex: '10001', fontFamily: 'monospace',
            });
            document.body.appendChild(this.numberInput.display);
        }
        this.numberInput.display.textContent = text;
    },

    resetNumberTimeout(): void {
        if (this.numberInput.timeout) clearTimeout(this.numberInput.timeout);
        this.numberInput.timeout = window.setTimeout(() => this.exitNumberInput(), 3000);
    },

    exitNumberInput(): void {
        this.numberInput.mode = false;
        this.numberInput.buffer = '';
        if (this.numberInput.timeout) clearTimeout(this.numberInput.timeout);
        this.numberInput.timeout = null;
        if (this.numberInput.display) {
            this.numberInput.display.remove();
            this.numberInput.display = null;
        }
    },
};

export default Events;