/**
 * @interface FavoriteGalleryInfo
 * @description 즐겨찾기된 갤러리 정보를 담는 인터페이스.
 * 이 타입은 프로젝트 전반에서 일관되게 사용됩니다.
 */
export interface FavoriteGalleryInfo {
  name: string;
  galleryId: string;
  galleryType: 'board' | 'mgallery' | 'mini';
}

/**
 * @type FavoriteGalleries
 * @description 갤러리 ID를 키로 사용하는 즐겨찾기 갤러리 목록 타입.
 */
export type FavoriteGalleries = Record<string, FavoriteGalleryInfo>;

/**
 * @type FavoriteProfiles
 * @description 프로필 이름을 키로 사용하는 전체 즐겨찾기 프로필 데이터 타입.
 */
export type FavoriteProfiles = Record<string, FavoriteGalleries>;

/**
 * @type PageNavigationMode
 * @description 게시판 페이지 이동 방식을 정의하는 타입.
 */
export type PageNavigationMode = 'ajax' | 'full';
