// src/types.ts

/**
 * 즐겨찾기에 등록된 개별 갤러리 정보
 */
export interface Favorite {
    galleryType: 'board' | 'mini' | 'mgallery' | 'person';
    galleryId: string;
    name: string;
  }
  
  /**
   * 즐겨찾기 프로필 (폴더) 구조
   * 키는 '0'부터 '9'까지의 숫자 문자열이며, 값은 Favorite 객체입니다.
   * @example { "1": { galleryType: 'mini', galleryId: '...', name: '...' } }
   */
  export interface FavoriteProfile {
    [key: string]: Favorite;
  }
  
  /**
   * 모든 즐겨찾기 프로필들을 담는 최상위 객체
   * 키는 프로필의 이름(예: '기본', '업무용')이며, 값은 FavoriteProfile 객체입니다.
   */
  export interface Profiles {
    [profileName: string]: FavoriteProfile;
  }
  
  /**
   * 단축키 액션의 종류
   * settingsStore의 defaultShortcutKeys 객체의 키들을 기반으로 합니다.
   */
  export type ShortcutAction = 
    | 'W' | 'C' | 'D' | 'R' | 'Q' | 'E' | 'F' | 'G' 
    | 'A' | 'S' | 'Z' | 'X'
    | 'PrevProfile' | 'NextProfile'
    | 'SubmitComment' | 'SubmitImagePost' | 'ToggleModal';
  
  /**
   * 사용자 설정이 가능한 단축키의 키 값을 담는 객체
   * 키는 `shortcut{Action}Key` 형태입니다. (예: `shortcutWKey`)
   */
  export type ShortcutKeys = {
    [K in `shortcut${ShortcutAction}Key`]?: string;
  };
  
  /**
   * 사용자 설정이 가능한 단축키의 활성화 여부를 담는 객체
   * 키는 `shortcut{Action}Enabled` 형태입니다. (예: `shortcutWEnabled`)
   */
  export type ShortcutEnabled = {
    [K in `shortcut${ShortcutAction}Enabled`]?: boolean;
  };
  
  /**
  * settingsStore에서 관리하는 전체 설정 상태
  * 이 인터페이스는 Pinia 스토어의 상태를 정의할 때 사용됩니다.
  */
  export interface SettingsState {
    pageNavigationMode: 'ajax' | 'full';
    shortcutEnabled: ShortcutEnabled;
    shortcutKeys: ShortcutKeys;
    altNumberEnabled: boolean;
    macroZEnabled: boolean;
    macroXEnabled: boolean;
    shortcutDRefreshCommentEnabled: boolean;
    macroInterval: number;
    favoritesPreviewEnabled: boolean;
    favoritesPreviewOpacity: number;
    autoRefreshEnabled: boolean;
    autoRefreshInterval: number;
    shortcutSubmitCommentKeyEnabled: boolean;
    shortcutSubmitImagePostKeyEnabled: boolean;
    shortcutToggleModalKeyEnabled: boolean;
    pauseOnInactiveEnabled: boolean; // 이전에 추가된 기능 포함
  }