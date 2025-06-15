import UI, { type GalleryInfo } from './UI';
import { useFavoritesStore } from '@/stores/favoritesStore';

// =================================================================
// Type Definitions (타입 정의)
// =================================================================

/**
 * @type GalleryType
 * @description DCinside 갤러리의 종류를 나타내는 리터럴 타입.
 */
type GalleryType = 'board' | 'mgallery' | 'mini' | 'person' | '';

/**
 * @interface CurrentGalleryInfo
 * @description 현재 페이지의 갤러리 정보를 담는 인터페이스.
 * @property {GalleryType} galleryType - 갤러리 종류
 * @property {string} galleryId - 갤러리 ID
 * @property {string} galleryName - 갤러리 이름
 */
interface CurrentGalleryInfo {
    galleryType: GalleryType;
    galleryId: string;
    galleryName: string;
}

/**
 * @interface PageContextInfo
 * @description 현재 페이지의 URL에서 파싱한 컨텍스트 정보를 담는 인터페이스.
 * @property {GalleryType} galleryType - 갤러리 종류
 * @property {string} galleryId - 갤러리 ID
 * @property {number} currentPage - 현재 페이지 번호
 * @property {boolean} isRecommendMode - 개념글 목록('개념글') 모드 여부
 */
interface PageContextInfo {
    galleryType: GalleryType;
    galleryId: string;
    currentPage: number;
    isRecommendMode: boolean;
}

/**
 * @description 즐겨찾기에 저장될 갤러리 데이터의 완전한 형태.
 * 이 타입은 `favoritesStore`와 `Storage` 모듈에서도 일관되게 사용되어야 합니다.
 */
interface FavoriteGalleryData extends GalleryInfo {
    name: string;
}

/**
 * @description Pinia의 `useFavoritesStore`의 반환 타입을 추론하여 정의합니다.
 * 이를 통해 스토어 인스턴스의 모든 속성과 메서드에 대한 타입 검사를 활성화합니다.
 */
type FavoritesStore = ReturnType<typeof useFavoritesStore>;


// =================================================================
// Gallery Module (갤러리 모듈)
// =================================================================

const Gallery = {
    /**
     * 현재 페이지가 새로고침 가능한 게시글 목록 페이지인지 확인합니다.
     * @returns {boolean} 새로고침 가능 여부
     */
    isRefreshablePage(): boolean {
        // URL을 검사하는 것보다, 실제 게시글 목록 테이블의 존재 여부로 판단하는 것이 더 정확합니다.
        return !!document.querySelector('table.gall_list tbody');
    },

    /**
     * 현재 컨텍스트에 맞는 '목록' 페이지의 전체 URL을 반환합니다.
     * 글 보기 페이지에 있다면, 해당 글의 목록 페이지 URL로 변환하여 반환합니다.
     * @returns {string} 목록 페이지 URL
     */
    getListUrlForCurrentContext(): string {
        const currentUrl = new URL(window.location.href);

        // 현재 경로가 글 보기('/view/') 페이지인 경우
        if (currentUrl.pathname.includes('/view/')) {
            // 경로를 목록('/lists/')으로 변경
            currentUrl.pathname = currentUrl.pathname.replace('/view/', '/lists/');
            // 글 번호에 해당하는 'no' 파라미터를 제거
            currentUrl.searchParams.delete('no');
        }

        return currentUrl.href;
    },

    /**
     * 현재 페이지의 갤러리 정보를 (타입, ID, 이름) 가져옵니다.
     * @returns {CurrentGalleryInfo} 현재 갤러리 정보 객체
     */
    getInfo(): CurrentGalleryInfo {
        const { galleryType, galleryId } = this.getPageInfo();
        if (!galleryId) {
            console.warn("getInfo: 갤러리 ID를 찾을 수 없습니다.");
            return { galleryType: '', galleryId: '', galleryName: '' };
        }

        let galleryName: string = galleryId; // 갤러리 이름을 찾지 못할 경우 ID를 기본값으로 사용

        // 1. 갤러리 이름이 포함된 <a> 요소를 선택합니다.
        const nameEl = document.querySelector<HTMLAnchorElement>('div.fl.clear h2 a');

        if (nameEl) {
            // 2. <a> 요소의 자식 노드 중 텍스트 노드(TEXT_NODE)만 필터링하여 텍스트를 추출합니다.
            //    (<a><span>이름</span></a> 와 같은 중첩 구조에서도 정확한 이름을 가져오기 위함)
            const nameFromTextNodes = Array.from(nameEl.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent?.trim() ?? '')
                .join('');

            // 3. 추출된 이름이 비어있지 않다면 사용합니다.
            if (nameFromTextNodes) {
                galleryName = nameFromTextNodes;
            } else {
                console.warn(`getInfo: '${galleryId}' 갤러리의 이름을 찾지 못했습니다. ID를 이름으로 사용합니다.`);
            }
        } else {
            console.error(`getInfo: 갤러리 이름 선택자('div.fl.clear h2 a')를 찾지 못했습니다. ID를 이름으로 사용합니다.`);
        }

        return { galleryType, galleryId, galleryName };
    },

    /**
     * 즐겨찾기 단축키(Alt+숫자)를 처리합니다.
     * - 키가 이미 등록되어 있으면: 해당 갤러리로 이동합니다.
     * - 키가 등록되어 있지 않으면: 현재 갤러리를 해당 키에 등록합니다.
     * @param {string} key - 처리할 키 (예: '1', '2', ...)
     * @param {FavoritesStore} favoritesStore - `useFavoritesStore`의 인스턴스
     */
    async handleFavoriteKey(key: string, favoritesStore: FavoritesStore): Promise<void> {
        try {
            // 1. 스토어에 해당 키가 등록되어 있는지 확인합니다.
            const keyExists = await favoritesStore.hasFavorite(key);

            if (keyExists) {
                // 2. 키가 존재하면, 해당 갤러리 정보를 가져와 페이지를 이동합니다.
                const galleryData = await favoritesStore.getFavorite(key);
                if (galleryData && 'galleryId' in galleryData && 'galleryType' in galleryData) {
                    // navigateToGallery는 galleryId와 galleryType을 필요로 합니다.
                    UI.navigateToGallery(galleryData as GalleryInfo);
                } else {
                    console.error(`[handleFavoriteKey] 키 '${key}'는 존재하지만 유효한 갤러리 데이터를 가져오지 못했습니다.`);
                    UI.showAlert("즐겨찾기 정보를 가져오는 중 오류 발생");
                }
            } else {
                // 3. 키가 존재하지 않으면, 현재 갤러리 정보를 즐겨찾기에 새로 추가합니다.
                const info = this.getInfo();
                if (info.galleryId && info.galleryType) {
                    const favoriteData: FavoriteGalleryData = {
                        galleryType: info.galleryType as 'board' | 'mgallery' | 'mini', // 타입 단언
                        galleryId: info.galleryId,
                        name: info.galleryName
                    };
                    await favoritesStore.addOrUpdateFavorite(key, favoriteData);
                    UI.showAlert(`'${info.galleryName || info.galleryId}'이(가) ${key}번에 등록되었습니다.`);
                } else {
                    UI.showAlert('즐겨찾기 등록은 갤러리 페이지에서만 가능합니다.');
                }
            }
        } catch (error) {
            console.error('[handleFavoriteKey] 오류 발생:', error);
            if (error instanceof Error && error.message.includes('load favorites data')) {
                UI.showAlert("즐겨찾기 정보를 불러오는데 실패했습니다.");
            } else {
                UI.showAlert("즐겨찾기 처리 중 오류가 발생했습니다.");
            }
        }
    },

    /**
     * 현재 URL을 분석하여 페이지 컨텍스트 정보(갤러리 타입, ID, 페이지 번호 등)를 반환합니다.
     * @returns {PageContextInfo} 페이지 컨텍스트 정보
     */
    getPageInfo(): PageContextInfo {
        const { href, pathname } = window.location;
        
        let galleryType: GalleryType = 'board'; // 기본값은 정식 갤러리
        if (pathname.startsWith('/mgallery/')) galleryType = 'mgallery';
        else if (pathname.startsWith('/mini/')) galleryType = 'mini';
        else if (pathname.startsWith('/person/')) galleryType = 'person';
        // URL에 갤러리 ID가 없는 경우 (예: DC 메인), galleryType은 'board'로 유지되지만 galleryId는 비어있게 됨

        const galleryIdMatch = href.match(/id=([^&]+)/);
        const galleryId = galleryIdMatch ? galleryIdMatch[1] : '';

        const currentPageMatch = href.match(/page=(\d+)/);
        const currentPage = currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1;

        const isRecommendMode = href.includes('exception_mode=recommend');

        return { galleryType, galleryId, currentPage, isRecommendMode };
    },

    /**
     * 현재 갤러리의 기본 목록 URL을 생성합니다.
     * @returns {string | null} 목록 URL 또는 갤러리 ID가 없을 경우 null
     */
    getBaseListUrl(): string | null {
        const { galleryType, galleryId } = this.getPageInfo();
        if (!galleryId) return null;
        const baseUrl = 'https://gall.dcinside.com';
        const listPath = 'board/lists';
        const galleryPrefix = galleryType === 'board' ? '' : `/${galleryType}`;
        return `${baseUrl}${galleryPrefix}/${listPath}?id=${galleryId}`;
    },

    /**
     * 현재 갤러리의 개념글 목록 URL을 생성합니다.
     * @returns {string | null} 개념글 목록 URL 또는 갤러리 ID가 없을 경우 null
     */
    getRecommendListUrl(): string | null {
        const baseListUrl = this.getBaseListUrl();
        if (!baseListUrl) return null;
        return `${baseListUrl}&exception_mode=recommend`;
    }
};

export default Gallery;