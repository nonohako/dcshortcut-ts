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
export type PageNavigationMode = 'ajax' | 'full' | 'infinite';

/**
 * @interface DcconAliasTarget
 * @description 사용자 지정 디시콘 별칭에 매핑되는 대상 정보.
 */
export interface DcconAliasTarget {
  alias: string;
  packageIdx: string;
  detailIdx: string;
  title?: string;
  imageUrl?: string;
  updatedAt: number;
}

/**
 * @type DcconAliasMap
 * @description 정규화된 별칭 키를 기준으로 디시콘 대상 배열을 저장하는 타입.
 */
export type DcconAliasMap = Record<string, DcconAliasTarget[]>;
