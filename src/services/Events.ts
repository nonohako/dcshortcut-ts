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

type StorageModule = typeof Storage;
type PostsModule = typeof Posts;
type UiModule = typeof UI;
type GalleryModule = typeof Gallery;
type FavoritesStore = ReturnType<typeof useFavoritesStore>;
type SettingsStore = ReturnType<typeof useSettingsStore>;
type UiStore = ReturnType<typeof useUiStore>;

interface MacroState {
  zRunning: boolean;
  xRunning: boolean;
  zTabId: number | null;
  xTabId: number | null;
}
type MacroStateResponse = ({ success: true } & MacroState) | { success: false; error?: string };
type TabIdResponse = { success: true; tabId: number } | { success: false; error?: string };

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

interface EventsModuleType {
  storage: StorageModule | null;
  posts: PostsModule | null;
  ui: UiModule | null;
  gallery: GalleryModule | null;
  favoritesStore: FavoritesStore | null;
  settingsStore: SettingsStore | null;
  uiStore: UiStore | null;
  _listenersAttached: boolean;
  _isAltPressed: boolean;
  isPageLoading: boolean;
  _currentTabId: number | null;
  _macroTimeouts: MacroTimeouts;
  numberInput: NumberInputState;

  setup(
    storageInstance: StorageModule,
    postsInstance: PostsModule,
    uiInstance: UiModule,
    galleryInstance: GalleryModule,
    favStore: FavoritesStore,
    settStore: SettingsStore,
    uiStoreInstance: UiStore
  ): void;
  _setupEventListeners(): void;
  handleKeyup(event: KeyboardEvent): void;
  handleWindowBlur(): void;
  handleWindowFocus(event?: FocusEvent): void;
  getMacroStateFromBackground(): Promise<MacroState>;
  getCurrentTabId(): Promise<number | null>;
  handleStopMacroCommand(macroType: 'Z' | 'X', reason?: string | null): void;
  triggerMacroNavigation(): Promise<void>;
  findPaginationLink(direction?: 'prev' | 'next'): HTMLAnchorElement | null;
  fetchPage(url: string): Promise<FetchedPage>;
  cycleProfile(direction?: 'prev' | 'next'): Promise<void>;
  getLastValidPostLink(doc: Document, baseURI: string): string | null;
  getFirstValidPostLink(doc: Document, baseURI: string): string | null;
  getValidPostsFromDoc(doc: Document, baseURI: string): ValidPostFromDoc[];
  loadPageContentAjax(targetLinkUrl: string): Promise<void>;
  checkUrlExists(url: string): Promise<boolean>;
  navigatePrevPost(): Promise<void>;
  navigateNextPost(): Promise<void>;
  rescheduleMacroAttempt(macroType: 'Z' | 'X'): void;
  toggleNumberInput(key: string): void;
  handleNumberInput(event: KeyboardEvent): void;
  updateNumberDisplay(text: string): void;
  resetNumberTimeout(): void;
  exitNumberInput(): void;
  handleShortcuts(key: string, event: KeyboardEvent): Promise<void>;
  handleKeydown(event: KeyboardEvent): Promise<void>;
}

// =================================================================
// Constants (상수)
// =================================================================

const COMMON_FETCH_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

const Events: EventsModuleType = {
  storage: null,
  posts: null,
  ui: null,
  gallery: null,
  favoritesStore: null,
  settingsStore: null,
  uiStore: null,

  _listenersAttached: false,
  _isAltPressed: false,
  isPageLoading: false,
  _currentTabId: null,
  _macroTimeouts: { Z: null, X: null },
  numberInput: {
    mode: false,
    buffer: '',
    timeout: null,
    display: null,
  },

  setup(
    storageInstance,
    postsInstance,
    uiInstance,
    galleryInstance,
    favStore,
    settStore,
    uiStoreInstance
  ) {
    this.storage = storageInstance;
    this.posts = postsInstance;
    this.ui = uiInstance;
    this.gallery = galleryInstance;
    this.favoritesStore = favStore;
    this.settingsStore = settStore;
    this.uiStore = uiStoreInstance;
    this._setupEventListeners();
  },

  _setupEventListeners() {
    if (this._listenersAttached) return;
    // 이제 this.handleKeydown이 EventsModuleType에 존재함을 TypeScript가 알고 있으므로 에러가 발생하지 않습니다.
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
  },

  handleKeyup(event: KeyboardEvent): void {
    if (event.key === 'Alt') {
      this._isAltPressed = false;
      if (this.settingsStore?.favoritesPreviewEnabled) {
        this.uiStore?.hideFavoritesPreview();
      }
    }
  },

  handleWindowBlur(): void {
    if (this._isAltPressed) {
      this._isAltPressed = false;
      if (this.settingsStore?.favoritesPreviewEnabled) {
        this.uiStore?.hideFavoritesPreview();
      }
    }
  },

  handleWindowFocus() {
    // 창에 포커스가 돌아왔을 때, _isAltPressed 상태가 비정상적으로 남아있다면 초기화합니다.
    // (대부분의 경우 keyup 이벤트가 처리하지만, 만약을 위한 안전장치)
    if (this._isAltPressed) {
      this._isAltPressed = false;
      if (this.settingsStore?.favoritesPreviewEnabled) {
        this.uiStore?.hideFavoritesPreview();
      }
    }
  },

  async getMacroStateFromBackground(): Promise<MacroState> {
    const defaultState: MacroState = {
      zRunning: false,
      xRunning: false,
      zTabId: null,
      xTabId: null,
    };
    try {
      const response = (await chrome.runtime.sendMessage({
        action: 'getMacroState',
      })) as MacroStateResponse;
      if (response?.success) {
        return {
          zRunning: response.zRunning,
          xRunning: response.xRunning,
          zTabId: response.zTabId,
          xTabId: response.xTabId,
        };
      }
      return defaultState;
    } catch (error) {
      return defaultState;
    }
  },

  async getCurrentTabId(): Promise<number | null> {
    if (this._currentTabId) return this._currentTabId;
    try {
      const response = (await chrome.runtime.sendMessage({
        action: 'getMyTabId',
      })) as TabIdResponse;
      if (response?.success) {
        this._currentTabId = response.tabId;
        return response.tabId;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  handleStopMacroCommand(macroType: 'Z' | 'X', reason: string | null = null): void {
    const timeoutId = this._macroTimeouts[macroType];
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    this._macroTimeouts[macroType] = null;
    const alertMessage = reason ?? `${macroType} 매크로가 중지되었습니다.`;
    this.ui?.showAlert(alertMessage);
  },

  async triggerMacroNavigation(): Promise<void> {
    if (!this.storage || !this.ui || !this.posts || !this.settingsStore) return;

    const macroState = await this.getMacroStateFromBackground();
    const currentInterval = this.settingsStore.macroInterval;
    const myTabId = await this.getCurrentTabId();

    if (!myTabId) return;

    const processMacro = async (type: 'Z' | 'X'): Promise<void> => {
      const isRunning = type === 'Z' ? macroState.zRunning : macroState.xRunning;
      const targetTabId = type === 'Z' ? macroState.zTabId : macroState.xTabId;
      const isUiEnabled =
        type === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
      const navigateFn = type === 'Z' ? this.navigatePrevPost : this.navigateNextPost;
      const alertText = type === 'Z' ? '자동 다음 글' : '자동 이전 글';

      if (isRunning && myTabId === targetTabId && isUiEnabled) {
        this.ui!.showAlert(`${alertText} (${currentInterval / 1000}초 후)`, 500);
        const currentTimeout = this._macroTimeouts[type];
        if (currentTimeout !== null) clearTimeout(currentTimeout);

        this._macroTimeouts[type] = window.setTimeout(async () => {
          this._macroTimeouts[type] = null;
          const latestState = await this.getMacroStateFromBackground();
          const latestTabId = await this.getCurrentTabId();
          const latestUiEnabled =
            type === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
          const latestIsRunning = type === 'Z' ? latestState.zRunning : latestState.xRunning;
          if (latestIsRunning && latestTabId === targetTabId && latestUiEnabled) {
            await navigateFn.call(this);
          }
        }, currentInterval);
      }
    };

    if (macroState.zRunning && myTabId === macroState.zTabId) {
      await processMacro('Z');
    } else if (macroState.xRunning && myTabId === macroState.xTabId) {
      await processMacro('X');
    }
  },

  // --- 이하 모든 헬퍼 및 핸들러 함수들은 원본 로직을 100% 보존 ---

  findPaginationLink(direction: 'prev' | 'next' = 'next'): HTMLAnchorElement | null {
    let targetLinkElement: Element | null = null;
    let targetPagingBox: Element | null = null;
    const exceptionPagingWrap = document.querySelector(
      '.bottom_paging_wrap.re, .bottom_paging_wrapre'
    );
    if (exceptionPagingWrap) {
      targetPagingBox = exceptionPagingWrap.querySelector('.bottom_paging_box');
    } else {
      const normalPagingWraps = document.querySelectorAll('.bottom_paging_wrap');
      if (normalPagingWraps.length > 1) {
        targetPagingBox = normalPagingWraps[1]?.querySelector('.bottom_paging_box');
      } else if (normalPagingWraps.length === 1) {
        targetPagingBox = normalPagingWraps[0]?.querySelector('.bottom_paging_box');
      }
    }
    if (targetPagingBox) {
      const currentPageElement = targetPagingBox.querySelector('em');
      if (direction === 'prev') {
        if (currentPageElement) {
          const prevSibling = currentPageElement.previousElementSibling;
          if (prevSibling?.tagName === 'A' && prevSibling.hasAttribute('href')) {
            targetLinkElement = prevSibling;
          }
        } else {
          targetLinkElement = targetPagingBox.querySelector('a.search_prev[href]');
        }
      } else {
        // 'next'
        if (currentPageElement) {
          const nextSibling = currentPageElement.nextElementSibling;
          if (nextSibling?.tagName === 'A' && nextSibling.hasAttribute('href')) {
            targetLinkElement = nextSibling;
          }
        } else {
          targetLinkElement = targetPagingBox.querySelector('a.search_next[href]');
        }
      }
    }
    return (
      targetLinkElement?.hasAttribute('href') ? targetLinkElement : null
    ) as HTMLAnchorElement | null;
  },

  async fetchPage(url: string): Promise<FetchedPage> {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        redirect: 'follow',
        headers: COMMON_FETCH_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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
      const currentProfileName = this.favoritesStore.activeProfileName;
      const profileNames = Object.keys(profiles);
      if (profileNames.length <= 1) {
        this.ui.showAlert('전환할 다른 프로필이 없습니다.');
        return;
      }
      const currentIndex = profileNames.indexOf(currentProfileName);
      let nextIndex;
      if (direction === 'next') {
        nextIndex = (currentIndex + 1) % profileNames.length;
      } else {
        nextIndex = (currentIndex - 1 + profileNames.length) % profileNames.length;
      }
      const nextProfileName = profileNames[nextIndex];
      await this.favoritesStore.switchProfile(nextProfileName);
      this.ui.showAlert(`프로필: ${nextProfileName}`);
    } catch (error) {
      this.ui.showAlert('프로필 전환 중 오류가 발생했습니다.');
    }
  },

  getLastValidPostLink(doc: Document, baseURI: string): string | null {
    if (!this.posts) return null;
    const galleryListWrap = doc.querySelector('.gall_listwrap');
    if (!galleryListWrap) return null;
    const rows = Array.from(galleryListWrap.querySelectorAll('tbody tr'));
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (
        this.posts.isValidPost(
          row.querySelector('td.gall_num') as HTMLElement,
          row.querySelector('td.gall_tit') as HTMLElement,
          row.querySelector('td.gall_subject') as HTMLElement
        )
      ) {
        const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
        if (link?.href) {
          try {
            return new URL(link.getAttribute('href')!, baseURI).href;
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  },

  getFirstValidPostLink(doc: Document, baseURI: string): string | null {
    if (!this.posts) return null;
    const galleryListWrap = doc.querySelector('.gall_listwrap');
    if (!galleryListWrap) return null;
    const rows = Array.from(doc.querySelectorAll('tbody tr'));
    for (const row of rows) {
      if (
        this.posts.isValidPost(
          row.querySelector('td.gall_num') as HTMLElement,
          row.querySelector('td.gall_tit') as HTMLElement,
          row.querySelector('td.gall_subject') as HTMLElement
        )
      ) {
        const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
        if (link?.href) {
          try {
            return new URL(link.getAttribute('href')!, baseURI).href;
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  },

  getValidPostsFromDoc(doc: Document, baseURI: string): ValidPostFromDoc[] {
    if (!this.posts) return [];
    return Array.from(doc.querySelectorAll('table.gall_list tbody tr'))
      .map((row) => {
        const numCell = row.querySelector('td.gall_num') as HTMLElement;
        const titleCell = row.querySelector('td.gall_tit') as HTMLElement;
        if (
          this.posts!.isValidPost(
            numCell,
            titleCell,
            row.querySelector('td.gall_subject') as HTMLElement
          )
        ) {
          const numText = numCell.textContent!.trim().replace(/\[.*?\]\s*/, '');
          const num = parseInt(numText, 10);
          const linkElement = titleCell.querySelector<HTMLAnchorElement>('a:first-child');
          let link: string | null = null;
          if (linkElement?.href) {
            try {
              link = new URL(linkElement.getAttribute('href')!, baseURI).href;
            } catch (e) {
              /* ignore */
            }
          }
          return !isNaN(num) && link ? { num, link } : null;
        }
        return null;
      })
      .filter((p): p is ValidPostFromDoc => p !== null);
  },

  async loadPageContentAjax(targetLinkUrl: string): Promise<void> {
    if (this.isPageLoading) return;
    if (!this.ui || !this.posts) {
      window.location.href = targetLinkUrl;
      return;
    }

    this.isPageLoading = true;
    window.AutoRefresher?.stop();
    this.ui.showAlert('로딩 중...');

    try {
      const { doc } = await this.fetchPage(targetLinkUrl);
      const currentTbodies = document.querySelectorAll('table.gall_list tbody');
      const newTbodies = doc.querySelectorAll('table.gall_list tbody');

      let currentPagingWrap = document.querySelector(
        '.bottom_paging_wrap.re, .bottom_paging_wrapre'
      );
      if (!currentPagingWrap) {
        const currentNormalWraps = document.querySelectorAll('.bottom_paging_wrap');
        if (currentNormalWraps.length > 1) currentPagingWrap = currentNormalWraps[1];
        else if (currentNormalWraps.length === 1) currentPagingWrap = currentNormalWraps[0];
      }

      let newPagingWrap = doc.querySelector('.bottom_paging_wrap.re, .bottom_paging_wrapre');
      if (!newPagingWrap) {
        const newNormalWraps = doc.querySelectorAll('.bottom_paging_wrap');
        if (newNormalWraps.length > 1) newPagingWrap = newNormalWraps[1];
        else if (newNormalWraps.length === 1) newPagingWrap = newNormalWraps[0];
      }

      if (currentTbodies.length > 0) {
        currentTbodies.forEach((tbody, index) => {
          tbody.innerHTML = newTbodies[index] ? newTbodies[index].innerHTML : '';
        });
      } else if (newTbodies.length > 0) {
        console.error('Cannot dynamically add new tbody to a page without one.');
      }

      if (currentPagingWrap) {
        currentPagingWrap.innerHTML = newPagingWrap ? newPagingWrap.innerHTML : '';
      } else if (newPagingWrap) {
        console.warn('Cannot insert new pagination dynamically.');
      }

      this.posts.adjustColgroupWidths();
      this.posts.addNumberLabels();
      this.posts.formatDates();
      addPrefetchHints();

      try {
        const targetUrlObj = new URL(targetLinkUrl);
        const currentUrl = new URL(window.location.href);
        ['page', 'search_pos', 's_type', 's_keyword', 'exception_mode'].forEach((param) => {
          const value = targetUrlObj.searchParams.get(param);
          if (value) {
            currentUrl.searchParams.set(param, value);
          } else {
            currentUrl.searchParams.delete(param);
          }
        });
        history.pushState(null, '', currentUrl.toString());
      } catch (urlError) {
        console.error('Error updating URL after AJAX:', urlError);
      }

      currentTbodies[0]
        ?.closest('table.gall_list')
        ?.scrollIntoView({ behavior: 'auto', block: 'start' });
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

  async navigatePrevPost(): Promise<void> {
    // Z 키 (다음 글)
    if (!this.posts || !this.ui) return;
    let currentUrl: URL, currentPostNo: number;
    try {
      currentUrl = new URL(window.location.href);
      const noStr = currentUrl.searchParams.get('no');
      if (!noStr) {
        this.ui.showAlert('현재 글 번호를 URL에서 찾을 수 없습니다.');
        return;
      }
      currentPostNo = parseInt(noStr, 10);
      if (isNaN(currentPostNo)) {
        this.ui.showAlert('URL의 글 번호가 유효하지 않습니다.');
        return;
      }
    } catch (e) {
      this.ui.showAlert('현재 URL을 처리할 수 없습니다.');
      return;
    }

    const crtIcon = document.querySelector('td.gall_num .sp_img.crt_icon');
    let isPageBoundary = false,
      shouldUseHeadFallback = false;
    if (!currentUrl.searchParams.has('s_keyword')) {
      const { currentIndex } = this.posts.getValidPosts();
      if (currentIndex === 0) isPageBoundary = true;
      if (isPageBoundary || !crtIcon) {
        if (!crtIcon) shouldUseHeadFallback = true;
      }
    }

    if (shouldUseHeadFallback) {
      let foundUrl: string | null = null;
      for (let i = 1; i <= 5; i++) {
        const targetPostNo = currentPostNo + i;
        const targetUrl = new URL(currentUrl);
        targetUrl.searchParams.set('no', targetPostNo.toString());
        const urlString = targetUrl.toString();
        if (await this.checkUrlExists(urlString)) {
          foundUrl = urlString;
          break;
        }
      }
      if (foundUrl) {
        window.location.href = foundUrl;
      } else {
        this.ui.showAlert('근처에서 다음 글을 찾지 못했습니다.');
        this.rescheduleMacroAttempt('Z');
      }
      return;
    }

    if (!crtIcon) {
      this.ui.showAlert('글 이동 중 오류 발생 (내부 상태 불일치)');
      this.rescheduleMacroAttempt('Z');
      return;
    }

    let row = crtIcon.closest('tr')?.previousElementSibling;
    while (row) {
      if (
        this.posts.isValidPost(
          row.querySelector('td.gall_num') as HTMLElement,
          row.querySelector('td.gall_tit') as HTMLElement,
          row.querySelector('td.gall_subject') as HTMLElement
        )
      ) {
        const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
        if (link?.href) {
          window.location.href = link.href;
          return;
        }
      }
      row = row.previousElementSibling;
    }

    const prevPageLinkElement = this.findPaginationLink('prev');
    if (prevPageLinkElement?.href) {
      const prevPageUrl = prevPageLinkElement.href;
      const isPrevSearchLink = prevPageLinkElement.classList.contains('search_prev');
      if (isPrevSearchLink) {
        try {
          const prevSearchBlockFirstPageUrl = new URL(prevPageUrl);
          const { doc: doc1, baseURI: baseURI1 } = await this.fetchPage(
            prevSearchBlockFirstPageUrl.toString()
          );
          const allPagingBoxes1 = doc1.querySelectorAll('.bottom_paging_wrap .bottom_paging_box');
          let pagingBox1 = allPagingBoxes1.length > 1 ? allPagingBoxes1[1] : allPagingBoxes1[0];
          if (!pagingBox1)
            throw new Error('Could not find pagination box on page 1 of prev search block.');
          let lastPageNum = 1;
          const nextSearchLink1 = pagingBox1.querySelector('a.search_next');
          if (nextSearchLink1) {
            const lastPageLinkElement = nextSearchLink1.previousElementSibling;
            if (
              lastPageLinkElement?.tagName === 'A' &&
              (lastPageLinkElement as HTMLAnchorElement).href
            ) {
              const pageNumStr = new URL(
                (lastPageLinkElement as HTMLAnchorElement).href,
                baseURI1
              ).searchParams.get('page');
              if (pageNumStr) lastPageNum = parseInt(pageNumStr, 10);
            }
          } else {
            const pageLinks = pagingBox1.querySelectorAll('a:not(.search_prev):not(.search_next)');
            if (pageLinks.length > 0) {
              const lastLink = pageLinks[pageLinks.length - 1];
              if ((lastLink as HTMLAnchorElement)?.href) {
                const pageNumStr = new URL(
                  (lastLink as HTMLAnchorElement).href,
                  baseURI1
                ).searchParams.get('page');
                if (pageNumStr) lastPageNum = parseInt(pageNumStr, 10);
              }
            } else if (pagingBox1.querySelector('em')?.textContent === '1') {
              lastPageNum = 1;
            }
          }
          const prevSearchBlockLastPageUrl = new URL(prevSearchBlockFirstPageUrl);
          prevSearchBlockLastPageUrl.searchParams.set('page', lastPageNum.toString());
          const { doc: doc2, baseURI: baseURI2 } = await this.fetchPage(
            prevSearchBlockLastPageUrl.toString()
          );
          const finalPostLinkHref = this.getLastValidPostLink(doc2, baseURI2);
          if (finalPostLinkHref) {
            const targetPostUrl = new URL(finalPostLinkHref);
            const targetNo = targetPostUrl.searchParams.get('no');
            if (targetNo) {
              const currentNavUrl = new URL(window.location.href);
              currentNavUrl.searchParams.set('no', targetNo);
              currentNavUrl.searchParams.set('page', lastPageNum.toString());
              const targetSearchPos = prevSearchBlockFirstPageUrl.searchParams.get('search_pos');
              if (targetSearchPos) currentNavUrl.searchParams.set('search_pos', targetSearchPos);
              else currentNavUrl.searchParams.delete('search_pos');
              window.location.href = currentNavUrl.toString();
            } else {
              throw new Error("Could not extract 'no' from final post link.");
            }
          } else {
            throw new Error(
              'Could not find the last valid post on the last page of the previous search block.'
            );
          }
        } catch (error) {
          this.ui.showAlert('"다음검색" 블록 이동 중 오류');
          this.rescheduleMacroAttempt('Z');
        }
      } else {
        try {
          const { doc, baseURI } = await this.fetchPage(prevPageUrl);
          const validPostsOnPrevPage = this.getValidPostsFromDoc(doc, baseURI);
          if (validPostsOnPrevPage && validPostsOnPrevPage.length > 0) {
            const potentialPrevPosts = validPostsOnPrevPage.filter((p) => p.num > currentPostNo);
            if (potentialPrevPosts.length > 0) {
              potentialPrevPosts.sort((a, b) => a.num - b.num);
              const targetPost = potentialPrevPosts[0];
              if (targetPost?.link && targetPost.num > 0) {
                const targetLinkUrl = new URL(targetPost.link);
                const targetNo = targetLinkUrl.searchParams.get('no');
                if (targetNo && parseInt(targetNo, 10) === targetPost.num) {
                  const currentNavUrl = new URL(window.location.href);
                  currentNavUrl.searchParams.set('no', targetNo);
                  const prevPageListUrl = new URL(prevPageUrl);
                  const targetPage = prevPageListUrl.searchParams.get('page');
                  const targetSearchPos = prevPageListUrl.searchParams.get('search_pos');
                  if (targetPage) currentNavUrl.searchParams.set('page', targetPage);
                  else currentNavUrl.searchParams.delete('page');
                  if (targetSearchPos)
                    currentNavUrl.searchParams.set('search_pos', targetSearchPos);
                  else currentNavUrl.searchParams.delete('search_pos');
                  window.location.href = currentNavUrl.toString();
                } else {
                  this.ui.showAlert('다음 글 정보 처리 중 오류 (번호 불일치)');
                  this.rescheduleMacroAttempt('Z');
                }
              } else {
                this.ui.showAlert('다음 글 정보 처리 중 오류 (링크/번호 없음)');
                this.rescheduleMacroAttempt('Z');
              }
            } else {
              this.ui.showAlert('다음 페이지에 (현재 글보다 다음인) 게시글이 없습니다.');
              this.rescheduleMacroAttempt('Z');
            }
          } else {
            this.ui.showAlert('다음 페이지에 표시할 게시글이 없습니다.');
            this.rescheduleMacroAttempt('Z');
          }
        } catch (error) {
          this.rescheduleMacroAttempt('Z');
        }
      }
    } else {
      try {
        const currentNavUrl = new URL(window.location.href);
        const currentPostNoStr = currentNavUrl.searchParams.get('no');
        if (!currentPostNoStr) {
          this.ui.showAlert('현재 글 번호 오류');
          return;
        }
        const localCurrentPostNo = parseInt(currentPostNoStr, 10);
        if (isNaN(localCurrentPostNo)) {
          this.ui.showAlert('현재 글 번호 오류');
          return;
        }
        const listUrl = new URL(window.location.href);
        listUrl.pathname = listUrl.pathname.replace(/(\/board)\/view\/?/, '$1/lists/');
        listUrl.searchParams.set('page', '1');
        listUrl.searchParams.delete('no');
        this.ui.showAlert('최신 글 확인 중...');
        const { doc, baseURI } = await this.fetchPage(listUrl.toString());
        const allPostsOnPage1 = this.getValidPostsFromDoc(doc, baseURI);
        const newerPosts = allPostsOnPage1.filter((p) => p.num > localCurrentPostNo);
        if (newerPosts.length > 0) {
          const newestPost = newerPosts.sort((a, b) => b.num - a.num)[0];
          if (newestPost?.link) {
            this.ui.showAlert('새로운 글을 발견하여 이동합니다.');
            const targetViewUrl = new URL(newestPost.link);
            targetViewUrl.searchParams.set('page', '1');
            const currentSearchParams = new URLSearchParams(window.location.search);
            ['exception_mode', 'search_pos', 's_type', 's_keyword'].forEach((param) => {
              if (currentSearchParams.has(param))
                targetViewUrl.searchParams.set(param, currentSearchParams.get(param)!);
            });
            window.location.href = targetViewUrl.toString();
          } else {
            this.ui.showAlert('첫 게시글입니다. (새 글 링크 오류)');
            this.rescheduleMacroAttempt('Z');
          }
        } else {
          this.ui.showAlert('첫 게시글입니다.');
          this.rescheduleMacroAttempt('Z');
        }
      } catch (error) {
        this.rescheduleMacroAttempt('Z');
      }
    }
  },

  async navigateNextPost(): Promise<void> {
    // X 키 (이전 글)
    if (!this.posts || !this.ui) return;
    let currentUrl: URL, currentPostNo: number;
    try {
      currentUrl = new URL(window.location.href);
      const noStr = currentUrl.searchParams.get('no');
      if (!noStr) {
        this.ui.showAlert('현재 글 번호를 URL에서 찾을 수 없습니다.');
        return;
      }
      currentPostNo = parseInt(noStr, 10);
      if (isNaN(currentPostNo)) {
        this.ui.showAlert('URL의 글 번호가 유효하지 않습니다.');
        return;
      }
    } catch (e) {
      this.ui.showAlert('현재 URL을 처리할 수 없습니다.');
      return;
    }

    const crtIcon = document.querySelector('td.gall_num .sp_img.crt_icon');
    let isPageBoundary = false,
      shouldUseHeadFallback = false;
    if (!currentUrl.searchParams.has('s_keyword')) {
      const { validPosts, currentIndex } = this.posts.getValidPosts();
      if (validPosts.length > 0 && currentIndex === validPosts.length - 1) isPageBoundary = true;
      if (isPageBoundary || !crtIcon) {
        if (!crtIcon) shouldUseHeadFallback = true;
      }
    }

    if (shouldUseHeadFallback) {
      let foundUrl: string | null = null;
      for (let i = 1; i <= 5; i++) {
        const targetPostNo = currentPostNo - i;
        if (targetPostNo <= 0) break;
        const targetUrl = new URL(currentUrl);
        targetUrl.searchParams.set('no', targetPostNo.toString());
        const urlString = targetUrl.toString();
        if (await this.checkUrlExists(urlString)) {
          foundUrl = urlString;
          break;
        }
      }
      if (foundUrl) {
        window.location.href = foundUrl;
      } else {
        this.ui.showAlert('근처에서 이전 글을 찾지 못했습니다.');
        this.rescheduleMacroAttempt('X');
      }
      return;
    }

    if (!crtIcon) {
      this.ui.showAlert('글 이동 중 오류 발생 (내부 상태 불일치)');
      this.rescheduleMacroAttempt('X');
      return;
    }

    let row = crtIcon.closest('tr')?.nextElementSibling;
    while (row) {
      if (
        this.posts.isValidPost(
          row.querySelector('td.gall_num') as HTMLElement,
          row.querySelector('td.gall_tit') as HTMLElement,
          row.querySelector('td.gall_subject') as HTMLElement
        )
      ) {
        const link = row.querySelector<HTMLAnchorElement>('td.gall_tit a:first-child');
        if (link?.href) {
          window.location.href = link.href;
          return;
        }
      }
      row = row.nextElementSibling;
    }

    const nextPageLinkElement = this.findPaginationLink('next');
    if (nextPageLinkElement?.href) {
      const nextPageUrl = nextPageLinkElement.href;
      try {
        const { doc, baseURI } = await this.fetchPage(nextPageUrl);
        const validPostsOnNextPage = this.getValidPostsFromDoc(doc, baseURI);
        if (validPostsOnNextPage && validPostsOnNextPage.length > 0) {
          const potentialNextPosts = validPostsOnNextPage.filter((p) => p.num < currentPostNo);
          if (potentialNextPosts.length > 0) {
            potentialNextPosts.sort((a, b) => b.num - a.num);
            const targetPost = potentialNextPosts[0];
            if (targetPost?.link && targetPost.num > 0) {
              const targetLinkUrl = new URL(targetPost.link);
              const targetNo = targetLinkUrl.searchParams.get('no');
              if (targetNo && parseInt(targetNo, 10) === targetPost.num) {
                const currentNavUrl = new URL(window.location.href);
                currentNavUrl.searchParams.set('no', targetNo);
                const nextPageListUrl = new URL(nextPageUrl);
                const targetPage = nextPageListUrl.searchParams.get('page');
                const targetSearchPos = nextPageListUrl.searchParams.get('search_pos');
                if (targetPage) currentNavUrl.searchParams.set('page', targetPage);
                else currentNavUrl.searchParams.delete('page');
                if (targetSearchPos) currentNavUrl.searchParams.set('search_pos', targetSearchPos);
                else currentNavUrl.searchParams.delete('search_pos');
                window.location.href = currentNavUrl.toString();
              } else {
                this.ui.showAlert('이전 글 정보 처리 중 오류 (번호 불일치)');
                this.rescheduleMacroAttempt('X');
              }
            } else {
              this.ui.showAlert('이전 글 정보 처리 중 오류 (링크/번호 없음)');
              this.rescheduleMacroAttempt('X');
            }
          } else {
            this.ui.showAlert('이전 페이지에 (현재 글보다 이전인) 게시글이 없습니다.');
            this.rescheduleMacroAttempt('X');
          }
        } else {
          this.ui.showAlert('이전 페이지에 표시할 게시글이 없습니다.');
          this.rescheduleMacroAttempt('X');
        }
      } catch (error) {
        this.rescheduleMacroAttempt('X');
      }
    } else {
      this.ui.showAlert('마지막 게시글입니다.');
      this.rescheduleMacroAttempt('X');
    }
  },

  async handleShortcuts(key, event) {
    if (!this.settingsStore || !this.ui || !this.posts || !this.gallery) return;

    const isViewMode = window.location.pathname.includes('/board/view/');
    const baseListUrl = this.gallery.getBaseListUrl();
    const recommendListUrl = this.gallery.getRecommendListUrl();

    let actionForPressedKey: string | null = null;
    for (const action in this.settingsStore.defaultShortcutKeys) {
      const assignedKey =
        this.settingsStore.shortcutKeys[`shortcut${action}Key`] ||
        this.settingsStore.defaultShortcutKeys[
          action as keyof typeof this.settingsStore.defaultShortcutKeys
        ];
      if (assignedKey.toUpperCase() === key.toUpperCase()) {
        actionForPressedKey = action;
        break;
      }
    }

    if (
      window.location.hostname === 'search.dcinside.com' &&
      (actionForPressedKey === 'A' || actionForPressedKey === 'S')
    ) {
      const currentUrl = new URL(window.location.href);
      const pathParts = currentUrl.pathname.split('/').filter((p) => p);
      let sortOrder = currentUrl.pathname.includes('/sort/accuracy') ? 'accuracy' : 'latest';
      let currentPage = 1;
      if (pathParts[0] === 'post' && pathParts[1] === 'p') {
        currentPage = parseInt(pathParts[2], 10);
      }
      const query = pathParts[pathParts.length - 1];
      if (actionForPressedKey === 'A') {
        if (currentPage <= 1) {
          this.ui.showAlert('첫 페이지입니다.');
          return;
        }
        window.location.href = `https://search.dcinside.com/post/p/${currentPage - 1}/sort/${sortOrder}/q/${query}`;
      } else {
        const currentPageElement = document.querySelector('div.bottom_paging_box em');
        if (currentPageElement && !currentPageElement.nextElementSibling) {
          this.ui.showAlert('마지막 페이지입니다.');
          return;
        }
        window.location.href = `https://search.dcinside.com/post/p/${currentPage + 1}/sort/${sortOrder}/q/${query}`;
      }
      return;
    }

    switch (actionForPressedKey) {
      case 'W':
        document.querySelector<HTMLButtonElement>('button#btn_write.write')?.click();
        break;
      case 'C':
        event.preventDefault();
        document.querySelector<HTMLTextAreaElement>('textarea[id^="memo_"]')?.focus();
        break;
      case 'D':
        if (this.settingsStore.shortcutDRefreshCommentEnabled)
          document.querySelector<HTMLButtonElement>('button.btn_cmt_refresh')?.click();
        document
          .querySelector('.comment_count')
          ?.scrollIntoView({ behavior: 'auto', block: 'center' });
        break;
      case 'R':
        location.reload();
        break;
      case 'Q':
        window.scrollTo({ top: 0, behavior: 'auto' });
        break;
      case 'E':
        document
          .querySelector('table.gall_list, .gall_listwrap')
          ?.scrollIntoView({ behavior: 'auto', block: 'start' });
        break;
      case 'F':
        if (baseListUrl) window.location.href = baseListUrl;
        break;
      case 'G':
        if (recommendListUrl) window.location.href = recommendListUrl;
        break;
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
      case 'Z':
        await this.navigatePrevPost();
        break;
      case 'X':
        await this.navigateNextPost();
        break;
      case 'PrevProfile':
        await this.cycleProfile('prev');
        break;
      case 'NextProfile':
        await this.cycleProfile('next');
        break;
    }
  },

  // [추가] 누락되었던 handleKeydown 함수
  async handleKeydown(event) {
    if (
      !this.favoritesStore ||
      !this.settingsStore ||
      !this.uiStore ||
      !this.posts ||
      !this.ui ||
      !this.gallery
    )
      return;

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

      // 1. 먼저 어떤 동작에 해당하는 키인지 확인합니다.
      let targetAction: string | null = null;
      const prevProfileKey = (keys.shortcutPrevProfileKey || defaults.PrevProfile).toUpperCase();
      const nextProfileKey = (keys.shortcutNextProfileKey || defaults.NextProfile).toUpperCase();
      const submitCommentKey = (
        keys.shortcutSubmitCommentKey || defaults.SubmitComment
      ).toUpperCase();
      const submitImagePostKey = (
        keys.shortcutSubmitImagePostKey || defaults.SubmitImagePost
      ).toUpperCase();
      const toggleModalKey = (keys.shortcutToggleModalKey || defaults.ToggleModal).toUpperCase();

      if (keyUpper === prevProfileKey) {
        targetAction = 'PrevProfile';
      } else if (keyUpper === nextProfileKey) {
        targetAction = 'NextProfile';
      } else if (event.key >= '0' && event.key <= '9' && this.settingsStore.altNumberEnabled) {
        targetAction = 'FavoriteNumber';
      } else if (
        keyUpper === submitCommentKey &&
        this.settingsStore.shortcutSubmitCommentKeyEnabled
      ) {
        targetAction = 'SubmitComment';
      } else if (
        keyUpper === submitImagePostKey &&
        this.settingsStore.shortcutSubmitImagePostKeyEnabled
      ) {
        targetAction = 'SubmitImagePost';
      } else if (keyUpper === toggleModalKey && this.settingsStore.shortcutToggleModalKeyEnabled) {
        targetAction = 'ToggleModal';
      }

      // 2. 스크립트가 처리해야 할 단축키(targetAction이 확인된 경우)에만 기본 동작을 막습니다.
      if (targetAction) {
        event.preventDefault();
        event.stopPropagation();

        // 3. 확인된 동작을 실행합니다.
        switch (targetAction) {
          case 'PrevProfile':
            if (this.settingsStore.favoritesPreviewEnabled && this._isAltPressed) {
              await this.cycleProfile('prev');
            }
            break;
          case 'NextProfile':
            if (this.settingsStore.favoritesPreviewEnabled && this._isAltPressed) {
              await this.cycleProfile('next');
            }
            break;
          case 'FavoriteNumber':
            await this.gallery.handleFavoriteKey(event.key, this.favoritesStore);
            break;
          case 'SubmitComment':
            document.querySelector<HTMLButtonElement>('button.btn_svc.repley_add')?.click();
            break;
          case 'SubmitImagePost':
            document
              .querySelector<HTMLButtonElement>('button.btn_svc.write[type="image"]')
              ?.click();
            break;
          case 'ToggleModal':
            this.uiStore.activeModal === 'shortcuts'
              ? this.uiStore.closeModal()
              : this.uiStore.toggleFavorites();
            break;
        }
      }
      return;
    }

    if (!event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'INPUT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
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
        const assignedKey = (
          this.settingsStore.shortcutKeys[`shortcut${action}Key`] ||
          this.settingsStore.defaultShortcutKeys[
            action as keyof typeof this.settingsStore.defaultShortcutKeys
          ]
        ).toUpperCase();
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

  rescheduleMacroAttempt(macroType: 'Z' | 'X'): void {
    const navigateFn = macroType === 'Z' ? this.navigatePrevPost : this.navigateNextPost;
    if (!this.settingsStore) return;
    const currentInterval = this.settingsStore.macroInterval;
    const currentTimeout = this._macroTimeouts[macroType];
    if (currentTimeout !== null) clearTimeout(currentTimeout);
    this._macroTimeouts[macroType] = window.setTimeout(async () => {
      this._macroTimeouts[macroType] = null;
      const state = await this.getMacroStateFromBackground();
      const tabId = await this.getCurrentTabId();
      const uiEnabled =
        macroType === 'Z' ? this.settingsStore!.macroZEnabled : this.settingsStore!.macroXEnabled;
      const shouldRun =
        (macroType === 'Z' && state.zRunning && tabId === state.zTabId && uiEnabled) ||
        (macroType === 'X' && state.xRunning && tabId === state.xTabId && uiEnabled);
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
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '5px',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: '10001',
        fontFamily: 'monospace',
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
