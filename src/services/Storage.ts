import type { FavoriteProfiles, PageNavigationMode } from '@/types';
import {
    FAVORITE_GALLERIES_KEY,
    PAGE_NAVIGATION_MODE_KEY,
    MACRO_INTERVAL_KEY,
} from './Global';

/**
 * @module Storage
 * @description Chrome 확장 프로그램의 `chrome.storage.local`을 사용하여 데이터를 관리하는 모듈.
 * 모든 메서드는 Promise를 반환하여 비동기적으로 동작합니다.
 * webextension-polyfill 라이브러리를 통해 `chrome.*` API는 다른 브라우저(예: Firefox)의 `browser.*` API와 호환됩니다.
 */
export type { PageNavigationMode };

const Storage = {
    /**
     * chrome.storage.local에 값을 저장하는 비동기 헬퍼 함수
     * @param {string} key - 저장할 데이터의 키
     * @param {T} value - 저장할 데이터 값
     * @returns {Promise<void>} 저장이 완료되면 resolve되는 Promise
     */
    async setData<T>(key: string, value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                // chrome.runtime.lastError는 콜백 함수 내에서만 유효합니다.
                if (chrome.runtime.lastError) {
                    console.error('Storage.setData Error:', chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                resolve();
            });
        });
    },

    /**
     * chrome.storage.local에서 값을 가져오는 비동기 헬퍼 함수
     * @param {string} key - 가져올 데이터의 키
     * @param {T} defaultValue - 키에 해당하는 값이 없을 경우 반환될 기본값
     * @returns {Promise<T>} 저장된 값 또는 기본값을 resolve하는 Promise
     */
    async getData<T>(key: string, defaultValue: T): Promise<T> {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get([key], result => {
                if (chrome.runtime.lastError) {
                    console.error('Storage.getData Error:', chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                // result 객체에 키가 존재하면 해당 값을, 그렇지 않으면 기본값을 반환합니다.
                // Nullish Coalescing Operator(??)는 값이 null 또는 undefined일 경우 오른쪽 피연산자를 반환합니다.
                resolve((result[key] as T) ?? defaultValue);
            });
        });
    },

    // --- 즐겨찾기 갤러리 미리보기 ---
    async getFavoritesPreviewEnabled(): Promise<boolean> {
        const defaultValue = true;
        return await this.getData('favoritesPreviewEnabled', defaultValue);
    },

    async saveFavoritesPreviewEnabled(enabled: boolean): Promise<void> {
        try {
            await this.setData('favoritesPreviewEnabled', enabled);
        } catch (error) {
            console.error('Failed to save favoritesPreviewEnabled:', error);
        }
    },

    async getFavoritesPreviewOpacity(): Promise<number> {
        const defaultValue = 0.85; // 기본 투명도 85%
        return await this.getData('favoritesPreviewOpacity', defaultValue);
    },

    async saveFavoritesPreviewOpacity(opacity: number): Promise<void> {
        try {
            // 숫자형으로 변환 후 유효성 검사
            const value = Number(opacity);
            if (!isNaN(value) && value >= 0.1 && value <= 1.0) {
                await this.setData('favoritesPreviewOpacity', value);
            } else {
                console.warn(`Invalid preview opacity value: ${opacity}. Not saved.`);
            }
        } catch (error) {
            console.error('Failed to save favoritesPreviewOpacity:', error);
        }
    },

    // --- 게시글 목록 자동 새로고침 ---
    async getAutoRefreshEnabled(): Promise<boolean> {
        const defaultValue = false; // 기본값: 비활성화
        return await this.getData('autoRefreshEnabled', defaultValue);
    },

    async saveAutoRefreshEnabled(enabled: boolean): Promise<void> {
        try {
            await this.setData('autoRefreshEnabled', enabled);
        } catch (error) {
            console.error('Failed to save autoRefreshEnabled:', error);
        }
    },

    async getAutoRefreshInterval(): Promise<number> {
        const defaultValue = 10; // 기본 간격: 10초
        const value = await this.getData('autoRefreshInterval', defaultValue);
        // 저장된 값이 유효하지 않을 경우를 대비해 최소 1초를 보장합니다.
        return Math.max(1, Number(value) || defaultValue);
    },

    async saveAutoRefreshInterval(interval: number): Promise<void> {
        try {
            const value = Number(interval);
            if (!isNaN(value) && value >= 1) {
                await this.setData('autoRefreshInterval', value);
            } else {
                console.warn(`Invalid auto-refresh interval: ${interval}. Not saved.`);
            }
        } catch (error) {
            console.error('Failed to save autoRefreshInterval:', error);
        }
    },

    // --- 비활성 탭에서 자동 새로고침 일시정지 ---
    async getPauseOnInactiveEnabled(): Promise<boolean> {
        const defaultValue = true; // 기본값: 활성화
        return await this.getData('pauseOnInactiveEnabled', defaultValue);
    },

    async savePauseOnInactiveEnabled(enabled: boolean): Promise<void> {
        try {
            await this.setData('pauseOnInactiveEnabled', enabled);
        } catch (error) {
            console.error('Failed to save pauseOnInactiveEnabled:', error);
        }
    },

    // --- 매크로 실행 간격 ---
    async getMacroInterval(): Promise<number> {
        const defaultValue = 5000; // 기본값: 5초 (5000ms)
        const value = await this.getData(MACRO_INTERVAL_KEY, defaultValue);
        // 최소 500ms를 보장하여 너무 빠른 실행을 방지합니다.
        return Math.max(500, Number(value) || defaultValue);
    },

    async saveMacroInterval(interval: number): Promise<void> {
        try {
            const value = Number(interval);
            if (!isNaN(value) && value >= 500) {
                await this.setData(MACRO_INTERVAL_KEY, value);
            } else {
                console.warn(`Invalid macro interval value: ${interval}. Not saved.`);
            }
        } catch (error) {
            console.error('Failed to save macro interval:', error);
        }
    },

    // --- 페이지 이동 방식 ---
    async getPageNavigationMode(): Promise<PageNavigationMode> {
        const defaultValue: PageNavigationMode = 'ajax';
        return await this.getData(PAGE_NAVIGATION_MODE_KEY, defaultValue);
    },

    async savePageNavigationMode(mode: PageNavigationMode): Promise<void> {
        if (mode !== 'ajax' && mode !== 'full') return;
        await this.setData(PAGE_NAVIGATION_MODE_KEY, mode);
    },

    // --- 즐겨찾기 갤러리 목록 ---
    // [수정] 반환 타입을 FavoriteProfiles로 변경하여 프로필 구조 전체를 다루도록 함
    async getFavorites(): Promise<FavoriteProfiles> {
        const defaultValue: FavoriteProfiles = {};
        const data = await this.getData(FAVORITE_GALLERIES_KEY, defaultValue);
        return data && typeof data === 'object' ? data : defaultValue;
    },


    // [수정] 받는 인자 타입을 FavoriteProfiles로 변경
    async saveFavorites(favorites: FavoriteProfiles): Promise<void> {
        await this.setData(FAVORITE_GALLERIES_KEY, favorites);
    },


    // --- Alt + 숫자 단축키 ---
    async getAltNumberEnabled(): Promise<boolean> {
        const defaultValue = true;
        return await this.getData('altNumberEnabled', defaultValue);
    },

    async saveAltNumberEnabled(enabled: boolean): Promise<void> {
        try {
            await this.setData('altNumberEnabled', enabled);
        } catch (error) {
            console.error('Failed to save altNumberEnabled:', error);
        }
    },

    // --- 일반 단축키 설정 (활성화 여부) ---
    async getShortcutEnabled(key: string): Promise<boolean> {
        const defaultValue = true;
        // getData의 반환 타입은 Promise<boolean>으로 명확히 간주됩니다.
        return await this.getData(key, defaultValue);
    },

    async saveShortcutEnabled(key: string, enabled: boolean): Promise<void> {
        try {
            await this.setData(key, enabled);
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
        }
    },

    // --- 일반 단축키 설정 (키 값) ---
    async getShortcutKey(key: string): Promise<string | null> {
        const defaultValue = null;
        return await this.getData(key, defaultValue);
    },

    async saveShortcutKey(key: string, value: string | null): Promise<void> {
        try {
            await this.setData(key, value);
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
        }
    },

    // --- D키 댓글 새로고침 단축키 ---
    async getShortcutDRefreshCommentEnabled(): Promise<boolean> {
        const defaultValue = true; // 기본값: 활성화
        return await this.getData('shortcutDRefreshCommentEnabled', defaultValue);
    },

    async saveShortcutDRefreshCommentEnabled(enabled: boolean): Promise<void> {
        try {
            await this.setData('shortcutDRefreshCommentEnabled', enabled);
        } catch (error) {
            console.error('Failed to save shortcutDRefreshCommentEnabled:', error);
        }
    },
};

// 모듈을 외부에서 사용할 수 있도록 export 합니다.
export default Storage;