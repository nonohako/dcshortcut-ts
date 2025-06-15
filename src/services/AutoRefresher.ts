import UI from './UI';
import Gallery from './Gallery';
import { useSettingsStore } from '@/stores/settingsStore';
import type Posts from './Posts'; // 'Posts' 모듈의 타입을 import

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

/**
 * @description useSettingsStore의 반환 타입을 추론하여 정의합니다.
 */
type SettingsStore = ReturnType<typeof useSettingsStore>;

/**
 * @description Posts 모듈의 타입을 정의합니다.
 */
type PostsModule = typeof Posts;

/**
 * @description Events 모듈의 타입을 정의합니다. (현재 파일에서는 isPageLoading 속성만 사용)
 * 실제 Events 모듈의 구조에 따라 확장될 수 있습니다.
 */
interface EventsModule {
    isPageLoading: boolean;
}

/**
 * @description fetch로 가져온 데이터에서 추출한 댓글 정보를 담는 타입.
 */
interface ReplyData {
    html: string | null;
    countText: string | null;
}


// =================================================================
// AutoRefresher Module (자동 새로고침 모듈)
// =================================================================

const AutoRefresher = {
    // --- State (상태) ---
    /** @description setTimeout의 ID를 저장합니다. 브라우저 환경에서는 number 타입입니다. */
    timerId: null as number | null,
    /** @description 설정 스토어 인스턴스. init()을 통해 주입됩니다. */
    settingsStore: null as SettingsStore | null,
    /** @description Posts 모듈. init()을 통해 주입됩니다. */
    postsModule: null as PostsModule | null,
    /** @description Events 모듈. init()을 통해 주입됩니다. */
    eventsModule: null as EventsModule | null,
    /** @description 페이지의 원래 제목. 제목에 새 글 카운트를 표시한 후 복원할 때 사용됩니다. */
    originalTitle: document.title,
    /** @description 페이지가 비활성 상태일 때 제목에 표시될 새 글의 수. */
    newPostCountInTitle: 0,
    /** @description 현재 진행 중인 fetch 요청을 취소하기 위한 AbortController. */
    abortController: null as AbortController | null,
    /** @description 새로고침 세대를 식별하는 ID. start()가 호출될 때마다 새로 생성되어 레이스 컨디션을 방지합니다. */
    generationId: 0,

    /**
     * AutoRefresher 모듈을 초기화합니다.
     * 필요한 의존성(스토어, 모듈)을 주입받습니다.
     * @param {SettingsStore} settingsStore - 설정 스토어.
     * @param {PostsModule} postsModule - 게시글 관련 모듈.
     * @param {EventsModule} eventsModule - 이벤트 관련 모듈 (페이지 로딩 상태 확인용).
     */
    init(settingsStore: SettingsStore, postsModule: PostsModule, eventsModule: EventsModule): void {
        this.settingsStore = settingsStore;
        this.postsModule = postsModule;
        this.eventsModule = eventsModule;
        this.originalTitle = document.title;
        console.log('[AutoRefresher] 초기화 완료.');
    },

    /**
     * 자동 새로고침을 시작합니다.
     */
    start(): void {
        if (this.timerId || !this.settingsStore?.autoRefreshEnabled) return;
    
        this.generationId = Date.now(); // 새 세대 ID 생성
        this.abortController = new AbortController();
        this.restoreOriginalTitle();
        
        console.log(`[AutoRefresher] 새 세대(${this.generationId}) 시작. 첫 확인을 예약합니다.`);
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
            this.abortController.abort(); // 진행 중인 fetch 요청 취소
            this.abortController = null;
        }
        this.restoreOriginalTitle();
    },

    /**
     * 다음 새 글 확인을 스케줄링합니다.
     * 서버 부하 분산을 위해 요청 간격에 약간의 무작위 변동(jitter)을 줍니다.
     * @param {number} currentGenerationId - 현재 실행 중인 세대의 ID.
     */
    scheduleNextCheck(currentGenerationId: number): void {
        if (currentGenerationId !== this.generationId) return; // 이전 세대의 작업이면 무시

        const baseInterval = this.settingsStore!.autoRefreshInterval * 1000;
        const jitter = (Math.random() - 0.5) * baseInterval * 0.3; // ±15% 변동
        const nextInterval = baseInterval + jitter;

        console.log(`[AutoRefresher] 다음 확인까지 약 ${Math.round(nextInterval / 1000)}초 남음.`);

        this.timerId = window.setTimeout(() => {
            this.checkNewPosts(currentGenerationId);
        }, nextInterval);
    },

    /**
     * 페이지 제목을 원래대로 복원하고, 새 글 카운트를 초기화합니다.
     */
    restoreOriginalTitle(): void {
        if (document.title !== this.originalTitle) {
            document.title = this.originalTitle;
        }
        this.newPostCountInTitle = 0;
    },

    /**
     * 서버에서 최신 게시글 목록을 가져와 현재 페이지와 비교하고, 변경 사항을 DOM에 적용합니다.
     * @param {number} currentGenerationId - 현재 실행 중인 세대의 ID.
     */
    async checkNewPosts(currentGenerationId: number): Promise<void> {
        // 1. 세대 ID 및 의존성 확인
        if (currentGenerationId !== this.generationId || !this.postsModule || !this.eventsModule) {
            console.warn(`[AutoRefresher] 오래된 세대 작업(${currentGenerationId})이거나 의존성이 없어 중단됩니다.`);
            return;
        }

        const urlAtRequestTime = Gallery.getListUrlForCurrentContext();
        if (!urlAtRequestTime) return;

        try {
            // 2. fetch 요청 (AbortController 시그널 포함)
            const response = await fetch(urlAtRequestTime, {
                signal: this.abortController!.signal,
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
                },
            });

            // 3. 응답 도착 후, 세대 ID 및 URL 이중 검증 (사용자가 그 사이 다른 페이지로 이동했을 수 있음)
            if (currentGenerationId !== this.generationId || urlAtRequestTime !== Gallery.getListUrlForCurrentContext()) {
                return;
            }
            // 4. 페이지 이동이 시작되었는지 최종 확인 (DOM 변경 전 최후의 방어선)
            if (this.eventsModule.isPageLoading) {
                console.warn("[AutoRefresher] 페이지 이동이 감지되어 DOM 수정을 중단합니다.");
                return;
            }

            if (!response.ok) throw new Error(`HTTP 오류! 상태: ${response.status}`);
            
            const text = await response.text();
            const parser = new DOMParser();
            const fetchedDoc = parser.parseFromString(text, 'text/html');

            // --- 모든 검증 통과: 안전하게 DOM 업데이트 로직 실행 ---

            // 5. 가져온 데이터에서 댓글 정보 가공 (Map으로 저장하여 빠른 조회)
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

            // 6. 현재 페이지의 댓글 수 업데이트
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

                        if (newData.html) { // 새 데이터에 댓글 존재
                            if (currentReplyBox) { // 기존에도 댓글 존재 -> 개수 비교 후 업데이트
                                if (currentReplyBox.textContent !== newData.countText) {
                                    currentReplyBox.innerHTML = `<span class="reply_num">${newData.countText}</span>`;
                                    // 시각적 효과
                                    currentReplyBox.style.transition = 'none';
                                    currentReplyBox.style.color = '#ff6600';
                                    setTimeout(() => {
                                        currentReplyBox.style.transition = 'color 0.5s ease';
                                        currentReplyBox.style.color = '';
                                    }, 100);
                                }
                            } else { // 기존에 댓글 없음 -> 새로 추가
                                titleCell.insertAdjacentHTML('beforeend', ` ${newData.html}`);
                            }
                        } else { // 새 데이터에 댓글 없음
                            if (currentReplyBox) { // 기존에 댓글 있었음 -> 삭제
                                currentReplyBox.remove();
                            }
                        }
                    }
                });
            }

            // 7. 새로운 게시글 처리
            const fetchedTbody = fetchedDoc.querySelector('table.gall_list tbody');
            if (!currentTbody || !fetchedTbody) return;

            // 현재 페이지의 가장 최신 글 번호 찾기
            let latestPostNumber = 0;
            currentTbody.querySelectorAll('tr').forEach(row => {
                if (this.postsModule!.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                    const numCell = row.querySelector('td.gall_num');
                    if (numCell && !numCell.querySelector('.sp_img.crt_icon')) {
                        const num = parseInt(numCell.textContent?.trim().replace(/\[.*?\]\s*/, '') ?? '0', 10);
                        if (!isNaN(num) && num > latestPostNumber) latestPostNumber = num;
                    }
                }
            });

            // 가져온 데이터에서 최신 글 번호보다 큰 글들을 '새로운 글'로 간주
            const newPostRows: HTMLTableRowElement[] = [];
            fetchedTbody.querySelectorAll('tr').forEach(row => {
                if (this.postsModule!.isValidPost(row.querySelector('td.gall_num'), row.querySelector('td.gall_tit'), row.querySelector('td.gall_subject'))) {
                    const num = parseInt(row.querySelector('td.gall_num')!.textContent!.trim().replace(/\[.*?\]\s*/, ''), 10);
                    if (num > latestPostNumber) newPostRows.push(row as HTMLTableRowElement);
                }
            });

            if (newPostRows.length > 0) {
                console.log(`[AutoRefresher] ${newPostRows.length}개의 새 글 발견.`);
                if (!document.hasFocus()) {
                    this.newPostCountInTitle += newPostRows.length;
                    document.title = `(${this.newPostCountInTitle}) ${this.originalTitle}`;
                }
                this.insertAndTrimPosts(currentTbody, newPostRows);
            }

            // 8. 성공적으로 완료 후, 다음 확인 예약
            this.scheduleNextCheck(currentGenerationId);

        } catch (error) {
            // 9. 강력한 오류 처리
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    // 사용자가 의도적으로 중지/이동한 경우이므로 조용히 종료
                    console.log(`[AutoRefresher] Fetch (세대: ${currentGenerationId})가 중단되었습니다.`);
                } else if (error.message.includes('Failed to fetch')) {
                    // 네트워크 문제 등 일시적 오류일 수 있으므로, 다음 주기를 기다림
                    console.warn(`[AutoRefresher] 'Failed to fetch' 오류 발생. 다음 주기에 재시도합니다.`, error);
                    this.scheduleNextCheck(currentGenerationId);
                } else {
                    // 그 외 서버 오류(404, 500), 파싱 오류 등 심각한 문제
                    console.error('[AutoRefresher] 예기치 않은 오류 발생:', error);
                    this.stop(); // 새로고침 완전 중지
                    UI.showAlert('새 글 확인 중 오류가 발생하여 자동 새로고침을 중지합니다.');
                }
            } else {
                // Error 객체가 아닌 다른 타입의 예외 처리
                console.error('[AutoRefresher] 알 수 없는 타입의 오류 발생:', error);
                this.stop();
            }
        }
    },

    /**
     * 새로운 게시글 행들을 테이블 상단에 삽입하고, 오래된 행들을 제거하여 50개를 유지합니다.
     * @param {HTMLTableSectionElement} targetTbody - 게시글을 삽입/제거할 `<tbody>` 요소.
     * @param {HTMLTableRowElement[]} newRows - 새로 삽입할 `<tr>` 요소들의 배열.
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

        // 새 글들을 최상단 유효 게시글 앞에 삽입
        newRows.reverse().forEach(row => {
            row.classList.add('new-post-highlight');
            targetTbody.insertBefore(row, firstValidPostRow);
        });

        // 하이라이트 효과 적용
        if (document.hasFocus()) {
            const insertedRows = targetTbody.querySelectorAll<HTMLTableRowElement>('.new-post-highlight');
            insertedRows.forEach(row => {
                row.classList.add('highlight-start');
                setTimeout(() => {
                    row.classList.remove('new-post-highlight', 'highlight-start');
                }, 2500);
            });
        }

        // 게시글 50개 유지 (오래된 글 제거)
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

        // 숫자 라벨, 날짜 포맷 등 기능 재적용
        this.postsModule.addNumberLabels();
        this.postsModule.formatDates();
    }
};

export default AutoRefresher;