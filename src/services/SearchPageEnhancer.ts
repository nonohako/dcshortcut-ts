// src/services/SearchPageEnhancer.ts

/**
 * @type SortOrder
 * @description DC인사이드 통합 검색의 정렬 순서를 정의하는 타입.
 */
type SortOrder = 'latest' | 'accuracy';

/**
 * @module SearchPageEnhancer
 * @description DC인사이드 통합 검색 페이지('/combine')의 기능을 개선하는 모듈.
 */
const SearchPageEnhancer = {
    /**
     * @property {boolean} isEnhanced - 기능이 이미 적용되었는지 여부를 추적하는 플래그.
     */
    isEnhanced: false as boolean,

    /**
     * 모듈을 초기화합니다.
     */
    init(): void {
        if (window.location.hostname !== 'search.dcinside.com') {
            return;
        }
        const pathParts = window.location.pathname.split('/').filter(p => p);
        if (pathParts[0] === 'combine') {
            console.log('[SearchEnhancer] 통합 검색 페이지 감지. 기능 개선을 시작합니다...');
            this.enhanceCombinePage();
        }
    },

    /**
     * 통합 검색 페이지의 게시글 목록을 전체 목록으로 교체하는 비동기 함수.
     */
    async enhanceCombinePage(): Promise<void> {
        if (this.isEnhanced) return;
        this.isEnhanced = true;

        const currentUrl = new URL(window.location.href);
        const pathParts = currentUrl.pathname.split('/').filter(p => p);

        let sortOrder: SortOrder = 'latest';
        if (currentUrl.pathname.includes('/sort/accuracy')) {
            sortOrder = 'accuracy';
        }
        
        const query = pathParts[pathParts.length - 1];
        const targetUrl = `https://search.dcinside.com/post/p/1/sort/${sortOrder}/q/${query}`;

        try {
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error(`HTTP fetch 실패: ${response.status}`);
            const text = await response.text();
            
            const parser = new DOMParser();
            const doc: Document = parser.parseFromString(text, 'text/html');

            let currentPostList: HTMLUListElement | null = null;
            // [수정] querySelectorAll의 결과를 Array.from()으로 감싸 실제 배열로 변환합니다.
            const allLists = Array.from(document.querySelectorAll<HTMLUListElement>('ul.sch_result_list'));

            for (const ul of allLists) {
                const parentContainer = ul.closest('.integrate_cont');
                if (parentContainer && !parentContainer.classList.contains('news_result')) {
                    currentPostList = ul;
                    break;
                }
            }

            const newPostList = doc.querySelector<HTMLUListElement>('ul.sch_result_list');

            if (currentPostList && newPostList) {
                console.log('[SearchEnhancer] 교체할 게시글 목록 발견. 전체 데이터로 교체합니다.');
                currentPostList.replaceWith(newPostList);
            } else {
                console.warn('[SearchEnhancer] 교체할 게시글 목록을 찾지 못했습니다.');
            }

        } catch (error) {
            console.error('[SearchEnhancer] 통합 검색 페이지 개선 중 오류 발생:', error);
        }
    }
};

export default SearchPageEnhancer;