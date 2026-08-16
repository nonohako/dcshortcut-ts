/**
 * @interface FavoriteGalleryInfo
 * @description 즐겨찾기된 갤러리 정보를 담는 인터페이스.
 * 이 타입은 프로젝트 전반에서 일관되게 사용됩니다.
 */
export interface FavoriteGalleryInfo {
  name: string;
  galleryId: string;
  galleryType: 'board' | 'mgallery' | 'mini' | 'web';
  /** 일반 웹페이지 즐겨찾기의 이동 주소. 기존 갤러리 데이터에는 존재하지 않습니다. */
  url?: string;
}

/**
 * 숫자는 기존처럼 Alt+숫자로 해석하고, 그 외 값은 정규화된 키 조합으로 저장합니다.
 */
export type FavoriteShortcut = string;

export interface FavoriteItem extends FavoriteGalleryInfo {
  id: string;
  shortcut: FavoriteShortcut | null;
}

export interface FavoriteFolder {
  id: string;
  name: string;
  favorites: FavoriteItem[];
}

export interface FavoritesData {
  version: 2;
  folders: FavoriteFolder[];
}

export interface FavoritesStateSnapshot {
  data: FavoritesData;
  activeFolderId: string;
}

export type LegacyFavoriteGalleries = Record<string, FavoriteGalleryInfo>;
export type LegacyFavoriteProfiles = Record<string, LegacyFavoriteGalleries>;

/**
 * @type PageNavigationMode
 * @description 게시판 페이지 이동 방식을 정의하는 타입.
 */
export type PageNavigationMode = 'ajax' | 'full' | 'infinite';

/**
 * @type ThemeMode
 * @description 확장 UI 테마 모드.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

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
