import UI from './UI';
import Gallery from './Gallery';
import { useSettingsStore } from '@/stores/settingsStore';
import type Posts from './Posts';
import type Events from './Events';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

type SettingsStore = ReturnType<typeof useSettingsStore>;
type PostsModule = typeof Posts;
type EventsModule = typeof Events;

interface ReplyData {
    html: string | null;
    countText: string | null;
}

// =================================================================
// AutoRefresher Module (자동 새로고침 모듈)
// =================================================================

const AutoRefresher = {
    // --- State (상태) ---
    timerId: null as number | null,
    settingsStore: null as SettingsStore | null,
    postsModule: null as PostsModule | null,
    eventsModule: null as EventsModule | null,
    originalTitle: document.title,
    newPostCountInTitle: 0,
    abortController: null as AbortController | null,
    generationId: 0,

    /**
     * AutoRefresher 모듈을 초기화합니다.
     */
    init(settingsStore: SettingsStore, postsModule: PostsModule, eventsModule: EventsModule): void {
        this.settingsStore = settingsStore;
        this.postsModule = postsModule;
        this.eventsModule = eventsModule;
        this.originalTitle = document.title;
        console.log('[AutoRefresher] 초기화 완료.');
    },

    /**
     * 자동 새로고침을 시작합니다. (원본 로직 복원)
     */
    start(): void {
        if (this.timerId) return;
        if (!this.settingsStore?.autoRefreshEnabled) return;
    
        this.generationId = Date.now();
        this.abortController = new AbortController();
        this.restoreOriginalTitle();
        
        console.log(`[AutoRefresher] 새 세대(${this.generationId}) 시작. 첫 확인을 예약합니다.`);
        
        // 원본과 동일하게, scheduleNextCheck를 통해 첫 요청을 예약합니다.
        this.scheduleNextCheck(this.generationId);
    },

    /**
     * 자동 새로고침을 중지합니다.
     */
    stop(): void {
        if (this.timerId) {
            console.log('[AutoRefresher] 예약된 확인을 중지합니다.');
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.restoreOriginalTitle();
    },

    /**
     * 다음 새 글 확인을 스케줄링합니다.
     */
    scheduleNextCheck(currentGenerationId: number): void {
        if (currentGenerationId !== this.generationId || !this.settingsStore) return;

        const baseInterval = this.settingsStore.autoRefreshInterval * 1000;
        const jitter = (Math.random() - 0.5) * baseInterval * 0.3;
        const nextInterval = baseInterval + jitter;

        console.log(`[AutoRefresher] 다음 확인까지 약 ${Math.round(nextInterval / 1000)}초 남음.`);

        this.timerId = window.setTimeout(() => {
            this.checkNewPosts(currentGenerationId);
        }, nextInterval);
    },

    /**
     * 페이지 제목을 원래대로 복원합니다.
     */
    restoreOriginalTitle(): void {
        if (document.title !== this.originalTitle) {
            document.title = this.originalTitle;
        }
        this.newPostCountInTitle = 0;
    },

    /**
     * 서버에서 최신 게시글 목록을 가져와 현재 페이지와 비교하고, 변경 사항을 DOM에 적용합니다.
     * (원본 로직을 그대로 유지)
     */
    async checkNewPosts(currentGenerationId: number): Promise<void> {
        if (currentGenerationId !== this.generationId || !this.postsModule || !this.eventsModule) {
            console.warn(`[AutoRefresher] 오래된 세대 작업(${currentGenerationId})이거나 의존성이 없어 중단됩니다.`);
            return;
        }

        const urlAtRequestTime = Gallery.getListUrlForCurrentContext();
        if (!urlAtRequestTime) return;

        const localAbortController = this.abortController;

        try {
            const response = await fetch(urlAtRequestTime, {
                signal: localAbortController!.signal,
                credentials: 'include',
                redirect: 'follow',
                headers: {
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
                }
            });

            const urlAtResponseTime = Gallery.getListUrlForCurrentContext();
            if (currentGenerationId !== this.generationId || urlAtRequestTime !== urlAtResponseTime) {
                return;
            }

            if (this.eventsModule.isPageLoading) {
                console.warn("[AutoRefresher] 페이지 이동이 감지되어 DOM 수정을 중단합니다.");
                return;
            }

            if (!response.ok) throw new Error(`HTTP 오류! 상태: ${response.status}`);
            const text = await response.text();
            const parser = new DOMParser();
            const fetchedDoc = parser.parseFromString(text, 'text/html');

            const fetchedReplyData = new Map<string, ReplyData>();
            fetchedDoc.querySelectorAll('table.gall_list tbody tr').forEach(row => {
                const numCell = row.querySelector('td.gall_num');
                const titleCell = row.querySelector('td.gall_tit');
                if (!numCell || !titleCell) return;
                const postNo = numCell.textContent?.trim().replace(/\[.*?\]\s*/, '') ?? '';
                if (!postNo || isNaN(Number(postNo))) return;
                const replyBox = titleCell.querySelector('a.reply_numbox');
                fetchedReplyData.set(postNo, {
                    html: replyBox ? replyBox.outerHTML : null,
                    countText: replyBox ? replyBox.textContent : null,
                });
            });

            const currentTbody = document.querySelector<HTMLTableSectionElement>('table.gall_list tbody');
            if (currentTbody) {
                currentTbody.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
                    const numCell = row.querySelector<HTMLTableCellElement>('td.gall_num');
                    const titleCell = row.querySelector<HTMLTableCellElement>('td.gall_tit');
                    if (!numCell || !titleCell) return;
                    const postNo = numCell.textContent?.trim().replace(/\[.*?\]\s*/, '') ?? '';
                    if (!postNo || isNaN(Number(postNo))) return;
                    if (fetchedReplyData.has(postNo)) {
                        const newData = fetchedReplyData.get(postNo)!;
                        const currentReplyBox = titleCell.querySelector<HTMLAnchorElement>('a.reply_numbox');
                        if (newData.html) {
                            if (currentReplyBox) {
                                if (currentReplyBox.textContent !== newData.countText) {
                                    currentReplyBox.innerHTML = `<span class="reply_num">${newData.countText}</span>`;
                                    currentReplyBox.style.transition = 'none';
                                    currentReplyBox.style.color = '#ff6600';
                                    setTimeout(() => {
                                        currentReplyBox.style.transition = 'color 0.5s ease';
                                        currentReplyBox.style.color = '';
                                    }, 100);
                                }
                            } else {
                                titleCell.insertAdjacentHTML('beforeend', ` ${newData.html}`);
                            }
                        } else {
                            if (currentReplyBox) {
                                currentReplyBox.remove();
                            }
                        }
                    }
                });
            }

            const fetchedTbody = fetchedDoc.querySelector('table.gall_list tbody');
            if (!currentTbody || !fetchedTbody) return;

            let latestPostNumber = 0;
            currentTbody.querySelectorAll('tr').forEach(row => {
                if (this.postsModule!.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                    const numCell = row.querySelector('td.gall_num');
                    if (numCell && !numCell.querySelector('.sp_img.crt_icon')) {
                        const num = parseInt(numCell.textContent?.trim().replace(/\[.*?\]\s*/, '') ?? '0', 10);
                        if (!isNaN(num) && num > latestPostNumber) {
                            latestPostNumber = num;
                        }
                    }
                }
            });

            const currentUrl = new URL(window.location.href);
            if (currentUrl.pathname.includes('/view/')) {
                const postNoFromUrl = parseInt(currentUrl.searchParams.get('no') || '0', 10);
                if (!isNaN(postNoFromUrl) && postNoFromUrl > latestPostNumber) {
                    latestPostNumber = postNoFromUrl;
                }
            }

            const newPostRows: HTMLTableRowElement[] = [];
            fetchedTbody.querySelectorAll('tr').forEach(row => {
                if (this.postsModule!.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                    const num = parseInt(row.querySelector('td.gall_num')!.textContent!.trim().replace(/\[.*?\]\s*/, ''), 10);
                    if (num > latestPostNumber) {
                        newPostRows.push(row as HTMLTableRowElement);
                    }
                }
            });

            if (newPostRows.length > 0) {
                if (!document.hasFocus()) {
                    this.newPostCountInTitle += newPostRows.length;
                    document.title = `(${this.newPostCountInTitle}) ${this.originalTitle}`;
                }
                this.insertAndTrimPosts(currentTbody, newPostRows);
            }

            this.scheduleNextCheck(currentGenerationId);

        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.log(`[AutoRefresher] Fetch (세대: ${currentGenerationId})가 중단되었습니다.`);
                } else if (error.message.includes('Failed to fetch')) {
                    console.warn(`[AutoRefresher] 'Failed to fetch' 오류 발생. 다음 주기에 재시도합니다.`, error);
                    this.scheduleNextCheck(currentGenerationId);
                } else {
                    console.error('[AutoRefresher] 예기치 않은 오류 발생:', error);
                    this.stop();
                    UI.showAlert('새 글 확인 중 오류가 발생하여 자동 새로고침을 중지합니다.');
                }
            } else {
                console.error('[AutoRefresher] 알 수 없는 타입의 오류 발생:', error);
                this.stop();
            }
        }
    },

    /**
     * 새로운 게시글 행들을 테이블 상단에 삽입하고, 오래된 행들을 제거합니다.
     */
    insertAndTrimPosts(targetTbody: HTMLTableSectionElement, newRows: HTMLTableRowElement[]): void {
        if (!this.postsModule) return;

        let firstValidPostRow: Element | null = null;
        for (const row of Array.from(targetTbody.children)) {
            if (this.postsModule.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                firstValidPostRow = row;
                break;
            }
        }

        newRows.reverse().forEach(row => {
            row.classList.add('new-post-highlight');
            targetTbody.insertBefore(row, firstValidPostRow);
        });

        if (document.hasFocus()) {
            const insertedRows = targetTbody.querySelectorAll<HTMLTableRowElement>('.new-post-highlight');
            insertedRows.forEach(row => {
                row.classList.add('highlight-start');
                setTimeout(() => {
                    row.classList.remove('new-post-highlight', 'highlight-start');
                }, 2500);
            });
        }

        const allValidRows: HTMLTableRowElement[] = [];
        targetTbody.querySelectorAll('tr').forEach(row => {
            if (this.postsModule!.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                allValidRows.push(row as HTMLTableRowElement);
            }
        });

        const rowsToRemoveCount = allValidRows.length - 50;
        if (rowsToRemoveCount > 0) {
            const rowsToRemove = allValidRows.slice(-rowsToRemoveCount);
            rowsToRemove.forEach(row => row.remove());
        }

        this.postsModule.addNumberLabels();
        this.postsModule.formatDates();
    }
};

export default AutoRefresher;